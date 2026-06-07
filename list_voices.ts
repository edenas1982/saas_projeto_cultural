import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import dotenv from "dotenv";

dotenv.config();

async function listVoices() {
  const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!googleCreds) {
    console.error("Credenciais não configuradas");
    return;
  }

  const client = new TextToSpeechClient({
    credentials: JSON.parse(googleCreds)
  });

  const [result] = await client.listVoices({ languageCode: 'pt-BR' });
  const voices = result.voices || [];
  
  voices.forEach(voice => {
    console.log(`${voice.name} - ${voice.ssmlGender}`);
  });
}

listVoices();
