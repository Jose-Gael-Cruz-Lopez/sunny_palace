# Security

This document is the reference for the security posture of the Jose x Jocelyn site
(`fromcampuscareer.com`). It records the architecture's trust model, every hardening
measure implemented during the 2026-06 security audit, the secrets/config that hold it
together, and the ongoing responsibilities required to keep it secure.

> Security is not a one-time state. The fixes below close the issues found in the audit
> and raise the bar significantly, but no system is unhackable. The "Ongoing maintenance"
> section at the end is as important as the fixes.

---

## 1. Architecture & trust model

- **Frontend:** React 18 + Vite 5 single-page app, built to `dist/` and served on
  **Vercel**. No server-side rendering; all logic the browser runs is public.
- **Backend:** a single **Supabase** project (Postgres 17, ref `kdkeerhukydxwoycjuwl`).
  The browser talks **directly** to Supabase with the **publishable / anon key**, which is
  *designed to be public* and is governed by **Row-Level Security (RLS)** and table/column
  **GRANTs**. Privileged work runs in **Deno edge functions** using the service role.
- **No user accounts.** There is no login, session, password, or JWT minted by the app —
  every visitor is the anonymous role. Admin/moderation is done by hand in the Supabase
  dashboard SQL editor. This makes a whole class of measures (password reset, session
  management, IDOR-between-users, CSRF on cookie sessions, default credentials) **not
  applicable** — see section 9.

### Core authorization model
1. **Writes are funneled through one trusted path.** All public submissions
   (coffee-chat, resume, opportunity, panelist, contact, waitlist) go through
   **Turnstile-gated edge functions** that run with the **service role** and set
   security-sensitive fields (`status`, `public_profile`) **server-side**. Direct
   anonymous `INSERT` is **revoked** on every user-writable table, so the gate cannot be
   bypassed via the REST API.
2. **Reads are "gated, column-restricted."** RLS row policies expose only
   approved/featured rows; **column-level GRANTs** hide PII (`email`, `linkedin_url`) from
   the anon role — RLS governs *rows*, GRANTs govern *columns*.
3. **The browser is never trusted.** Client-side validation is treated as cosmetic;
   every constraint is re-enforced at the edge-function and/or database layer.

---

## 2. Critical fixes

### CRIT-1 — Gemini API key shipped in the frontend bundle  *(measures #3, #14)*
**Risk:** `src/lib/gemini.js` read `VITE_GEMINI_API_KEY`, and any `VITE_`-prefixed variable
is inlined into the public JS bundle at build time. Anyone could extract the Google API key
from DevTools / the deployed `dist/assets/*.js` and run unlimited Gemini calls on the
project's bill and quota.
**Fix:** the AI resume-builder feature was unreachable dead code, so it was **deleted**
entirely (`src/lib/gemini.js`, `ResumeBuilder.jsx`, and all references/i18n strings). The
leaked key was **rotated/deleted** in Google AI Studio and **removed** from the Cloudflare
Pages environment.
**Verification:** `grep -r "generativelanguage\|VITE_GEMINI\|AIza" dist/` returns nothing;
confirmed against the live deployed bundle.
**Lesson:** never use a `VITE_`-prefixed variable for a secret. Only values that are
*designed* to be public (Supabase anon key, Turnstile site key) may be `VITE_`.

### CRIT-2 — Submissions self-approved (moderation bypass)  *(measures #5, #15, #34)*
**Risk:** every table's insert policy was `WITH CHECK (true)`, and the browser inserted rows
with `status: 'approved'`. Anyone hitting the REST API with the public key could publish
arbitrary content instantly, or pin it with `status:'featured'`.
**Fix:** migration `005` rewrote the insert policies to pin `status='pending'`
(`coffee_chat_profiles` also forces `public_profile=false`). Submissions now flow through
the `submit-form` edge function, which sets the status server-side. Moderation happens in
the dashboard. (Opportunities/resumes were later set to auto-publish *server-side* — see
section 7 — without re-opening the client-controlled hole.)
**Verification:** `POST /rest/v1/<table>` with `status:'approved'` via the anon key is
rejected; the only insert path is the service-role edge function.

### CRIT-3 — PII (emails) readable by anyone via the REST API  *(measures #6, #33, #35)*
**Risk:** SELECT policies granted the anon role whole rows including `email`. The frontend's
column allow-list was **cosmetic** — `GET /rest/v1/coffee_chat_profiles?select=name,email`
returned every approved mentor's email. RLS governs rows, not columns.
**Fix:** migration `006` uses **column-level GRANTs** — `REVOKE SELECT` on the table then
`GRANT SELECT (<non-PII columns>)` to `anon` — so `email`/`linkedin_url` (resumes) and
`email`/`consented_at` (coffee chat) are unreadable. Client reads stopped using
`select('*')` and enumerate the granted columns.
**Verification:** `?select=email` and `?select=*` return **401** for the anon role; non-PII
selects return data. Confirmed live.

---

## 3. High-severity fixes — anti-abuse

### HIGH-1 — No rate limiting / anti-abuse on forms or functions  *(measure #28)*
**Risk:** insert policies were `WITH CHECK (true)` with no throttle; the edge functions had
no protection. A script with the public key could flood every table, email-bomb the contact
inbox, and burn the Resend quota.
**Fix (Cloudflare Turnstile + a single trusted insert path):**
- A shared `src/components/Turnstile.jsx` widget was added to the contact, waitlist,
  coffee-chat, resume, opportunity (and later panelist) forms; the token is sent with each
  request.
- `send-contact-email` and `add-to-waitlist` verify the token against Cloudflare's
  `siteverify` endpoint before doing any work (403 on failure, fail-closed if the secret is
  unset).
- A new **`submit-form`** edge function is the **only** path for the direct-insert forms:
  it verifies Turnstile, inserts with the **service role**, **whitelists columns**, and
  **force-sets** `status`/`public_profile` server-side.
- Migration `007` **revokes anon `INSERT`** on `coffee_chat_profiles`, `resume_submissions`,
  and `opportunities`, so the REST API can no longer be used to bypass Turnstile.
**Verification:** a replayed POST without a valid token → 403; a direct anon REST insert →
401. Confirmed live.

### HIGH-1b — Panelist form left an open anon insert  *(follow-up)*
**Risk:** the Partner Panels "apply to speak" form still inserted into `panelists` directly
with the anon key (no Turnstile), the one form HIGH-1 missed.
**Fix:** `submit-form` gained a `panelist` type (whitelisted columns, forced
`status='pending'`, email-validated); the form now posts through it with a Turnstile token;
migration `012` revokes anon `INSERT` on `panelists`.
**Verification:** direct anon insert → 401; `submit-form` panelist with a bad token → 403.

---

## 4. High-severity fixes — injection & uploads

### HIGH-2 — Stored XSS via user URLs rendered as `href`  *(measure #19)*
**Risk:** user-controlled URLs (`linkedin_url`, opportunity `link`) were rendered straight
into anchor `href`s. A `javascript:alert(document.cookie)` value became a clickable XSS
payload (and combined with CRIT-2 could be published instantly).
**Fix:** `src/lib/safeUrl.js` exports `safeHttpUrl(raw)`, which returns the URL only if it
parses as an absolute `http:`/`https:` URL (blocking `javascript:`, `data:`, `vbscript:`,
relative URLs). It is applied at every `href` sink. Migration `008` adds DB-layer
`CHECK (... LIKE 'https://%')` constraints (NOT VALID) on the URL columns as a backstop.
**Verification:** `safeHttpUrl('javascript:alert(1)')` → null; the DB rejects a non-https
link insert. Confirmed live.

### HIGH-3 — Insecure file uploads + public avatars bucket  *(measures #21, #8)*
**Risk:** the `avatars` bucket was public, accepted anon uploads of any type/size, and used
the **user-controlled** `file.type` as the stored content type — an attacker could upload an
HTML/SVG file with a spoofed `image/*` type and get a hosted URL on the storage domain
(phishing / stored content). The `resumes` bucket had no size limit and no content sniffing.
**Fix:** migration `009` codifies both buckets in version control and sets
`allowed_mime_types` + `file_size_limit` (avatars: png/jpeg/webp, 2 MB; resumes:
application/pdf, 5 MB), re-asserting the resume storage policies. The client validates size
and type before upload, passes an explicit allowed MIME (never `file.type`), and checks the
`%PDF` **magic-byte** header for resumes. The bucket limits are a server-side backstop.
**Verification:** live `storage.buckets` shows the limits on both buckets; a `.html`
renamed to `.png`, an oversized image, and a non-PDF resume are all rejected.

---

## 5. High-severity fixes — webhooks, errors, headers, dependencies

### HIGH-4 — Webhook had no signature verification  *(measure #31)*
**Risk:** `send-welcome-email` is triggered by a Supabase database webhook and trusted the
payload entirely. The only "auth" was the public anon key, so anyone could POST a crafted
`{record:{email:"victim@x.com"}}` and send mail from the verified domain to arbitrary
addresses (spam/phishing, Resend abuse, sender-reputation damage).
**Fix:** the function reads `WEBHOOK_SECRET` and requires a matching `x-webhook-secret`
header **before** reading the body (timing-safe compare, fail-closed if unset), validates
`record.email`, caps name length, and stays at `verify_jwt=true` so the publishable key
alone cannot invoke it. The DB webhook sends the matching header.
**Verification:** POST without a valid JWT + secret → 401, no email. (The same pattern was
later applied to `coffee-chat-welcome` — see section 7.)

### HIGH-5 — Verbose errors leaked internals  *(measures #12, #11)*
**Risk:** edge functions returned raw Resend bodies, `dbErr.message`, and stack info to the
browser, leaking schema and upstream details.
**Fix:** all responses now return generic messages (e.g. "Something went wrong"); the real
error stays in `console.error` only. Known cases map to safe messages (duplicate email →
"You're already on the list", 409). No DB/Resend body ever reaches the client.

### HIGH-6 — Missing security headers / CSP  *(measure #46)*
**Risk:** no `Content-Security-Policy`, `HSTS`, `X-Frame-Options`, etc. — open to
clickjacking, MIME-sniffing, and no defense-in-depth against XSS.
**Fix:** `vercel.json` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, a 2-year `Strict-Transport-Security` (preload), `Permissions-Policy`,
and a strict **CSP** scoped to exactly what the app loads (self, Cloudflare Turnstile,
Fontshare/Google Fonts, `*.supabase.co`, `cdn.simpleicons.org`, `data:`/`blob:`). No
`unsafe-eval`, no wildcard `script-src`, no dead Gemini origin.

> `public/_headers` is a leftover Cloudflare Pages config file from before the move to
> Vercel. It is **not read by Vercel** and has no effect on the live site — `vercel.json`
> is the only config that matters now. It's kept in the repo only as a historical
> reference; do not edit it expecting it to change live behavior.
**Verification:** `curl -I https://fromcampuscareer.com` shows all headers live; the CSP
allows the Turnstile script/iframe with zero violations.

### HIGH-7 — Dependency vulnerabilities & unpinned imports  *(measures #37, #38)*
**Risk:** no `npm audit` in CI; edge functions imported an old `deno.land/std` and an
unpinned `@supabase/supabase-js@2`.
**Fix:** `npm audit fix` patched the reachable advisories (production scope → 0 vulns; the
2 remaining are dev-only esbuild/Vite). Edge functions dropped the stale std `serve` import
for the built-in `Deno.serve`, and `@supabase/supabase-js` is pinned. A
`.github/workflows/audit.yml` runs `npm audit` on every PR. Major upgrades (React 19,
Vite 8, etc.) were deliberately deferred — no security driver.

---

## 6. Medium-severity fixes

### MED-1 — HTML/email injection in notification emails  *(measure #19, output encoding)*
User values (`name`, `email`, `message`, `school`, `firstName`, …) were interpolated raw
into email HTML, allowing HTML/link injection into the inbox. Each function now has an
`escapeHtml()` helper applied to every user value, strips newlines from subjects
(header-injection), URL-encodes interpolated IDs, and enforces max lengths (400 on
oversize).

### MED-2 — Overly permissive CORS  *(measure #27)*
`send-contact-email` and `add-to-waitlist` returned `Access-Control-Allow-Origin: *`. All
three browser-facing functions now share one per-request helper that echoes the request
`Origin` **only** if it's in the `ALLOWED_ORIGINS` allow-list (otherwise omits the header).
`Vary: Origin` is set.
**Verification:** `Origin: https://evil.com` gets no ACAO header; `fromcampuscareer.com` is
echoed.

**Update (issue #92):** the `ALLOWED_ORIGINS`-unset case used to fail *open*, defaulting to
`Access-Control-Allow-Origin: *`. It now fails *closed* (omits the ACAO header) unless the
operator explicitly opts into the permissive local-dev fallback via
`ALLOW_ALL_ORIGINS_DEV=true`.

### MED-3 — Thin server-side input validation  *(measure #16)*
Validation existed only client-side (bypassable via REST). The edge functions now validate
email format and field lengths, and migration `011` adds DB-layer `CHECK` constraints (all
NOT VALID): a `status` domain, an email-format regex on every email column, and
`char_length` ceilings on free-text columns — so a crafted payload can't insert a malformed
email or a 100k-char value.
**Verification:** malformed email, invalid status, and oversized text are all rejected at
the DB; valid rows succeed.

### MED-5 — No audit log / monitoring  *(measures #42, #43)*
There was no record of who approved/changed a submission. Migration `010` adds an
`audit_log` table (RLS-on, no anon policy) and one shared `AFTER INSERT/UPDATE` trigger on
the four moderated tables that records new submissions and **status changes** (with actor
and from/to). Review queries live in `supabase/admin-queries.sql`. Alerting options
(log drains, Resend webhooks, optional Sentry) are documented.
**Verification:** an insert + a status change log rows; non-status edits don't; the trigger
never blocks writes; anon cannot read the table.

### MED-6 — CLI link metadata committed  *(measures #1, #13)*
`supabase/.temp/` (project ref, pooler URL/host, versions — recon, not passwords) was
tracked in a public repo. It's now gitignored and untracked (`git rm --cached`); the CLI
regenerates it locally.

---

## 7. Low-severity items, follow-ups & deliberate tradeoffs

### LOW-1 — Backup/restore runbook  *(measure #44)*
`docs/BACKUP.md` documents the active (free-tier) Supabase backup limits, a weekly manual
export procedure (`supabase db dump` + per-table CSV for the data tables), a step-by-step
restore checklist (migrations → data → secrets → function deploys → buckets), and an
optional GitHub Action automation outline. PITR requires Supabase Pro (a flagged decision).

### LOW-2 — PR security checklist  *(measure #50)*
`docs/SECURITY-REVIEW-CHECKLIST.md` captures the 12 recurring pitfalls from this audit
(RLS hides rows not columns, never let the client set status/role, validate at the
server/DB boundary, sanitize `href` URLs, escape email input, no `VITE_` secrets, generic
errors, anti-abuse on writes, locked buckets, CSP, webhook secrets, no `.temp`). It is wired
into `.github/pull_request_template.md` so reviewers check them on every PR.

### LOW-3 — Supabase advisor (linter) hardening  *(migrations `020`, `021`)*
Follow-up hardening surfaced by the Supabase security advisor after the earlier waves.
None of these was an active anon-exploitable hole; all are defense-in-depth.
- **`020`** pins a non-mutable `search_path` on `record_status_audit()`, `set_updated_at()`,
  and `coffee_chat_set_approved_at()` (so a caller-set `search_path` can't influence a
  `SECURITY DEFINER`/trigger function), and revokes `EXECUTE` on the internal trigger/event
  functions `record_status_audit()` and `rls_auto_enable()` from `anon`/`authenticated`/
  `public` — they're only ever invoked by triggers, never meant to be callable via
  `/rest/v1/rpc`.
- **`021`** revokes `anon`/`PUBLIC` `EXECUTE` on the five coffee-chat admin RPCs
  (`admin_approve_coffee_chat_profile`, `admin_reject_coffee_chat_profile`,
  `admin_set_featured_coffee_chat_profile`, `admin_list_pending_coffee_chat_profiles`,
  `is_coffee_chat_admin`), granting `authenticated`/`service_role` only — these already
  self-gated via `is_coffee_chat_admin()` (anon carries no JWT email), so this narrows the
  advisor-flagged RPC surface without a functional change. It also drops the
  `avatar_public_read` SELECT policy on `storage.objects`: the `avatars` bucket is public
  and serves object URLs directly (no policy consulted), so that policy only enabled
  bucket-wide key **listing/enumeration**, which the client never uses.
**Verification:** `npm run build` succeeds; avatar upload/display and coffee-chat admin
actions (as an authenticated admin) are unaffected; `supabase/functions/**` calls unaffected
(they use the service role).

### `coffee-chat-welcome` — secured + repurposed  *(follow-up)*
This orphaned function was `verify_jwt=false` with no secret check — an open email-send/spam
vector. It is now gated by `verify_jwt=true` + an `x-webhook-secret` shared secret (the
HIGH-4 pattern), email-validated, and repurposed to the Supabase DB-webhook payload shape so
it fires only on the `pending → approved` transition (other updates are a safe no-op). The
`on-coffee-chat-approved` webhook drives it.

### Deliberate tradeoff — instant publish for opportunities & resumes
The site owner chose to auto-publish opportunities and resumes (vs. moderating them).
This is implemented **safely**: `submit-form` force-sets `status='approved'` **server-side**
for those two types only (coffee-chat and panelists stay moderated/`pending`), keeping the
Turnstile gate, service-role insert, column whitelist, validation, and PII locks. The
client never sets the status. **Residual risk:** content is published without human review,
so a determined human (past Turnstile) can post junk — this is a product decision, not a
vulnerability. Migration `013` also added the missing `opportunities.location`/`pay` columns
the form referenced.

---

## 8. Secrets, webhooks & migration inventory

### Edge function secrets (Supabase — private, server-side only)
| Secret | Used by | Purpose |
|---|---|---|
| `TURNSTILE_SECRET` | submit-form, send-contact-email, add-to-waitlist | verify Turnstile tokens |
| `WEBHOOK_SECRET` | send-welcome-email, coffee-chat-welcome | shared-secret webhook gate |
| `ALLOWED_ORIGINS` | submit-form, send-contact-email, add-to-waitlist | CORS allow-list (e.g. `https://fromcampuscareer.com`) |
| `ALLOW_ALL_ORIGINS_DEV` | submit-form, send-contact-email, add-to-waitlist | set to `true` to opt into the permissive `*` CORS fallback (local dev only) when `ALLOWED_ORIGINS` is unset |
| `RESEND_API_KEY` | all email functions | Resend API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEYS` | service-role functions | privileged DB access (auto-provided) |

### Frontend env vars (Vercel — PUBLIC by design, shipped in the bundle)
| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | project URL — public |
| `VITE_SUPABASE_ANON_KEY` | publishable key — public, governed by RLS/GRANTs |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key — public by design |

> **Rule:** never add a `VITE_`-prefixed secret. If it isn't safe in the browser, it must
> live as an edge secret and be used only inside an edge function.

### Database webhooks
| Webhook | Fires on | Calls | Auth |
|---|---|---|---|
| `on-new-subscriber` | `subscribers` INSERT | `send-welcome-email` | Authorization bearer + `x-webhook-secret` |
| `on-coffee-chat-approved` | `coffee_chat_profiles` UPDATE | `coffee-chat-welcome` | Authorization bearer + `x-webhook-secret` |

### Migrations added by the audit
`005` lock insert status · `006` lock PII columns · `007` revoke anon insert ·
`008` https URL checks · `009` storage hardening · `010` audit log ·
`011` input constraints · `012` revoke panelists insert · `013` opportunities location/pay ·
`017` revoke subscribers insert (HIGH-N1) · `018` revoke waitlist insert (MED-N2) ·
`019` revoke secondary-form inserts (MED-N1) · `020` DB function search_path + internal
RPC EXECUTE hardening · `021` lock coffee-chat admin RPCs to authenticated/service_role +
drop avatar-listing storage policy (see LOW-3 in section 7 for detail on `020`/`021`).

### Edge functions
`submit-form` (verify_jwt=false, Turnstile) · `send-contact-email` / `add-to-waitlist`
(verify_jwt=false, Turnstile) · `send-welcome-email` / `coffee-chat-welcome`
(verify_jwt=true, webhook secret). The legacy `verify-turnstile` function (superseded by
`submit-form`) has been deleted.

---

## 9. Measures evaluated as Not Applicable

These were assessed and do not apply to this architecture (anonymous public SPA, Supabase +
RLS, no user accounts, no payments). Recorded for completeness.

| # | Measure | Why N/A |
|---|---------|---------|
| 2 | Public `.env` files | none committed; only `.env.example` |
| 4 | Weak/missing authentication | the app has **no auth** — the analog (open inserts) is CRIT-2 |
| 7 | Open DB read/write | RLS on every table; writes intentionally gated via submit-form |
| 9 | Admin routes unprotected | no admin routes; admin is the Supabase dashboard (enable 2FA) |
| 10 | Debug pages in prod | none; Vite strips dev tooling |
| 17 | SQL injection | all access via parameterized supabase-js / RLS; no string-built SQL |
| 18 | NoSQL injection | no NoSQL datastore |
| 20 | CSRF | no cookie sessions; requests use an explicit bearer header |
| 22 | Path traversal | storage keys are timestamp/random-prefixed and sanitized |
| 23 | SSRF | no server-side fetch of user-supplied URLs |
| 24 | Broken password reset | no passwords exist |
| 25 | Weak session management | no server session; always anonymous |
| 26 | Weak/leaked JWT secret | only the public anon key; Supabase manages the JWT secret |
| 29 | Public test/staging env | no staging app or seed data in the repo |
| 30 | Default credentials | no app login |
| 32 | Frontend-only payment checks | no payments |
| 33 | IDOR | no per-user resources by ID (the column-leak analog was CRIT-3) |
| 36 | Source maps in prod | Vite default is no prod sourcemaps |
| 39 / 40 | Prompt injection / AI data access | the AI feature was deleted (CRIT-1) — no AI path remains |
| 41 | Excessive DB perms | browser uses the RLS-limited anon role; service role only in edge functions |
| 45 | Public internal dashboards | none; Supabase Studio is behind Supabase auth |
| 47 | Cookie flags | the app sets no cookies |
| 48 | Unencrypted sensitive data | Supabase encrypts at rest + TLS; resume PDFs in a private bucket |
| 49 | Poor tenant isolation | single-tenant; the moderation-status flaw (CRIT-2) is the closest analog |

---

## 10. Ongoing maintenance & incident response

The audit closed the known issues; staying secure is an ongoing responsibility. Most
real-world breaches are **account/credential compromise**, not code bugs — so the first
items below matter most.

### Do these now / keep them true
1. **Enable 2FA** on the GitHub, Supabase, and Cloudflare accounts. This is the single
   highest-impact control — the admin surface (dashboard SQL, deploys, secrets) is protected
   only by these logins.
2. **Disable any auto-merge automation.** During this audit an integration auto-merged PRs
   to `main` within seconds, unreviewed — that is itself a supply-chain risk. PRs to `main`
   should require human review.
3. **Never add a `VITE_`-prefixed secret.** Anything `VITE_*` ships in the public bundle.
4. **Rotate keys on any suspected leak:** Supabase keys (dashboard → API), Turnstile keys
   (Cloudflare), `RESEND_API_KEY`, and the `WEBHOOK_SECRET` / `TURNSTILE_SECRET` edge
   secrets. After rotating, redeploy the functions / frontend.

### Routine hygiene
- **Dependencies:** the `audit.yml` workflow runs `npm audit` on every PR. Address
  high/critical promptly; schedule periodic major-version upgrades (React/Vite/Tailwind).
- **PR reviews:** use `docs/SECURITY-REVIEW-CHECKLIST.md` for every change so the same bug
  classes (client-set status, PII via REST, unsanitized URLs, `VITE_` secrets) don't return.
- **Monitoring:** review `audit_log` (who approved what), Supabase logs / advisors, and
  Resend delivery for anomalies. Consider a Sentry DSN and/or log drains as the site grows.
- **Backups:** follow `docs/BACKUP.md`; run one export end-to-end to confirm it works, and
  re-evaluate Supabase Pro / PITR before launch.

### If you suspect a compromise
1. Rotate all keys/secrets immediately (see above) and redeploy.
2. Check `audit_log` and Supabase logs for unexpected status changes or inserts.
3. Revoke suspicious GitHub/Supabase/Cloudflare sessions and OAuth apps; review installed
   GitHub Apps.
4. If data was altered, restore from a backup per `docs/BACKUP.md`.
5. Review recent commits/PRs to `main` for unauthorized changes.

### Known residual risks (by design or out of scope)
- **Auto-published content** (opportunities/resumes) is not human-reviewed — Turnstile stops
  bots, not determined humans posting junk.
- **Admin is dashboard-only**, so its security == the Supabase account's security (hence 2FA).
- The free Supabase tier has **limited backup retention and no PITR**.

---

*Last updated for the 2026-06 security audit. Keep this document current as the app evolves.*