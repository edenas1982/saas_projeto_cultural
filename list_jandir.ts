import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey || '');

async function list() {
    const { data } = await supabase.from('question_invites').select('*').eq('memorial_id', 'aa2166a5-e52d-4366-9156-c4aeb21a8630');
    console.log(data);
}

list();
