const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use production environment variables if .env file is not found
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://tfdedlqdsajjdjkerkli.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZGVkbHFkc2FqamRqa2Vya2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3NjQ5MTAsImV4cCI6MjA1OTM0MDkxMH0.GkbFdw5UjSlGvcuxuUMcflgVlJ4CHCuAg8n8F25mNMs';

// Log connection info
console.log('SUPABASE URL:', supabaseUrl);
console.log('SUPABASE KEY AVAILABLE:', !!supabaseKey);

// Create Supabase client using environment variables
const supabase = createClient(supabaseUrl, supabaseKey);

// List of tables we expect to exist
const tablesToCheck = [
  'notifications', 
  'service_areas', 
  'waste_items', 
  'logs',
  'messages',
  'batches',
  'illegal_dumping_reports'
];

// Test function to check tables directly
async function testDatabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // First check if we can access Supabase at all
    const { data: healthData, error: healthError } = await supabase.from('_end').select('*');
    
    if (healthError && !healthError.message.includes('does not exist')) {
      console.error('❌ Connection error:', healthError);
      return;
    }
    
    console.log('✅ Supabase connection successful!');
    
    // Check each table individually
    for (const tableName of tablesToCheck) {
      await checkTable(tableName);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Function to check if a specific table exists and retrieve its data
async function checkTable(tableName) {
  try {
    // First try a simple select to see if the table exists
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(3);
    
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log(`❌ Table '${tableName}' does not exist`);
      } else {
        console.error(`⚠️ Error accessing ${tableName}:`, error);
      }
    } else {
      console.log(`✅ Table '${tableName}' exists! (${data?.length || 0} rows found)`);
      if (data?.length > 0) {
        // Print first row keys to see column structure
        console.log(`   Column structure: ${Object.keys(data[0]).join(', ')}`);
      }
    }
  } catch (error) {
    console.error(`⚠️ Unexpected error checking ${tableName}:`, error);
  }
}

// Execute test function
testDatabaseConnection().catch(console.error);
