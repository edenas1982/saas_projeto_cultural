import Anthropic from '@anthropic-ai/sdk';
import { IAProvider } from './IAProvider.js';

export class ClaudeProvider implements IAProvider {
  private ai: Anthropic;
  private readonly modelName = 'claude-sonnet-4-6';

  constructor() {
    this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  }

  public async generateText(prompt: string, maxTokens: number = 600, systemPrompt?: string): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }> {
    const response = await this.ai.messages.create({
      model: this.modelName,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(systemPrompt ? { system: systemPrompt } : {})
    });

    const textBlock = response.content[0];
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      text,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      model: this.modelName
    };
  }
}
