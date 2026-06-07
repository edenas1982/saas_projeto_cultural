const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // get a valid invite token
  const { data: invites } = await supabase
    .from('question_invites')
    .select('*')
    .limit(1);

  if (!invites || invites.length === 0) {
    console.log('No invites');
    return;
  }
  const invite = invites[0];
  console.log('Testing invite:', invite.token);

  const testAnswers = [
    {
      pergunta_id: "ide_01",
      resposta: "Teste resposta",
      pergunta_texto_snapshot: "Teste",
      gaveta_snapshot: "IDENTIDADE",
      opcional: false
    }
  ];

  const inserts = [
    {
      memorial_id: invite.memorial_id,
      pergunta_id: "ide_01",
      resposta: "Teste resposta",
      pergunta_texto_snapshot: "Teste",
      gaveta_snapshot: "IDENTIDADE",
      opcional: false
    }
  ];

  const { error } = await supabase.from('respostas').insert(inserts);
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success');
    // clean up
    await supabase.from('respostas').delete().eq('memorial_id', invite.memorial_id).eq('resposta', 'Teste resposta');
  }
}

main();
