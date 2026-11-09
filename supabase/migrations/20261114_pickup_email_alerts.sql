-- Email an alert to the chosen admin accounts for every new digital bin and bag
-- pickup request.
--
-- Deliberately standalone: this adds new objects only. It puts no trigger on
-- digital_bins or pickup_requests and changes no existing function, view, rule
-- or cron job, so a problem here cannot affect booking, pricing or assignment.
-- A once-a-minute job only reads the request tables, finds rows it has not seen
-- and calls the pickup-email-alerts Edge Function.
--
-- Nothing is emailed until the function is deployed, RESEND_API_KEY is set and
-- at least one account is added to td_pickup_email_recipients. Accounts are
-- added when going live, not here, because this repository is public.
-- Undo: supabase/diagnostics/pickup_email_alerts_rollback.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Who gets the alerts. The address is read live from the account, so it follows
-- any change of email on file.
CREATE TABLE public.td_pickup_email_recipients (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per request: the delivery log, and what stops a second email.
-- No foreign key to the request tables, so it never restricts their rows.
CREATE TABLE public.td_pickup_email_alerts (
  source          text NOT NULL CHECK (source IN ('pickup_requests', 'digital_bins')),
  request_id      text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts        integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, request_id)
);
CREATE INDEX td_pickup_email_alerts_pending_idx
  ON public.td_pickup_email_alerts (created_at) WHERE status = 'pending';

-- Service role only: RLS on with no policies, and no table grants.
ALTER TABLE public.td_pickup_email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.td_pickup_email_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.td_pickup_email_recipients FROM anon, authenticated;
REVOKE ALL ON public.td_pickup_email_alerts FROM anon, authenticated;

-- Requests that already exist are history: mark them so going live does not
-- email the whole backlog.
INSERT INTO public.td_pickup_email_alerts (source, request_id, status)
SELECT 'pickup_requests', p.id::text, 'skipped' FROM public.pickup_requests p;
INSERT INTO public.td_pickup_email_alerts (source, request_id, status)
SELECT 'digital_bins', b.id::text, 'skipped' FROM public.digital_bins b;

-- Finds new requests, claims up to p_limit for sending and returns them with
-- the recipients. A claim stops overlapping runs picking the same row; an
-- unsent claim is retried after two minutes, five attempts at most.
CREATE FUNCTION public.td_pickup_email_claim(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_recipients jsonb;
  v_keys text[];
  v_requests jsonb;
BEGIN
  INSERT INTO public.td_pickup_email_alerts (source, request_id)
  SELECT 'pickup_requests', p.id::text FROM public.pickup_requests p
  ON CONFLICT DO NOTHING;
  INSERT INTO public.td_pickup_email_alerts (source, request_id)
  SELECT 'digital_bins', b.id::text FROM public.digital_bins b
  ON CONFLICT DO NOTHING;

  SELECT jsonb_agg(u.email)
    INTO v_recipients
    FROM public.td_pickup_email_recipients r
    JOIN auth.users u ON u.id = r.user_id
   WHERE u.email IS NOT NULL;

  -- No recipients yet: keep everything pending and use up no attempts.
  IF v_recipients IS NULL THEN
    RETURN jsonb_build_object('recipients', '[]'::jsonb, 'requests', '[]'::jsonb);
  END IF;

  WITH picked AS (
    SELECT a.source, a.request_id
      FROM public.td_pickup_email_alerts a
     WHERE a.status = 'pending'
       AND a.attempts < 5
       AND (a.last_attempt_at IS NULL OR a.last_attempt_at < now() - interval '2 minutes')
     ORDER BY a.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
       FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.td_pickup_email_alerts a
       SET attempts = a.attempts + 1, last_attempt_at = now()
      FROM picked
     WHERE a.source = picked.source AND a.request_id = picked.request_id
    RETURNING a.source, a.request_id
  )
  SELECT array_agg(claimed.source || '/' || claimed.request_id) INTO v_keys FROM claimed;

  IF v_keys IS NULL THEN
    RETURN jsonb_build_object('recipients', v_recipients, 'requests', '[]'::jsonb);
  END IF;

  -- The same view the Requests page reads. Customer name and contact details
  -- are not selected, so they never reach an inbox.
  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
    INTO v_requests
    FROM (
      SELECT v.source, v.id AS request_id, v.created_at, v.address, v.waste_type,
             v.bag_count, v.bin_size_liters, v.fee, v.is_urgent, v.scheduled_date
        FROM public.admin_pickup_requests v
       WHERE v.source || '/' || v.id = ANY (v_keys)
    ) d;

  RETURN jsonb_build_object('recipients', v_recipients, 'requests', v_requests);
END;
$$;

CREATE FUNCTION public.td_pickup_email_mark(p_source text, p_request_id text, p_ok boolean, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.td_pickup_email_alerts a
     SET status = CASE WHEN p_ok THEN 'sent' WHEN a.attempts >= 5 THEN 'failed' ELSE 'pending' END,
         sent_at = CASE WHEN p_ok THEN now() ELSE a.sent_at END,
         last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END
   WHERE a.source = p_source AND a.request_id = p_request_id;
$$;

-- The job's shared secret stays in Vault, never in this public repository.
SELECT vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'td_pickup_email_cron_secret');

CREATE FUNCTION public.td_pickup_email_secret_ok(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets s
     WHERE s.name = 'td_pickup_email_cron_secret' AND s.decrypted_secret = p_secret
  );
$$;

REVOKE ALL ON FUNCTION public.td_pickup_email_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_pickup_email_mark(text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.td_pickup_email_secret_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.td_pickup_email_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.td_pickup_email_mark(text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.td_pickup_email_secret_ok(text) TO service_role;

SELECT cron.schedule(
  'td-pickup-email-alerts',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://tfdedlqdsajjdjkerkli.supabase.co/functions/v1/pickup-email-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'td_pickup_email_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

COMMIT;
