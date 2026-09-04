# Security Audit — Fresh Pass (2026-06)

> *Resolution status last updated 2026-07 — see the status notes on HIGH-N1, MED-N1, MED-N2,
> and LOW-N1 below; those items are now fixed.*

This is a **fresh** audit of the *current* codebase, run after the 2026-06 hardening
documented in `docs/SECURITY.md`. The 18 fixes in that document were re-verified and
**still hold** (column-scoped reads, forced server-side status, revoked anon INSERT on the
four moderated tables, escaped email HTML, webhook secrets, CSP/headers, locked buckets,
`safeHttpUrl` at href sinks, no `VITE_` secrets in the bundle). Production `npm audit` is
clean.

The findings below were originally issues the prior audit **did not close** — almost all in
the same bug class it was built to prevent (HIGH-1: *"anti-abuse on public writes; revoke
anon INSERT when gating via a function"*), but applied to only 4 of the ~12 anon-writable
tables. The other ~8 "request / suggestion / subscriber" tables were never brought into the
trusted insert path.

> **Status update:** HIGH-N1, MED-N1, and MED-N2 have since been **fixed and merged**
> (migrations `017`, `019`, and `018` respectively — see each section below for details).
> LOW-N1 has also been resolved; the `verify-turnstile` function no longer exists in the
> tree. The implementation prompts below are kept as a historical record of what was done.

Priority order: **Critical → High → Medium → Low**. Skip nothing except items marked ⛔ N/A.

---

## Critical

*(none found — no secret exposure, no PII read leak, no moderation/self-approval bypass in
the current tree.)*

---

## High

### HIGH-N1 — Unauthenticated newsletter signup is an email-amplification vector  *(measure #51)*  ✅ RESOLVED

> **Fixed in migration `017`.** Option (a) from the "Decisions" section below was taken:
> the newsletter signup was routed through `submit-form` (Turnstile + service-role insert)
> and direct anon `INSERT` on `subscribers` was revoked. The instant welcome email was
> kept, now firing only on legitimate gated signups.

**Original state (BUG, now fixed).** The `subscribers` table accepted a direct, unauthenticated anon
`INSERT` (`subscribers_insert ... WITH CHECK (true)`, `001_initial_schema.sql:21`) with **no
Turnstile and no rate limit**. A Supabase **database webhook** (`on-new-subscriber`) fires on
every insert and calls `send-welcome-email`, which sends a Resend email to
`record.email`. So an attacker scripting

```
POST /rest/v1/subscribers  { "email": "anyone@anywhere.com", "source": "x" }
```

in a loop makes our **verified domain email arbitrary third parties** — burning the Resend
quota, damaging sender reputation (spam-trap hits → blacklisting), and sending unsolicited
mail. This is the HIGH-4 risk re-opened from the *insert* side: HIGH-4 secured the function
against direct calls, but left the table insert that *triggers* it wide open.

**File/line refs.**
- `supabase/migrations/001_initial_schema.sql:21` — `subscribers_insert WITH CHECK (true)`.
- `src/pages/Home.jsx:263-284` — `handleNewsletterSubmit`, direct `supabase.from('subscribers').insert(...)`, no token.
- `src/components/ArticleSubscribe.jsx:19-21` — direct `supabase.from('subscribers').insert(...)`, no token.
- Webhook: `on-new-subscriber` → `supabase/functions/send-welcome-email/index.ts` (docs/SECURITY.md §8).

**Implementation prompt (self-contained).**
> Route the newsletter signup through the existing Turnstile-gated `submit-form` edge
> function instead of a direct anon insert, mirroring how the waitlist/coffee-chat forms
> already work, and revoke the direct anon INSERT so the gate can't be bypassed.
>
> 1. In `supabase/functions/submit-form/index.ts`: add a `subscriber` entry to
>    `TABLE_BY_TYPE` (`subscribers`), add a `case 'subscriber'` to `buildRow` that
>    whitelists only `email` (trimmed, lowercased) and `source` (trimmed, capped), and add
>    `subscriber` to the email-format validation branch so a malformed email is rejected
>    with the generic 400. Do **not** let the client set any other column.
> 2. Add a new migration `supabase/migrations/017_revoke_subscribers_insert.sql` that does
>    `REVOKE INSERT ON subscribers FROM anon;` and rewrites the insert policy to
>    `WITH CHECK (false)` (defense-in-depth, mirroring `007_revoke_anon_insert.sql`). Keep
>    the existing email-format CHECK. The service role used by `submit-form` bypasses RLS,
>    so the webhook-driven welcome email still works for legitimate signups.
> 3. Update `src/pages/Home.jsx` (`handleNewsletterSubmit`) and
>    `src/components/ArticleSubscribe.jsx` to (a) render the shared `<Turnstile>` widget,
>    (b) hold the token, and (c) POST `{ type:'subscriber', turnstileToken, payload:{ email,
>    source } }` to `${VITE_SUPABASE_URL}/functions/v1/submit-form` with the anon key as the
>    bearer — exactly like `OpportunityBoard.jsx`/`CoffeeChat.jsx` do. Preserve the existing
>    "already subscribed" (409 / duplicate) UX.
>
> Touch ONLY: `supabase/functions/submit-form/index.ts`, the new migration file,
> `src/pages/Home.jsx`, `src/components/ArticleSubscribe.jsx`. (Exact wiring depends on the
> decision answer — follow it.)

**Verification.**
- `grep -n "from('subscribers')" src -r` returns **no** direct `.insert(` calls (only the function path).
- A direct `POST /rest/v1/subscribers` with the anon key returns **401/403** (insert revoked).
- A `submit-form` POST with `type:'subscriber'` and a bad/empty Turnstile token returns **403**, no row, no email.
- `npm run build` succeeds.

---

## Medium

### MED-N1 — Secondary request/suggestion forms accept ungated anon inserts  *(measure #52)*  ✅ RESOLVED

> **Fixed in migration `019`.** Option (a) from the "Decisions" section below was taken:
> all six forms were fully gated (Turnstile + `submit-form` + revoke anon INSERT).

**Original state (BUG, now fixed).** Six more tables took direct, unauthenticated anon `INSERT` with
`WITH CHECK (true)` and **no Turnstile / no throttle**. Unlike `subscribers` they have **no
read-back** (no anon SELECT policy) and **no email trigger**, so the impact is **write-spam /
junk-row flooding** and forced manual moderation — not data exposure. (`panel_suggestions`'s
form renders a Turnstile widget, but the insert is a direct REST call so the token is never
verified server-side — the gate is cosmetic.)

**File/line refs (table → insert site, all `WITH CHECK (true)` in `001_initial_schema.sql`).**
- `template_requests` (`:112`) — `src/pages/CareerTemplates.jsx:173`, `src/pages/ResumeCompanies.jsx:85`.
- `bridge_year_suggestions` (`:128`) — `src/pages/BridgeYear.jsx:130`.
- `interview_prep_requests` (`:144`) — `src/pages/InterviewPrep.jsx:78`.
- `panel_suggestions` (`:160`) — `src/pages/PartnerPanels.jsx:193`.
- `linkedin_episode_requests` (`:193`) — `src/pages/LinkedInSeries.jsx:420`.
- `bridge_year_subscribers` (`002_bridge_year_subscribers.sql:12`) — `src/pages/BridgeYear.jsx:159`.

**Implementation prompt (self-contained).** *(Run only per the decision answer.)*
> Bring these forms into the trusted insert path, mirroring HIGH-1 / HIGH-1b. For each
> table, add a whitelisted `type` to `submit-form`'s `TABLE_BY_TYPE` + `buildRow` (force any
> status field server-side; cap lengths; validate email format where the table has an email
> column), then add a migration `018_revoke_secondary_inserts.sql` that
> `REVOKE INSERT ... FROM anon` and sets the insert policies to `WITH CHECK (false)` for all
> six tables. Update each form component to render `<Turnstile>` and POST through
> `submit-form` with the token, preserving existing success/error UX. Touch ONLY:
> `supabase/functions/submit-form/index.ts`, the new migration, and the six form components
> listed above.

**Verification.**
- Direct `POST /rest/v1/<table>` with the anon key → **401/403** for all six.
- Each form's `submit-form` POST with a bad token → **403**, no row.
- `grep -rn "\.insert(" src/pages/CareerTemplates.jsx src/pages/ResumeCompanies.jsx src/pages/BridgeYear.jsx src/pages/InterviewPrep.jsx src/pages/PartnerPanels.jsx src/pages/LinkedInSeries.jsx` shows no direct table inserts remain for these tables.
- `npm run build` succeeds.

### MED-N2 — `waitlist_subscribers` anon INSERT never revoked (Turnstile gate bypassable)  *(measure #53)*  ✅ RESOLVED

> **Fixed in migration `018`.** Anon `INSERT` on `waitlist_subscribers` was revoked; the
> `add-to-waitlist` function's service-role insert was untouched, as planned.

**Original state (BUG, now fixed).** The waitlist flow ran through the Turnstile-gated `add-to-waitlist`
edge function (which inserts with the **service role**), but the table still has an open anon
`INSERT` policy (`003_waitlist_subscribers.sql:17`, `WITH CHECK (true)`) and anon INSERT was
**never revoked** (migration `007` covered only coffee-chat/resume/opportunity). So an
attacker can `POST /rest/v1/waitlist_subscribers` directly and **bypass Turnstile** — the
exact HIGH-1 bug class. No email amplification (the waitlist email is sent *inside* the
function, not by a webhook), so impact is junk rows only.

**File/line refs.**
- `supabase/migrations/003_waitlist_subscribers.sql:17` — open insert policy.
- `supabase/functions/add-to-waitlist/index.ts:137-159` — service-role insert (unaffected by the revoke).

**Implementation prompt (self-contained).**
> Add a migration `supabase/migrations/017_revoke_waitlist_insert.sql` (renumber if 017 is
> taken) that does `REVOKE INSERT ON waitlist_subscribers FROM anon;` and rewrites the insert
> policy to `WITH CHECK (false)`, mirroring `007_revoke_anon_insert.sql` (include the same
> explanatory comment pattern). Do **not** change `add-to-waitlist` — it already inserts with
> the service role, which bypasses RLS. Touch ONLY the new migration file.

**Verification.**
- A direct `POST /rest/v1/waitlist_subscribers` with the anon key → **401/403**.
- The `add-to-waitlist` function still inserts successfully (service role) end-to-end.
- SQL review: the migration only REVOKEs/locks; no other table touched.

---

## Low

### LOW-N1 — Delete the unused legacy `verify-turnstile` edge function  *(measure #54)*  ✅ RESOLVED

**Original state.** `supabase/functions/verify-turnstile/index.ts` was dead code — superseded
by `submit-form` (docs/SECURITY.md §8 called it "legacy"). No frontend code called it
(`grep` for `functions/v1/` found only `send-contact-email`, `add-to-waitlist`,
`submit-form`). It was deployed `--no-verify-jwt`, used a *different* secret name
(`TURNSTILE_SECRET_KEY` vs the live `TURNSTILE_SECRET`), and **returned `err.message` to the
client** (`:64`), a minor HIGH-5-class leak. It performed no privileged action (token verify
only), so risk was low — but it shouldn't have existed.

**Resolution.** The `supabase/functions/verify-turnstile/` directory has been deleted.
`grep -rn "verify-turnstile" src supabase` returns nothing. If it was ever deployed, confirm
`supabase functions delete verify-turnstile` was also run against the live project so the
deployed copy doesn't linger with the stale secret name.

**Verification.** `grep -rn "verify-turnstile" src supabase` returns nothing; `npm run build` succeeds.

### LOW-N2 — OpportunityBoard `postLink` rendered as `href` without `safeHttpUrl`  *(measure #55)*

**Current state.** `OpportunityBoard.jsx` maps `row.link` to both `viewLink` (sanitized with
`safeHttpUrl`, `:97-99`) and `postLink` (rendered raw, `:100-103`). The DB `CHECK (link LIKE
'https://%')` from migration `008` blocks non-https links at insert, and `script-src 'self'`
blocks `javascript:` execution — so this is a **defense-in-depth gap**, not an open hole. But
the same value is sanitized at one sink and not the other.

**File/line refs.** `src/pages/OpportunityBoard.jsx:72` (`isExternal`), `:100-103` (`postLink` href/Link).

**Implementation prompt (self-contained).**
> In `src/pages/OpportunityBoard.jsx`, route `postLink` through `safeHttpUrl` the same way
> `viewLink` already is: compute `const safePost = safeHttpUrl(card.postLink)` and only render
> the external `<a href={safePost}>` when it is truthy; otherwise fall back to the existing
> internal `<Link>` (for genuinely relative routes) or render a disabled CTA. Keep behavior
> identical for valid `https://` links. Touch ONLY `src/pages/OpportunityBoard.jsx`.

**Verification.** A card whose `link` is `javascript:alert(1)` renders a disabled/inert CTA, not a clickable `javascript:` href; valid `https://` links still open in a new tab. `npm run build` succeeds.

### LOW-N3 — Avatar upload uses an unsanitized file extension in the storage key  *(measure #56)*

**Current state.** Both avatar upload paths derive the storage key extension from the
user-controlled filename (`ext = file.name.split('.').pop()`), then build
`${Date.now()}-${random}.${ext}`. Storage keys cannot escape the bucket and the bucket
enforces `allowed_mime_types` + size (migration `009`), and `safeMime` (not `file.type`) is
the stored content type — so this is very low risk, but the raw extension is sloppy and
inconsistent with the resume path, which sanitizes its filename.

**File/line refs.** `src/pages/ResumeReviews.jsx:463-465`, `src/pages/CoffeeChat.jsx` (avatar upload, ~`:416-428`).

**Implementation prompt (self-contained).**
> In `src/pages/ResumeReviews.jsx` and `src/pages/CoffeeChat.jsx`, derive the avatar file
> extension from the already-validated MIME (`image/png`→`png`, `image/jpeg`→`jpg`,
> `image/webp`→`webp`) instead of the user filename, or sanitize the popped extension with
> `replace(/[^a-z0-9]/gi, '')` before using it in the storage key. No behavior change for
> valid uploads. Touch ONLY those two files (disjoint edits).

**Verification.** Uploading an avatar named `x.png/../../evil` produces a clean key like `<ts>-<rand>.png`; `npm run build` succeeds.

### LOW-N4 — CSP: remove likely-dead `img-src` origins and add `object-src 'none'`  *(measure #57)*

**Current state.** The CSP `img-src` allows `https://www.google.com` and `https://*.gstatic.com`
with no apparent use in the app (Google Fonts uses `fonts.gstatic.com`, already in
`font-src`). Dead origins widen the policy for no reason (HIGH-6 lesson: "don't leave dead
origins in the CSP"). There is also no explicit `object-src 'none'` (covered transitively by
`default-src 'self'`, but worth pinning).

**File/line refs.** `vercel.json:12`. (`public/_headers` is an inert leftover from the
pre-Vercel Cloudflare Pages setup — not read by the current host, no need to edit it.)

**Implementation prompt (self-contained).**
> Confirm nothing in the app loads an image from `www.google.com` or `gstatic.com`
> (`grep -rn "google.com\|gstatic" src index.html`). If unused, remove `https://www.google.com`
> and `https://*.gstatic.com` from the `img-src` directive, and add `object-src 'none'`, in
> **both** `public/_headers` and `vercel.json` — keep the two policies byte-for-byte identical.
> Change nothing else in the CSP. Touch ONLY `public/_headers` and `vercel.json`.

**Verification.** `diff` the CSP string between `public/_headers` and `vercel.json` — identical; the removed origins are gone, `object-src 'none'` present; `npm run build` succeeds.

---

## Verified safe (no action)

- **`dangerouslySetInnerHTML`** (Home, article pages, etc.) renders only **static i18n /
  content** (`t.*`, hardcoded arrays) — never user-submitted data — and `script-src 'self'`
  (no `unsafe-inline`) blocks inline-handler execution even if markup were injected. Keep
  these sources static.
- **Public reads** (`coffee_chat_profiles`, `resume_submissions`, `opportunities`,
  `resume_submissions.target_companies`) are column-scoped; PII (`email`, `linkedin_url`,
  `consented_at`, `submitted_by`) is revoked at the GRANT layer and not selected. Request
  tables have **no** anon SELECT policy.
- **Uploads** validate size + MIME allow-list (+ `%PDF` magic bytes for resumes) and store an
  explicit server-chosen content type, never `file.type`.
- **Edge functions** force `status`/`public_profile` server-side, escape email HTML, strip
  newlines from subjects, return generic errors, gate on Turnstile (public forms) or a
  timing-safe webhook secret (webhook functions).
- **No `VITE_` secrets**: only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_TURNSTILE_SITE_KEY` (all public by design). `archive/` is unreferenced and not built.
- **Dependencies**: production `npm audit` = 0; the 2 remaining moderate advisories are
  dev-only (esbuild/Vite dev server) and already documented as a deliberate deferral.

---

## Decisions (resolved — kept as a record of what was chosen)

1. **HIGH-N1 — newsletter gating approach.** ✅ Option (a) was chosen (migration `017`).
   - (a) **[Recommended]** Add a `subscriber` type to `submit-form` (Turnstile + service-role
     insert), revoke anon INSERT, wire both subscribe boxes through it. Consistent with every
     other form; adds a Turnstile challenge to the inline email box.
   - (b) Build a dedicated `subscribe` edge function instead (more code, same result).
   - (c) Keep the direct insert but accept the risk (not recommended — leaves the
     email-amplification vector open).
   - Also: keep the instant welcome email on signup? (Recommended: yes — gating fixes the abuse.)

2. **MED-N1 — secondary-forms scope.** ✅ Option (a) was chosen (migration `019`).
   - (a) **[Recommended]** Fully gate all six (Turnstile + `submit-form` + revoke anon INSERT).
     Most work; adds a Turnstile widget to six forms.
   - (b) Revoke anon INSERT + DB mitigations only, defer the Turnstile UX (faster, leaves the
     forms unusable until rewired — so only viable bundled with (a)).
   - (c) Accept as low-value spam targets (no read-back, no email); rely on existing length
     caps + manual cleanup.