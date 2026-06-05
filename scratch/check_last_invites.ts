import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: invites, error } = await supabase
    .from('question_invites')
    .select('id, destinatario_nome, destinatario_tel, token, status, memorial_id, created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
     console.error("error: ", error.message);
  } else {
     console.log("Last 15 invites:");
     invites.forEach(inv => {
       console.log(`- ID: ${inv.id}`);
       console.log(`  Name: ${inv.destinatario_nome}`);
       console.log(`  Tel: ${inv.destinatario_tel}`);
       console.log(`  Status: ${inv.status}`);
       console.log(`  Memorial ID: ${inv.memorial_id}`);
       console.log(`  Created At: ${inv.created_at}`);
       console.log("------------------------------------------------");
     });
  }
}
run();
