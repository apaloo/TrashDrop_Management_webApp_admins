// Execute SQL script against Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.production
require('dotenv').config({ path: '.env.production' });

// Get Supabase URL and Key from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Path to the SQL script
const scriptPath = path.join(__dirname, 'add_missing_tables.sql');

async function executeSql() {
  try {
    // Read SQL script
    const sql = fs.readFileSync(scriptPath, 'utf8');
    
    console.log('Connecting to Supabase...');
    console.log('Executing SQL script...');
    
    // Execute SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try alternative approach if RPC fails
      console.log('Trying alternative approach - breaking down SQL into statements...');
      
      // Split SQL into statements and execute one by one
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const stmt of statements) {
        if (stmt.trim()) {
          const trimmedStmt = stmt.trim();
          if (trimmedStmt) {
            try {
              // Using raw query for direct SQL execution
              const { data, error } = await supabase.from('_exec_sql').select('*').eq('query', trimmedStmt);
              if (error) {
                console.error(`Error executing statement: ${trimmedStmt.substring(0, 50)}...`, error);
              }
            } catch (err) {
              console.error(`Error processing statement: ${trimmedStmt.substring(0, 50)}...`, err);
            }
          }
        }
      }
      
      // Final verification approach - directly query for table existence
      await verifyTables();
    } else {
      console.log('SQL executed successfully!');
      console.log('Result:', data);
      
      // Verify table creation
      await verifyTables();
    }
  } catch (error) {
    console.error('Error reading or executing SQL:', error);
  }
}

// Verify that tables exist
async function verifyTables() {
  const tables = [
    'notifications', 
    'messages', 
    'service_areas',
    'waste_items',
    'logs',
    'batches',
    'illegal_dumping_reports'
  ];
  
  console.log('\n=== TABLE VERIFICATION ===');
  
  for (const table of tables) {
    try {
      // Try to get a count from each table
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Table '${table}' verification failed:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists with ${count} rows`);
      }
    } catch (error) {
      console.error(`❌ Error verifying table '${table}':`, error);
    }
  }
}

// Execute the SQL
executeSql();
