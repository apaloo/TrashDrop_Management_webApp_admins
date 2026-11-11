-- Add missing batch_name column to batches table

-- Add batch_name column
ALTER TABLE public.batches ADD COLUMN batch_name TEXT;

-- Set default values for existing records using batch_number or id
UPDATE public.batches 
SET batch_name = COALESCE('Batch-' || batch_number, 'Batch-' || id::TEXT)
WHERE batch_name IS NULL;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
