import { GeminiProvider } from '../src/services/GeminiProvider.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const provider = new GeminiProvider();
    console.log("Calling Gemini...");
    const result = await provider.generateText("Diga 'Olá mundo' em português.");
    console.log("Result:", result);
  } catch (e: any) {
    console.error("Gemini failed:", e);
  }
}
main();
