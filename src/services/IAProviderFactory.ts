import { IAProvider } from './IAProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import { GeminiProvider } from './GeminiProvider.js';

export class IAProviderFactory {
  public static createProvider(providerType?: string): IAProvider {
    const type = (providerType || process.env.AI_PROVIDER || 'claude').toLowerCase();

    if (type === 'gemini') {
      return new GeminiProvider();
    }

    return new ClaudeProvider();
  }
}
