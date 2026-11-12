-- Admins confirm a digital bin's MoMo/e-Cash payment (TD53 follow-up, owner's
-- decision 2026-11-12). Collectors cash out a bin only once its payment is
-- confirmed by the gateway or an admin (bin_payments.confirmed_by,
-- td_withdrawable_items; collector repository 20261112154512). When the
-- gateway never confirms, an admin checks TrendiPay and records the result
-- here: confirmed (confirmed_by = 'staff', set by td_guard_bin_payment) or
-- failed. Every decision is written to Logs with the admin's note.
--
--   1. td_capability_roles(): new capability payments.confirm (Admin);
--   2. admin_bin_payments_to_confirm(): payments awaiting confirmation;
--   3. admin_confirm_bin_payment(id, decision, note).

CREATE OR REPLACE FUNCTION public.td_capability_roles(p_capability text)
returns text[] language sql immutable
set search_path to 'public', 'extensions', 'pg_temp' as $function$
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
    WHEN 'payments.confirm' THEN ARRAY['admin']
    ELSE ARRAY[]::text[]
  END
$function$;

-- MoMo/e-Cash collections not yet confirmed by the gateway or an admin:
-- still pending/initiated, or confirmed only by the collector (or by nobody
-- on record). The client's number is masked.
CREATE OR REPLACE FUNCTION public.admin_bin_payments_to_confirm()
returns table(
  id text, digital_bin_id text, bin_status text, collector_name text,
  payment_mode text, total_bill numeric, collector_share numeric,
  status text, confirmed_by text, client_momo text,
  gateway_reference text, gateway_transaction_id text, gateway_error text,
  created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer
set search_path to 'public' as $function$
begin
  if not public.can_do('payments.confirm') then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  return query
    select bp.id::text, bp.digital_bin_id::text, db.status::text,
           coalesce(nullif(btrim(concat_ws(' ', cp.first_name, cp.last_name)), ''), 'Collector')::text,
           bp.payment_mode, bp.total_bill, bp.collector_share,
           bp.status, bp.confirmed_by,
           case when length(coalesce(bp.client_momo, '')) > 5
                then left(bp.client_momo, 3) || '***' || right(bp.client_momo, 2) else '***' end,
           bp.gateway_reference, bp.gateway_transaction_id, bp.gateway_error,
           bp.created_at, bp.updated_at
      from public.bin_payments bp
      left join public.digital_bins db on db.id = bp.digital_bin_id
      left join public.collector_profiles cp on cp.id = bp.collector_id
     where bp.type = 'collection'
       and bp.payment_mode in ('momo', 'e_cash')
       and (bp.status in ('pending', 'initiated')
            or (bp.status = 'success' and coalesce(bp.confirmed_by, 'collector') = 'collector'))
     order by bp.created_at desc
     limit 200;
end $function$;

-- An admin's decision after checking TrendiPay: 'confirm' (the client paid)
-- or 'fail' (they didn't). A note saying what was checked is required.
CREATE OR REPLACE FUNCTION public.admin_confirm_bin_payment(p_id text, p_decision text, p_note text)
returns jsonb language plpgsql security definer
set search_path to 'public' as $function$
declare
  before_row jsonb;
  done jsonb;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.can_do('payments.confirm') then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('confirm', 'fail') then
    raise exception 'Choose confirm or fail';
  end if;
  if note is null then
    raise exception 'Say what you checked in TrendiPay';
  end if;

  select jsonb_build_object('status', bp.status, 'confirmed_by', bp.confirmed_by) into before_row
    from public.bin_payments bp
   where bp.id::text = p_id and bp.type = 'collection' and bp.payment_mode in ('momo', 'e_cash')
     and (bp.status in ('pending', 'initiated')
          or (bp.status = 'success' and coalesce(bp.confirmed_by, 'collector') = 'collector'))
   for update;
  if before_row is null then
    raise exception 'This payment was already confirmed or failed, or no longer exists';
  end if;

  -- td_guard_bin_payment records confirmed_by = 'staff' for an admin
  update public.bin_payments bp
     set status = case when p_decision = 'confirm' then 'success' else 'failed' end,
         gateway_error = case when p_decision = 'fail' then left('Checked by an admin: ' || note, 500) else bp.gateway_error end,
         updated_at = now()
   where bp.id::text = p_id
  returning jsonb_build_object('id', bp.id::text, 'digital_bin_id', bp.digital_bin_id::text, 'status', bp.status,
                               'confirmed_by', bp.confirmed_by, 'total_bill', bp.total_bill) into done;

  perform public.td_write_log('info', 'admin',
    case when p_decision = 'confirm' then 'payment.confirmed' else 'payment.failed' end,
    'bin_payment', p_id,
    case when p_decision = 'confirm'
         then format('MoMo payment of GHS %s confirmed by an admin: %s', done ->> 'total_bill', note)
         else format('MoMo payment of GHS %s marked failed by an admin: %s', done ->> 'total_bill', note) end,
    before_row, done);
  return done;
end $function$;

revoke all on function public.admin_bin_payments_to_confirm() from public, anon;
revoke all on function public.admin_confirm_bin_payment(text, text, text) from public, anon;
grant execute on function public.admin_bin_payments_to_confirm() to authenticated;
grant execute on function public.admin_confirm_bin_payment(text, text, text) to authenticated;
