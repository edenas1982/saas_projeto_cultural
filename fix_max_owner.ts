import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = supabaseUrl?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const targetUserId = "78654881-7776-4391-8e3f-03d54bc135d9"; // nascimentopalotina@gmail.com
  const sourceUserId = "466c123c-d367-47cb-aba6-007d24eb609f"; // contato@ecomemoriasapp.com

  console.log(`Setting owner of Maximiliano back to ${targetUserId}`);

  const { data: updated, error } = await supabase
    .from('memoriais')
    .update({ user_id: targetUserId })
    .eq('id', '30cd3e0c-03c8-4929-a4ae-8d1be17aed0c')
    .select();

  console.log(updated, error);
}

run();
