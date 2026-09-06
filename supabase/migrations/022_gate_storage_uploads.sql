-- ============================================================
-- 022 — Gate storage uploads behind the Turnstile-verified edge
--        function (issue #79)
-- ============================================================
-- avatar_upload (migration 019) and resume_upload (migrations 001/009)
-- allowed ANY anonymous request to INSERT directly into the `avatars` /
-- `resumes` buckets via the Storage REST API using the public anon key —
-- completely bypassing the Cloudflare Turnstile check that gates every
-- other write in this app. A script could hit the storage endpoint
-- straight, with no CAPTCHA, and spam up to the bucket's 2MB/5MB
-- per-file limit indefinitely (storage-quota exhaustion / DoS).
--
-- All avatar/resume uploads now flow through supabase/functions/submit-
-- form (multipart/form-data), which verifies Turnstile BEFORE uploading
-- and runs with the service role — which bypasses RLS entirely, so no
-- INSERT policy is needed for it to keep working. Dropping these
-- policies removes the only path anon had into either bucket.
--
-- Safe to re-run: DROP POLICY IF EXISTS.
-- ============================================================

DROP POLICY IF EXISTS "avatar_upload" ON storage.objects;
DROP POLICY IF EXISTS "resume_upload" ON storage.objects;

-- resume_admin_select (service_role SELECT on the resumes bucket) is
-- untouched — the admin review flow still needs to read pending PDFs.
