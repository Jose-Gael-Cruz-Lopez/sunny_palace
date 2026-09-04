import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0'

// Public, Turnstile-gated insert proxy for the moderated/public forms:
//   coffee_chat            -> coffee_chat_profiles
//   resume                 -> resume_submissions
//   opportunity            -> opportunities
//   panelist               -> panelists
//   subscriber             -> subscribers   (newsletter signup; anon INSERT revoked in migration 017)
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

// Allow-list of origins permitted to make cross-origin requests. Comma-separated
// in ALLOWED_ORIGINS (e.g. `https://fromcampuscareer.com`). When unset, fall back
// to `*` for local dev only.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean)
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET')
const MAX_BODY_BYTES = 1_000_000 // ~1MB — these are JSON rows, not file uploads.

// Server-side email format check at the trust boundary. Must match the DB-layer
// CHECK constraint (migration 011) and the other edge functions.
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Cap long free-text fields so a crafted client can't push a 100k-char value
// through to the DB. Mirrors the char_length caps in migration 011.
const MAX_LONGTEXT = 5000

// Build CORS headers per request: echo the request Origin only if it's allow-listed,
// fall back to `*` when no allow-list is configured, otherwise omit the ACAO header.
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (ALLOWED_ORIGINS.length === 0) {
    base['Access-Control-Allow-Origin'] = '*' // local dev fallback only
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    base['Access-Control-Allow-Origin'] = origin
  }
  // else: omit the ACAO header entirely (browser will block cross-origin)
  return base
}

// JSON response helper bound to a request's per-request CORS headers.
const jsonWith = (corsHeaders: Record<string, string>) =>
  (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

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
        avatar_url: trimOrNull(payload.avatar_url),
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
        file_name: trimOrNull(payload.file_name),
        avatar_url: trimOrNull(payload.avatar_url),
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

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  const json = jsonWith(corsHeaders)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Reject oversized bodies up front when the client declares a length.
  const declaredLen = Number(req.headers.get('content-length') || '0')
  if (declaredLen > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, 413)
  }

  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: 'Payload too large' }, 413)
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const { type, turnstileToken, payload } = parsed as {
      type?: string
      turnstileToken?: string
      payload?: Record<string, unknown>
    }

    // 1. Turnstile gate — generic 403 on failure, no work done.
    const remoteip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ok = await verifyTurnstile(turnstileToken, remoteip)
    if (!ok) {
      return json({ error: 'Verification failed' }, 403)
    }

    // 2. Validate type → table.
    if (!type || !(type in TABLE_BY_TYPE)) {
      return json({ error: 'Invalid submission type' }, 400)
    }
    const table = TABLE_BY_TYPE[type]
    const row = buildRow(type, (payload && typeof payload === 'object') ? payload : {})

    // 2b. Server-side input validation at the trust boundary (MED-3).
    //   - email format for the types where email is REQUIRED (coffee_chat, resume,
    //     panelist, subscriber, bridge_year_subscriber),
    //   - email format for the types where email is OPTIONAL, but only when present,
    //   - max length on long free-text fields so an absurdly long value can't be
    //     inserted. Generic 400 on failure — no DB internals leaked.
    if (type === 'coffee_chat' || type === 'resume' || type === 'panelist' || type === 'subscriber' || type === 'bridge_year_subscriber') {
      const email = row.email
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
        return json({ error: 'Invalid submission' }, 400)
      }
    }
    // Types that carry an OPTIONAL email column: the email is nullable, so only
    // enforce the format when a non-empty value is actually present.
    const OPTIONAL_EMAIL_TYPES = [
      'template_request', 'bridge_year_suggestion', 'interview_prep_request',
      'panel_suggestion', 'linkedin_episode_request',
    ]
    if (OPTIONAL_EMAIL_TYPES.includes(type)) {
      const email = row.email
      if (typeof email === 'string' && email.length > 0 && !EMAIL_REGEX.test(email)) {
        return json({ error: 'Invalid submission' }, 400)
      }
    }
    const longTextFields = ['story', 'topics', 'why', 'eligibility', 'target_companies', 'request', 'description', 'help_needed', 'why_helpful', 'topic']
    for (const field of longTextFields) {
      const val = row[field]
      if (typeof val === 'string' && val.length > MAX_LONGTEXT) {
        return json({ error: 'Invalid submission' }, 400)
      }
    }

    // 3. Service-role client (bypasses RLS). Prefer the new secret key, fall back
    //    to the legacy service_role key — mirrors add-to-waitlist.
    const serviceKey = (() => {
      try {
        const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
        if (secretKeys?.default) return secretKeys.default
      } catch (_) { /* fall through to legacy key */ }
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    })()

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    const { error: dbErr } = await supabase.from(table).insert(row)
    if (dbErr) {
      // Keep DB internals out of the client response.
      console.error(`Insert error (${table}):`, dbErr)
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
