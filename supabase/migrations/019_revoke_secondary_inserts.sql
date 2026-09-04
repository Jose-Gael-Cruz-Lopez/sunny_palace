-- 019_revoke_secondary_inserts.sql
--
-- MED-N1 (anti-abuse / Turnstile): close the direct anon INSERT path on the six
-- "secondary" public forms. Each of these previously did an UNGATED anon insert
-- straight to /rest/v1/<table> with the publishable (anon) key and a permissive
-- `WITH CHECK (true)` policy — no Turnstile, no human in the loop — making each one
-- a write-spam vector an attacker could script arbitrarily.
--
-- Mirroring migration 007 (HIGH-1) and migration 017 (HIGH-N1), these forms now
-- route through the `submit-form` edge function, which runs with the service role
-- AFTER verifying a Cloudflare Turnstile token and whitelisting writable columns.
-- The service role bypasses RLS, so legitimate gated submissions still land. We
-- revoke the table-level anon INSERT grant here so the Turnstile gate can't be
-- bypassed by POSTing straight to PostgREST with the anon key.
--
-- Defense-in-depth: each insert policy is rewritten to WITH CHECK (false) so even
-- if a table-level INSERT grant were ever re-added by mistake, RLS still denies
-- anon inserts (harmless once the grant is gone, but it keeps the system safe).
--
-- This does NOT touch the email-format / char_length CHECK constraints from
-- migration 011 — those remain as-is.

REVOKE INSERT ON template_requests FROM anon;
DROP POLICY IF EXISTS "template_requests_insert" ON template_requests;
CREATE POLICY "template_requests_insert" ON template_requests FOR INSERT WITH CHECK (false);

REVOKE INSERT ON bridge_year_suggestions FROM anon;
DROP POLICY IF EXISTS "bridge_year_insert" ON bridge_year_suggestions;
CREATE POLICY "bridge_year_insert" ON bridge_year_suggestions FOR INSERT WITH CHECK (false);

REVOKE INSERT ON interview_prep_requests FROM anon;
DROP POLICY IF EXISTS "interview_prep_insert" ON interview_prep_requests;
CREATE POLICY "interview_prep_insert" ON interview_prep_requests FOR INSERT WITH CHECK (false);

REVOKE INSERT ON panel_suggestions FROM anon;
DROP POLICY IF EXISTS "panel_suggestions_insert" ON panel_suggestions;
CREATE POLICY "panel_suggestions_insert" ON panel_suggestions FOR INSERT WITH CHECK (false);

REVOKE INSERT ON linkedin_episode_requests FROM anon;
DROP POLICY IF EXISTS "linkedin_requests_insert" ON linkedin_episode_requests;
CREATE POLICY "linkedin_requests_insert" ON linkedin_episode_requests FOR INSERT WITH CHECK (false);

REVOKE INSERT ON bridge_year_subscribers FROM anon;
DROP POLICY IF EXISTS "bridge_year_subscribers_insert" ON bridge_year_subscribers;
CREATE POLICY "bridge_year_subscribers_insert" ON bridge_year_subscribers FOR INSERT WITH CHECK (false);


-- ============================================================================
-- ADDED FOR ISSUE #78 (appended, not part of the original 019 migration above)
--
-- Backfills objects that were applied by hand on the live database and never
-- captured in any migration, but are relied on by migrations 020 and 021.
-- Appended here (rather than as a separately-numbered file) because this
-- repo's sequential integer migration numbering has no value between 019
-- and 020 for a new file to occupy. Since 019 has already been applied to
-- the live project, editing this file's content has no effect on the live
-- database — it only affects fresh rebuilds (local dev, disaster recovery)
-- going forward, which is exactly what's needed here.
-- ============================================================================

-- ----------------------------------------------------------------
-- 1. coffee_chat_admins table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."coffee_chat_admins" (
    "email" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."coffee_chat_admins" OWNER TO "postgres";

ALTER TABLE ONLY "public"."coffee_chat_admins"
    ADD CONSTRAINT "coffee_chat_admins_pkey" PRIMARY KEY ("email");

ALTER TABLE "public"."coffee_chat_admins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coffee_chat_admins_self_check" ON "public"."coffee_chat_admins"
    FOR SELECT TO "authenticated"
    USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))));

-- ----------------------------------------------------------------
-- 2. Trigger functions
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;
ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."coffee_chat_set_approved_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."coffee_chat_set_approved_at"() OWNER TO "postgres";

-- rls_auto_enable: created because migration 020 REVOKEs EXECUTE on it.
-- NOTE: no event trigger currently exists on the live DB that calls this
-- function, so we create the function only, not an event trigger.
CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

-- ----------------------------------------------------------------
-- 3. Coffee chat admin RPCs
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."is_coffee_chat_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM coffee_chat_admins
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
ALTER FUNCTION "public"."is_coffee_chat_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_approve_coffee_chat_profile"("profile_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_coffee_chat_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE coffee_chat_profiles SET status = 'approved' WHERE id = profile_id;
END;
$$;
ALTER FUNCTION "public"."admin_approve_coffee_chat_profile"("profile_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_reject_coffee_chat_profile"("profile_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_coffee_chat_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE coffee_chat_profiles SET status = 'rejected' WHERE id = profile_id;
END;
$$;
ALTER FUNCTION "public"."admin_reject_coffee_chat_profile"("profile_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_list_pending_coffee_chat_profiles"() RETURNS TABLE("id" "uuid", "name" "text", "pronouns" "text", "email" "text", "linkedin_url" "text", "role_title" "text", "location" "text", "role_function" "text"[], "identity_tags" "text"[], "topics" "text", "capacity" "text", "avatar_url" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_coffee_chat_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.name, p.pronouns, p.email, p.linkedin_url,
           p.role_title, p.location, p.role_function, p.identity_tags,
           p.topics, p.capacity, p.avatar_url, p.created_at
    FROM coffee_chat_profiles p
    WHERE p.status = 'pending'
    ORDER BY p.created_at ASC;
END;
$$;
ALTER FUNCTION "public"."admin_list_pending_coffee_chat_profiles"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_set_featured_coffee_chat_profile"("profile_id" "uuid", "is_featured" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_coffee_chat_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE coffee_chat_profiles SET featured = is_featured WHERE id = profile_id;
END;
$$;
ALTER FUNCTION "public"."admin_set_featured_coffee_chat_profile"("profile_id" "uuid", "is_featured" boolean) OWNER TO "postgres";

-- ----------------------------------------------------------------
-- 4. Trigger for the coffee-chat approved_at column (in scope for #78)
-- ----------------------------------------------------------------
-- NOTE: trg_businesses_updated_at, trg_campaigns_updated_at, trg_cbl_updated_at,
-- trg_clients_updated_at, and trg_loyalty_configs_updated_at were intentionally
-- left out here. They also use set_updated_at() on the live DB, but their target
-- tables (businesses, campaigns, client_business_loyalty, clients,
-- loyalty_configs) are outside the coffee-chat/avatar scope of issue #78 and
-- are not created by any migration up to this point -- likely the same class
-- of hand-applied-to-live drift as #78/#91, but in an unrelated feature area.
-- That should be filed and fixed as its own issue rather than folded in here.
CREATE OR REPLACE TRIGGER "coffee_chat_approved_at_trigger" BEFORE UPDATE ON "public"."coffee_chat_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."coffee_chat_set_approved_at"();

-- ----------------------------------------------------------------
-- 5. Storage policy for avatar uploads
-- ----------------------------------------------------------------
CREATE POLICY "avatar_upload" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'avatars');

-- Not recreating avatar_public_read: confirmed it doesn't exist on the
-- live database, and migration 021's DROP POLICY IF EXISTS already
-- handles its absence safely.