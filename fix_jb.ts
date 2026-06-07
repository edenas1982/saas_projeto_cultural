import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey || '');

async function fix_jb() {
    await supabase.from('memoriais').update({ status_memorial: 'suspenso' }).eq('id', 'ada8b8fd-0cd3-4a9b-bb91-aeca53398a40');
    console.log("JB resetado para suspenso");
}

fix_jb();
