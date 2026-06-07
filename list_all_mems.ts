import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey || '');

async function list() {
    const { data: memoriais } = await supabase.from('memoriais').select('id, nome_homenageado, status_memorial, status');
    console.log("Memoriais:");
    console.table(memoriais);
}

list();
