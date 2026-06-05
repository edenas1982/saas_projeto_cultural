import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("Variável ANTHROPIC_API_KEY não encontrada no .env");
    return;
  }
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 50,
      messages: [{ role: "user", content: "Diga apenas: Chave Anthropic funcionando!" }]
    });

    if (msg.content && msg.content.length > 0 && msg.content[0].type === 'text') {
        console.log("✅ Sucesso! Resposta da IA:", msg.content[0].text);
    } else {
        console.log("✅ Sucesso! (Formato de resposta inesperado)", msg);
    }
  } catch (error: any) {
    console.error("❌ Erro na API Key:", error.message || error);
  }
}
test();
