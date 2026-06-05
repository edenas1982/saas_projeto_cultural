import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Required Supabase environment variables are missing.');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
  }

  const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const supabase = createClient(cleanUrl, supabaseKey);

  console.log('Connecting to Supabase...');

  // The condition is: 3 attempts. We just delete all rows in eventos_geracao 
  // where motivo_geracao is 'regeneracao parcial' to reset the counters for everyone.
  
  const { data, error, count } = await supabase
    .from('eventos_geracao')
    .delete()
    .eq('motivo_geracao', 'regeneracao parcial')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error deleting records:', error);
    process.exit(1);
  }

  console.log(`Successfully deleted ${count || 0} events.`);
  console.log('Counters for partial regenerations have been reset for all memorials.');
}

run().catch(console.error);
