-- ============================================================================
-- Reward redemptions: staff send airtime and data to households.
--
-- The household app now offers airtime and data bundles (GH₵5 / 10 / 20 at
-- 200 points per GH₵1), sent by hand by TrashDrop staff. Its migration
-- 20261030000000_airtime_data_rewards.sql (household repository) adds the
-- phone number and network to rewards_redemption; this one lets staff work
-- through them from the admin site (Reward Redemptions page):
--
--   1. td_capability_roles(): new capability rewards.manage (Admin, Manager);
--      the same table as src/lib/permissions.js
--   2. admin_reward_redemptions(status): redemptions with the household,
--      reward, phone number and network (pending ones oldest first)
--   3. admin_set_redemption_status(id, 'sent' | 'rejected', note): a pending
--      redemption only, once. Rejected needs a reason and gives the points
--      back (the household's balance ignores rejected redemptions). Logged.
--
-- Needs 20261101_role_permissions.sql, 20261104_area_dumping_access.sql and
-- the household migration above (stops with a message if it isn't run yet).
-- Changes no data. Safe to re-run. One transaction.
-- Undo: supabase/diagnostics/reward_redemptions_rollback.sql
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'rewards_redemption' AND column_name = 'phone_number') THEN
    RAISE EXCEPTION 'Run the household migration 20261030000000_airtime_data_rewards.sql first';
  END IF;
END $$;

-- ── 1. capability table (keep in step with src/lib/permissions.js) ────────
CREATE OR REPLACE FUNCTION public.td_capability_roles(p_capability text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_capability
    WHEN 'dashboard.stats' THEN ARRAY['admin', 'manager']
    WHEN 'dashboard.liveQueue' THEN ARRAY['admin', 'manager']
    WHEN 'requests.view' THEN ARRAY['admin', 'manager']
    WHEN 'requests.assign' THEN ARRAY['admin', 'manager']
    WHEN 'requests.cancel' THEN ARRAY['admin', 'manager']
    WHEN 'requests.locate' THEN ARRAY['admin']
    WHEN 'collectors.view' THEN ARRAY['admin']
    WHEN 'alerts.view' THEN ARRAY['admin']
    WHEN 'logs.view' THEN ARRAY['admin']
    WHEN 'bags.view' THEN ARRAY['admin']
    WHEN 'bags.manage' THEN ARRAY['admin']
    WHEN 'dumping.view' THEN ARRAY['admin', 'manager', 'authority', 'media', 'volunteer', 'user']
    WHEN 'dumping.reporters' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.verify' THEN ARRAY['admin', 'manager', 'authority', 'media', 'volunteer']
    WHEN 'dumping.assign' THEN ARRAY['admin', 'manager', 'authority', 'volunteer']
    WHEN 'dumping.fee' THEN ARRAY['admin', 'manager', 'authority']
    WHEN 'dumping.markCleaned' THEN ARRAY['admin', 'manager', 'authority', 'volunteer']
    WHEN 'dumping.manage' THEN ARRAY['admin', 'manager']
    WHEN 'reports.view' THEN ARRAY['admin', 'manager', 'media', 'authority', 'volunteer']
    WHEN 'reports.export' THEN ARRAY['admin', 'manager', 'media', 'authority', 'volunteer']
    WHEN 'users.manage' THEN ARRAY['admin']
    WHEN 'settings.manage' THEN ARRAY['admin']
    WHEN 'rewards.manage' THEN ARRAY['admin', 'manager']
    ELSE ARRAY[]::text[] END
$$;

-- ── 2. the list ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reward_redemptions(p_status text DEFAULT 'pending')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.can_do('rewards.manage') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(x) ORDER BY
             CASE WHEN p_status = 'pending' THEN x.created_at END ASC,
             CASE WHEN p_status IS DISTINCT FROM 'pending' THEN x.created_at END DESC)
      FROM (
        SELECT rr.id::text AS id, rr.created_at, coalesce(rr.status, 'pending') AS status, rr.points_spent,
               rr.phone_number, rr.network, rr.sent_at, rr.staff_note,
               r.name AS reward_name, r.category AS reward_category,
               rr.user_id,
               coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
                        split_part(u.email, '@', 1)) AS household_name,
               coalesce(p.email, u.email::text) AS household_email
          FROM public.rewards_redemption rr
          LEFT JOIN public.rewards r ON r.id = rr.reward_id
          LEFT JOIN public.profiles p ON p.id = rr.user_id
          LEFT JOIN auth.users u ON u.id = rr.user_id
         WHERE p_status IS NULL OR coalesce(rr.status, 'pending') = p_status
         LIMIT 500
      ) x), '[]'::jsonb);
END $$;

-- ── 3. sent or rejected ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_redemption_status(p_id text, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  done jsonb;
BEGIN
  IF NOT public.can_do('rewards.manage') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('sent', 'rejected') THEN
    RAISE EXCEPTION 'Status must be sent or rejected';
  END IF;
  IF p_status = 'rejected' AND nullif(btrim(coalesce(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for rejecting it';
  END IF;

  -- Pending only, so two staff can't both send the same one
  UPDATE public.rewards_redemption rr
     SET status = p_status,
         sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE rr.sent_at END,
         handled_by = auth.uid(),
         staff_note = nullif(btrim(coalesce(p_note, '')), '')
   WHERE rr.id::text = p_id AND coalesce(rr.status, 'pending') = 'pending'
  RETURNING jsonb_build_object('id', rr.id::text, 'status', rr.status, 'points_spent', rr.points_spent,
                               'phone_number', rr.phone_number, 'network', rr.network, 'user_id', rr.user_id)
    INTO done;

  IF done IS NULL THEN
    RAISE EXCEPTION 'This redemption was already handled, or no longer exists';
  END IF;

  PERFORM public.td_write_log('info', 'admin',
    CASE WHEN p_status = 'sent' THEN 'reward.sent' ELSE 'reward.rejected' END,
    'reward_redemption', p_id,
    CASE WHEN p_status = 'sent'
         THEN format('Reward sent to %s (%s)', done ->> 'phone_number', done ->> 'network')
         ELSE format('Reward rejected, %s points returned: %s', done ->> 'points_spent', btrim(p_note)) END,
    jsonb_build_object('status', 'pending'), done);
  RETURN done;
END $$;

REVOKE ALL ON FUNCTION public.admin_reward_redemptions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_redemption_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reward_redemptions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_redemption_status(text, text, text) TO authenticated;

COMMIT;
