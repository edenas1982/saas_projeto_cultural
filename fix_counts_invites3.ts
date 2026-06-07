import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey || '');

async function fix_counts() {
    const { data: invites } = await supabase.from('question_invites').select('*');
    
    // Group invites by memorial_id
    const invitesByMemorial = (invites || []).reduce((acc: any, inv: any) => {
        if (!acc[inv.memorial_id]) {
            acc[inv.memorial_id] = { criados: 0, concluidos: 0 };
        }
        acc[inv.memorial_id].criados++;
        if (inv.status === 'concluido') acc[inv.memorial_id].concluidos++;
        return acc;
    }, {});
    
    for (let memorial_id of Object.keys(invitesByMemorial)) {
        const counts = invitesByMemorial[memorial_id];
        
        let status_novo = 'aguardando';
        if (counts.criados > 0 && counts.concluidos > 0 && counts.concluidos < counts.criados) {
            status_novo = 'respostas_parciais';
        } else if (counts.criados > 0 && counts.concluidos === counts.criados) {
            status_novo = 'respostas_recebidas';
        }

        console.log(`Memorial ${memorial_id} - Criados: ${counts.criados}, Concluidos: ${counts.concluidos} => ${status_novo}`);

        await supabase.from('memoriais').update({ 
          total_invites_criados: counts.criados,
          total_invites_concluidos: counts.concluidos,
          status_memorial: status_novo
        }).eq('id', memorial_id);
    }
    console.log("Done");
}

fix_counts();
