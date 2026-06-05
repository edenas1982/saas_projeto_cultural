import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
console.log('SUPABASE_URL:', url);
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: user } = await supabaseAdmin.from('profiles').select('*').eq('email', 'nascimentopalotina@gmail.com');
  console.log('User:', user);
  
  const { data: m2 } = await supabaseAdmin.from('memoriais').select('id, nome_homenageado, status, perfil_voz').eq('user_id', 'd5ffac32-29c6-48d3-8ba2-37c42338fd7f');
  console.log('Memoriais of user:', m2);
  const targetId = m2?.find(m => m.nome_homenageado.toLowerCase().includes('teste'))?.id;

  if (targetId) {
    const { data: narrativas } = await supabaseAdmin.from('narrativas').select('*').eq('memorial_id', targetId).order('gerado_em', { ascending: false }).limit(1);
    
    if (narrativas && narrativas.length > 0) {
      const nar = narrativas[0];
      console.log('Testing auto-gen for narrativa:', nar.id);
      try {
        const res = await fetch(`http://localhost:3000/api/narrativas/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ narrativa_id: nar.id, voz: 'MALE' })
        });
        const text = await res.text();
        console.log('Audio Response:', text);
      } catch (err) {
        console.error('Audio Err:', err);
      }
    }
  }
}
run();
