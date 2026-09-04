# Backup & Restore Runbook

Operational runbook for backing up and restoring the production database and
storage for this project (Supabase Postgres 17, project ref
`kdkeerhukydxwoycjuwl`, region `us-east-1`). Hosting is Vercel (frontend) +
Supabase (backend). This addresses security-audit item **LOW-1**.

> **Audience:** the operator (project owner). Run the
> [validation command](#validate) once end-to-end before trusting this runbook.

---

## 1. Backup tiers

Supabase performs platform-level backups automatically. What you get depends on
the billing plan. **This project is currently on the Free tier (pre-launch).**

| | **Free (active now)** | **Pro (paid, ~$25/mo + usage)** |
|---|---|---|
| Automated backups | Daily, best-effort | Daily, scheduled |
| Retention | Short (a few days) | 7 days (longer add-on available) |
| Point-in-time recovery (PITR) | ❌ No | ✅ Yes (add-on, billed) |
| Self-serve download of backups | ❌ Not exposed on Free | ✅ Dashboard download |
| Restore granularity | Whole-project, last backup only | Any second within retention (PITR) |

On Free tier there is **no PITR and no self-serve backup download**, and the
retention window is short. If the project is paused for inactivity (Free-tier
behavior), restore the project before any backup/restore work below.

> ### DECISION: enable Pro for PITR?
>
> **Status: NOT enabled (Free tier).** This is acceptable pre-launch because the
> data volume is small and the manual weekly export below is the real safety net.
>
> **Re-evaluate at launch / first real users.** Once the mailing list and
> submissions hold data you can't recreate, enabling **Supabase Pro + PITR**
> (paid) gives second-level recovery and removes reliance on a human running the
> weekly export. Until then, the manual export in §2 is mandatory.

---

## 2. Manual weekly export (the real safety net)

Run this **weekly** (and before any risky migration). It produces an
off-platform copy that does not depend on Supabase's Free-tier retention.

### 2.0 Tables to export

These are the data tables worth protecting (names verified against
`supabase/migrations/`):

**Primary (the audit calls these out):**

- `subscribers` — newsletter / mailing list
- `waitlist_subscribers` — waitlist signups
- `coffee_chat_profiles` — coffee-chat user submissions
- `resume_submissions` — resume submission rows (PDFs live in storage, see §2.4)
- `opportunities` — opportunity submissions
- `panelists` — panelist submissions

**Also present in this schema (export too — they hold user input):**

- `bridge_year_subscribers`, `bridge_year_suggestions`
- `interview_prep_requests`, `linkedin_episode_requests`
- `panel_suggestions`, `template_requests`
- `audit_log` (security/audit trail; nice to keep)

The simplest correct approach is to dump the **whole `public` schema** (§2.2),
which captures all of the above plus anything added later. Per-table CSV (§2.3)
is for sharing/inspecting individual tables.

### 2.1 Get the DB connection string (do NOT hardcode it)

Dashboard → **Project Settings → Database → Connection string → URI**. Use the
**Session / direct** connection (port 5432) for dumps. Then export it to an env
var for the session — never paste credentials into a file or commit them:

```bash
export DB_URL='postgresql://postgres:[YOUR-PASSWORD]@db.kdkeerhukydxwoycjuwl.supabase.co:5432/postgres'
mkdir -p backups
```

### 2.2 Full SQL dump (recommended — captures everything)

Using the Supabase CLI (already linked to this project locally):

```bash
# Full logical dump of the public schema (schema + data)
supabase db dump --db-url "$DB_URL" -f "backups/$(date +%F).sql"

# Data only (no DDL) — pairs with `supabase db push` for restore
supabase db dump --db-url "$DB_URL" --data-only -f "backups/$(date +%F)-data.sql"
```

If you prefer raw `pg_dump` (same result, no CLI):

```bash
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges \
  -f "backups/$(date +%F).sql"
```

### 2.3 Per-table CSV (for sharing / spot checks)

The Dashboard **SQL editor cannot run `COPY ... TO STDOUT`** (no client-side file
access). Two working options:

**(a) Table Editor → Export.** Dashboard → **Table Editor** → pick a table →
**⋮ / Export → Export to CSV**. Repeat per table. Good for ad-hoc, but manual.

**(b) `psql \copy` (client-side, scriptable):**

```bash
for t in subscribers waitlist_subscribers coffee_chat_profiles \
         resume_submissions opportunities panelists; do
  psql "$DB_URL" -c "\copy (select * from $t) to 'backups/${t}-$(date +%F).csv' csv header"
done
```

`\copy` (with the backslash) runs client-side and writes to your local disk,
unlike server-side `COPY`.

### 2.4 Storage buckets (handled separately — NOT in the SQL dump)

The SQL dump does **not** include bucket file contents. Two buckets exist
(codified in `supabase/migrations/009_storage_hardening.sql`):

- `resumes` — **private**, `application/pdf` only, 5MB cap. Holds submitted
  resume PDFs under a `pending/` prefix. **Sensitive — store the export
  privately.**
- `avatars` — **public**, images only, 2MB cap.

Download bucket contents out-of-band:

```bash
# Per object via the CLI storage commands (verify availability in your CLI version):
supabase storage ls ss:///resumes --experimental
supabase storage cp -r ss:///resumes "backups/resumes-$(date +%F)/" --experimental
supabase storage cp -r ss:///avatars "backups/avatars-$(date +%F)/" --experimental
```

If `supabase storage` is unavailable in your CLI version, download objects from
**Dashboard → Storage → resumes / avatars**, or script it with the storage REST
API using the service-role key. The **bucket configuration and policies** (size
caps, MIME limits, RLS) are already in migration `009`, so those restore via
migrations — only the **file blobs** need manual backup.

---

## 3. Restore checklist

Use this to rebuild from scratch (project deleted, corrupted, or migrating).

1. **Create / restore the project.**
   - If the existing project is just paused: restore it from the Dashboard, then
     skip to step 5 (verify) if data is intact.
   - If rebuilding: create a new Supabase project (same region `us-east-1`,
     Postgres 17). Note the new project ref.

2. **Re-link the CLI** to the (new) project:
   ```bash
   supabase link --project-ref <NEW-OR-SAME-REF>
   ```

3. **Apply schema via migrations** (source of truth is
   `supabase/migrations/`, applied in numeric order 001→021):
   ```bash
   supabase db push
   ```
   This recreates all tables, RLS policies, the `audit_log`, input constraints,
   AND the storage buckets + storage policies (migration `009`). A fresh
   `db push` against an empty project has been verified to complete cleanly
   through migration `021`.

4. **Restore data** from the most recent backup:
   ```bash
   # From the data-only SQL dump:
   psql "$DB_URL" -f backups/<DATE>-data.sql

   # OR per-table from CSV:
   psql "$DB_URL" -c "\copy waitlist_subscribers from 'backups/waitlist_subscribers-<DATE>.csv' csv header"
   # ...repeat per table
   ```
   If you restored from a **full** dump (not data-only) into a fresh empty DB,
   you can skip `db push` and load the full `.sql` instead — but the
   migrations-first path is preferred because it guarantees current RLS/policies.

5. **Re-set edge-function secrets.** These are NOT in any dump and NOT in git.
   Set each via `supabase secrets set` (or Dashboard → Edge Functions → Secrets):

   | Secret | Used by |
   |---|---|
   | `TURNSTILE_SECRET` / `TURNSTILE_SECRET_KEY` | Turnstile verification |
   | `WEBHOOK_SECRET` | webhook auth |
   | `ALLOWED_ORIGINS` | CORS allow-list |
   | `RESEND_API_KEY` | transactional email |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role inserts |
   | `SUPABASE_SECRET_KEYS` | publishable/secret key validation |

   ```bash
   supabase secrets set TURNSTILE_SECRET=... WEBHOOK_SECRET=... \
     ALLOWED_ORIGINS=... RESEND_API_KEY=... \
     SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_SECRET_KEYS=...
   ```
   (`SUPABASE_URL` is provided by the platform automatically.)

6. **Redeploy edge functions** (the six in `supabase/functions/`). Note that
   `add-to-waitlist`, `send-contact-email`, and `submit-form` MUST keep
   `verify_jwt = false` — this is already pinned in `supabase/config.toml`, so a
   plain deploy preserves it:
   ```bash
   supabase functions deploy
   ```

7. **Re-create storage buckets & policies** — already handled by `db push` in
   step 3 (migration `009`). Then **re-upload bucket file blobs** from the §2.4
   backup (resume PDFs, avatars).

8. **Update the frontend** if the project ref changed: rotate the Supabase URL /
   publishable key in the Vercel project's environment variables and redeploy.

9. **Smoke tests / verify** (step 5 of the audit):
   - Submit the contact form and the waitlist form → confirm a new row appears
     and the welcome email sends.
   - Submit a coffee-chat / resume form → confirm the row inserts and (resume)
     the PDF lands in the private `resumes` bucket.
   - Spot-check row counts against the backup CSV/dump.
   - Confirm anon cannot read PII (RLS) and the public site loads.

---

## 4. Optional: automate the dump (describe only — not implemented)

A weekly **GitHub Actions** scheduled workflow can remove the human from the
loop. Outline (do **not** commit secrets):

- **Trigger:** `on: schedule: - cron: '0 7 * * 1'` (Mondays 07:00 UTC) plus
  `workflow_dispatch` for manual runs.
- **Steps:** install the Supabase CLI → run
  `supabase db dump --db-url "$DB_URL" --data-only -f dump.sql` → optionally
  per-table `\copy` CSVs.
- **Where to put the output:** upload to a **private** destination — an
  `actions/upload-artifact` (private repo, short retention), a private S3 bucket
  (`aws s3 cp`), or another private object store. Do **not** push dumps to a
  public repo; they contain subscriber PII.
- **Secrets:** store `DB_URL` (and any S3/cloud creds) in **GitHub Actions
  repository secrets**, referenced as `${{ secrets.DB_URL }}`. Never inline them.
- **Caveat:** this still does NOT capture storage blobs — add a step using the
  storage REST API / `supabase storage cp` with the service-role key if you want
  resume PDFs covered.

This is a future enhancement; the manual weekly export in §2 is the baseline.

---

## 5. What is NOT backed up by this

- **Storage file blobs** unless you explicitly run §2.4 (resume PDFs, avatars).
  The SQL dump only stores bucket *config/metadata* via migrations, not files.
- **Edge-function secrets** (TURNSTILE_SECRET, WEBHOOK_SECRET, ALLOWED_ORIGINS,
  RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEYS) — keep these
  in your own secrets manager; they are not in git or any dump.
- **Auth users** — if/when Supabase Auth is used, the `auth` schema is not in a
  `--schema=public` dump. Add `--schema=auth` (or a full dump) if needed.
- **Vercel project config / env vars** (Supabase URL, publishable key, build
  settings) — back these up separately.
- **DNS, domain, and third-party config** (Resend, Turnstile keys/site config).
- **Realtime / cron / extension state** beyond what the migrations recreate.

---

## <a id="validate"></a>6. Validate the export works (run once)

You do not need to restore anything to prove the backup path works — just run a
single dump and confirm it produces a non-empty file:

```bash
export DB_URL='<from Dashboard → Project Settings → Database>'
mkdir -p backups && supabase db dump --db-url "$DB_URL" --data-only -f "backups/test-$(date +%F).sql" \
  && ls -lh "backups/test-$(date +%F).sql" \
  && grep -c "INSERT INTO\|COPY " "backups/test-$(date +%F).sql"
```

A non-zero file size and a non-zero match count means the export pipeline works.
Delete the test file afterward (it contains PII): `rm backups/test-*.sql`.