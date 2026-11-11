-- Email a person when the TrashDrop team approves or rejects their requested
-- account type (MMDA, Manager, Media, Volunteer). Until now the decision was
-- only an in-app notification, so a pending account had to keep signing in to
-- find out.
--
-- Deliberately standalone, like 20261114_pickup_email_alerts.sql: new objects
-- only. No trigger on account_roles and no change to admin_review_account_role
-- or any other existing function, rule or cron job, so a problem here cannot
-- affect approvals. A once-a-minute job reads account_roles, finds decisions it
-- has not emailed and calls the access-decision-emails Edge Function, which
-- sends through Resend with the RESEND_API_KEY the pickup alerts already use.
--
-- Undo: supabase/diagnostics/access_decision_emails_rollback.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- One row per decision (an account can be reviewed more than once, so the
-- review time is part of the key): the delivery log, and what stops a second
-- email. No foreign key, so it never restricts account rows.
CREATE TABLE public.td_access_decision_emails (
  user_id         uuid NOT NULL,
  reviewed_at     timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reviewed_at)
);
CREATE INDEX td_access_decision_emails_pending_idx
  ON public.td_access_decision_emails (created_at) WHERE status = 'pending';

-- Service role only: RLS on with no policies, and no table grants.
ALTER TABLE public.td_access_decision_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.td_access_decision_emails FROM anon, authenticated;

-- Decisions already made are history: going live emails nobody about them.
INSERT INTO public.td_access_decision_emails (user_id, reviewed_at, status)
SELECT r.user_id, r.reviewed_at, 'skipped'
  FROM public.account_roles r
 WHERE r.reviewed_at IS NOT NULL AND r.status IN ('approved', 'rejected');

-- Finds new decisions, claims up to p_limit for sending and returns them. A
-- claim stops overlapping runs picking the same row; an unsent claim is retried
-- after two minutes, five attempts at most. A decision replaced by a newer one
-- before it was sent is skipped, so only the latest outcome is emailed.
CREATE FUNCTION public.td_access_email_claim(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_keys text[];
  v_decisions jsonb;
BEGIN
  INSERT INTO public.td_access_decision_emails (user_id, reviewed_at)
  SELECT r.user_id, r.reviewed_at
    FROM public.account_roles r
   WHERE r.reviewed_at IS NOT NULL AND r.status IN ('approved', 'rejected')
  ON CONFLICT DO NOTHING;

  UPDATE public.td_access_decision_emails e
     SET status = 'skipped'
   WHERE e.status = 'pending'
     AND NOT EXISTS (
       SELECT 1 FROM public.account_roles r
        WHERE r.user_id = e.user_id AND r.reviewed_at = e.reviewed_at
          AND r.status IN ('approved', 'rejected'));

  WITH picked AS (
    SELECT e.user_id, e.reviewed_at
      FROM public.td_access_decision_emails e
     WHERE e.status = 'pending'
       AND e.attempts < 5
       AND (e.last_attempt_at IS NULL OR e.last_attempt_at < now() - interval '2 minutes')
     ORDER BY e.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
       FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.td_access_decision_emails e
       SET attempts = e.attempts + 1, last_attempt_at = now()
      FROM picked
     WHERE e.user_id = picked.user_id AND e.reviewed_at = picked.reviewed_at
    RETURNING e.user_id, e.reviewed_at
  )
  SELECT array_agg(claimed.user_id::text || '/' || claimed.reviewed_at::text) INTO v_keys FROM claimed;

  IF v_keys IS NULL THEN
    RETURN jsonb_build_object('decisions', '[]'::jsonb);
  END IF;

  -- Only what the email needs: the person's own address and first name, the
  -- outcome, and the reviewer's note (which the person already sees in the app).
  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
    INTO v_decisions
    FROM (
      SELECT r.user_id,
             r.reviewed_at,
             u.email,
             nullif(btrim(coalesce(u.raw_user_meta_data ->> 'firstName', '')), '') AS first_name,
             r.status AS decision,
             r.role,
             r.requested_role,
             r.review_note AS note
        FROM public.account_roles r
        JOIN auth.users u ON u.id = r.user_id
       WHERE r.user_id::text || '/' || r.reviewed_at::text = ANY (v_keys)
    ) d;

  RETURN jsonb_build_object('decisions', v_decisions);
END;
$$;

CREATE FUNCTION public.td_access_email_mark(p_user_id uuid, p_reviewed_at timestamptz, p_ok boolean, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.td_access_decision_emails e
     SET status = CASE WHEN p_ok THEN 'sent' WHEN e.attempts >= 5 THEN 'failed' ELSE 'pending' END,
         sent_at = CASE WHEN p_ok THEN now() ELSE e.sent_at END,
         last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END
   WHERE e.user_id = p_user_id AND e.reviewed_at = p_reviewed_at;
$$;

-- The job's shared secret stays in Vault, never in this public repository.
SELECT vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'td_access_email_cron_secret');

CREATE FUNCTION public.td_access_email_secret_ok(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets s
     WHERE s.name = 'td_access_email_cron_secret' AND s.decrypted_secret = p_secret
  );
$$;

REVOKE ALL ON FUNCTION public.td_access_email_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_access_email_mark(uuid, timestamptz, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_access_email_secret_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.td_access_email_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.td_access_email_mark(uuid, timestamptz, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.td_access_email_secret_ok(text) TO service_role;

SELECT cron.schedule(
  'td-access-decision-emails',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://tfdedlqdsajjdjkerkli.supabase.co/functions/v1/access-decision-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'td_access_email_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

COMMIT;
