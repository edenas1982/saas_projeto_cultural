export interface IAProvider {
  generateText(prompt: string, maxTokens?: number, systemPrompt?: string): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }>;
}
