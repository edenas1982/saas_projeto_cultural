import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
  console.log('🔄 Inicializando Google Gen AI SDK via ADC...');
  try {
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const ai = new GoogleGenAI({
      vertexai: true,
      project: 'sodium-burner-496217-u4',
      location: 'us-central1',
    });
    
    console.log('📡 Enviando ping de teste para o modelo gemini-2.5-flash...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Ping de teste para conexão. Responda apenas com a palavra: PONG.',
    });

    console.log('\n========================================');
    console.log('✅ CONEXÃO COM O GEMINI ESTABELECIDA COM SUCESSO!');
    console.log(`Resposta da API: "${response.text ? response.text.trim() : ''}"`);
    console.log('========================================');
  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ ERRO NA CONEXÃO COM O GEMINI:');
    console.error(error.stack || error.message || error);
    console.error('========================================');
    process.exit(1);
  }
}

testConnection();
