const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const TO_EMAIL = 'campustocareerteam@gmail.com'
const FROM_EMAIL = 'Jose x Jocelyn <newsletter@fromcampuscareer.com>'

const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET')

// Generic message returned to the client; detailed errors stay in console.error.
const GENERIC_ERROR = 'Something went wrong. Please try again.'

// Max lengths for user-controlled inputs; oversized inputs are rejected with a 400.
const MAX_MESSAGE_LENGTH = 5000
const MAX_FIELD_LENGTH = 200

// Server-side email format check at the trust boundary. Matches the DB-layer
// CHECK constraint (migration 011) and the other edge functions.
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Escape user-controlled values before interpolating them into an email `html`
// string, to prevent HTML/email injection. `&` MUST be escaped first.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

// Verify a Cloudflare Turnstile token before doing any work.
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

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // Fail closed rather than sending Resend a "Bearer undefined" request.
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured; rejecting request')
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { name, email, message, turnstileToken } = await req.json()

    // Anti-abuse gate: a valid Turnstile token is required before we send any email.
    const remoteip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (!(await verifyTurnstile(turnstileToken, remoteip))) {
      return new Response(
        JSON.stringify({ error: 'Verification failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!email || !message) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders })
    }

    // Length checks (before building/sending the email). Reject oversized inputs
    // with the generic 400, consistent with the existing pattern.
    if (
      String(message).length > MAX_MESSAGE_LENGTH ||
      (name != null && String(name).length > MAX_FIELD_LENGTH) ||
      String(email).length > MAX_FIELD_LENGTH
    ) {
      return new Response(GENERIC_ERROR, { status: 400, headers: corsHeaders })
    }

    // Email format check at the trust boundary. Reject malformed addresses with
    // the generic 400, consistent with the existing pattern.
    if (!EMAIL_REGEX.test(String(email).trim())) {
      return new Response(GENERIC_ERROR, { status: 400, headers: corsHeaders })
    }

    // Escape user-controlled values before interpolating into the HTML body.
    const safeName = name ? escapeHtml(String(name)) : '(no name)'
    const safeEmail = escapeHtml(String(email))
    const safeMessage = escapeHtml(String(message))
    // `email` is also used in reply_to (not HTML) and the subject. The subject is
    // not HTML, so don't HTML-escape it; instead strip newlines (header-injection
    // safety).
    const subjectEmail = String(email).replace(/[\r\n]+/g, ' ')
    const subjectName = name ? String(name).replace(/[\r\n]+/g, ' ') : ''

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject: `New message from ${subjectName || subjectEmail}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="margin:0 0 24px;color:#162B44;">New message via Jose x Jocelyn</h2>
            <p style="margin:0 0 8px;color:#6B5E52;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">From</p>
            <p style="margin:0 0 24px;font-size:16px;color:#1A1916;">${safeName} &lt;${safeEmail}&gt;</p>
            <p style="margin:0 0 8px;color:#6B5E52;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Message</p>
            <p style="margin:0;font-size:16px;color:#1A1916;line-height:1.7;white-space:pre-wrap;">${safeMessage}</p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
