import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return console.log("NO KEY");
  
  const requestParams = {
    input: { ssml: "<speak><p>Teste ssml longo com tags.</p><break time=\"800ms\"/></speak>" },
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
     const json = await apiRes.json();
     console.log("OK", Object.keys(json));
  }
}
run();
