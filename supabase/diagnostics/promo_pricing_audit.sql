-- Read-only audit of digital bin pricing and promotions (production).
-- Runs inside a READ ONLY transaction and ends with ROLLBACK: it cannot change anything.
-- Each result row starts with the check it answers (A1, B4, ...). See PR #49.

BEGIN TRANSACTION READ ONLY;

-- A. Can customers change their own promotion count? (finding 1)
SELECT 'A1 policies' AS check, polname, polcmd, polroles::regrole[]::text AS roles,
       pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy WHERE polrelid = 'public.promotional_usage'::regclass ORDER BY polname;
SELECT 'A2 grants' AS check, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'promotional_usage' AND grantee IN ('anon', 'authenticated')
GROUP BY grantee;
SELECT 'A3 columns' AS check, column_name, column_default, is_generated, generation_expression
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promotional_usage' ORDER BY ordinal_position;
SELECT 'A4 triggers' AS check, tgname, pg_get_triggerdef(oid) AS def
FROM pg_trigger WHERE tgrelid = 'public.promotional_usage'::regclass AND NOT tgisinternal;

-- B. Does the database check a booking's price? (finding 2)
SELECT 'B1 bin triggers' AS check, t.tgname, p.proname,
       pg_get_functiondef(p.oid) ILIKE '%fee%' AS mentions_fee,
       pg_get_functiondef(p.oid) ILIKE '%promotional_usage%' AS touches_promo_count
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.digital_bins'::regclass AND NOT t.tgisinternal ORDER BY t.tgname;
SELECT 'B2 bin checks' AS check, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE conrelid = 'public.digital_bins'::regclass AND contype = 'c' ORDER BY conname;
SELECT 'B3 bin insert policies' AS check, polname, polroles::regrole[]::text AS roles, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy WHERE polrelid = 'public.digital_bins'::regclass AND polcmd IN ('a', '*');
-- B4: last 90 days, stored fee vs what the pricing rules give (today's zone price / active schedule)
SELECT 'B4 fee vs rules' AS check, x.kind, count(*) AS bins,
       count(*) FILTER (WHERE x.expected IS NULL) AS cannot_price,
       count(*) FILTER (WHERE abs(x.fee - x.expected) > 0.01) AS mismatched,
       min(x.fee - x.expected) AS min_diff, max(x.fee - x.expected) AS max_diff
FROM (
  SELECT CASE WHEN b.is_promotional THEN 'promotional' ELSE 'zone' END AS kind, b.fee,
    CASE WHEN b.is_promotional THEN
      (SELECT s.client_fee FROM public.promotional_fee_schedule s WHERE s.bin_size_liters = b.bin_size_liters AND s.is_active LIMIT 1)
    ELSE
      (SELECT round((to_jsonb(z) ->> ('price_' || b.bin_size_liters || 'l'))::numeric * coalesce(b.bag_count, 1)
                    * (CASE WHEN b.is_urgent THEN 1.3 ELSE 1 END) + 1, 2)
         FROM public.bin_locations l, LATERAL public.get_covering_pricing_zone(
                ST_Y(l.coordinates::geometry), ST_X(l.coordinates::geometry)) z
        WHERE l.id = b.location_id LIMIT 1)
    END AS expected
  FROM public.digital_bins b
  WHERE b.created_at > now() - interval '90 days' AND b.fee IS NOT NULL
) x GROUP BY x.kind;

-- C. Is every promotional booking counted? (findings 3 and 4)
SELECT 'C1 whatsapp rpc counts promos' AS check, p.oid::regprocedure::text AS fn,
       pg_get_functiondef(p.oid) ILIKE '%promotional_usage%' AS touches_promo_count
FROM pg_proc p WHERE p.proname = 'create_whatsapp_digital_bin';
SELECT 'C2 increment function' AS check, p.oid::regprocedure::text AS fn, p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS def
FROM pg_proc p WHERE p.proname = 'increment_promotional_usage';
SELECT 'C3 promo bins vs count' AS check,
       count(*) AS customers_with_promo_bins,
       count(*) FILTER (WHERE x.promo_bins > coalesce(x.used_count, 0)) AS more_bins_than_counted,
       count(*) FILTER (WHERE x.promo_bins > coalesce(x.max_requests, 5)) AS over_the_limit,
       coalesce(sum(greatest(x.promo_bins - coalesce(x.used_count, 0), 0)), 0) AS uncounted_promo_bins
FROM (
  SELECT b.user_id, count(*) AS promo_bins, u.used_count, u.max_requests
  FROM public.digital_bins b LEFT JOIN public.promotional_usage u ON u.user_id = b.user_id
  WHERE b.is_promotional GROUP BY b.user_id, u.used_count, u.max_requests
) x;
SELECT 'C4 customised limits' AS check, max_requests, count(*) AS accounts,
       count(*) FILTER (WHERE used_count > max_requests) AS used_more_than_limit
FROM public.promotional_usage GROUP BY max_requests ORDER BY max_requests;

-- D. Who gets a promotion row at signup?
SELECT 'D1 signup trigger' AS check, t.tgname, p.proname
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
  AND pg_get_functiondef(p.oid) ILIKE '%promotional_usage%';
SELECT 'D2 accounts without a promo row' AS check, count(*) AS accounts
FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.promotional_usage pu WHERE pu.user_id = u.id);

-- E. Cost of flat promotional pricing (finding 5)
SELECT 'E1 promo bookings' AS check, bin_size_liters, count(*) AS bins,
       count(*) FILTER (WHERE coalesce(bag_count, 1) > 1) AS multi_bag, max(bag_count) AS max_bags,
       count(*) FILTER (WHERE is_urgent) AS urgent,
       sum(fee) AS customers_paid, sum(collector_total_payout) AS collector_payouts,
       sum(collector_total_payout - fee) AS trashdrop_subsidy
FROM public.digital_bins WHERE is_promotional GROUP BY bin_size_liters ORDER BY bin_size_liters;

-- F. Database schedule vs the collector app's built-in table (finding 6)
--    Collector app: 120 L 18/30, 240 L 22/40, 360 L 48/95
SELECT 'F1 promo schedule' AS check, bin_size_liters, client_fee, collector_payout, platform_subsidy,
       to_jsonb(s) ->> 'max_requests' AS max_requests, is_active
FROM public.promotional_fee_schedule s ORDER BY bin_size_liters, is_active DESC;

-- G. Unused parts (finding 8)
SELECT 'G1 unused' AS check,
  (SELECT count(*) FROM public.digital_bins WHERE coalesce((to_jsonb(digital_bins) ->> 'surge_multiplier')::numeric, 1) <> 1) AS bins_with_surge,
  (SELECT count(*) FROM public.digital_bins WHERE coalesce((to_jsonb(digital_bins) ->> 'collector_distance_payout')::numeric, 0) > 0) AS bins_with_distance_pay,
  (SELECT CASE WHEN to_regclass('public.promotional_pricing') IS NULL THEN NULL
          ELSE (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.promotional_pricing', false, true, '')))[1]::text::int END) AS promotional_pricing_rows,
  to_regprocedure('public.get_welcome_discount_multiplier(uuid)') IS NOT NULL AS welcome_discount_function_exists;

ROLLBACK;
