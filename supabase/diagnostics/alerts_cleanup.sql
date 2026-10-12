-- ============================================================================
-- Alerts: remove the "Sample alert for dashboard display" seed row.
-- Run the PREVIEW first. Pick ONE fix: archive (keeps the row, closed) or delete.
-- ============================================================================

-- PREVIEW
SELECT id, title, description, created_at
FROM public.alerts
WHERE description = 'Sample alert for dashboard display' OR (title = 'System Alert' AND entity_type = 'system' AND created_by IS NOT NULL AND rule_key IS NULL);

-- FIX A: archive (needs 20261017_alerts_rules.sql for the status column)
BEGIN;
UPDATE public.alerts
SET status = 'closed', resolution_note = 'Seed/sample record archived'
WHERE description = 'Sample alert for dashboard display';
COMMIT;

-- FIX B: delete instead (its activity rows are removed with it)
-- BEGIN;
-- DELETE FROM public.alerts WHERE description = 'Sample alert for dashboard display';
-- COMMIT;
