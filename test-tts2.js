import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

let sbUrl = process.env.VITE_SUPABASE_URL;
if (sbUrl) sbUrl = sbUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(sbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  const requestParams = {
    input: { text: 'Teste longo. '.repeat(50) }, // 650 chars
    voice: { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B', ssmlGender: 'MALE' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: -1.0 }
  };
  
  const apiRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestParams)
  });
  if (!apiRes.ok) {
     console.log("ERROR", await apiRes.text());
  } else {
     console.log("OK!");
  }
}
run();
