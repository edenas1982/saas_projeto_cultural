export interface Lead { id: string; nome: string; whatsapp?: string; status?: string; tipo_negocio?: string; ultimo_contato?: string; created_at?: string; }
export interface Tarefa { id: string; titulo: string; concluida?: boolean; lead_id?: string; }

export type Memorial = {
  id: string;
  user_id: string;
  nome_homenageado: string;
  data_nascimento?: string;
  data_falecimento?: string;
  foto_url?: string;
  densidade: 'curta' | 'media' | 'longa' | 'minimo' | 'medio' | 'documental';
  status: 'rascunho' | 'gerado' | 'publicado';
  perfil_tom_manual?: 'rustico' | 'urbano' | 'erudito' | 'popular';
  perfil_voz?: string;
  perfil_tom_inferido?: string;
  consentimento_uso: boolean;
  publico: boolean;
  confirmado_pelo_usuario: boolean;
  total_perguntas_respondidas: number;
  aviso_imprecisao: boolean;
  frase_destaque?: string;
  auto_aprovar_mensagens?: boolean;
  permitir_mensagens?: boolean;
  respostas?: any[];
  plano_geracao?: 'basico' | 'premium' | 'enterprise';
  edits_used?: number;
  edits_limit?: number;
  ciclo_contrato_plano?: number;
  created_at: string;
  updated_at: string;
};

export type Pergunta = {
  id: string;
  gaveta: 'identidade' | 'jornada' | 'essencia' | 'legado';
  ordem: number;
  texto_pergunta: string;
  placeholder?: string;
  obrigatoria: boolean;
  tipo_saida: 'fato' | 'memoria' | 'perfil_narrativo';
  created_at: string;
};

export type Resposta = {
  id: string;
  memorial_id: string;
  pergunta_id: string;
  pergunta_texto_snapshot: string;
  gaveta_snapshot: string;
  resposta: string;
  opcional: boolean;
  created_at: string;
};

export type Narrativa = {
  id: string;
  memorial_id: string;
  conteudo_completo: string;
  audio_url?: string;
  status: 'rascunho' | 'revisao' | 'publicado';
  gerado_em: string;
  updated_at: string;
};

export type MensagemVisitante = {
  id: string;
  memorial_id: string;
  autor_nome: string;
  conteudo: string;
  aprovado: boolean;
  created_at: string;
};

export type Midia = {
  id: string;
  memorial_id: string;
  tipo_midia: 'foto' | 'documento';
  url: string;
  ordem: number;
  descricao?: string;
  aprovado: boolean;
  created_at: string;
};

export type Fato = {
  id: string;
  memorial_id: string;
  tipo_fato: string;
  conteudo: string;
  ano_referencia?: string;
  metadados?: any;
  created_at: string;
};
