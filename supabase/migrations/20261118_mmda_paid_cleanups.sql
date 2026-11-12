-- Cleanup fees (owner's decision 2026-11-12; protected collector payouts,
-- docs/COLLECTOR_PAYOUTS.md in the household repository):
--
--   1. Only an admin or an MMDA (authority) account sets a cleanup fee
--      (dumping.fee: Admin, Authority; managers no longer). Enforced for every
--      route by td_guard_cleanup_fee.
--   2. A cleanup an MMDA assigns is paid by the MMDA to the team directly;
--      TrashDrop only records it (illegal_dumping_mobile.fee_paid_by = 'mmda',
--      stamped from the assigner's role). Until MMDA-funded accounts exist,
--      such cleanups are not cashable on TrashDrop (td_withdrawable_items
--      part C). Cleanups an admin assigns, and claimed ones, are paid by
--      TrashDrop as before.
--   3. collector_assignments_view shows fee_paid_by, so the apps can show who
--      pays.
-- On 2026-11-12: 18 cleanups assigned, all by admins (fee_paid_by =
-- 'trashdrop'); none disposed or cashed out.

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
    WHEN 'dumping.fee' THEN ARRAY['admin', 'authority']
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

alter table public.illegal_dumping_mobile
  add column if not exists fee_paid_by text check (fee_paid_by in ('trashdrop', 'mmda'));
comment on column public.illegal_dumping_mobile.fee_paid_by is
  'Who pays the cleanup team: trashdrop (cashable on TrashDrop) or mmda (the MMDA pays the team; TrashDrop records it). Stamped at assignment.';
update public.illegal_dumping_mobile set fee_paid_by = 'trashdrop'
 where assigned_to is not null and fee_paid_by is null;

CREATE OR REPLACE FUNCTION public.td_stamp_assignment()
returns trigger language plpgsql
set search_path to 'public', 'extensions', 'pg_temp' as $function$
declare current_status text;
begin
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if new.assigned_to is null then
    new.assigned_at := null;
    new.assigned_via := null;
    new.fee_paid_by := null;
  else
    current_status := lower(trim(coalesce(case when tg_op = 'UPDATE' then old.status else new.status end, 'pending')));
    if current_status = 'pending' then
      raise exception 'Verify this report before assigning a cleanup team' using errcode = 'P0001',
        hint = 'Set status to verified first, then assign the team in a separate step.';
    elsif current_status not in ('verified', 'in_progress') then
      raise exception 'Only verified reports can be assigned a cleanup team (this one is %)', current_status using errcode = 'P0001';
    end if;
    new.assigned_at := now();
    new.assigned_via := case when coalesce(current_setting('app.td_claim', true), '') = 'on' then 'claim' else 'admin' end;
    -- An MMDA (or its team) pays the cleanups it assigns; TrashDrop pays the rest
    new.fee_paid_by := case when auth.uid() is not null and public.td_my_role() = 'authority' then 'mmda' else 'trashdrop' end;
  end if;
  return new;
end $function$;

-- Only an admin or an MMDA sets a cleanup fee, whatever the route
CREATE OR REPLACE FUNCTION public.td_guard_cleanup_fee()
returns trigger language plpgsql security definer
set search_path to 'public' as $function$
begin
  if auth.uid() is null then
    return new; -- service key
  end if;
  if coalesce(new.cleanup_fee, 0) > 0
     and (tg_op = 'INSERT' or new.cleanup_fee is distinct from old.cleanup_fee)
     and not public.can_do('dumping.fee') then
    raise exception 'Only an admin or the MMDA can set a cleanup fee' using errcode = '42501';
  end if;
  return new;
end $function$;
revoke all on function public.td_guard_cleanup_fee() from public, anon, authenticated;
drop trigger if exists ab_td_guard_cleanup_fee on public.illegal_dumping_mobile;
create trigger ab_td_guard_cleanup_fee before insert or update on public.illegal_dumping_mobile
  for each row execute function public.td_guard_cleanup_fee();

CREATE OR REPLACE VIEW public.collector_assignments_view AS
 SELECT idm.id, cp.user_id AS collector_id, idm.assigned_to AS collector_profile_id, idm.waste_type AS type, idm.location,
    idm.latitude, idm.longitude, idm.severity AS priority, idm.size, idm.photos, idm.reported_by,
    CASE idm.status WHEN 'verified'::text THEN 'available'::text WHEN 'in_progress'::text THEN 'accepted'::text
      WHEN 'completed'::text THEN 'completed'::text WHEN 'disposed'::text THEN 'disposed'::text ELSE idm.status END AS status,
    idm.status AS original_status, idm.created_at, idm.updated_at, idm.disposed_at, idm.disposal_site_id, idm.disposal_site_name,
    'Community Report'::text AS authority,
    td_cleanup_payment(idm.cleanup_fee, idm.size, idm.severity, (to_jsonb(cp.*) ->> 'collector_type'::text)) AS payment,
    CASE idm.size WHEN 'small'::text THEN '15 mins'::text WHEN 'medium'::text THEN '30 mins'::text WHEN 'large'::text THEN '1 hour'::text ELSE '30 mins'::text END AS estimated_time,
    'Calculate'::text AS distance,
    coalesce(idm.fee_paid_by, 'trashdrop') AS fee_paid_by
   FROM illegal_dumping_mobile idm JOIN collector_profiles cp ON idm.assigned_to = cp.id
  WHERE idm.assigned_to IS NOT NULL
    AND idm.status = ANY (ARRAY['verified'::text, 'in_progress'::text, 'completed'::text, 'disposed'::text])
    AND (cp.user_id = auth.uid() OR td_can_manage_requests() OR (CURRENT_USER <> ALL (ARRAY['anon'::name, 'authenticated'::name])));

CREATE OR REPLACE FUNCTION public.td_withdrawable_items(p_collector_id uuid)
returns table(item_type text, item_id text, amount numeric, earned_at timestamp with time zone)
language sql stable security definer
set search_path to 'public' as $function$
  WITH in_withdrawals AS (
    SELECT wi.item_type, wi.item_id
    FROM public.withdrawal_items wi
    JOIN public.withdrawals w ON w.id = wi.withdrawal_id
    WHERE w.status NOT IN ('failed', 'cancelled')
  )
  -- A: digital bins: client payments confirmed by the gateway or an admin
  --    (TD53), at most the bin's stored payout
  SELECT 'digital_bin'::text, db.id::text,
         least(sum(bp.collector_share), coalesce(max(db.collector_total_payout), 0)),
         max(coalesce(db.updated_at, bp.created_at))
  FROM public.bin_payments bp
  JOIN public.digital_bins db ON db.id = bp.digital_bin_id
  WHERE db.collector_id = p_collector_id
    AND db.status = 'disposed'
    AND bp.type = 'collection'
    AND bp.status = 'success'
    AND bp.confirmed_by IN ('gateway', 'staff')
    AND bp.payment_mode IN ('momo', 'e_cash')
    AND db.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'digital_bin')
    AND db.id NOT IN (
      SELECT bp2.digital_bin_id FROM public.bin_payments bp2
      WHERE bp2.type = 'disbursement' AND bp2.status = 'success' AND bp2.digital_bin_id IS NOT NULL
    )
  GROUP BY db.id
  HAVING least(sum(bp.collector_share), coalesce(max(db.collector_total_payout), 0)) > 0

  UNION ALL
  -- B: pickup requests (prepaid, fixed fee)
  SELECT 'pickup_request'::text, pr.id::text, pr.collector_total_payout, coalesce(pr.disposed_at, pr.updated_at)
  FROM public.pickup_requests pr
  WHERE pr.collector_id = p_collector_id
    AND pr.status = 'disposed'
    AND pr.collector_total_payout > 0
    AND pr.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'pickup_request')

  UNION ALL
  -- C: illegal dumping cleanups paid by TrashDrop, disposed. Cleanups an MMDA
  --    assigned are paid by the MMDA directly and only recorded here.
  SELECT 'dumping_cleanup'::text, v.id::text, v.payment, coalesce(v.disposed_at, v.updated_at)
  FROM public.collector_assignments_view v
  WHERE v.collector_id = p_collector_id
    AND v.original_status = 'disposed'
    AND v.payment > 0
    AND v.fee_paid_by = 'trashdrop'
    AND v.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'dumping_cleanup')

  UNION ALL
  -- D: TrashDrop's top-up on promotional bins paid in cash (the collector
  --    already has the client's cash; TrashDrop owes the rest of the payout)
  SELECT 'promo_subsidy'::text, db.id::text, max(bp.platform_subsidy), max(coalesce(db.updated_at, bp.created_at))
  FROM public.bin_payments bp
  JOIN public.digital_bins db ON db.id = bp.digital_bin_id
  WHERE db.collector_id = p_collector_id
    AND db.status = 'disposed'
    AND db.is_promotional
    AND bp.type = 'collection'
    AND bp.status = 'success'
    AND bp.payment_mode = 'cash'
    AND bp.platform_subsidy > 0
    AND db.id::text NOT IN (SELECT i.item_id FROM in_withdrawals i WHERE i.item_type = 'promo_subsidy')
  GROUP BY db.id
$function$;
