import { GoogleGenAI } from '@google/genai';
import { IAProvider } from './IAProvider.js';

export class GeminiProvider implements IAProvider {
  private ai: GoogleGenAI;
  private readonly modelName = 'gemini-2.5-flash';

  constructor() {
    this.ai = new GoogleGenAI({
      vertexai: true,
      project: 'sodium-burner-496217-u4',
      location: 'us-central1',
    });
  }

  public async generateText(prompt: string, maxTokens: number = 600, systemPrompt?: string): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }> {
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        maxOutputTokens: maxTokens,
        systemInstruction: systemPrompt,
      },
    });

    const text = response.text || '';

    return {
      text,
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      model: this.modelName,
    };
  }
}
