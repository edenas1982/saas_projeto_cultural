import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Sparkles, AlertCircle, Heart, Leaf, Mic, ArrowLeft, Loader2, PlayCircle, Eye, Settings, Briefcase, Crown, CheckCircle2, ChevronDown, ChevronUp, Download, Share2, MessageCircle, X, Coins, Edit3, ArrowUpCircle, ArrowDownCircle, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SaasFastPlanModal } from '../../components/saas/SaasFastPlanModal';

export default function SaasGerarBiografia() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, walletBalance, setWalletBalance } = useAuth();
  
  const [memorial, setMemorial] = useState<any>(null);
  const [narrativaAtual, setNarrativaAtual] = useState<any>(null); // Se existir, estamos no modo "Alterar"
  const [loading, setLoading] = useState(true);

  // Flow State
  const [etapa, setEtapa] = useState<'configuracao' | 'leitura' | 'final'>('configuracao');

  // Configuration States
  const [planoGeracao, setPlanoGeracao] = useState('basico');
  
  const [densidade, setDensidade] = useState<'200' | '300' | '400'>('200');
  const [tom, setTom] = useState<string>('');
  const [voz, setVoz] = useState<string>('');
  const [consentimento, setConsentimento] = useState(false);
  const [instrucoesAdicionais, setInstrucoesAdicionais] = useState('');
  const [instrucaoSalva, setInstrucaoSalva] = useState('');
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini'>('claude');
  const [modoConteudo, setModoConteudo] = useState<'ia' | 'manual'>('ia');
  const [textoManual, setTextoManual] = useState('');
  
  // Credit / Plan Management states (Fase 4 e 5)
  const [editsUsed, setEditsUsed] = useState<number>(0);
  const [editsLimit, setEditsLimit] = useState<number>(2);
  const [textEditsInCycle, setTextEditsInCycle] = useState<number>(0);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [fastPlanModalOpen, setFastPlanModalOpen] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<'basico' | 'enterprise' | 'premium' | null>(null);
  const [planActionLoading, setPlanActionLoading] = useState(false);

  // UI States
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [generationType, setGenerationType] = useState<'text' | 'audio' | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const textSteps = [
    { label: "Validando limite e contrato", desc: "Checando edições disponíveis no plano", minProgress: 0 },
    { label: "Carregando memórias familiares", desc: "Buscando respostas e fatos no Supabase", minProgress: 15 },
    { label: "Conectando ao Claude 3.5 Sonnet", desc: "Enviando dados para a engine de IA", minProgress: 35 },
    { label: "Redigindo a biografia afetiva", desc: "Organizando a narrativa nas 4 gavetas", minProgress: 60 },
    { label: "Registrando logs e rascunho", desc: "Salvando versão de revisão no banco", minProgress: 85 }
  ];

  const audioSteps = [
    { label: "Validando permissões de locução", desc: "Checando áudio permitido no plano", minProgress: 0 },
    { label: "Conectando ao motor de locução", desc: "Inicializando síntese premium", minProgress: 20 },
    { label: "Sintetizando e gerando mídia", desc: "Processando áudio .mp3 de alta fidelidade", minProgress: 45 },
    { label: "Fazendo upload para o Storage", desc: "Armazenando arquivo de áudio", minProgress: 70 },
    { label: "Registrando custos e telemetria", desc: "Finalizando logs e ativando timeline", minProgress: 88 }
  ];

  useEffect(() => {
    if (!saving) {
      setLoadingProgress(0);
      setGenerationType(null);
      return;
    }

    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 95) return 95;
        const increment = prev < 50 ? 2.5 : prev < 80 ? 1.2 : 0.4;
        return Number((prev + increment).toFixed(1));
      });
    }, 250);

    return () => clearInterval(interval);
  }, [saving]);
  
  // Generation Result
  const [textoGerado, setTextoGerado] = useState('');
  const [narrativaIdGerada, setNarrativaIdGerada] = useState('');
  
  // Phase 1: Snapshot and Semantic Routing
  const [initialSnapshot, setInitialSnapshot] = useState<{
    tamanho: string;
    tom: string;
    voz: string;
    instrucao: string;
  } | null>(null);

  // Restore state from sessionStorage if user minimized/refreshed
  useEffect(() => {
    if (id) {
       const cached = sessionStorage.getItem(`saas_bio_${id}`);
       if (cached) {
         try {
           const parsed = JSON.parse(cached);
           if (parsed.initialSnapshot) setInitialSnapshot(parsed.initialSnapshot);
           if (parsed.densidade) setDensidade(parsed.densidade);
           if (parsed.tom) setTom(parsed.tom);
           if (parsed.voz) setVoz(parsed.voz);
           if (parsed.instrucoesAdicionais) setInstrucoesAdicionais(parsed.instrucoesAdicionais);
         } catch(e) {}
       }
    }
  }, [id]);

  // Save state to sessionStorage
  useEffect(() => {
    if (id) {
      sessionStorage.setItem(`saas_bio_${id}`, JSON.stringify({
        initialSnapshot,
        densidade,
        tom,
        voz,
        instrucoesAdicionais
      }));
    }
  }, [initialSnapshot, densidade, tom, voz, instrucoesAdicionais, id]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    // Correct capabilities when plan view changes
    setVoz('');
    
    if (planoGeracao === 'basico') {
      if (densidade === '300' || densidade === '400') setDensidade('200');
      if (tom !== 'popular') setTom('popular');
    } else if (planoGeracao === 'premium') {
      if (densidade === '400') setDensidade('300');
      if (tom !== 'popular' && tom !== 'rustico') setTom('popular');
    }
  }, [planoGeracao]);

  const loadData = async () => {
    if (!id) return;
    try {
      const { data: memData, error: memError } = await supabase
        .from('memoriais')
        .select('*, respostas(count)')
        .eq('id', id)
        .single();

      if (memError) throw memError;
      setMemorial(memData);
      
      if (memData.densidade && !sessionStorage.getItem(`saas_bio_${id}`)) {
        if (memData.densidade === 'minimo') setDensidade('200' as any);
        else if (memData.densidade === 'medio') setDensidade('300' as any);
        else if (memData.densidade === 'documental') setDensidade('400' as any);
        else setDensidade(memData.densidade);
      }
      if (memData.perfil_tom_manual && !sessionStorage.getItem(`saas_bio_${id}`)) setTom(memData.perfil_tom_manual);
      if (memData.perfil_voz) setVoz(memData.perfil_voz);

      // Carrega plano e fatias de edições
      if (memData.plano_geracao) {
         setPlanoGeracao(memData.plano_geracao);
      }
      if (typeof memData.edits_used === 'number') setEditsUsed(memData.edits_used);
      if (typeof memData.text_edits_in_cycle === 'number') setTextEditsInCycle(memData.text_edits_in_cycle);
      if (typeof memData.edits_limit === 'number') {
        setEditsLimit(memData.edits_limit);
      } else {
        const limits = { basico: 3, premium: 4, enterprise: 5 };
        setEditsLimit(limits[memData.plano_geracao as 'basico' | 'premium' | 'enterprise'] || 3);
      }

      // Verifica se já existe uma narrativa (Modo Alterar) que não esteja arquivada
      const { data: narData, error: narError } = await supabase
        .from('narrativas')
        .select('*')
        .eq('memorial_id', id)
        .neq('status_publicacao', 'arquivado')
        .order('gerado_em', { ascending: false })
        .limit(1)
        .single();
        
      if (!narError && narData) {
         setNarrativaAtual(narData);
         const isAudioMissing = !narData.audio_url || narData.audio_status === 'failed';
         if (narData.status_publicacao === 'rascunho' || isAudioMissing) {
           setTextoGerado(narData.conteudo_completo);
           setNarrativaIdGerada(narData.id);
           setEtapa('leitura');
         }
      }

      const { data: eventos } = await supabase
        .from('eventos_geracao')
        .select('instrucao_ajuste')
        .eq('memorial_id', id)
        .order('gerado_em', { ascending: false })
        .limit(1)
        .single();

      if (eventos) {
        setInstrucaoSalva(eventos.instrucao_ajuste || '');
      }
      
      // Fase 1: Setup do initialSnapshot
      if (!sessionStorage.getItem(`saas_bio_${id}`)) {
        setInitialSnapshot({
           tamanho: memData.densidade === 'minimo' ? '200' : memData.densidade === 'medio' ? '300' : memData.densidade === 'documental' ? '400' : (memData.densidade || '200'),
           tom: memData.perfil_tom_manual || '',
           voz: memData.perfil_voz || '',
           instrucao: eventos?.instrucao_ajuste || ''
        });
      }

    } catch (err) {
      console.error('Error loading data', err);
      setErrorMsg('Erro ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Observer on location.state so that SaasFastPlanModal can trigger the local downgrade modal
  useEffect(() => {
    if (location.state?.openPlanChange && location.state?.pendingPlan) {
      setShowPlanModal(true);
      setSelectedPlanForModal(location.state.pendingPlan);
      // Let's also close the SaasFastPlanModal if it's open, because we are transitioning to the local downgrade confirmation
      setFastPlanModalOpen(false);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  const getTooltipMsg = (minPlan: string) => {
    if (minPlan === 'premium') return 'Liberado no plano Premium e Enterprise';
    if (minPlan === 'enterprise') return 'Liberado exclusivamente no plano Enterprise';
    return undefined;
  };

  // Função auxiliar Roteador Semântico
  function detectChanges(snapshot: any, current: any) {
    return {
      tamanhoChanged: snapshot.tamanho !== current.tamanho,
      tomChanged: snapshot.tom !== current.tom,
      vozChanged: snapshot.voz !== current.voz,
      instrucaoChanged: snapshot.instrucao.trim() !== current.instrucao.trim(),
      hasInstruction: current.instrucao.trim() !== ''
    };
  }

  const handleGenerateText = async () => {
    if (!memorial || !session) return;
    
    setErrorMsg('');
    setStatusMsg('');
    setSaving(true);
    setGenerationType('text');
    
    try {
      if (modoConteudo === 'ia') {
        if (!consentimento) throw new Error('É necessário confirmar os parâmetros para prosseguir.');
        if (!tom) throw new Error('Por favor, selecione um Tom Narrativo.');
        if (!voz) throw new Error('Por favor, selecione uma Voz de Narração.');
      } else {
        if (!textoManual.trim()) throw new Error('Por favor, insira o texto da biografia.');
        if (!voz) throw new Error('Por favor, selecione uma Voz de Narração.');
      }

      // Monta o estado atual para comparação se for IA
      const currentState = {
         tamanho: densidade,
         tom: tom,
         voz: voz,
         instrucao: instrucoesAdicionais || instrucaoSalva
      };

      let action = 'REBUILD';

      if (modoConteudo === 'ia' && initialSnapshot && narrativaAtual) {
         const changes = detectChanges(initialSnapshot, currentState);
         
         // Lógica de Roteamento (Regra 2.1)
         if (changes.tomChanged || changes.tamanhoChanged) {
            action = 'REBUILD';
         } else if (changes.hasInstruction && changes.instrucaoChanged) {
            action = 'REFINE';
         } else if (changes.vozChanged) {
            action = 'SILENT';
         } else {
            throw new Error('Você não realizou nenhuma alteração para atualizar a biografia.');
         }

         if (action === 'SILENT') {
            const mappedDensidade = densidade === '200' ? 'minimo' : densidade === '300' ? 'medio' : 'documental';
            const { error: updateError } = await supabase
              .from('memoriais')
              .update({ perfil_voz: voz, densidade: mappedDensidade, perfil_tom_manual: tom })
              .eq('id', memorial.id);

            if (updateError) throw updateError;
            
            // Regra 1.3 - Rebase pós sucesso
            setInitialSnapshot({ ...currentState });
            
            setTextoGerado(narrativaAtual.conteudo_completo);
            setNarrativaIdGerada(narrativaAtual.id);
            setEtapa('leitura');
            setSaving(false);
            return;
         }
      }

      const mappedDensidade = densidade === '200' ? 'minimo' : densidade === '300' ? 'medio' : 'documental';

      // Salva no banco as intenções caso existam outras mudancas
      const updates: any = {
        perfil_voz: voz,
        confirmado_pelo_usuario: true,
      };
      if (modoConteudo === 'ia') {
        updates.densidade = mappedDensidade;
        updates.perfil_tom_manual = tom;
      }

      const { error: updateError } = await supabase
        .from('memoriais')
        .update(updates)
        .eq('id', memorial.id);

      if (updateError) throw updateError;
      
      let endpoint = '';
      let payload = {};

      if (modoConteudo === 'manual') {
        endpoint = '/api/narrativas/generate';
        payload = {
          memorial_id: memorial.id,
          modo_conteudo: 'manual',
          texto_manual: textoManual.trim()
        };
      } else {
        if (action === 'REFINE') {
           // Modo Ajuste Fino
           endpoint = '/api/narrativas/adjust';
           setStatusMsg('Enviando instruções para a IA...');
           payload = {
             memorial_id: memorial.id,
             narrativa_id: narrativaAtual.id,
             versao_atual: narrativaAtual.versao || 1,
             instrucao: instrucoesAdicionais.trim(),
             ai_provider: aiProvider
           };
        } else {
           // Modo REBUILD
           endpoint = '/api/narrativas/generate';
           
           setStatusMsg('Consultando banco de dados...');
           const { data: respostas } = await supabase
              .from('respostas')
              .select('*')
              .eq('memorial_id', memorial.id);

           setStatusMsg('Gerando o texto da biografia...');
           payload = {
             memorial_id: memorial.id,
             respostas: respostas || [],
             perfil_tom: tom,
             densidade: mappedDensidade,
             total_perguntas: memorial.total_perguntas_respondidas || 0,
             motivo_geracao: !narrativaAtual ? 'primeira geracao' : (action === 'REBUILD' ? 'regeneracao completa' : 'mudanca de tom'),
             contexto_adicional: instrucoesAdicionais.trim(),
             texto_base: narrativaAtual ? narrativaAtual.conteudo_completo : undefined,
             ai_provider: aiProvider
           };
        }
      }

      const response = await fetch(endpoint, {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${session.access_token}`
         },
         body: JSON.stringify(payload),
      });

      if (!response.ok) {
         let errMsg = 'Erro na requisição da API.';
         try {
            const text = await response.text();
            try {
               const errData = JSON.parse(text);
               errMsg = errData.error || errData.message || errMsg;
            } catch {
               if (text.includes('<title>')) {
                  const match = text.match(/<pre>([\s\S]*?)<\/pre>/) || text.match(/<title>([\s\S]*?)<\/title>/);
                  if (match) errMsg = `Erro no Servidor: ${match[1].trim()}`;
               } else {
                  errMsg = text.slice(0, 150) || `Status ${response.status}`;
               }
            }
         } catch (e: any) {
            errMsg = `Erro na requisição (${response.status}): ${e.message}`;
         }
         throw new Error(errMsg);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Erro ao processar texto biográfico');
      
      // Regra 1.3 - Rebaseamento após sucesso validado
      if (modoConteudo === 'ia') {
        setInitialSnapshot({ ...currentState });
      }

      // Recarrega contadores e limites atualizados do banco
      await loadData();

      const newNarrativeId = data.narrativa_id;
      setNarrativaIdGerada(newNarrativeId);
      
      setTextoGerado(data.conteudo_completo);
      setEtapa('leitura');

    } catch (err: any) {
      setErrorMsg(err.message || 'Houve um erro ao processar a geração de texto.');
    } finally {
      setSaving(false);
    }
  };

  const handleAprovarEGerarAudio = async () => {
    if (!narrativaIdGerada || !session || !memorial) return;

    setErrorMsg('');
    setStatusMsg('Gerando a locução de áudio...');
    setSaving(true);
    setGenerationType('audio');

    try {
      const audioRes = await fetch('/api/narrativas/audio', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          narrativa_id: narrativaIdGerada,
          voz: voz,
          forcar_regeracao: true
        }),
      });

      if (!audioRes.ok) {
         let errMsg = 'Erro ao processar locução de áudio.';
         try {
            const text = await audioRes.text();
            try {
               const errData = JSON.parse(text);
               errMsg = errData.error || errData.message || errMsg;
            } catch {
               if (text.includes('<title>')) {
                  const match = text.match(/<pre>([\s\S]*?)<\/pre>/) || text.match(/<title>([\s\S]*?)<\/title>/);
                  if (match) errMsg = `Erro no Servidor de Áudio: ${match[1].trim()}`;
               } else {
                  errMsg = text.slice(0, 150) || `Status ${audioRes.status}`;
               }
            }
         } catch (e: any) {
            errMsg = `Erro na requisição de áudio (${audioRes.status}): ${e.message}`;
         }
         throw new Error(errMsg);
      }

      const audioData = await audioRes.json();
      if (!audioData.success) {
        throw new Error(audioData.error || 'Falha na geração do áudio. O texto foi salvo.');
      }

      await supabase.from('memoriais').update({ 
         status_memorial: 'concluido', 
         publico: true,
         status: memorial.status === 'rascunho' ? 'gerado' : memorial.status 
      }).eq('id', memorial.id);

      setEtapa('final');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gerar timeline e áudio.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('qr-canvas-final') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qrcode-${(memorial?.nome_homenageado || 'memorial').replace(/\\s+/g, '-').toLowerCase()}.png`;
      link.href = url;
      link.click();
    }
  };

  // Componente Modal do Plano de Geração (Fase 4 e Fase 5)
  const renderPlanChangeModal = () => {
    if (!showPlanModal || !selectedPlanForModal || !memorial) return null;

    const PLAN_COSTS = { basico: 2, premium: 4, enterprise: 6 };
    const EDITS_LIMITS = { basico: 3, premium: 4, enterprise: 5 };
    const PLAN_LEVELS = { basico: 1, premium: 2, enterprise: 3 };

    const old_plan = (memorial.plano_geracao || 'basico') as 'basico' | 'enterprise' | 'premium';
    const old_level = PLAN_LEVELS[old_plan] || 1;
    const new_level = PLAN_LEVELS[selectedPlanForModal];

    const isUpgrade = new_level > old_level;
    const isDowngrade = new_level < old_level;

    const old_plan_cost = PLAN_COSTS[old_plan];
    const new_plan_cost = PLAN_COSTS[selectedPlanForModal];
    const creditDiff = Math.abs(new_plan_cost - old_plan_cost);

    const isDowngradeBlocked = isDowngrade && editsUsed >= EDITS_LIMITS[selectedPlanForModal];

    const handleConfirmChange = async () => {
      setPlanActionLoading(true);
      setErrorMsg('');
      try {
        const response = await fetch('/api/memorial/change-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            memorial_id: memorial.id,
            new_plan: selectedPlanForModal
          })
        });

        if (!response.ok) {
          let errMsg = 'Erro ao processar alteração de plano.';
          try {
            const text = await response.text();
            try {
              const errData = JSON.parse(text);
              errMsg = errData.error || errData.message || errMsg;
            } catch {
              if (text.includes('<title>')) {
                const match = text.match(/<pre>([\s\S]*?)<\/pre>/) || text.match(/<title>([\s\S]*?)<\/title>/);
                if (match) errMsg = `Erro no Servidor de Planos: ${match[1].trim()}`;
              } else {
                errMsg = text.slice(0, 150) || `Status ${response.status}`;
              }
            }
          } catch (e: any) {
            errMsg = `Erro na requisição de mudança de plano (${response.status}): ${e.message}`;
          }
          throw new Error(errMsg);
        }

        const resData = await response.json();

        // Update local states upon success
        setPlanoGeracao(selectedPlanForModal);
        setWalletBalance(resData.new_wallet_balance);
        if (typeof resData.new_edits_used === 'number') {
           setEditsUsed(resData.new_edits_used);
        }
        setEditsLimit(EDITS_LIMITS[selectedPlanForModal]);
        
        // Update memorial ref
        setMemorial(prev => prev ? { 
          ...prev, 
          plano_geracao: selectedPlanForModal,
          edits_limit: EDITS_LIMITS[selectedPlanForModal],
          edits_used: resData.new_edits_used ?? editsUsed,
          status_memorial: resData.rebuild_forced ? 'aguardando' : prev.status_memorial,
          status: resData.rebuild_forced ? 'rascunho' : prev.status
        } : null);

        if (resData.rebuild_forced) {
          setNarrativaAtual(null);
          setTextoGerado('');
          setNarrativaIdGerada('');
        }

        setShowPlanModal(false);

        if (resData.rebuild_forced) {
          setStatusMsg('Plano alterado! A biografia foi limpa para a nova qualidade.');
        } else {
          setStatusMsg('Plano atualizado com sucesso!');
        }
        setTimeout(() => setStatusMsg(''), 4000);

      } catch (err: any) {
        setErrorMsg(err.message || 'Ocorreu um erro ao alterar o plano.');
      } finally {
        setPlanActionLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
          
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDowngradeBlocked ? 'bg-red-100 text-red-600' : (isUpgrade ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600')}`}>
              {isDowngradeBlocked ? (
                <AlertCircle className="w-5 h-5" />
              ) : (isUpgrade ? (
                <ArrowUpCircle className="w-5 h-5" />
              ) : (
                <ArrowDownCircle className="w-5 h-5" />
              ))}
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {isDowngradeBlocked ? 'Downgrade Indisponível' : (isUpgrade ? 'Confirmar Upgrade' : 'Confirmar Downgrade')}
            </h3>
          </div>

          <div className="space-y-4 text-sm text-slate-600 mb-6 font-sans">
            {isDowngradeBlocked ? (
              <div>
                <p className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl leading-relaxed mb-3 font-semibold">
                  Alerta de Bloqueio ("Mau Negócio"):
                </p>
                <p className="leading-relaxed">
                  Você já realizou <span className="font-bold text-slate-800">{editsUsed} edições</span> neste memorial, o que excede o limite estrito de <span className="font-bold text-red-600">{EDITS_LIMITS[selectedPlanForModal]} edições</span> do plano <span className="capitalize font-bold text-slate-800">{selectedPlanForModal}</span>.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Exclua a biografia primeiro para liberar este downgrade.
                </p>
              </div>
            ) : isUpgrade ? (
              <div>
                <p className="leading-relaxed mb-2">
                  Você está migrando do plano <strong className="capitalize text-slate-850">{old_plan}</strong> para o plano <strong className="capitalize text-slate-850">{selectedPlanForModal}</strong>.
                </p>
                <ul className="space-y-1.5 pl-4 list-disc mb-3 text-xs">
                  <li>Custo do Upgrade: <strong className="text-indigo-600">{creditDiff} créditos</strong></li>
                  <li>Saldo atual da carteira: <strong className="text-slate-800">{walletBalance.toFixed(2)} créditos</strong></li>
                </ul>
              </div>
            ) : (
              <div>
                <p className="leading-relaxed mb-2">
                  Você está reduzindo do plano <strong className="capitalize text-slate-850">{old_plan}</strong> para o plano <strong className="capitalize text-slate-850">{selectedPlanForModal}</strong>.
                </p>
                <ul className="space-y-1.5 pl-4 list-disc mb-3 text-xs">
                  <li>Reembolso creditado: <strong className="text-amber-600">+{creditDiff} créditos</strong></li>
                  <li>Saldo atual da carteira: <strong className="text-slate-800">{walletBalance.toFixed(2)} créditos</strong></li>
                </ul>
              </div>
            )}

            {!!narrativaAtual && !isDowngradeBlocked && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-[11px] leading-relaxed mt-4">
                <strong>Atenção:</strong> Ao alterar o plano, o texto e o áudio atuais serão <strong>excluídos</strong> para que uma nova narrativa seja gerada na qualidade e nos limites do novo pacote. O status voltará para "Aguardando Geração" e os limites de edição serão zerados para o plano {selectedPlanForModal}.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setShowPlanModal(false)}
              disabled={planActionLoading}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              {isDowngradeBlocked ? 'Ok, Entendi' : 'Cancelar'}
            </button>
            {!isDowngradeBlocked && (
              <button
                onClick={handleConfirmChange}
                disabled={planActionLoading}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${isUpgrade ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'} disabled:opacity-50`}
              >
                {planActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isUpgrade ? 'Confirmar Cobrança' : 'Confirmar Reconstrução'}
              </button>
            )}
          </div>

        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!memorial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Memorial não encontrado.</p>
      </div>
    );
  }

  const isAlterarMode = !!narrativaAtual;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Modal Antiansiedade Premium */}
      {saving && generationType && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-[6px] p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">
             {/* Glow decorativo de topo */}
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
             
             <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 animate-pulse shadow-sm">
                 {generationType === 'text' ? (
                   <Sparkles className="w-6 h-6 text-indigo-600" />
                 ) : (
                   <Mic className="w-6 h-6 text-indigo-600" />
                 )}
               </div>
               <div>
                 <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                   {generationType === 'text' ? 'Tecendo as Linhas da Memória...' : 'Dando Voz ao Legado...'}
                 </h3>
                 <p className="text-[11px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5 animate-pulse">
                   Processamento em andamento
                 </p>
               </div>
             </div>

             <p className="text-[12.5px] leading-relaxed text-slate-500 font-sans mb-6">
               {generationType === 'text' 
                 ? 'Nossa Inteligência Artificial está reunindo as lembranças enviadas pela família para redigir uma biografia sensível e afetiva, seguindo a estrutura de legado do homenageado.' 
                 : 'Sintetizando a narrativa biográfica com a voz de locução de alta definição configurada para o memorial. Aguarde alguns instantes.'}
             </p>

             {/* Barra de Progresso */}
             <div className="mb-6">
               <div className="flex items-center justify-between text-xs mb-2">
                 <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                   {loadingProgress >= 95 ? 'Finalizando...' : `Etapa ${generationType === 'text' ? 'Texto' : 'Áudio'}`}
                 </span>
                 <span className="font-extrabold text-slate-900 text-sm">
                   {Math.floor(loadingProgress)}%
                 </span>
               </div>
               <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/50 shadow-inner">
                 <div 
                   className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                   style={{ width: `${loadingProgress}%` }}
                 />
               </div>
             </div>

             {/* Lista de Etapas */}
             <div className="space-y-3.5 border-t border-slate-100 pt-6 mt-2">
               {(generationType === 'text' ? textSteps : audioSteps).map((step, i, arr) => {
                 const isCompleted = i < arr.length - 1 ? loadingProgress >= arr[i+1].minProgress : loadingProgress >= 95;
                 const isActive = loadingProgress >= step.minProgress && !isCompleted;

                 return (
                   <div key={i} className="flex items-start gap-3.5 transition-all duration-200">
                     <div className="flex-shrink-0 mt-0.5">
                       {isCompleted ? (
                         <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_2px_4px_rgba(16,185,129,0.2)]">
                           <CheckCircle2 className="w-3.5 h-3.5" />
                         </div>
                       ) : isActive ? (
                         <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-sm">
                           <Loader2 className="w-3.5 h-3.5 animate-spin" />
                         </div>
                       ) : (
                         <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                           {i + 1}
                         </div>
                       )}
                     </div>
                     <div className="flex-1">
                       <p className={`text-[12.5px] font-bold leading-tight ${isCompleted ? 'text-slate-800 line-through opacity-60' : isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`}>
                         {step.label}
                       </p>
                       <p className={`text-[10px] mt-0.5 leading-snug ${isActive ? 'text-slate-500 font-medium' : 'text-slate-400'}`}>
                         {step.desc}
                       </p>
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>
         </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/saas')}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                {isAlterarMode ? 'Corrigir Biografia:' : 'Gerar Biografia:'} {memorial.nome_homenageado || 'Sem Nome'}
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Configuração e Processamento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Carteira e Franquia de Edições */}
            <div className="flex items-center gap-3 font-sans">
              <div className="hidden sm:flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full text-indigo-700 font-bold text-xs" title="Saldo na Carteira Global">
                <Coins className="w-4 h-4 text-indigo-500" />
                <span>{walletBalance.toFixed(2)} Créditos</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-slate-700 font-semibold text-xs" title="Edições do Ciclo / Limite do Plano">
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Ciclo: {textEditsInCycle} edições | Usadas: {editsUsed}/{editsLimit}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {errorMsg && (
          <div className="fixed bottom-6 w-[90%] md:w-auto left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="p-4 shadow-2xl bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
              <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-red-100 rounded-full transition-colors opacity-70 hover:opacity-100 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* --- ETAPA: CONFIGURAÇÃO --- */}
        {renderPlanChangeModal()}
          <SaasFastPlanModal 
            isOpen={fastPlanModalOpen} 
            onClose={() => setFastPlanModalOpen(false)} 
            memorialId={memorial?.id} 
            currentPlan={planoGeracao} 
            editsUsed={editsUsed} 
            walletBalance={walletBalance} 
            hasBio={!!narrativaAtual}
            onPlanChanged={(newPlan, newBalance) => {
              loadData();
              if (typeof newBalance === 'number') {
                 setWalletBalance(newBalance);
              }
            }} 
          />
        {etapa === 'configuracao' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* 1. Banner de Plano Atual */}
            <div className={`bg-gradient-to-r p-6 sm:p-8 rounded-[16px] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${
              planoGeracao === 'enterprise' 
                ? 'from-indigo-950 to-indigo-900 border border-indigo-800' 
                : planoGeracao === 'premium'
                  ? 'from-slate-900 to-slate-800 border border-slate-700'
                  : 'bg-white border border-slate-200'
            }`}>
              <div className="flex items-center gap-4">
                 <div className={`w-14 h-14 flex items-center justify-center rounded-[14px] text-2xl shadow-inner flex-shrink-0 ${
                   planoGeracao === 'enterprise' ? 'bg-indigo-900 text-indigo-200 border border-indigo-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]' :
                   planoGeracao === 'premium' ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]' :
                   'bg-slate-50 text-slate-700 border border-slate-200'
                 }`}>
                   {planoGeracao === 'enterprise' ? '🏛' : planoGeracao === 'premium' ? '⭐' : '📋'}
                 </div>
                 <div>
                    <h2 className={`text-[12px] font-bold tracking-widest uppercase mb-0.5 ${
                      planoGeracao === 'basico' ? 'text-slate-500' : 'text-white/60'
                    }`}>Seu Plano Atual</h2>
                    <div className={`text-2xl font-black capitalize tracking-tight ${
                      planoGeracao === 'basico' ? 'text-slate-900' : 'text-white'
                    }`}>
                      {planoGeracao}
                    </div>
                    <div className={`text-[13px] leading-relaxed mt-1 font-medium ${
                      planoGeracao === 'basico' ? 'text-slate-500' : 'text-white/70'
                    }`}>
                      {planoGeracao === 'enterprise' ? '400 palavras · Todos os tons · Vozes Premium HD' :
                       planoGeracao === 'premium' ? '300 palavras · Múltiplos tons · Vozes Avançadas' :
                       '200 palavras · Tom popular · Voz Padrão'}
                    </div>
                 </div>
              </div>

              <div className="w-full md:w-auto mt-2 md:mt-0">
                 <button
                   onClick={() => setFastPlanModalOpen(true)}
                   className={`w-full md:w-auto px-6 py-3.5 font-bold text-[14px] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                     planoGeracao === 'basico' 
                       ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md' 
                       : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                   }`}
                 >
                   <Crown className={`w-[18px] h-[18px] ${planoGeracao === 'basico' ? 'text-emerald-400' : 'text-amber-300'}`} />
                   {planoGeracao === 'enterprise' ? 'Gerenciar Plano' : 'Fazer Upgrade'}
                 </button>
              </div>
            </div>

            {/* Método de Criação da Biografia */}
            <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm">
              <h2 className="text-[13px] font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                Método de Criação da Biografia
              </h2>
              <div className="flex bg-slate-100 rounded-[10px] p-1 gap-1 max-w-md">
                <button
                  type="button"
                  onClick={() => setModoConteudo('ia')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                    modoConteudo === 'ia'
                      ? 'bg-white text-indigo-600 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ✨ Gerar com IA
                </button>
                <button
                  type="button"
                  onClick={() => setModoConteudo('manual')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                    modoConteudo === 'manual'
                      ? 'bg-white text-indigo-600 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ✍️ Digitar Manualmente
                </button>
              </div>
            </div>

            {/* 2 & 3. Tamanho e Tom (Apenas se IA) */}
            {modoConteudo === 'ia' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-[26px] h-[26px] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[11px] flex-shrink-0">2</span>
                    <h2 className="text-[13px] font-bold text-slate-900 tracking-tight">Tamanho da Narrativa</h2>
                  </div>
                  
                  <div className="flex bg-slate-100 rounded-[10px] p-1 gap-1 mb-4">
                    {[
                      { id: '200', label: 'Curta', minPlan: 'basico' },
                      { id: '300', label: 'Média', minPlan: 'premium' },
                      { id: '400', label: 'Longa', minPlan: 'enterprise' }
                    ].map(s => {
                      const isLocked = 
                        (s.minPlan === 'enterprise' && planoGeracao !== 'enterprise') ||
                        (s.minPlan === 'premium' && planoGeracao === 'basico');
                      const active = densidade === s.id;
                      return (
                        <button key={s.id} disabled={isLocked} onClick={() => setDensidade(s.id as any)} title={isLocked ? getTooltipMsg(s.minPlan) : undefined}
                          className={`flex-1 py-[7px] flex flex-col items-center justify-center gap-0.5 rounded-lg border-none transition-all ${isLocked ? 'cursor-not-allowed text-slate-400' : active ? 'bg-white text-indigo-600 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.1)]' : 'text-slate-500 font-medium hover:text-slate-700 cursor-pointer'}`}>
                          <span className="text-[12px] flex items-center gap-1">
                            {isLocked && <Lock className="w-[10px] h-[10px]" />}
                            {s.label}
                          </span>
                          <span className={`text-[8px] tracking-wider uppercase font-bold ${isLocked ? 'text-slate-400' : active ? 'text-indigo-400' : 'text-slate-400'}`}>
                            {s.minPlan === 'basico' ? 'Básico' : s.minPlan === 'premium' ? 'Premium' : 'Enterprise'}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Card Expandido Tamanho */}
                  {[
                    { id: '200', words: '200 palavras', time: '~1 min', desc: 'Ideal para resumos objetivos', icon: <path strokeLinecap="round" d="M3.75 9h16.5M3.75 12h10.5" /> },
                    { id: '300', words: '300 palavras', time: '~2 min', desc: 'Equilíbrio entre detalhe e fluidez', icon: <path strokeLinecap="round" d="M3.75 9h16.5M3.75 12h16.5M3.75 15h10.5" /> },
                    { id: '400', words: '400 palavras', time: '~3 min', desc: 'Narrativa completa e detalhada', icon: <path strokeLinecap="round" d="M3.75 9h16.5M3.75 12h16.5M3.75 15h16.5M3.75 18h10.5" /> }
                  ].filter(o => o.id === densidade).map(o => (
                    <div key={o.id} className="flex items-center gap-4 p-4 rounded-xl bg-indigo-50/80 border-2 border-indigo-100">
                      <div className="w-11 h-11 rounded-[10px] bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 shadow-sm">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5"><g>{o.icon}</g></svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-indigo-900 mb-0.5">
                          {densidade === '200' ? 'Curta' : densidade === '300' ? 'Média' : 'Longa'} <span className="font-normal text-[12px] text-indigo-500">· {o.words}</span>
                        </div>
                        <div className="text-[11px] text-indigo-600/80 leading-snug">{o.desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-indigo-100 text-[11px] font-bold text-indigo-600 shadow-sm whitespace-nowrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px]">
                          <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 2"/>
                        </svg>
                        {o.time}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-[26px] h-[26px] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[11px] flex-shrink-0">3</span>
                    <h2 className="text-[13px] font-bold text-slate-900 tracking-tight">Tom Narrativo</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'popular', label: 'Popular', desc: 'Acessível e próxima', emoji: '💬', minPlan: 'basico' },
                      { id: 'rustico', label: 'Rústico', desc: 'Raízes e tradição', emoji: '🌾', minPlan: 'premium' },
                      { id: 'urbano', label: 'Urbano', desc: 'Moderno e direto', emoji: '🏙', minPlan: 'enterprise' }, 
                      { id: 'erudito', label: 'Erudito', desc: 'Refinado e formal', emoji: '📜', minPlan: 'enterprise' }
                    ].map(style => {
                      const isLocked = 
                        (style.minPlan === 'enterprise' && planoGeracao !== 'enterprise') ||
                        (style.minPlan === 'premium' && planoGeracao === 'basico');
                      const active = tom === style.id;
                      return (
                        <button key={style.id} disabled={isLocked} onClick={() => setTom(style.id)} title={isLocked ? getTooltipMsg(style.minPlan) : undefined}
                          className={`text-left p-[13px] rounded-xl border-2 transition-all ${isLocked ? 'cursor-not-allowed opacity-[0.45] bg-[#fafafa] border-slate-200' : active ? 'border-indigo-600 bg-indigo-50 shadow-[0_0_0_3px_rgba(79,70,229,0.15)] cursor-pointer' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                             <span className="text-[17px]">{style.emoji}</span>
                             <div className="flex items-center gap-1.5">
                               <span className={`text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded ${
                                 style.minPlan === 'enterprise' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                 style.minPlan === 'premium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                 'bg-slate-100 text-slate-500 border border-slate-200'
                               }`}>
                                 {style.minPlan === 'basico' ? 'Básico' : style.minPlan === 'premium' ? 'Premium' : 'Enterprise'}
                               </span>
                               {isLocked ? <Lock className="w-3 h-3 text-slate-400" /> : active ? <CheckCircle2 className="w-4 h-4 text-indigo-600" /> : null}
                             </div>
                          </div>
                          <div className={`text-[12px] font-bold mb-0.5 ${active ? 'text-indigo-900' : 'text-slate-700'}`}>{style.label}</div>
                          <div className={`text-[11px] leading-[1.3] ${active ? 'text-indigo-600' : 'text-slate-400'}`}>{style.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Voz */}
            <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-[26px] h-[26px] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[11px] flex-shrink-0">4</span>
                <h2 className="text-[13px] font-bold text-slate-900 tracking-tight">Voz de Narração</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { id: 'pt-BR-Standard-A', name: 'Feminina Padrão', sub: 'Sintética · Clara', gender: 'feminina', emoji: '🎙️', wave: [3,5,8,5,3,6,9,6,3], minPlan: 'basico' }, 
                    { id: 'pt-BR-Standard-B', name: 'Masculina Padrão', sub: 'Sintética · Grave', gender: 'masculino', emoji: '🎙️', wave: [4,7,5,8,4,7,5,8,4], minPlan: 'basico' },
                    { id: 'pt-BR-Journey-F', name: 'Serena', sub: 'Journey · Expressiva', gender: 'feminina', emoji: '🎤', wave: [3,6,10,7,4,8,11,6,3], minPlan: 'premium' }, 
                    { id: 'pt-BR-Journey-D', name: 'Atlas', sub: 'Journey · Profunda', gender: 'masculino', emoji: '🎤', wave: [5,8,6,10,5,9,7,10,5], minPlan: 'premium' },
                    { id: 'elevenlabs-alice', name: 'Emocional', sub: 'ElevenLabs · Ultra-real', gender: 'feminina', emoji: '✨', wave: [2,5,9,12,8,11,7,10,4], minPlan: 'enterprise' }, 
                    { id: 'elevenlabs-marcus', name: 'Grave Neural', sub: 'ElevenLabs · Ultra-real', gender: 'masculino', emoji: '✨', wave: [4,8,6,11,5,10,8,12,5], minPlan: 'enterprise' },
                    { id: 'elevenlabs-sarah', name: 'Suave', sub: 'ElevenLabs · Ultra-real', gender: 'feminina', emoji: '✨', wave: [3,6,8,10,7,9,6,8,4], minPlan: 'enterprise' }
                  ].map(v => {
                    const isLocked = 
                      (v.minPlan === 'enterprise' && planoGeracao !== 'enterprise') ||
                      (v.minPlan === 'premium' && planoGeracao === 'basico');
                    const active = voz === v.id;
                    return (
                      <button key={v.id} onClick={() => { if (isLocked) { setFastPlanModalOpen(true); } else { setVoz(v.id); } }} title={isLocked ? `${getTooltipMsg(v.minPlan)} - Clique para fazer Upgrade` : undefined}
                        className={`text-left p-4 rounded-[13px] border-2 transition-all cursor-pointer ${isLocked ? 'opacity-[0.6] bg-[#fafafa] border-slate-200 hover:border-amber-300' : active ? 'border-indigo-600 bg-indigo-50 shadow-[0_0_0_3px_rgba(79,70,229,0.15)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                        {/* Topo: emoji + waveform */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[17px] border ${isLocked ? 'bg-slate-100 border-slate-200 grayscale opacity-50' : active ? 'bg-indigo-100 border-indigo-200' : 'bg-slate-100 border-slate-200'}`}>{v.emoji}</div>
                          <div className="flex items-center gap-2">
                             {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                             <svg viewBox={`0 0 ${v.wave.length * 5} 16`} className="w-10 h-4 flex-shrink-0">
                                {v.wave.map((h, i) => (
                                  <rect key={i} x={i * 5} y={(16 - h) / 2} width="3" height={h} rx="1.5" fill={isLocked ? "#e5e7eb" : active ? "#6366f1" : "#d1d5db"} />
                                ))}
                             </svg>
                          </div>
                        </div>
                        <div className={`text-[13px] font-bold mb-[3px] ${isLocked ? 'text-slate-500' : active ? 'text-indigo-900' : 'text-slate-900'}`}>{v.name}</div>
                        <div className={`text-[11px] mb-2 ${isLocked ? 'text-slate-400' : active ? 'text-indigo-600' : 'text-slate-500'}`}>{v.sub}</div>
                        <div className="flex items-center justify-between mt-1">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLocked ? 'bg-slate-100 text-slate-400' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            {v.gender === "feminina" ? "♀" : "♂"} {v.gender}
                          </div>
                          <span className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                            v.minPlan === 'enterprise' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                            v.minPlan === 'premium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {v.minPlan === 'basico' ? 'Básico' : v.minPlan === 'premium' ? 'Premium' : 'Enterprise'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Form de inserção manual */}
            {modoConteudo === 'manual' && (
              <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-[26px] h-[26px] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[11px] flex-shrink-0">5</span>
                  <h2 className="text-[13px] font-bold text-slate-900 tracking-tight">Inserir Biografia Manualmente</h2>
                </div>
                <textarea
                  value={textoManual}
                  onChange={(e) => setTextoManual(e.target.value)}
                  placeholder="Escreva ou cole aqui o texto completo da biografia da pessoa homenageada. Esse texto será utilizado para a timeline pública e para a síntese de voz."
                  className="w-full border-[1.5px] border-slate-200 rounded-[10px] p-3.5 text-[13px] text-slate-700 bg-slate-50 resize-none outline-none focus:border-indigo-500 focus:bg-white focus:ring-[3px] focus:ring-indigo-500/10 transition-all font-sans leading-relaxed text-left placeholder:text-slate-400"
                  rows={10}
                />
              </div>
            )}

            {/* 5. Chat / Instruções (Apenas se IA) */}
            {modoConteudo === 'ia' && (
              <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-[26px] h-[26px] rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[11px] flex-shrink-0">5</span>
                  <div>
                    <h2 className="text-[13px] font-bold text-slate-900 tracking-tight">Instrução de Ajuste</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{isAlterarMode ? 'Leia a biografia no botão abaixo antes de alterar.' : 'Dê guias para a IA estruturar o texto.'}</p>
                  </div>
                </div>

                {/* Se Alterar -> Caixa de prévia */}
                {isAlterarMode && narrativaAtual && (
                   <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button 
                        onClick={() => setShowPreview(!showPreview)}
                        className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors"
                      >
                         <div className="flex items-center gap-2">
                           <BookOpen className="w-[14px] h-[14px] text-slate-500" />
                           <span className="font-semibold text-slate-700 text-[13px]">Ver Biografia Atual</span>
                         </div>
                         {showPreview ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      
                      {showPreview && (
                         <div className="p-4 border-t border-slate-200 bg-slate-50/50 max-h-[300px] overflow-y-auto">
                            <p className="font-serif text-slate-700 leading-relaxed text-[13px] whitespace-pre-wrap">
                               {narrativaAtual.conteudo_completo?.replace(/(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)/g, '') || 'Sem texto'}
                            </p>
                         </div>
                      )}
                   </div>
                )}

                <textarea 
                  value={instrucoesAdicionais}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setInstrucoesAdicionais(e.target.value);
                    }
                  }}
                  disabled={saving}
                  placeholder={isAlterarMode ? "Ex: Tire a menção sobre a viagem do exterior..." : "Ex: Enfatize os anos de serviço público. Use linguagem mais acessível. Mencione os netos pelo nome..."}
                  className="w-full border-[1.5px] border-slate-200 rounded-[10px] p-3.5 text-[13px] text-slate-700 bg-slate-50 resize-none outline-none focus:border-indigo-500 focus:bg-white focus:ring-[3px] focus:ring-indigo-500/10 transition-all font-sans leading-relaxed text-left placeholder:text-slate-400"
                  rows={3}
                  maxLength={500}
                />
                <div className="flex justify-end mt-1.5">
                    <span className={`text-[10px] font-bold tracking-wide uppercase ${instrucoesAdicionais.length === 500 ? 'text-red-500' : 'text-slate-400'}`}>
                      {instrucoesAdicionais.length} / 500
                    </span>
                </div>
              </div>
            )}

            {/* 6. Geração Final Container (Luxo Premium Light) */}
            <div className="bg-white rounded-[14px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200 relative overflow-hidden mt-6">
                
                {/* AI Provider selector (Only in AI Mode) */}
                {modoConteudo === 'ia' && (
                  <div className="mb-6 flex flex-col gap-2">
                    <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Provedor de Inteligência Artificial
                    </label>
                    <div className="flex bg-slate-100 rounded-[10px] p-1 gap-1 max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setAiProvider('claude')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                          aiProvider === 'claude'
                            ? 'bg-white text-indigo-600 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Claude 3.5 Sonnet
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiProvider('gemini')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                          aiProvider === 'gemini'
                            ? 'bg-white text-indigo-600 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Gemini 1.5 Pro
                      </button>
                    </div>
                  </div>
                )}

                {/* Lock warning (Only in AI Mode) */}
                {modoConteudo === 'ia' && textEditsInCycle >= 2 && editsUsed >= editsLimit && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 mb-6">
                    <Lock className="w-5 h-5 text-red-655 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-red-950">Limite de Geração Atingido</p>
                      <p className="text-xs text-red-700 mt-1 leading-relaxed">
                        Você atingiu o limite de edições do seu plano ({editsLimit}) no ciclo atual deste memorial. Para realizar novas gerações de IA, faça upgrade de plano.
                      </p>
                      <button 
                        type="button"
                        onClick={() => setFastPlanModalOpen(true)}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline bg-transparent border-none cursor-pointer"
                      >
                        Fazer Upgrade do Plano agora
                      </button>
                    </div>
                  </div>
                )}

                {modoConteudo === 'ia' ? (
                  <div className="flex items-start gap-4 mb-6">
                    <div className="mt-1">
                      <input 
                        type="checkbox" 
                        id="consentimento"
                        className="w-5 h-5 rounded-[6px] border-slate-300 text-indigo-600 focus:ring-indigo-600/20 bg-slate-50 cursor-pointer shadow-sm transition-all"
                        checked={consentimento}
                        onChange={e => setConsentimento(e.target.checked)}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label htmlFor="consentimento" className="font-bold text-[14px] text-slate-800 cursor-pointer select-none">
                        Confirmo a {isAlterarMode ? 'atualização' : 'geração'} da biografia com os parâmetros escolhidos.
                      </label>
                      <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                        Somente o <strong className="text-slate-700">TEXTO</strong> será gerado agora para sua aprovação e leitura final antes de criarmos o Áudio com a voz escolhida.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs text-slate-600 leading-relaxed">
                    Você está salvando a biografia escrita manualmente. O texto inserido será utilizado na timeline e servirá como base para sintetizar o áudio na etapa de locução.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5 mt-6">
                  <div>
                    {modoConteudo === 'ia' ? (
                      <>
                        <p className="text-slate-400 text-[12px]">
                          Custo desta operação: <strong className="text-slate-700">
                            {textEditsInCycle < 2 ? 'Gratuito (Primeiras 2 edições)' : '1 Edição do Plano'}
                          </strong>
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1">Tempo estimado de processamento: ~30 segundos</p>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-400 text-[12px]">Custo desta operação: <strong className="text-emerald-600">Totalmente Gratuito (Bypass de IA)</strong></p>
                        <p className="text-slate-500 text-[11px] mt-1">Tempo estimado de processamento: Instantâneo</p>
                      </>
                    )}
                  </div>
                  
                  <div className="w-full sm:w-auto flex items-center justify-end gap-3 flex-wrap">
                    {statusMsg && (
                      <div className="text-[13px] font-bold text-indigo-600 animate-pulse text-right bg-indigo-50/80 px-4 py-2 rounded-lg border border-indigo-100 w-full sm:w-auto">
                        {statusMsg}
                      </div>
                    )}
                    
                    <button 
                      onClick={handleGenerateText}
                      disabled={
                        saving ||
                        (modoConteudo === 'ia' && (!consentimento || !tom || !voz || (textEditsInCycle >= 2 && editsUsed >= editsLimit))) ||
                        (modoConteudo === 'manual' && (!textoManual.trim() || !voz))
                      }
                      className={`w-full sm:w-auto border-0 px-6 py-3.5 font-bold text-[13px] rounded-xl flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                        (saving ||
                        (modoConteudo === 'ia' && (!consentimento || !tom || !voz || (textEditsInCycle >= 2 && editsUsed >= editsLimit))) ||
                        (modoConteudo === 'manual' && (!textoManual.trim() || !voz)))
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-br from-indigo-600 to-indigo-500 hover:to-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] hover:-translate-y-[1px] cursor-pointer'
                      }`}
                    >
                      {saving ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : 
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} className="w-[18px] h-[18px]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      }
                      {saving 
                        ? 'Processando...' 
                        : (modoConteudo === 'manual' 
                          ? 'Salvar Biografia Manual' 
                          : (isAlterarMode ? 'Atualizar Texto da Biografia' : 'Gerar Biografia'))}
                    </button>
                  </div>
                </div>
             </div>

          </div>
        )}

        {/* --- ETAPA: LEITURA E APROVAÇÃO --- */}
        {etapa === 'leitura' && (
          <div className="animate-in slide-in-from-right duration-300">
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-center sm:text-left">
                   <div>
                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 tracking-wide uppercase mb-3">
                        Aprovação de Conteúdo
                     </span>
                     <h2 className="text-2xl font-bold text-slate-900">Esta é a biografia gerada.</h2>
                     <p className="text-slate-500 text-sm mt-1">Por favor, leia atentamente. Se aprovar, geraremos a locução em Áudio.</p>
                   </div>
                </div>

                <div className="p-8 md:p-12 bg-[#faf9f6]">
                   <div className="max-w-2xl mx-auto prose prose-slate">
                      <p className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
                         {textoGerado.replace(/(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)/g, '')}
                      </p>
                   </div>
                </div>
             </div>

             <div className="flex flex-col sm:flex-row justify-end items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                  disabled={saving || editsUsed >= editsLimit}
                  onClick={() => {
                     setEtapa('configuracao');
                     setConsentimento(false);
                     setNarrativaAtual({ id: narrativaIdGerada, conteudo_completo: textoGerado });
                  }}
                  className={`w-full sm:w-auto px-6 py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                    editsUsed >= editsLimit
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50'
                  }`}
                  title={editsUsed >= editsLimit ? "Limite de edições do plano atingido. Faça upgrade do plano para permitir novas alterações no texto." : "Voltar para alterar o texto"}
                >
                  {editsUsed >= editsLimit && <Lock className="w-3.5 h-3.5" />}
                  Voltar e Re-escrever
                </button>

                <button
                   onClick={handleAprovarEGerarAudio}
                   disabled={saving}
                   className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-slate-900/20"
                >
                   {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5 text-amber-400" />}
                   {saving ? statusMsg : 'Aprovar texto e Gerar Timeline Biográfica'}
                </button>
             </div>
          </div>
        )}

        {/* --- ETAPA: FINALIZAÇÃO --- */}
        {etapa === 'final' && (
           <div className="animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto shadow-sm text-center">
                 <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                 </div>
                 
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Tudo Pronto!</h2>
                 <p className="text-slate-600 mb-8 max-w-[280px] mx-auto text-sm leading-relaxed">
                    A biografia em áudio e texto foi publicada com sucesso e o QRCode da lápide está disponível.
                 </p>

                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 inline-block shadow-inner">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm inline-block">
                       <QRCodeCanvas 
                         id="qr-canvas-final"
                         value={`${window.location.origin}/m/${memorial.id}`} 
                         size={200}
                         level={"H"}
                         includeMargin={true}
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <button
                      onClick={handleDownloadQr}
                      className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Download className="w-5 h-5" />
                      Imprimir/Salvar QRCode
                    </button>
                    <button
                      onClick={() => window.open(`/memorial/${memorial.id}`, '_blank')}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                      Abrir Timeline Pública
                    </button>
                    <button
                      onClick={() => navigate('/saas')}
                      className="w-full mt-4 text-indigo-600 font-medium hover:text-indigo-800 transition-colors text-sm"
                    >
                      &larr; Voltar para o Painel Inicial
                    </button>
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
}

