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
    const models = await anthropic.models.list();
    console.log("Modelos permitidos:", models.data.filter(m => m.id.includes('claude')).map(m => m.id));
  } catch (e: any) {
    console.error("Erro:", e.message || e);
  }
}
test();
