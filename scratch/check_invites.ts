import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  console.log('Fetching invites...');
  const { data: invites, error } = await supabaseAdmin
    .from('question_invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching invites:', error);
    return;
  }

  console.log('Last 10 invites:');
  invites.forEach((inv) => {
    console.log({
      id: inv.id,
      destinatario_nome: inv.destinatario_nome,
      destinatario_tel: inv.destinatario_tel,
      token: inv.token,
      perguntas_ids: inv.perguntas_ids,
      created_at: inv.created_at,
    });
  });
}

run();
