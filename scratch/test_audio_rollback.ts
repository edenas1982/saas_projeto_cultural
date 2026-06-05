import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  console.log('Testing rollback of edits_used on audio failure...');
  
  // Find a test memorial
  const { data: memorials } = await supabaseAdmin
    .from('memoriais')
    .select('id, nome_homenageado, edits_used, edits_limit')
    .eq('origem_sistema', 'saas')
    .limit(1);

  if (!memorials || memorials.length === 0) {
    console.error('No SaaS memorials found in DB to test.');
    return;
  }

  const memorial = memorials[0];
  console.log(`Using memorial: ${memorial.nome_homenageado} (ID: ${memorial.id})`);
  console.log(`Original edits_used: ${memorial.edits_used}`);

  // Fetch or create a draft narrative for this memorial
  let { data: narratives } = await supabaseAdmin
    .from('narrativas')
    .select('id, audio_status')
    .eq('memorial_id', memorial.id)
    .limit(1);

  let narrativeId = narratives?.[0]?.id;
  if (!narrativeId) {
    console.log('Creating a draft narrative to test...');
    const { data: newNav, error: insertErr } = await supabaseAdmin
      .from('narrativas')
      .insert({
        memorial_id: memorial.id,
        template: 'visual',
        conteudo_completo: 'Esta é uma biografia de teste para rollback de áudio.',
        status_publicacao: 'rascunho',
        versao: 1
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Failed to create test narrative:', insertErr);
      return;
    }
    narrativeId = newNav.id;
  }

  console.log(`Testing narrative ID: ${narrativeId}`);

  // We will temporarily simulate a failure.
  // We can trigger /api/narrativas/audio with an invalid voice name (e.g., 'invalid-voice')
  // which will fail the permission check or synthesis and should trigger a rollback!
  // Wait, let's call the endpoint. Since the endpoint requires JWT, we should fetch a session token.
  // Wait! In query_db.ts, it uses fetch, but how does it authenticate?
  // It has standard authorization. We can generate a JWT using auth or just bypass it if we have a token.
  // But wait! Let's mock call the endpoint.
  // Let's print out instructions.
}
run();
