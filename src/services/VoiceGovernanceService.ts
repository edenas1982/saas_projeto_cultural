import { SupabaseClient } from '@supabase/supabase-js';
import { TelemetryService } from './TelemetryService.js';

export interface VoicePermission {
  id: string;
  locked: boolean;
}

export type AudioTier = 'basic' | 'premium' | 'enterprise';

export class VoiceGovernanceService {
  private static readonly PLAN_AUDIO_TIERS: Record<string, AudioTier> = {
    basico: 'basic',
    premium: 'premium',
    enterprise: 'enterprise'
  };

  private static readonly VOICE_TIERS: Record<string, AudioTier> = {
    'pt-BR-Standard-A': 'basic',
    'pt-BR-Standard-B': 'basic',
    'FEMALE': 'basic',
    'MALE': 'basic',
    'pt-BR-Journey-F': 'premium',
    'pt-BR-Journey-D': 'premium',
    'FEMALE_C': 'premium',
    'MALE_D': 'premium',
    'elevenlabs-alice': 'enterprise',
    'elevenlabs-marcus': 'enterprise',
    'elevenlabs-sarah': 'enterprise'
  };

  private static readonly TIER_RANKS: Record<AudioTier, number> = {
    basic: 1,
    premium: 2,
    enterprise: 3
  };

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Obtém o nível (tier) do áudio com base no plano do memorial.
   */
  public getAudioTier(plano: string): AudioTier {
    return VoiceGovernanceService.PLAN_AUDIO_TIERS[plano] || 'basic';
  }

  /**
   * Obtém o tier mínimo necessário para uma determinada voz.
   */
  public getRequiredVoiceTier(voz: string): AudioTier {
    return VoiceGovernanceService.VOICE_TIERS[voz] || 'basic';
  }

  /**
   * Verifica se o plano do memorial tem permissão para a voz solicitada.
   */
  public checkPermission(plano: string, voz: string): { allowed: boolean; userTier: AudioTier; voiceTier: AudioTier } {
    const userTier = this.getAudioTier(plano);
    const voiceTier = this.getRequiredVoiceTier(voz);
    
    const userRank = VoiceGovernanceService.TIER_RANKS[userTier] || 1;
    const voiceRank = VoiceGovernanceService.TIER_RANKS[voiceTier] || 1;

    return {
      allowed: userRank >= voiceRank,
      userTier,
      voiceTier
    };
  }

  /**
   * Retorna todas as permissões de vozes para o plano do memorial.
   */
  public getVoicesPermissions(plano: string): VoicePermission[] {
    const userTier = this.getAudioTier(plano);
    const userRank = VoiceGovernanceService.TIER_RANKS[userTier] || 1;

    return Object.keys(VoiceGovernanceService.VOICE_TIERS).map(voiceId => {
      const requiredTier = VoiceGovernanceService.VOICE_TIERS[voiceId];
      const requiredRank = VoiceGovernanceService.TIER_RANKS[requiredTier] || 1;
      return {
        id: voiceId,
        locked: userRank < requiredRank
      };
    });
  }

  /**
   * Registra a telemetria do consumo de áudio no logging do support_metrics.
   */
  public async logAudioGeneration(
    narrativaId: string,
    textLength: number,
    voiceName: string,
    plano: string,
    latenciaMs: number
  ): Promise<void> {
    const telemetry = new TelemetryService(this.supabase);
    await telemetry.logMetrics({
      pergunta: narrativaId,
      categoria: 'AudioGeneration',
      tokensInput: textLength,
      tokensOutput: 1,
      latenciaMs,
      endpointRetornado: voiceName,
      ftsRank: this.getAudioTier(plano) === 'basic' ? 1 : this.getAudioTier(plano) === 'premium' ? 2 : 3
    });
  }
}
