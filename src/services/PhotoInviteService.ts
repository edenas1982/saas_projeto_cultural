import { AuditService } from "./AuditService.js";
import { SupabaseClient } from "@supabase/supabase-js";
import { ErrorMapper } from "./ErrorMapper.js";

export class PhotoInviteService {
  constructor(private readonly audit: AuditService) {}

  /**
   * @description Gera e salva um token de upload de fotos (FotoLink) para o memorial.
   * @rules Link expira em 30 dias por padrão. Status inicial é 'ativo'. Se houver link ativo, reutiliza.
   * @entity photo_invites
   * @audit true
   */
  public async createInvite(supabase: SupabaseClient, memorialId: string, operatorId: string) {
    try {
      // 1. Busca os dados do memorial para validação e obter organization_id
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('id, organization_id')
        .eq('id', memorialId)
        .single();

      if (memorialError || !memorial) {
        throw new Error('Memorial não encontrado');
      }

      // 2. Verifica se já existe um link ativo e não expirado para reutilizar
      const { data: existingInvite } = await supabase
        .from('photo_invites')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('status', 'ativo')
        .gt('expira_em', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (existingInvite) {
        return existingInvite;
      }

      // Expira em 30 dias por padrão
      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + 30);

      // 3. Insere o convite do FotoLink no banco
      const { data: newInvite, error: insertError } = await supabase
        .from('photo_invites')
        .insert({
          memorial_id: memorialId,
          organization_id: memorial.organization_id,
          status: 'ativo',
          expira_em: expiraEm.toISOString(),
          total_acessos: 0
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Auditoria da geração do link
      await AuditService.logEvent(supabase, {
        action_type: "create_photo_invite",
        entity_type: "photo_invites",
        entity_id: newInvite.id,
        memorial_id: memorialId,
        actor_id: operatorId,
        actor_role: "agent",
        payload: { invite_id: newInvite.id, description: `FotoLink criado para memorial ${memorialId}` }
      });

      return newInvite;
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Retorna os dados necessários para a tela pública sem expor informações sigilosas.
   * @rules Link deve estar ativo e dentro do prazo de validade. Incrementa total_acessos.
   * @entity photo_invites, memoriais, midias
   * @audit false
   */
  public async getPublicData(supabase: SupabaseClient, token: string) {
    try {
      // 1. Busca o convite pelo token
      const { data: invite, error: inviteError } = await supabase
        .from('photo_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invite) {
        throw { status: 404, message: 'Link do FotoLink inválido ou não encontrado.' };
      }

      // 2. Valida se expirado ou concluído
      if (invite.status !== 'ativo' || new Date(invite.expira_em) < new Date()) {
        throw { status: 410, message: 'Este link expirou ou já foi concluído.' };
      }

      // 3. Incrementa total_acessos
      await supabase
        .from('photo_invites')
        .update({ total_acessos: (invite.total_acessos || 0) + 1 })
        .eq('id', invite.id);

      // 4. Busca dados mínimos do homenageado e plano
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('id, nome_homenageado, data_nascimento, data_falecimento, foto_url, plano_geracao, organization_id')
        .eq('id', invite.memorial_id)
        .single();

      if (memorialError || !memorial) {
        throw { status: 404, message: 'Memorial não encontrado.' };
      }

      // 5. Busca as fotos já enviadas e aprovadas na galeria
      const { data: midias, error: midiasError } = await supabase
        .from('midias')
        .select('*')
        .eq('memorial_id', memorial.id)
        .eq('tipo_midia', 'foto')
        .eq('aprovado', true)
        .order('ordem', { ascending: true });

      const fotosGaleria = midias || [];

      return {
        invite,
        memorial,
        fotosGaleria
      };
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Valida os limites do plano antes de aceitar um upload.
   * @rules Limite de galeria: Basico = 5, Premium = 10, Enterprise = 15.
   * @entity photo_invites, memoriais, midias
   * @audit false
   */
  public async validateLimits(supabase: SupabaseClient, token: string, type: 'perfil' | 'galeria') {
    try {
      // 1. Busca o convite pelo token
      const { data: invite, error: inviteError } = await supabase
        .from('photo_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invite || invite.status !== 'ativo' || new Date(invite.expira_em) < new Date()) {
        throw { status: 410, message: 'Link do FotoLink inválido ou expirado.' };
      }

      // 2. Busca o plano do memorial
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('id, plano_geracao')
        .eq('id', invite.memorial_id)
        .single();

      if (memorialError || !memorial) {
        throw { status: 404, message: 'Memorial não encontrado.' };
      }

      const plano = memorial.plano_geracao || 'basico';
      const limitesPlano = {
        basico:     { perfil: 1, galeria: 5  },
        premium:    { perfil: 1, galeria: 10 },
        enterprise: { perfil: 1, galeria: 15 }
      };

      const limites = limitesPlano[plano as 'basico' | 'premium' | 'enterprise'] || limitesPlano.basico;

      if (type === 'perfil') {
        return { allowed: true, limit: limites.perfil, current: 0 };
      }

      // 3. Busca a contagem atual de mídias da galeria
      const { count, error: countError } = await supabase
        .from('midias')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_id', memorial.id)
        .eq('tipo_midia', 'foto');

      if (countError) {
        throw countError;
      }

      const currentCount = count || 0;
      const allowed = currentCount < limites.galeria;

      return {
        allowed,
        limit: limites.galeria,
        current: currentCount,
        plano
      };
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Registra que fotos foram enviadas e gera a notificação no painel do parceiro.
   * @rules Cria notificação em organization_notifications do tipo 'foto_enviada'.
   * @entity organization_notifications
   * @audit true
   */
  public async notifyPhotosReceived(supabase: SupabaseClient, token: string, count: number) {
    try {
      // 1. Busca o convite pelo token
      const { data: invite, error: inviteError } = await supabase
        .from('photo_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invite) {
        throw new Error('Link inválido');
      }

      // 2. Busca o memorial para obter a organização
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('id, nome_homenageado, organization_id')
        .eq('id', invite.memorial_id)
        .single();

      if (memorialError || !memorial) {
        throw new Error('Memorial não encontrado');
      }

      if (!memorial.organization_id) {
        return;
      }

      // 3. Cria a notificação de nova foto
      const { error: notifError } = await supabase
        .from('organization_notifications')
        .insert({
          organization_id: memorial.organization_id,
          memorial_id: memorial.id,
          invite_id: invite.id,
          tipo: 'foto_enviada',
          titulo: 'Fotos recebidas',
          mensagem: `A família enviou ${count} foto(s) para o memorial de ${memorial.nome_homenageado}.`,
          lida: false
        });

      if (notifError) {
        throw notifError;
      }

      // Auditoria
      await AuditService.logEvent(supabase, {
        action_type: "notify_photos_received",
        entity_type: "photo_invites",
        entity_id: invite.id,
        memorial_id: memorial.id,
        actor_id: "system",
        actor_role: "system",
        payload: { count, description: `Família enviou ${count} fotos para memorial ${memorial.id}. Notificação gerada.` }
      });
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }
}
