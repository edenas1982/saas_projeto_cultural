import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

let sbUrl = process.env.VITE_SUPABASE_URL;
if (sbUrl) sbUrl = sbUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(sbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: nar, error } = await supabase.from('narrativas').select('id, conteudo_completo').eq('id', 'b537e1ea-291d-4ac0-9afc-9d04bea489e3').single();
  
  if (!nar) return console.log("Narrativa n\u00E3o encontrada.");

  let textToSpeak = nar.conteudo_completo
    .replace(/\[?(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)\]?/g, '')
    .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/^[#]+\s/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^(?:xml\s*)+/i, '')
    .trim();

  const paragraphs = textToSpeak.split(/\n+/).filter(p => p.trim());
  const chunks = [];
  let currentChunk = '';
  
  for (const p of paragraphs) {
     const ssmlP = `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>\n<break time="800ms"/>\n`;
     if (currentChunk.length + ssmlP.length > 4000) {
        chunks.push(currentChunk);
        currentChunk = ssmlP;
     } else {
        currentChunk += ssmlP;
     }
  }
  if (currentChunk) chunks.push(currentChunk);

  console.log("Total chunks:", chunks.length);
  const audioBuffers = [];
  const googleApiKey = process.env.GOOGLE_TTS_API_KEY;

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const requestParams = {
      input: { ssml: `<speak>\n${chunk}</speak>` },
      voice: { 
        languageCode: 'pt-BR', 
        name: 'pt-BR-Standard-B',
        ssmlGender: 'MALE'
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        speakingRate: 0.95,
        pitch: -1.0
      },
    };

    const apiRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestParams)
    });
    
    if (!apiRes.ok) {
       console.log("ERRO no chunk Standard", await apiRes.text());
       return;
    }
    const json = await apiRes.json();
    if (json.audioContent) {
       audioBuffers.push(Buffer.from(json.audioContent, 'base64'));
    }
  }

  const finalAudioBuffer = Buffer.concat(audioBuffers);
  console.log("Audio size:", finalAudioBuffer.length);
}
run();
