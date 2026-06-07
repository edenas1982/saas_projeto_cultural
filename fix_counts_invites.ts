import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey || '');

async function fix_counts() {
    console.log("Recuperando todos os memoriais...");
    const { data: memoriais } = await supabase.from('memoriais').select('id');
    if (!memoriais) return;
    
    for (let m of memoriais) {
        const { count: totalCriados } = await supabase
          .from('question_invites')
          .select('*', { count: 'exact', head: true })
          .eq('memorial_id', m.id)
          .not('perguntas_ids', 'cs', '["TRANSFERENCIA_CONTROLE"]');
          
        const { count: totalConcluidos } = await supabase
          .from('question_invites')
          .select('*', { count: 'exact', head: true })
          .eq('memorial_id', m.id)
          .eq('status', 'concluido')
          .not('perguntas_ids', 'cs', '["TRANSFERENCIA_CONTROLE"]');

        const _totalCriados = totalCriados || 0;
        const _totalConcluidos = totalConcluidos || 0;

        let status_novo = undefined;
        if (_totalCriados > 0 && _totalConcluidos > 0 && _totalConcluidos < _totalCriados) {
            status_novo = 'respostas_parciais';
        } else if (_totalCriados > 0 && _totalConcluidos === _totalCriados) {
            status_novo = 'respostas_recebidas';
        }

        const updateData: any = { 
          total_invites_criados: _totalCriados,
          total_invites_concluidos: _totalConcluidos,
        };

        if (status_novo) {
            updateData.status_memorial = status_novo;
        }

        await supabase.from('memoriais').update(updateData).eq('id', m.id);
        console.log(`Memorial ${m.id} fixed: criados: ${_totalCriados}, concluidos: ${_totalConcluidos}`);
    }
    console.log("Done");
}

fix_counts();
