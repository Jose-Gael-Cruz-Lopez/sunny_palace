import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

// Public, Turnstile-gated insert proxy for the moderated/public forms:
//   coffee_chat            -> coffee_chat_profiles  (multipart: optional avatar file)
//   resume                 -> resume_submissions     (multipart: required resume PDF, optional avatar)
//   opportunity            -> opportunities
//   panelist               -> panelists
//   subscriber              -> subscribers   (newsletter signup; anon INSERT revoked in migration 017)
//   template_request       -> template_requests           (anon INSERT revoked in migration 019)
//   bridge_year_suggestion -> bridge_year_suggestions      (anon INSERT revoked in migration 019)
//   interview_prep_request -> interview_prep_requests      (anon INSERT revoked in migration 019)
//   panel_suggestion       -> panel_suggestions            (anon INSERT revoked in migration 019)
//   linkedin_episode_request -> linkedin_episode_requests  (anon INSERT revoked in migration 019)
//   bridge_year_subscriber -> bridge_year_subscribers      (anon INSERT revoked in migration 019)
//
// The browser no longer inserts these rows directly (anon INSERT is revoked in
// migration 007). All inserts flow through here, run with the service role, and
// require a valid Cloudflare Turnstile token. Server-side we force status/visibility
// fields and whitelist columns so a crafted client payload can't self-approve a row.
//
// coffee_chat / resume (issue #79): these two types carry file uploads (avatar,
// resume PDF). The browser used to upload straight to Supabase Storage with the
// anon key BEFORE this function ever ran, so the Turnstile gate only protected the
// database row, not the storage write — a script could hit the storage REST API
// directly and never touch Turnstile at all. Now the client sends the file(s) here
// as multipart/form-data, we verify Turnstile FIRST, upload via the service-role
// client, and only then build/insert the row (deleting any just-uploaded file if a
// later step fails, so a rejected submission never leaves an orphaned object).
// Direct anonymous storage INSERTs are revoked in migration 022 — this function is
// the only remaining path into the `avatars` / `resumes` buckets.

// Allow-list of origins permitted to make cross-origin requests. Comma-separated
// in ALLOWED_ORIGINS (e.g. `https://fromcampuscareer.com`). When unset, CORS
// fails closed (no ACAO header) unless ALLOW_ALL_ORIGINS_DEV=true opts into
// the permissive `*` fallback for local dev.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean)
// Explicit opt-in for the permissive local-dev CORS fallback (issue #92: CORS
// previously failed OPEN — defaulting to `*` — whenever ALLOWED_ORIGINS was
// unset. Now it fails CLOSED unless this flag is deliberately set.)
const ALLOW_ALL_ORIGINS_DEV = Deno.env.get('ALLOW_ALL_ORIGINS_DEV') === 'true'
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET')
const MAX_BODY_BYTES = 1_000_000 // ~1MB — plain JSON rows, no file uploads.
// Multipart bodies (coffee_chat / resume) can carry a resume PDF (<=5MB) and an
// avatar (<=2MB) plus a little form overhead — cap well above that worst case
// (~7.1MB) but comfortably under the platform's request-size ceiling.
const MAX_MULTIPART_BYTES = 8_000_000

// Server-side email format check at the trust boundary. Must match the DB-layer
// CHECK constraint (migration 011) and the other edge functions.
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Cap long free-text fields so a crafted client can't push a 100k-char value
// through to the DB. Mirrors the char_length caps in migration 011.
const MAX_LONGTEXT = 5000
// Cap short identifier-ish fields (names, titles, emails, ...). Mirrors the
// char_length(...) <= 500 caps in migration 011 for the columns that have
// one; also applied to `email`, which migration 011 checks for FORMAT but,
// on every table, never bounds by length (issue #92).
const MAX_SHORTTEXT = 500

// Storage constraints for the two upload types. Mirror the bucket config in
// migration 009 (file_size_limit / allowed_mime_types) — enforced here too since
// bucket-level limits alone don't stop an attacker from probing with malformed
// requests, and we need the MIME→extension mapping regardless.
const AVATAR_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // 2MB — matches the avatars bucket limit
const RESUME_MAX_BYTES = 5 * 1024 * 1024 // 5MB — matches the resumes bucket limit

// Build CORS headers per request: echo the request Origin only if it's allow-listed;
// otherwise omit the ACAO header (fail closed), unless ALLOW_ALL_ORIGINS_DEV=true.
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (ALLOWED_ORIGINS.length > 0) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      base['Access-Control-Allow-Origin'] = origin
    }
    // else: omit the ACAO header entirely (browser will block cross-origin)
  } else if (ALLOW_ALL_ORIGINS_DEV) {
    // No allow-list configured, but the operator explicitly opted into the
    // permissive local-dev fallback.
    base['Access-Control-Allow-Origin'] = '*'
  }
  // else: ALLOWED_ORIGINS unset and the dev fallback isn't enabled — fail
  // CLOSED by omitting the ACAO header, rather than defaulting to `*`.
  return base
}

// JSON response helper bound to a request's per-request CORS headers.
const jsonWith = (corsHeaders: Record<string, string>) =>
  (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

// Read a request body up to maxBytes, counting real bytes (not UTF-16 code
// units) as they stream in, and bail out as soon as the cap is exceeded
// instead of buffering the whole — potentially oversized — body into memory
// first. Returns null on any body larger than maxBytes.
async function readBodyLimited(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(buf)
}

// Verify a Cloudflare Turnstile token. Returns true only on a verified human.
async function verifyTurnstile(token: unknown, remoteip?: string | null): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.error('TURNSTILE_SECRET is not set — rejecting submission')
    return false
  }
  if (!token || typeof token !== 'string') return false
  try {
    const form = new URLSearchParams()
    form.set('secret', TURNSTILE_SECRET)
    form.set('response', token)
    if (remoteip) form.set('remoteip', remoteip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const data = await res.json()
    return data?.success === true
  } catch (err) {
    console.error('Turnstile verify error:', err)
    return false
  }
}

// Whitelisted, type-coercing column maps. The client can ONLY influence these
// fields; everything else (status, public_profile, like_count, view_count, ids,
// timestamps) is set server-side or left to DB defaults.
const TABLE_BY_TYPE: Record<string, string> = {
  coffee_chat: 'coffee_chat_profiles',
  resume: 'resume_submissions',
  opportunity: 'opportunities',
  panelist: 'panelists',
  subscriber: 'subscribers',
  template_request: 'template_requests',
  bridge_year_suggestion: 'bridge_year_suggestions',
  interview_prep_request: 'interview_prep_requests',
  panel_suggestion: 'panel_suggestions',
  linkedin_episode_request: 'linkedin_episode_requests',
  bridge_year_subscriber: 'bridge_year_subscribers',
}

const str = (v: unknown) => (typeof v === 'string' ? v : null)
const trimOrNull = (v: unknown) => {
  const s = str(v)
  const t = s?.trim()
  return t ? t : null
}
const strArray = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => String(x)) : []

function buildRow(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'coffee_chat':
      return {
        name: trimOrNull(payload.name),
        pronouns: trimOrNull(payload.pronouns),
        email: trimOrNull(payload.email),
        linkedin_url: trimOrNull(payload.linkedin_url),
        role_title: trimOrNull(payload.role_title),
        location: trimOrNull(payload.location),
        role_function: strArray(payload.role_function),
        identity_tags: strArray(payload.identity_tags),
        topics: trimOrNull(payload.topics),
        capacity: trimOrNull(payload.capacity),
        // avatar_url is never trusted from the client — it's set below, after a
        // server-verified upload (issue #79), overwriting whatever this is.
        avatar_url: null,
        consented_at: new Date().toISOString(),
        // Force server-side — coffee-chat profiles auto-publish (like opportunities
        // and resumes) so they appear on the directory immediately. The board reads
        // status='approved' AND public_profile=true, so both are required.
        status: 'approved',
        public_profile: true,
      }
    case 'resume':
      return {
        handle: trimOrNull(payload.handle),
        email: trimOrNull(payload.email),
        linkedin_url: trimOrNull(payload.linkedin_url),
        role_title: trimOrNull(payload.role_title),
        role_type: trimOrNull(payload.role_type),
        stage: trimOrNull(payload.stage),
        target_companies: str(payload.target_companies), // free-text column, not an array
        background_tags: strArray(payload.background_tags),
        allow_download: payload.allow_download === true,
        allow_annotation: payload.allow_annotation === true,
        story: trimOrNull(payload.story),
        // file_name / avatar_url are never trusted from the client — they're set
        // below, after server-verified uploads (issue #79).
        file_name: null,
        avatar_url: null,
        // Force server-side — resumes are auto-published (status 'approved') so they
        // appear in the library immediately. Coffee-chat/panelists stay moderated.
        status: 'approved',
      }
    case 'opportunity':
      return {
        role: trimOrNull(payload.role),
        company: trimOrNull(payload.company),
        role_type: trimOrNull(payload.role_type),
        link: trimOrNull(payload.link),
        deadline: trimOrNull(payload.deadline),
        eligibility: trimOrNull(payload.eligibility),
        why: trimOrNull(payload.why),
        submitted_by: trimOrNull(payload.submitted_by),
        location: trimOrNull(payload.location),
        pay: trimOrNull(payload.pay),
        // Force server-side — opportunities enter the moderation queue, same as
        // panelist applications (issue #94). An admin promotes to 'approved' or
        // 'featured' via the queries in supabase/admin-queries.sql before the row
        // becomes public (see the opportunities_read_approved RLS policy).
        status: 'pending',
      }
    case 'panelist':
      return {
        name: trimOrNull(payload.name),
        email: trimOrNull(payload.email),
        linkedin_url: trimOrNull(payload.linkedin_url),
        role_title: trimOrNull(payload.role_title),
        topic: trimOrNull(payload.topic),
        interested_in: trimOrNull(payload.interested_in),
        notes: trimOrNull(payload.notes),
        // Force server-side — panelist applications enter the moderation queue:
        status: 'pending',
      }
    case 'subscriber': {
      // Newsletter signup. Whitelist ONLY email + source; never let the client set
      // `name`, `confirmed`, `confirmation_token`, etc. email is normalized
      // (trimmed + lowercased) so the UNIQUE(email) constraint dedupes case-variants;
      // source is trimmed and capped so a crafted client can't push a huge value.
      const email = trimOrNull(payload.email)
      const source = trimOrNull(payload.source)
      return {
        email: email ? email.toLowerCase() : null,
        source: source ? source.slice(0, 200) : null,
      }
    }
    case 'template_request': {
      // Career Templates "request a template" form. email is optional/nullable.
      const request = trimOrNull(payload.request)
      const email = trimOrNull(payload.email)
      const category = trimOrNull(payload.category)
      return {
        request: request ? request.slice(0, 5000) : null,
        email: email ? email.toLowerCase().slice(0, 500) : null,
        category: category ? category.slice(0, 500) : null,
      }
    }
    case 'bridge_year_suggestion': {
      // Bridge Year "suggest a program" form. email is optional/nullable.
      const program_name = trimOrNull(payload.program_name)
      const company = trimOrNull(payload.company)
      const link = trimOrNull(payload.link)
      const why = trimOrNull(payload.why)
      const email = trimOrNull(payload.email)
      return {
        program_name: program_name ? program_name.slice(0, 500) : null,
        company: company ? company.slice(0, 500) : null,
        link: link ? link.slice(0, 500) : null,
        why: why ? why.slice(0, 5000) : null,
        email: email ? email.toLowerCase().slice(0, 500) : null,
      }
    }
    case 'interview_prep_request': {
      // Interview Prep "request a resource" form. email is optional/nullable.
      const description = trimOrNull(payload.description)
      const stage = trimOrNull(payload.stage)
      const interview_type = trimOrNull(payload.interview_type)
      const help_needed = trimOrNull(payload.help_needed)
      const email = trimOrNull(payload.email)
      return {
        description: description ? description.slice(0, 5000) : null,
        stage: stage ? stage.slice(0, 500) : null,
        interview_type: interview_type ? interview_type.slice(0, 500) : null,
        help_needed: help_needed ? help_needed.slice(0, 5000) : null,
        email: email ? email.toLowerCase().slice(0, 500) : null,
      }
    }
    case 'panel_suggestion': {
      // Partner Panels "suggest a panel" form. email is optional/nullable.
      const topic = trimOrNull(payload.topic)
      const why_helpful = trimOrNull(payload.why_helpful)
      const stage = trimOrNull(payload.stage)
      const category = trimOrNull(payload.category)
      const email = trimOrNull(payload.email)
      return {
        topic: topic ? topic.slice(0, 5000) : null,
        why_helpful: why_helpful ? why_helpful.slice(0, 5000) : null,
        stage: stage ? stage.slice(0, 500) : null,
        category: category ? category.slice(0, 500) : null,
        email: email ? email.toLowerCase().slice(0, 500) : null,
      }
    }
    case 'linkedin_episode_request': {
      // LinkedIn Series "suggest a topic" form. email is optional/nullable.
      const topic = trimOrNull(payload.topic)
      const email = trimOrNull(payload.email)
      const category = trimOrNull(payload.category)
      return {
        topic: topic ? topic.slice(0, 5000) : null,
        email: email ? email.toLowerCase().slice(0, 500) : null,
        category: category ? category.slice(0, 500) : null,
      }
    }
    case 'bridge_year_subscriber': {
      // Bridge Year email capture. email is REQUIRED (validated below). Normalize
      // (trim + lowercase) so any UNIQUE(email) constraint dedupes case-variants.
      const email = trimOrNull(payload.email)
      return {
        email: email ? email.toLowerCase().slice(0, 500) : null,
      }
    }
    default:
      return {}
  }
}

// Server-side input validation at the trust boundary (MED-3), factored out of the
// handler so file-upload types can run it AFTER their uploads (issue #79) and
// clean those uploads up on a validation failure instead of leaking them.
// Returns an error message, or null if the row passes.
function validateRow(type: string, row: Record<string, unknown>): string | null {
  //   - email format for the types where email is REQUIRED (coffee_chat, resume,
  //     panelist, subscriber, bridge_year_subscriber),
  if (type === 'coffee_chat' || type === 'resume' || type === 'panelist' || type === 'subscriber' || type === 'bridge_year_subscriber') {
    const email = row.email
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return 'Invalid submission'
    }
  }
  //   - email format for the types where email is OPTIONAL, but only when present,
  const OPTIONAL_EMAIL_TYPES = [
    'template_request', 'bridge_year_suggestion', 'interview_prep_request',
    'panel_suggestion', 'linkedin_episode_request',
  ]
  if (OPTIONAL_EMAIL_TYPES.includes(type)) {
    const email = row.email
    if (typeof email === 'string' && email.length > 0 && !EMAIL_REGEX.test(email)) {
      return 'Invalid submission'
    }
  }
  //   - max length on long free-text fields so an absurdly long value can't be
  //     inserted (char_length(...) <= 5000 in migration 011).
  const longTextFields = ['story', 'topics', 'why', 'eligibility', 'target_companies', 'request', 'description', 'help_needed', 'why_helpful', 'topic', 'interested_in', 'notes']
  for (const field of longTextFields) {
    const val = row[field]
    if (typeof val === 'string' && val.length > MAX_LONGTEXT) {
      return 'Invalid submission'
    }
  }
  // Short identifier-ish columns (char_length(...) <= 500 in migration 011).
  const shortTextFields = ['name', 'role', 'company', 'submitted_by', 'location', 'role_title', 'handle', 'file_name', 'program_name']
  for (const field of shortTextFields) {
    const val = row[field]
    if (typeof val === 'string' && val.length > MAX_SHORTTEXT) {
      return 'Invalid submission'
    }
  }
  // Email length: every email column has a format CHECK but none has a
  // length CHECK (issue #92) — bound it here at the trust boundary instead.
  if (typeof row.email === 'string' && row.email.length > MAX_SHORTTEXT) {
    return 'Invalid submission'
  }
  return null
}

// Upload a validated avatar image (service-role client, bypasses RLS) and return
// its storage path + public URL. The path is generated here, never taken from the
// client, so a crafted filename can't shape it. Returns an error message on any
// validation/upload failure.
async function uploadAvatar(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  file: File,
): Promise<{ ok: true; path: string; publicUrl: string } | { ok: false; error: string }> {
  const ext = AVATAR_MIME_TO_EXT[file.type]
  if (!ext || file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Please upload a PNG, JPEG, or WebP avatar under 2MB.' }
  }
  const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false })
  if (error) {
    console.error('Avatar upload error:', error)
    return { ok: false, error: 'Could not upload avatar' }
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { ok: true, path, publicUrl: data.publicUrl }
}

// Upload a validated resume PDF (service-role client, bypasses RLS). Checks size,
// declared MIME, AND the magic-bytes header (%PDF) — the header check defends
// against a renamed/spoofed file whose declared type can't be trusted. The path
// (including the 'pending/' prefix the admin queries key off of) is generated
// here, never taken from the client.
async function uploadResume(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.type !== 'application/pdf' || file.size > RESUME_MAX_BYTES) {
    return { ok: false, error: 'Please upload a PDF under 5MB.' }
  }
  try {
    const header = await file.slice(0, 4).text()
    if (header !== '%PDF') {
      return { ok: false, error: 'Please upload a PDF under 5MB.' }
    }
  } catch {
    return { ok: false, error: 'Please upload a PDF under 5MB.' }
  }
  const path = `pending/${Date.now()}-${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('resumes').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (error) {
    console.error('Resume upload error:', error)
    return { ok: false, error: 'Could not upload resume' }
  }
  return { ok: true, path }
}

// Best-effort delete of any files this request already uploaded, so a submission
// rejected AFTER a successful upload (a failed insert, or a second file failing
// validation) never leaves an orphaned object in storage (issue #79, acceptance
// criterion 3). Turnstile is checked before any upload, so a request that never
// passes verification never reaches this point in the first place.
async function cleanupUploads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  uploads: Array<{ bucket: string; path: string }>,
): Promise<void> {
  for (const u of uploads) {
    try {
      const { error } = await supabase.storage.from(u.bucket).remove([u.path])
      if (error) console.error(`Cleanup failed for ${u.bucket}/${u.path}:`, error)
    } catch (err) {
      console.error(`Cleanup threw for ${u.bucket}/${u.path}:`, err)
    }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  const json = jsonWith(corsHeaders)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const contentType = req.headers.get('content-type') || ''
  const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data')

  // Reject oversized bodies up front when the client declares a length.
  const declaredLen = Number(req.headers.get('content-length') || '0')
  if (declaredLen > (isMultipart ? MAX_MULTIPART_BYTES : MAX_BODY_BYTES)) {
    return json({ error: 'Payload too large' }, 413)
  }

  try {
    let type: string | undefined
    let turnstileToken: string | undefined
    let payload: Record<string, unknown> = {}
    let avatarFile: File | null = null
    let resumeFile: File | null = null

    if (isMultipart) {
      // coffee_chat / resume only (issue #79) — these carry file uploads, so the
      // client sends `type`, `turnstileToken`, a `payload` field (JSON-encoded,
      // same shape the JSON path below would receive), and the file field(s).
      let form: FormData
      try {
        form = await req.formData()
      } catch {
        return json({ error: 'Invalid form data' }, 400)
      }
      const typeField = form.get('type')
      const tokenField = form.get('turnstileToken')
      const payloadField = form.get('payload')
      type = typeof typeField === 'string' ? typeField : undefined
      turnstileToken = typeof tokenField === 'string' ? tokenField : undefined
      if (typeof payloadField === 'string') {
        try {
          payload = JSON.parse(payloadField)
        } catch {
          return json({ error: 'Invalid JSON' }, 400)
        }
      }
      if (type !== 'coffee_chat' && type !== 'resume') {
        return json({ error: 'Invalid submission type' }, 400)
      }
      const avatarField = form.get('avatar')
      if (avatarField instanceof File && avatarField.size > 0) avatarFile = avatarField
      if (type === 'resume') {
        const resumeField = form.get('resume')
        if (!(resumeField instanceof File) || resumeField.size === 0) {
          return json({ error: 'Resume file is required' }, 400)
        }
        resumeFile = resumeField
      }
    } else {
      const raw = await readBodyLimited(req, MAX_BODY_BYTES)
      if (raw === null) {
        return json({ error: 'Payload too large' }, 413)
      }
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw)
      } catch {
        return json({ error: 'Invalid JSON' }, 400)
      }
      const p = parsed as { type?: string; turnstileToken?: string; payload?: Record<string, unknown> }
      type = p.type
      turnstileToken = p.turnstileToken
      payload = (p.payload && typeof p.payload === 'object') ? p.payload : {}
      if (type === 'coffee_chat' || type === 'resume') {
        // These two types now carry file uploads and must go through
        // multipart/form-data (issue #79) — a plain JSON body can no longer
        // smuggle a client-supplied avatar_url/file_name and skip server-side
        // upload validation (and the storage Turnstile gate) entirely.
        return json({ error: 'This submission type requires multipart/form-data' }, 400)
      }
    }

    // 1. Turnstile gate — generic 403 on failure, no work done. Checked BEFORE
    // any storage upload, so an unverified request never touches storage at all
    // (issue #79, acceptance criterion 1).
    const remoteip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ok = await verifyTurnstile(turnstileToken, remoteip)
    if (!ok) {
      return json({ error: 'Verification failed' }, 403)
    }

    // 2. Validate type → table. Object.hasOwn (not `in`) so a crafted type like
    // "constructor" or "toString" can't match something off Object.prototype.
    if (!type || !Object.hasOwn(TABLE_BY_TYPE, type)) {
      return json({ error: 'Invalid submission type' }, 400)
    }
    const table = TABLE_BY_TYPE[type]
    const row = buildRow(type, (payload && typeof payload === 'object') ? payload : {})

    // 3. Service-role client (bypasses RLS). Prefer the new secret key, fall back
    //    to the legacy service_role key — mirrors add-to-waitlist. Created here
    //    (rather than just before the DB insert) because the file uploads below
    //    need it too.
    const serviceKey = (() => {
      try {
        const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
        if (secretKeys?.default) return secretKeys.default
      } catch (_) { /* fall through to legacy key */ }
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    })()

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    // 4. File uploads (coffee_chat / resume only), now that Turnstile has passed.
    // Track everything uploaded so it can be deleted if a later step fails.
    const uploaded: Array<{ bucket: string; path: string }> = []
    if (type === 'resume') {
      const result = await uploadResume(supabase, resumeFile as File)
      if (!result.ok) {
        return json({ error: result.error }, 400)
      }
      uploaded.push({ bucket: 'resumes', path: result.path })
      row.file_name = result.path
    }
    if (type === 'coffee_chat' || type === 'resume') {
      if (avatarFile) {
        const result = await uploadAvatar(supabase, avatarFile)
        if (!result.ok) {
          await cleanupUploads(supabase, uploaded)
          return json({ error: result.error }, 400)
        }
        uploaded.push({ bucket: 'avatars', path: result.path })
        row.avatar_url = result.publicUrl
      } else {
        row.avatar_url = null
      }
    }

    // 5. Server-side input validation at the trust boundary (MED-3). Runs after
    // uploads so a rejected row here also cleans up any file already uploaded.
    const validationError = validateRow(type, row)
    if (validationError) {
      await cleanupUploads(supabase, uploaded)
      return json({ error: validationError }, 400)
    }

    const { error: dbErr } = await supabase.from(table).insert(row)
    if (dbErr) {
      // Keep DB internals out of the client response.
      console.error(`Insert error (${table}):`, dbErr)
      await cleanupUploads(supabase, uploaded)
      // Map a unique-violation (e.g. an already-subscribed email) to a 409 so the
      // client can render its "already subscribed" state — mirrors add-to-waitlist.
      if (dbErr.code === '23505') {
        return json({ error: 'Already submitted' }, 409)
      }
      return json({ error: 'Could not save submission' }, 500)
    }

    return json({ ok: true }, 200)
  } catch (err) {
    console.error('Function error:', err)
    return json({ error: 'Unexpected error' }, 500)
  }
})
