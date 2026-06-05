export interface FriendlyError {
  status: number;
  message: string;
  code: string;
  isCritical: boolean;
}

export class ErrorMapper {
  /**
   * Mapeia erros técnicos ou de rede das APIs externas para mensagens comerciais e amigáveis para a UX.
   * Define isCritical como true para erros que indicam falha ou exaustão de chaves/créditos de APIs do sistema.
   */
  public static mapError(error: any): FriendlyError {
    const message = error?.message || String(error);
    const status = error?.status || error?.statusCode || 500;

    // 1. Falta de Internet / Host Inacessível
    if (
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed') ||
      message.includes('getaddrinfo')
    ) {
      return {
        status: 503,
        code: 'NETWORK_ERROR',
        message: 'Falha de conexão: Não foi possível conectar aos servidores de inteligência artificial. Verifique sua conexão de internet e tente novamente.',
        isCritical: false
      };
    }

    // 2. Erros da API Anthropic (Claude)
    if (message.includes('Anthropic') || message.includes('anthropic') || error?.type?.includes('anthropic')) {
      // Falta de saldo / quota
      if (
        message.includes('credit') ||
        message.includes('balance') ||
        message.includes('quota') ||
        message.includes('limit exceeded') ||
        status === 429
      ) {
        return {
          status: 402,
          code: 'AI_API_OUT_OF_BALANCE',
          message: 'O serviço de redação biográfica está temporariamente indisponível devido a limite de processamento da API de IA. Por favor, tente novamente em alguns instantes.',
          isCritical: true
        };
      }
      // Chave de API inválida ou expirada
      if (status === 401 || message.includes('authentication') || message.includes('API key')) {
        return {
          status: 500,
          code: 'AI_API_AUTH_ERROR',
          message: 'Falha na autenticação do serviço de inteligência artificial (credenciais expiradas). O suporte técnico já foi notificado.',
          isCritical: true
        };
      }
    }

    // 3. Erros da API Google GenAI / Vertex / Gemini
    if (message.includes('GoogleGenAI') || message.includes('Gemini') || message.includes('vertex')) {
      if (
        message.includes('quota') ||
        message.includes('exhausted') ||
        message.includes('billing') ||
        message.includes('limit') ||
        status === 429
      ) {
        return {
          status: 402,
          code: 'GEMINI_API_LIMIT',
          message: 'O serviço de processamento está temporariamente indisponível por limite de cota da API Gemini. Tente novamente mais tarde.',
          isCritical: true
        };
      }
      if (status === 401 || status === 403 || message.includes('auth') || message.includes('credential')) {
        return {
          status: 500,
          code: 'GEMINI_API_AUTH_ERROR',
          message: 'Falha de autenticação no serviço do provedor Gemini. O suporte técnico foi notificado.',
          isCritical: true
        };
      }
    }

    // 4. Erros da API ElevenLabs
    if (message.includes('elevenlabs') || message.includes('ElevenLabs')) {
      if (
        message.includes('quota') ||
        message.includes('character limit') ||
        message.includes('insufficient') ||
        status === 429
      ) {
        return {
          status: 402,
          code: 'ELEVENLABS_API_LIMIT',
          message: 'Limite de locução premium excedido no provedor ElevenLabs. O suporte foi notificado.',
          isCritical: true
        };
      }
      if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('key')) {
        return {
          status: 500,
          code: 'ELEVENLABS_API_AUTH_ERROR',
          message: 'Falha de credenciais com o provedor de vozes premium ElevenLabs. O suporte técnico foi notificado.',
          isCritical: true
        };
      }
    }

    // 5. Erros da API Google Cloud TTS
    if (message.includes('texttospeech') || message.includes('TTS') || message.includes('voice')) {
      if (message.includes('not found') || message.includes('unsupported') || message.includes('deprecated') || status === 400 || status === 404) {
        return {
          status: 400,
          code: 'VOICE_DEPRECATED',
          message: 'A voz de locução selecionada está desativada, descontinuada ou indisponível. Por favor, selecione outra voz nas configurações e tente gerar o áudio novamente.',
          isCritical: true
        };
      }
      if (message.includes('quota') || message.includes('billing') || status === 429) {
        return {
          status: 402,
          code: 'GOOGLE_TTS_LIMIT',
          message: 'O serviço de locução por áudio atingiu a cota diária permitida de caracteres. O suporte técnico já foi notificado.',
          isCritical: true
        };
      }
    }

    // Fallback: qualquer outro erro não mapeado explicitamente
    return {
      status: status === 200 ? 500 : status, // Garante que erros tenham código HTTP de erro
      code: 'UNKNOWN_API_ERROR',
      message: `Ocorreu um erro inesperado no processamento: ${message}`,
      isCritical: false
    };
  }
}
