import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: memoriais } = await supabase.from('memoriais').select('id, status').eq('origem_sistema', 'saas');
  
  if (!memoriais) return;
  
  for (const m of memoriais) {
    if (m.status === 'rascunho' || m.status === 'em_progresso' || m.status === 'aguardando') {
      const { data: invites } = await supabase.from('question_invites').select('status').eq('memorial_id', m.id).neq('status', 'expirado');
      
      if (invites && invites.length > 0) {
        const allConcluidos = invites.every(i => i.status === 'concluido');
        if (allConcluidos) {
          console.log(`Updating memorial ${m.id} to respostas_recebidas`);
          await supabase.from('memoriais').update({ status: 'respostas_recebidas' }).eq('id', m.id);
        } else {
          // Are there answers?
          const { data: answers } = await supabase.from('respostas').select('id').eq('memorial_id', m.id);
          if (answers && answers.length > 0 && m.status !== 'aguardando') {
             // Maybe some answers received, but not all invites concluded
             console.log(`Memorial ${m.id} has some answers but not all invites are concluded.`);
          }
        }
      } else {
        const { data: answers } = await supabase.from('respostas').select('id').eq('memorial_id', m.id);
        if (answers && answers.length > 0) {
           await supabase.from('memoriais').update({ status: 'respostas_recebidas' }).eq('id', m.id);
           console.log(`Updated legacy memorial ${m.id} with answers to respostas_recebidas`);
        }
      }
    }
  }
}
run();
