import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Memorial } from '../types';
import { Loader2, ArrowLeft, PenTool, Settings, FileText, CheckCircle, Sparkles, Leaf, Heart, Star, BookOpen, AlertCircle, X, Lock } from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';

export default function GestaoMemorial() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const action = location.state?.action || 'generate';
  const instrucaoInicial = location.state?.instrucao || '';
  const showContextField = location.state?.showContextField || false;
  
  const [memorial, setMemorial] = useState<Memorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [adjustStatus, setAdjustStatus] = useState('');
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Form states
  const [densidade, setDensidade] = useState<Memorial['densidade']>('minimo');
  const [tom, setTom] = useState<Memorial['perfil_tom_manual'] | ''>('');
  const [voz, setVoz] = useState<string>('');
  const [consentimento, setConsentimento] = useState(false);
  const [instrucoesAdicionais, setInstrucoesAdicionais] = useState(instrucaoInicial);
  const [instrucaoSalva, setInstrucaoSalva] = useState('');
  const [narrativaAtual, setNarrativaAtual] = useState('');
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [tentativasUsadas, setTentativasUsadas] = useState(0);
  const MAX_TENTATIVAS = 999;

  useEffect(() => {
    if (mensagem.texto) {
      const timer = setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [mensagem.texto]);

  useEffect(() => {
    if (id) {
      loadMemorial(id);
    }
  }, [id]);

  const loadMemorial = async (memorialId: string) => {
    if (!user) return;
    try {
      const { data: memorialDataArray, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorialId)
        .eq('user_id', user.id)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .limit(1);

      if (memorialError || !memorialDataArray || memorialDataArray.length === 0) throw new Error('Memorial não encontrado');
      
      const memorialData = memorialDataArray[0];
      setMemorial(memorialData);
      setDensidade(memorialData.densidade && ['minimo', 'medio', 'documental'].includes(memorialData.densidade) ? memorialData.densidade : 'minimo');
      setTom(memorialData.perfil_tom_manual && ['rustico', 'urbano', 'erudito', 'popular'].includes(memorialData.perfil_tom_manual) ? memorialData.perfil_tom_manual : '');
      setVoz(memorialData.perfil_voz || '');
      setConsentimento(false); // O usuário precisa sempre aceitar explicitamente a cada geração

      const { data: narrativas } = await supabase
        .from('narrativas')
        .select('id, conteudo_completo')
        .eq('memorial_id', memorialId)
        .order('gerado_em', { ascending: false });
      
      if (narrativas && narrativas.length > 0) {
        setTentativasUsadas(narrativas.length);
        setNarrativaAtual(narrativas[0].conteudo_completo);
      } else {
        setTentativasUsadas(0);
      }

      const { data: eventos } = await supabase
        .from('eventos_geracao')
        .select('instrucao_ajuste')
        .eq('memorial_id', memorialId)
        .order('gerado_em', { ascending: false })
        .limit(1);

      if (eventos && eventos.length > 0) {
        setInstrucaoSalva(eventos[0].instrucao_ajuste || '');
      }

    } catch (error) {
      console.error(error);
      alert('Erro ao carregar memorial.');
      navigate('/painel');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (confirmarFinal: boolean = false) => {
    if (!memorial) return;
    setMensagem({ tipo: '', texto: '' });
    setSaving(true);

    try {
      if (confirmarFinal && !consentimento) {
        throw new Error('Você deve concordar com o aviso de imprecisão e consentimento para confirmar.');
      }
      
      if (confirmarFinal && !tom) {
        throw new Error('Por favor, selecione um Tom Narrativo antes de confirmar.');
      }
      
      if (confirmarFinal && !voz) {
        throw new Error('Por favor, selecione uma Voz de Narração antes de confirmar.');
      }

      const updates: any = {
        densidade,
        perfil_tom_manual: tom === '' ? null : tom,
        perfil_voz: voz === '' ? null : voz,
        consentimento_uso: consentimento,
        aviso_imprecisao: consentimento
      };

      if (confirmarFinal) {
        updates.confirmado_pelo_usuario = true;
        // Se gerar novo texto, volta status para revisão para permitir confirmar e gerar áudio novamente
        if (memorial.status === 'publicado') {
          updates.status = 'gerado';
        }
      }

      const { error } = await supabase
        .from('memoriais')
        .update(updates)
        .eq('id', memorial.id);

      if (error) throw error;

      // if confirmation is requested, hit generator API
      if (confirmarFinal) {
        const { data: respostas, error: respostasError } = await supabase
          .from('respostas')
          .select('*')
          .eq('memorial_id', memorial.id);

        if (respostasError) {
          console.error('Erro ao buscar respostas:', respostasError);
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const token = session?.access_token;

        const hasNarrativa = !!narrativaAtual;
        const hasInstructions = instrucoesAdicionais.trim().length > 0;
        const isInstructionsChanged = instrucoesAdicionais.trim() !== instrucaoSalva.trim();
        const isVoiceChanged = voz !== memorial.perfil_voz;
        const isToneChanged = tom !== memorial.perfil_tom_manual;
        const isDensityChanged = densidade !== memorial.densidade;

        if (hasNarrativa) {
          if (!isInstructionsChanged && !isToneChanged && !isDensityChanged && !isVoiceChanged) {
             throw new Error('Você não realizou nenhuma alteração. Modifique o texto, tamanho, tom ou voz para continuar.');
          }

          if (!isInstructionsChanged && !isToneChanged && !isDensityChanged && isVoiceChanged) {
             setAdjustStatus('Voz atualizada. Preparando revisão...');
             setTimeout(() => {
               setGenerationComplete(true);
             }, 800);
             return;
          }
        }

        const isAdjusting = action !== 'regenerate' && hasNarrativa && hasInstructions && isInstructionsChanged && !isToneChanged && !isDensityChanged;

        if (isAdjusting) {
           setAdjustStatus('Aplicando ajuste no texto da biografia...');
           const { data: narrativas, error: fetchErr } = await supabase
              .from('narrativas')
              .select('id')
              .eq('memorial_id', memorial.id)
              .order('gerado_em', { ascending: false })
              .limit(1);
           
           if (!narrativas || narrativas.length === 0) {
              throw new Error('Narrativa anterior não encontrada para ajuste.');
           }

           const response = await fetch('/api/narrativas/adjust', {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json',
               ...(token ? { 'Authorization': `Bearer ${token}` } : {})
             },
             body: JSON.stringify({
               memorial_id: memorial.id,
               narrativa_id: narrativas[0].id,
               instrucao: instrucoesAdicionais.trim(),
             }),
           });

           const data = await response.json();
          
           if (!data.success) {
             throw new Error(data.error || 'Erro ao ajustar biografia');
           }

           setAdjustStatus('Finalizando processo...');
           setGenerationComplete(true);
           return;

        } else {
           setAdjustStatus('Gerando texto da biografia...');
           const response = await fetch('/api/narrativas/generate', {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json',
               ...(token ? { 'Authorization': `Bearer ${token}` } : {})
             },
             body: JSON.stringify({
               memorial_id: memorial.id,
               respostas: respostas || [],
               perfil_tom: tom || 'rustico',
               densidade: densidade || 'minimo',
               total_perguntas: memorial.total_perguntas_respondidas || 0,
               motivo_geracao: action === 'regenerate' ? 'regeneracao completa' : (hasNarrativa ? 'mudanca de tom' : 'primeira geracao'),
               contexto_adicional: instrucoesAdicionais.trim(),
               texto_base: action === 'regenerate' ? undefined : (narrativaAtual || undefined)
             }),
           });

           const data = await response.json();
          
           if (!data.success) {
             throw new Error(data.error || 'Erro ao gerar biografia');
           }
           
           setAdjustStatus('Finalizando processo...');
           setGenerationComplete(true);
           return;
        }
      }

      setMensagem({ 
        tipo: 'success', 
        texto: 'Configurações salvas com sucesso.' 
      });
      
      // Atualiza o state local
      setMemorial({ ...memorial, ...updates } as Memorial);
      setSaving(false);

    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao salvar configurações.' });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-gray-900 animate-spin" />
      </div>
    );
  }

  if (!memorial) return null;

  const isConfirmado = memorial.confirmado_pelo_usuario;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      
      {/* Loading Modal OVERLAY */}
      {(saving && adjustStatus) ? (
        <LoadingScreen 
          isGenerating={saving} 
          isComplete={generationComplete}
          statusMessage={adjustStatus}
          onComplete={() => {
            navigate(`/memorial/${memorial?.id}/revisar`, { replace: true });
          }}
        />
      ) : null}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <button 
          onClick={() => navigate('/painel')}
          className="text-gray-500 hover:text-gray-900 transition flex items-center gap-1 text-sm font-medium order-2 md:order-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>

        <div className="flex z-10 items-center justify-start gap-4 order-1 md:order-2 w-full md:w-auto bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
          {memorial.foto_url ? (
            <img 
              src={memorial.foto_url} 
              alt="Homenageado" 
              className="w-14 h-14 rounded-full object-cover border border-stone-200"
              
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xl border border-stone-200">
              {memorial.nome_homenageado.charAt(0)}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Homenageado</span>
            <h2 className="text-lg font-bold text-stone-800 leading-tight truncate max-w-[200px] md:max-w-xs">
              {memorial.nome_homenageado}
            </h2>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
          {action === 'adjust' ? 'Alterar Narrativa Específica' : action === 'regenerate' ? 'Gerar Nova Biografia' : 'Configure a biografia'}
        </h2>
        <p className="text-gray-500 mt-2 font-medium">Escolha como quer que a história seja contada.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-6 text-xl">
          <Settings className="w-6 h-6 text-blue-600" />
          {action === 'adjust' ? 'Ajuste Específico da Narrativa' : 'Configuração da Narrativa'}
        </h3>

        {/* Current Context info markers */}
        {memorial && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
              Tamanho: {
                !memorial.densidade ? 'Curta / Resumo (Padrão)' :
                memorial.densidade === 'minimo' ? 'Curta / Resumo' :
                memorial.densidade === 'medio' ? 'Média' :
                memorial.densidade === 'documental' ? 'Longa / Documental' : 
                memorial.densidade
              }
            </span>
            
            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
              Tom: {memorial.perfil_tom_manual || memorial.perfil_tom_inferido || 'Emotivo (Padrão)'}
            </span>
            
            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
              Voz: {
                !memorial.perfil_voz ? 'Feminina 1 (Padrão)' :
                memorial.perfil_voz === 'pt-BR-Journey-D' ? 'Masculina 1' :
                memorial.perfil_voz === 'pt-BR-Journey-F' ? 'Feminina 1' :
                memorial.perfil_voz === 'pt-BR-Neural2-A' ? 'Feminina 2' :
                memorial.perfil_voz === 'pt-BR-Neural2-B' ? 'Masculina 2' : 
                memorial.perfil_voz
              }
            </span>
          </div>
        )}

        {mensagem.texto && (
          <div className="fixed bottom-6 w-[90%] md:w-auto left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`p-4 shadow-2xl rounded-xl flex items-center justify-between gap-4 border ${mensagem.tipo === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
              <div className="flex items-center gap-3">
                {mensagem.tipo === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                <p className="text-sm font-medium">{mensagem.texto}</p>
              </div>
              <button onClick={() => setMensagem({ tipo: '', texto: '' })} className="p-1 rounded-full transition-colors opacity-70 hover:opacity-100 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-8">
          
          {/* Biografia Atual & Ajustes Adicionais */}
          <div className="border border-stone-200 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all">
            {narrativaAtual && (
               <div className="border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
                  >
                    <span className="flex items-center gap-2">
                       <FileText className="w-4 h-4" />
                       {isBioExpanded ? 'Ocultar Biografia Atual' : 'Ler Biografia Atual'}
                    </span>
                    <span className="text-xs text-gray-500 font-normal">
                      {isBioExpanded ? 'Recolher' : 'Expandir para revisar e pedir alterações'}
                    </span>
                  </button>
                  {isBioExpanded && (
                     <div className="p-5 bg-white border-t border-gray-100 prose prose-sm max-w-none font-serif leading-relaxed text-gray-800 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                       {narrativaAtual}
                     </div>
                  )}
               </div>
            )}
            <div className="p-5 flex flex-col gap-2 focus-within:bg-blue-50/20 transition-colors">
               <div className="flex items-center justify-between mb-1">
                 <label className="block text-sm font-bold text-gray-900 flex items-center gap-2">
                   <PenTool className="w-4 h-4 text-blue-600" />
                   Instruções Adicionais (Opcional)
                 </label>
                 <span className="text-xs font-semibold px-2 py-1 bg-stone-100 text-stone-600 rounded-md">
                   Uso da IA: {tentativasUsadas} / {MAX_TENTATIVAS}
                 </span>
               </div>
               <p className="text-xs text-gray-500 mb-2">Descreva o que deseja enfatizar, ou se estiver refazendo a biografia, diga o que quer alterar (ex: Foque mais no trabalho dela, retire a parte sobre o vizinho).</p>
               <textarea 
                  value={instrucoesAdicionais}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setInstrucoesAdicionais(e.target.value);
                    }
                  }}
                  placeholder="Escreva aqui suas instruções detalhadas..."
                  className="w-full resize-none bg-stone-50 border border-gray-200 rounded-xl p-3 outline-none text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all min-h-[80px]"
                  rows={3}
                  maxLength={500}
               />
               <div className={`text-xs text-right mt-1 ${instrucoesAdicionais.length === 500 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                 {instrucoesAdicionais.length} / 500 caracteres
               </div>
            </div>
          </div>

          {/* Tamanho */}
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#8C7A6B] text-white flex items-center justify-center text-sm font-bold shadow-sm mt-0.5">1</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Tamanho da Biografia</h3>
                <p className="text-sm text-gray-500 mt-1">Selecione o volume de texto ideal para a leitura pública do memorial.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-0 lg:pl-12">
              {[
                { id: 'minimo', title: 'Curta', l1: 'Até 100 palavras', l2: '~1 min de leitura' },
                { id: 'medio', title: 'Média', l1: 'Até 200 palavras', l2: '~2 min de leitura' },
                { id: 'documental', title: 'Longa', l1: 'Até 300 palavras', l2: '~3 min de leitura' }
              ].map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setDensidade(size.id as any)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-full group
                    ${densidade === size.id 
                      ? 'border-[#8C7A6B] ring-1 ring-[#8C7A6B] bg-[#FAF8F5]' 
                      : 'border-gray-200 bg-white hover:border-[#8C7A6B]/30'
                    }
                  `}
                >
                  <span className={`block mb-1 text-sm md:text-base font-bold ${densidade === size.id ? 'text-[#4A3F35]' : 'text-gray-900'}`}>{size.title}</span>
                  <div className={`mt-auto space-y-0.5 text-xs md:text-sm ${densidade === size.id ? 'text-[#6B5D50]' : 'text-gray-500'}`}>
                    <p>{size.l1}</p>
                    <p>{size.l2}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Estilo Narrativo */}
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#8C7A6B] text-white flex items-center justify-center text-sm font-bold shadow-sm mt-0.5">2</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Tom Narrativo</h3>
                <p className="text-sm text-gray-500 mt-1">Escolha a linguagem e o tom emocional para contar essa história.</p>
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-0 lg:pl-12">
              {[
                { 
                  id: 'rustico', 
                  title: 'Rústico (Simples e direto)', 
                  icon: Leaf,
                  desc: 'Uma conversa honesta e familiar, foco no cotidiano.',
                  ex: '"João nasceu em 1942... Trabalhou anos como marceneiro."'
                },
                { 
                  id: 'popular', 
                  title: 'Popular (Emocional)', 
                  icon: Heart,
                  desc: 'Linguagem afetiva e emotiva, muito próxima da própria família.',
                  ex: '"As mãos que trabalharam a madeira eram as que cuidavam..."'
                },
                { 
                  id: 'erudito', 
                  title: 'Erudito (Solene)', 
                  icon: Star,
                  desc: 'Uma homenagem formal e respeitosa, perfeita para leitura cerimonial.',
                  ex: '"Dedicou sua vida ao ofício laborioso e à construção austera..."'
                },
                { 
                  id: 'urbano', 
                  title: 'Urbano (Dinâmico)', 
                  icon: BookOpen,
                  desc: 'Trajetória acelerada e focada no progresso e modernidade.',
                  ex: '"O ritmo moderno ficava de lado enquanto João moldava madeira..."'
                }
              ].map((style) => {
                const Icon = style.icon;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setTom(style.id as any)}
                    className={`p-4 md:p-5 rounded-xl border text-left transition-all h-full
                      ${tom === style.id 
                        ? 'border-[#8C7A6B] ring-1 ring-[#8C7A6B] bg-[#FAF8F5]' 
                        : 'border-gray-200 bg-white hover:border-[#8C7A6B]/30'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 shrink-0 ${tom === style.id ? 'text-[#8C7A6B]' : 'text-gray-400'}`}>
                         <div className={`p-2 rounded-lg ${tom === style.id ? 'bg-[#8C7A6B]/10' : 'bg-gray-50'}`}>
                           <Icon className="w-5 h-5" />
                         </div>
                      </div>
                      <div className="flex-1">
                        <span className={`block mb-1 text-sm md:text-base font-bold ${tom === style.id ? 'text-[#4A3F35]' : 'text-gray-900'}`}>{style.title}</span>
                        <p className={`text-xs md:text-sm mb-3 leading-relaxed ${tom === style.id ? 'text-[#6B5D50]' : 'text-gray-500'}`}>{style.desc}</p>
                        <p className={`text-xs italic p-2.5 rounded-lg border-l-2 ${tom === style.id ? 'bg-white/60 text-[#4A3F35] border-[#8C7A6B]/30' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{style.ex}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opções de Áudio Gerais */}
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#8C7A6B] text-white flex items-center justify-center text-sm font-bold shadow-sm mt-0.5">3</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Voz da Narração</h3>
                <p className="text-sm text-gray-500 mt-1">Defina quem irá narrar a história no tocador de áudio.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-0 lg:pl-12">
              {[
                { id: 'MALE', title: 'Masculina 1', desc: 'Serena e respeitosa', minPlan: 'basico' },
                { id: 'MALE_D', title: 'Masculina 2', desc: 'Grave e solene', minPlan: 'premium' },
                { id: 'FEMALE', title: 'Feminina 1', desc: 'Clara e acolhedora', minPlan: 'basico' },
                { id: 'FEMALE_C', title: 'Feminina 2', desc: 'Suave e emotiva', minPlan: 'premium' },
              ].map((voiceOption) => {
                const planoGeracao = memorial?.plano_geracao || 'basico';
                const isLocked = (voiceOption.id === 'MALE_D' || voiceOption.id === 'FEMALE_C') && planoGeracao === 'basico';
                const isSelected = voz === voiceOption.id;
                return (
                  <button
                    key={voiceOption.id}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        alert('Esta voz premium requer o plano Premium ou Enterprise. Entre em contato com a funerária administradora para realizar o upgrade.');
                      } else {
                        setVoz(voiceOption.id);
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all h-full relative
                      ${isLocked 
                        ? 'opacity-60 bg-stone-100/80 border-stone-200 cursor-pointer hover:border-amber-300' 
                        : isSelected 
                          ? 'border-[#8C7A6B] ring-1 ring-[#8C7A6B] bg-[#FAF8F5]' 
                          : (!voz ? 'border-red-200 bg-red-50/30 hover:bg-red-50' : 'border-gray-200 bg-white hover:border-[#8C7A6B]/30')
                      }
                    `}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className={`block text-sm font-bold ${isSelected ? 'text-[#4A3F35]' : 'text-gray-900'}`}>
                          {voiceOption.title}
                        </span>
                        {isLocked && <Lock className="w-3.5 h-3.5 text-stone-400" />}
                      </div>
                      <span className={`text-xs ${isSelected ? 'text-[#6B5D50]' : 'text-gray-500'}`}>
                        {voiceOption.desc}
                      </span>
                      <span className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded self-start mt-2 ${
                        voiceOption.minPlan === 'premium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {voiceOption.minPlan === 'basico' ? 'Básico' : 'Premium'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="pl-0 lg:pl-12">
              {!voz && <p className="text-xs text-red-500 font-medium mt-1">É obrigatório selecionar uma voz para a narrativa do memorial.</p>}
            </div>
          </div>

          {/* Consentimento e Ações Finais (Unificado) */}
          <div className="mt-12 bg-stone-50 border border-stone-200 rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-sm">
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="flex items-center h-6 pt-0.5">
                <input
                  type="checkbox"
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  className="w-5 h-5 text-stone-800 border-gray-300 rounded focus:ring-stone-800 focus:ring-offset-0 transition-colors"
                />
              </div>
              <div className="flex-1">
                 <span className="text-sm md:text-base font-bold text-gray-900">
                   Aceito gerar a biografia com Inteligência Artificial.
                 </span>
                 <p className="text-xs md:text-sm text-gray-600 mt-1.5 leading-relaxed">
                   Estou ciente que esta narrativa será gerada (ou re-ajustada) por IA. O áudio definitivo só será gravado quando você aprovar e publicar o texto final na próxima tela. Verifique a biografia com atenção antes de publicar.
                 </p>
              </div>
            </label>

            <div className="flex flex-col md:flex-row items-center justify-end border-t border-stone-200 pt-6">
              <button
                onClick={() => {
                  handleSaveConfig(true);
                }}
                disabled={!consentimento || saving}
                className="w-full md:w-auto bg-[#2E2823] text-white px-8 md:px-10 py-3.5 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base md:text-lg shadow-sm"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Gerar Biografia
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
