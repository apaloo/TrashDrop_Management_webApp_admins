-- Check the actual schema of illegal_dumping_mobile table

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'illegal_dumping_mobile'
ORDER BY ordinal_position;

-- Sample data to see what's actually in the table
SELECT * FROM illegal_dumping_mobile LIMIT 1;
