-- ============================================================================
-- Collectors: data cleanup. Run AFTER supabase/migrations/20261016_collectors_admin.sql
-- (uses public.td_gh_phone and its triggers). Run each PREVIEW first; the fixes are in
-- BEGIN … COMMIT blocks; change COMMIT to ROLLBACK to try them safely.
-- ============================================================================

-- ── A. Phone numbers stored in the email field ─────────────────────────────
-- PREVIEW
SELECT id, first_name, last_name, email, phone,
       public.td_gh_phone(email) AS phone_from_email
FROM public.collector_profiles
WHERE email IS NOT NULL
  AND email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'
ORDER BY created_at;

-- FIX: copy the number into phone when phone is empty, then clear email
BEGIN;
SET LOCAL app.collector_cleanup = 'on'; -- existing duplicates must not block the fix
UPDATE public.collector_profiles
SET phone = coalesce(nullif(btrim(phone), ''), public.td_gh_phone(email), phone),
    email = NULL
WHERE email IS NOT NULL
  AND email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$';
COMMIT;

-- ── B. Phone numbers not in +233XXXXXXXXX form ─────────────────────────────
-- PREVIEW (normalised = NULL means it is not a Ghana number: fix by hand)
SELECT id, first_name, last_name, phone, public.td_gh_phone(phone) AS normalised
FROM public.collector_profiles
WHERE phone IS DISTINCT FROM public.td_gh_phone(phone)
ORDER BY normalised NULLS FIRST, created_at;

-- FIX: only rows that can be normalised
BEGIN;
SET LOCAL app.collector_cleanup = 'on'; -- existing duplicates must not block the fix
UPDATE public.collector_profiles
SET phone = public.td_gh_phone(phone)
WHERE public.td_gh_phone(phone) IS NOT NULL
  AND phone IS DISTINCT FROM public.td_gh_phone(phone);
COMMIT;

-- ── C. Duplicate collectors (same phone or same email) ─────────────────────
-- Typical cause: an admin added the collector, then they signed up in the
-- app, which made a second profile. Keep the row WITH user_id (the app
-- account; pickups point at it), copy zone/notes over, deactivate the other.
SELECT 'phone' AS matched_on, public.td_gh_phone(phone) AS value,
       array_agg(id ORDER BY user_id NULLS LAST, created_at) AS ids,
       array_agg(coalesce(user_id::text, '(no app account)') ORDER BY user_id NULLS LAST, created_at) AS user_ids
FROM public.collector_profiles
WHERE public.td_gh_phone(phone) IS NOT NULL
GROUP BY public.td_gh_phone(phone) HAVING count(*) > 1
UNION ALL
SELECT 'email', lower(email),
       array_agg(id ORDER BY user_id NULLS LAST, created_at),
       array_agg(coalesce(user_id::text, '(no app account)') ORDER BY user_id NULLS LAST, created_at)
FROM public.collector_profiles
WHERE email IS NOT NULL
GROUP BY lower(email) HAVING count(*) > 1;

-- FIX (fill in the two ids from the list above, one pair at a time)
-- BEGIN;
-- UPDATE public.collector_profiles keep
-- SET assigned_region = coalesce(keep.assigned_region, dup.assigned_region),
--     notes = coalesce(keep.notes, dup.notes)
-- FROM public.collector_profiles dup
-- WHERE keep.id = '<id with user_id>' AND dup.id = '<id without user_id>';
-- UPDATE public.collector_profiles
-- SET status = 'inactive', deactivation_reason = 'Duplicate of <id with user_id>', deactivated_at = now()
-- WHERE id = '<id without user_id>';
-- COMMIT;

-- ── D. Missing or old regions ──────────────────────────────────────────────
-- PREVIEW: collectors with no service zone, or a zone that is not in
-- service_zones (e.g. the old 'North District'). signup_region is what the
-- collector picked in the app, to help you choose.
SELECT c.id, c.first_name, c.last_name, c.assigned_region, c.region AS signup_region,
       CASE WHEN nullif(btrim(c.assigned_region), '') IS NULL OR c.assigned_region ILIKE 'unassigned'
            THEN 'missing' ELSE 'not a service zone' END AS problem
FROM public.collector_profiles c
LEFT JOIN public.service_zones z ON lower(z.name) = lower(btrim(c.assigned_region))
WHERE z.id IS NULL
ORDER BY problem, c.created_at;

-- FIX 1: blank, 'Unassigned' and the old placeholder districts → NULL (shows as Unassigned)
BEGIN;
SET LOCAL app.collector_cleanup = 'on'; -- existing duplicates must not block the fix
UPDATE public.collector_profiles
SET assigned_region = NULL
WHERE assigned_region IS NOT NULL
  AND (btrim(assigned_region) = ''
       OR assigned_region ILIKE 'unassigned'
       OR assigned_region IN ('North District', 'South District', 'East District', 'West District', 'Central District'));
COMMIT;

-- FIX 2: assign zones (edit names/ids, or do it from the Collectors page Edit form)
-- UPDATE public.collector_profiles SET assigned_region = 'Accra – Ga North' WHERE id IN ('<id>', '<id>');
-- UPDATE public.collector_profiles SET assigned_region = 'Tamale' WHERE id = '<id>';

-- ── E. Vehicle fields ──────────────────────────────────────────────────────
-- PREVIEW: unknown types, 'N/A' placeholders, capacity in the old column
SELECT id, first_name, last_name, vehicle_type, license_plate, vehicle_plate, vehicle_capacity, vehicle_capacity_bags
FROM public.collector_profiles
WHERE (vehicle_type IS NOT NULL AND lower(vehicle_type) NOT IN ('cart', 'motorcycle', 'tricycle', 'truck', 'van', 'bicycle', 'other'))
   OR upper(btrim(coalesce(license_plate, ''))) IN ('N/A', 'NA', '-')
   OR upper(btrim(coalesce(vehicle_plate, ''))) IN ('N/A', 'NA', '-')
   OR (vehicle_capacity IS NOT NULL AND vehicle_capacity_bags IS NULL)
ORDER BY created_at;

-- FIX: lower-case types, clear 'N/A' plates, make both plate columns agree
BEGIN;
SET LOCAL app.collector_cleanup = 'on'; -- existing duplicates must not block the fix
UPDATE public.collector_profiles SET vehicle_type = lower(btrim(vehicle_type))
WHERE vehicle_type IS DISTINCT FROM lower(btrim(vehicle_type));
UPDATE public.collector_profiles SET license_plate = NULL WHERE upper(btrim(license_plate)) IN ('N/A', 'NA', '-', '');
UPDATE public.collector_profiles SET vehicle_plate = NULL WHERE upper(btrim(vehicle_plate)) IN ('N/A', 'NA', '-', '');
UPDATE public.collector_profiles SET vehicle_plate = license_plate WHERE vehicle_plate IS NULL AND license_plate IS NOT NULL;
UPDATE public.collector_profiles SET license_plate = vehicle_plate WHERE license_plate IS NULL AND vehicle_plate IS NOT NULL;
COMMIT;
-- vehicle_capacity (old column) may be kg or bags, so it is not copied
-- automatically. If it was bags for everyone:
-- UPDATE public.collector_profiles SET vehicle_capacity_bags = vehicle_capacity
-- WHERE vehicle_capacity_bags IS NULL AND vehicle_capacity BETWEEN 1 AND 500;
