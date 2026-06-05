import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

let envPath = '.env';
if (!fs.existsSync(envPath)) {
  envPath = '.env.example'; // just in case, but probably shouldn't use example
}
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { error: err1 } = await supabase.from('perguntas').update({ 
        texto_pergunta: 'Onde nasceu?',
        dica: 'Cidade e estado de nascimento.'
    }).eq('id', 'ide_01');
    if (err1) console.error(err1);
    
    const { error: err2 } = await supabase.from('perguntas').update({ 
        texto_pergunta: 'Como era o lugar onde nasceu?',
        dica: 'Descreva a casa, o clima, ou o que mais marcava aquele ambiente inicial.'
    }).eq('id', 'ide_02');
    if (err2) console.error(err2);

    console.log('Perguntas atualizadas com sucesso!');
  } catch(e) {
    console.error(e);
  }
}
run();
