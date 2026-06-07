import { useEffect, useState, FormEvent, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Memorial, Pergunta, Resposta } from '../types';
import { Loader2, ArrowLeft, Save, AlertCircle, CheckCircle2, Droplets, Leaf, Fingerprint, Milestone, LogOut, Check, Share2, Wand2 } from 'lucide-react';
import { ProgressModal } from '../components/ProgressModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { NewLinkModal } from '../components/NewLinkModal';
import CompartilharModal from '../components/CompartilharModal';
import { Image as ImageIcon } from 'lucide-react';

type Gaveta = 'identidade' | 'jornada' | 'essencia' | 'legado';

const GAVETAS_INFO: Record<Gaveta, { title: string; sub: string; fullTitle: string; desc: string; icon: any; bg: string }> = {
  identidade: { 
    title: 'Identidade', sub: 'A Raiz', fullTitle: 'IDENTIDADE – A RAIZ', 
    desc: 'Fatos básicos e a fundação da pessoa. Suas origens e os primeiros passos.', 
    icon: Fingerprint, bg: 'from-[#F2EAE0] to-[#EADBCF]'
  },
  jornada: { 
    title: 'Jornada', sub: 'O Tronco', fullTitle: 'JORNADA – O TRONCO', 
    desc: 'Os caminhos percorridos, as escolhas feitas e os momentos mais marcantes.', 
    icon: Milestone, bg: 'from-[#EBE5DE] to-[#DECCB8]'
  },
  essencia: { 
    title: 'Essência', sub: 'A Seiva', fullTitle: 'ESSÊNCIA – A SEIVA', 
    desc: 'Sua verdadeira personalidade, os valores cultivados e o mundo interior.', 
    icon: Droplets, bg: 'from-[#EBE5DE] to-[#D5CFC9]'
  },
  legado: { 
    title: 'Legado', sub: 'Os Frutos', fullTitle: 'LEGADO – OS FRUTOS', 
    desc: 'O que fica. Como celebramos tudo o que deixou para o mundo e para nós.', 
    icon: Leaf, bg: 'from-[#F1ECE6] to-[#E0D5CA]' 
  }
};

export default function RascunhoMemorial() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [memorial, setMemorial] = useState<Memorial | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostasIniciais, setRespostasIniciais] = useState<Record<string, Resposta>>({});
  
  // State for the form values: { pergunta_id: "texto da resposta" }
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [abaAtual, setAbaAtual] = useState<Gaveta>('identidade');
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Progress Modal States
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressState, setProgressState] = useState<1 | 2>(1);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [lastAnswer, setLastAnswer] = useState('');
  const [mandatoryFilled, setMandatoryFilled] = useState(0);
  const [totalMandatory, setTotalMandatory] = useState(12);
  const [optionalFilled, setOptionalFilled] = useState(0);
  const [totalOptional, setTotalOptional] = useState(8);

  // Gallery Modal
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);

  const handleTestFill = () => {
    const testData = [
      "Um homem de poucas palavras, mas de um coração gigante, trabalhador incansável e o grande porto seguro da nossa família.",
      "Antônio Alves da Silva. Nasceu em uma fazenda pequena no interior de Minas Gerais, perto de Poços de Caldas.",
      "Nasceu em 1945. Cresceu na roça, sem energia elétrica no começo, brincando no quintal de terra batida entre os pés de café.",
      "Filho do 'Seu' João e da Dona Maria, lavradores que vieram de carroça do interior de São Paulo em busca de terra boa.",
      "Chamavam ele de 'Tonho Ventania' porque não parava quieto, sempre correndo para ajudar o pai na roça.",
      "Foi marceneiro a vida inteira. Tinha as mãos grossas, mas um cuidado de artista para fazer móveis perfeitos.",
      "Casou-se com a Dona Helena, o amor da vida dele. Ficaram juntos por 50 anos e tiveram 4 filhos e 9 netos.",
      "A casinha com varanda que ele comprou com muito suor em Campinas, interior de São Paulo.",
      "Quando teve coragem de largar o emprego na fábrica para abrir a própria marcenaria na garagem de casa. Passou aperto, mas venceu.",
      "Não era de falar muito. O jeito dele amar era consertar as coisas quebradas na casa dos filhos e fazer brinquedos de madeira para os netos.",
      "Cheiro de pó de serra misturado com café forte passado na hora.",
      "Macarronada com frango assado com a casa cheia, seguida do cochilo sagrado no sofá com o jogo de futebol na TV.",
      "Sentar na cadeira de fio na calçada no fim da tarde, escutando rádio AM bem baixinho.",
      "Guardava parafusos e pregos velhos em potes de margarina dizendo 'um dia vai servir' (e sempre servia).",
      "Era o conselheiro quieto. Ele escutava todo mundo e só falava quando era para dar uma palavra de sabedoria.",
      "'Deus não dá um fardo maior do que a gente tem força para carregar.'",
      "Que o trabalho honesto é a nossa maior riqueza e que a família deve sempre sentar unida na mesa, não importam as brigas.",
      "A vez que ele tentou fazer um bolo surpresa para a Helena e confundiu o sal com o açúcar. O bolo ficou horrível, mas comemos tudo de tanto orgulho dele.",
      "Após uma vida longa e de muito trabalho, ele partiu de forma tranquila após um infarto, dormindo na sua cadeira favorita na varanda.",
      "'Não chorem porque fui embora, fiquem felizes pelas coisas lindas que vivemos. Cuidem bem da mãe de vocês.'"
    ];

    const sortedPerguntas = [...perguntas].sort((a, b) => a.ordem - b.ordem);
    const newFormValues = { ...formValues };
    
    sortedPerguntas.forEach((p, index) => {
      if (index < testData.length) {
        newFormValues[p.id] = testData[index];
      }
    });
    
    setFormValues(newFormValues);
  };

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  // Scroll to top when changing tab
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [abaAtual]);

  const loadData = async (memorialId: string) => {
    try {
      const { data: memorialDataArray, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorialId)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .limit(1);

      if (memorialError || !memorialDataArray || memorialDataArray.length === 0) {
        console.error("Memorial load error:", memorialError);
        throw new Error(`Memorial não encontrado: ${memorialError?.message || 'Sem dados'}`);
      }
      const memorialData = memorialDataArray[0];
      setMemorial(memorialData);

      const { data: perguntasData, error: perguntasError } = await supabase
        .from('perguntas')
        .select('*')
        .order('ordem', { ascending: true });

      if (perguntasError) {
        console.error("Perguntas load error:", perguntasError);
        throw perguntasError;
      }
      setPerguntas(perguntasData || []);

      const { data: respostasData, error: respostasError } = await supabase
        .from('respostas')
        .select('*')
        .eq('memorial_id', memorialId);

      if (respostasError) {
        console.error("Respostas load error:", respostasError);
        throw respostasError;
      }

      const initialRespMap: Record<string, Resposta> = {};
      const formValMap: Record<string, string> = {};
      
      respostasData?.forEach((resp) => {
        initialRespMap[resp.pergunta_id] = resp;
        formValMap[resp.pergunta_id] = resp.resposta;
      });

      setRespostasIniciais(initialRespMap);
      setFormValues(formValMap);

    } catch (error: any) {
      console.error('Erro geral ao carregar dados:', error);
      alert(`Erro ao carregar os dados: ${error?.message || error}. Retornando ao painel.`);
      navigate('/painel');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (perguntaId: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [perguntaId]: value
    }));
    if (value.trim() !== '') {
      setLastAnswer(value);
    }
  };

  const handleSave = async (e?: FormEvent, isFinalizar: boolean = false, redirect: boolean = false, isBackgroundSave: boolean = false): Promise<boolean> => {
    if (e) e.preventDefault();
    setMensagem({ tipo: '', texto: '' });
    if (!isBackgroundSave) {
      setSaving(true);
    }

    try {
      if (!memorial) throw new Error('Referência de memorial perdida.');

      const insertsArray = [];
      const updatesArray = [];
      const now = new Date().toISOString();

      for (const p of perguntas) {
        const val = formValues[p.id];
        if (val && val.trim() !== '') {
          const existe = respostasIniciais[p.id];
          if (existe) {
            if (existe.resposta !== val) {
              updatesArray.push({
                id: existe.id,
                memorial_id: memorial.id,
                pergunta_id: p.id,
                pergunta_texto_snapshot: p.texto_pergunta,
                gaveta_snapshot: p.gaveta,
                resposta: val,
                opcional: !p.obrigatoria,
                created_at: existe.created_at
              });
            }
          } else {
            insertsArray.push({
              memorial_id: memorial.id,
              pergunta_id: p.id,
              pergunta_texto_snapshot: p.texto_pergunta,
              gaveta_snapshot: p.gaveta,
              resposta: val,
              opcional: !p.obrigatoria,
              created_at: now
            });
          }
        }
      }

      if (insertsArray.length > 0) {
        const { error } = await supabase.from('respostas').insert(insertsArray);
        if (error) throw error;
      }
      
      if (updatesArray.length > 0) {
        const { error } = await supabase.from('respostas').upsert(updatesArray, { onConflict: 'id' });
        if (error) throw error;
      }
      
      const perguntasObrigatorias = perguntas.filter(p => p.obrigatoria);
      const perguntasRespondidas = Object.entries(formValues)
        .filter(([k, v]) => typeof v === 'string' && v.trim() !== '')
        .map(([k]) => k);
      const atendeRequisitos = perguntasObrigatorias.every(p => perguntasRespondidas.includes(p.id));

      const situacaoAtualizada = isFinalizar && atendeRequisitos ? 'respostas_recebidas' : memorial.status;

      await supabase.from('memoriais').update({
         total_perguntas_respondidas: perguntasRespondidas.length,
         ...(isFinalizar && atendeRequisitos ? { status_memorial: 'respostas_recebidas' } : {})
      }).eq('id', memorial.id);

      if (isFinalizar) {
        if (atendeRequisitos) {
          setIsGeneratingBio(true);
          setGenerationComplete(false);
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const response = await fetch('/api/narrativas/generate', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                memorial_id: memorial.id,
                respostas: Object.entries(formValues).map(([k, v]) => {
                  const p = perguntas.find(per => per.id === k);
                  return {
                    pergunta_id: k,
                    resposta: v,
                    pergunta_texto_snapshot: p?.texto_pergunta || '',
                    gaveta_snapshot: p?.gaveta || ''
                  };
                }),
                perfil_tom: memorial.perfil_tom_manual || 'rustico',
                densidade: memorial.densidade || 'minimo',
                total_perguntas: perguntasRespondidas.length,
                motivo_geracao: 'primeira geracao',
                contexto_adicional: ''
              }),
            });

            const genData = await response.json();
            if (!genData.success) {
              throw new Error(genData.error || 'Erro ao gerar biografia');
            }

            setGenerationComplete(true);
            setTimeout(() => {
              navigate(`/memorial/${memorial.id}/revisar`);
            }, 2000);
          } catch (genError: any) {
            setIsGeneratingBio(false);
            setMensagem({ tipo: 'error', texto: genError.message || 'Erro ao gerar biografia.' });
          }
          return true;
        } else {
          const primeiraFaltante = perguntasObrigatorias.find(p => !perguntasRespondidas.includes(p.id));
          if (primeiraFaltante && abaAtual !== primeiraFaltante.gaveta) {
            setAbaAtual(primeiraFaltante.gaveta as Gaveta);
          }
          setMensagem({ 
            tipo: 'error', 
            texto: 'Algumas perguntas precisam ser respondidas antes de avançar. Preencha os campos com a marcação "Obrigatório".' 
          });
        }
      } else if (redirect) {
        navigate('/painel');
        return true;
      }

      // Re-load initial maps so we don't duplicate on next save
      if (!isFinalizar || !atendeRequisitos) {
        await loadData(memorial.id);
        setLastSaved(new Date());
      }

      return true;
      
    } catch (error: any) {
      console.error(error);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar. Verifique sua conexão.' });
      return false;
    } finally {
      if (!isBackgroundSave) {
        setSaving(false);
      }
    }
  };

  const handleLoadMockData = async () => {
    try {
      setSaving(true);
      // Pega as respostas de algum outro memorial que tenha respostas
      const { data, error } = await supabase
        .from('respostas')
        .select('*')
        .not('memorial_id', 'eq', memorial?.id)
        .limit(300);
          
      if (error) throw error;
      
      const tempFormValues = { ...formValues };
      
      if (data && data.length > 0) {
        perguntas.forEach(p => {
           // tenta achar resposta da exata pergunta em outro memorial
           const answer = data.find(d => d.pergunta_id === p.id);
           if (answer && answer.resposta) {
               tempFormValues[p.id] = answer.resposta;
           } else {
               // pega qualquer resposta de texto q seja grandinha se não achar
               const anyAnswer = data.find(d => typeof d.resposta === 'string' && d.resposta.length > 50);
               tempFormValues[p.id] = anyAnswer ? anyAnswer.resposta : 'Exemplo de resposta inserida para facilitar os testes.';
           }
        });
      } else {
        // Se a base ta limpa
        perguntas.forEach(p => {
           tempFormValues[p.id] = 'Exemplo de resposta inserida para facilitar os testes da base que ainda está limpa.';
        });
      }
      
      setFormValues(tempFormValues);
      setMensagem({ tipo: 'success', texto: 'TestData: Dados carregados com sucesso!' });
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'TestData: Erro ao carregar.' });
    } finally {
      setSaving(false);
    }
  };

  const abas: Gaveta[] = ['identidade', 'jornada', 'essencia', 'legado'];
  const currentIndex = abas.indexOf(abaAtual);
  const hasNext = currentIndex < abas.length - 1;
  const hasPrev = currentIndex > 0;

  const goToNext = async () => {
    await handleSave(); // auto-save
    setAbaAtual(abas[currentIndex + 1]);
  };
  const goToPrev = async () => {
    await handleSave(); // auto-save 
    setAbaAtual(abas[currentIndex - 1]);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFBF7] space-y-4">
        <Loader2 className="w-8 h-8 text-[#5A453A] animate-spin" />
        <p className="text-[#5A453A] font-medium tracking-wide">Abrindo as gavetas de memórias...</p>
      </div>
    );
  }

  const perguntasDaGaveta = perguntas.filter(p => p.gaveta === abaAtual);
  const infoAtual = GAVETAS_INFO[abaAtual];

  return (
    <div className="flex h-screen w-full bg-[#FDFBF7] font-sans text-[#3B2F2A] overflow-hidden">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#362A24] text-[#EFEAE2] flex-shrink-0 relative z-20 shadow-2xl">
        <div className="p-8 flex items-center gap-3">
           <Leaf className="w-6 h-6 text-[#A18A72]" />
           <h1 className="font-serif font-bold text-lg tracking-wider text-[#DDC5A9] uppercase">Eco de Memórias</h1>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-2">
          {abas.map((aba) => {
            const inf = GAVETAS_INFO[aba];
            const Icon = inf.icon;
            const active = aba === abaAtual;
            
            // Calc answered ratio
            const currentQuestions = perguntas.filter(p => p.gaveta === aba);
            const numAll = currentQuestions.length;
            const numDone = currentQuestions.filter(p => formValues[p.id]?.trim() !== '').length;

            return (
              <button
                key={aba}
                onClick={() => {
                  handleSave();
                  setAbaAtual(aba);
                }}
                className={`w-full text-left px-8 py-4 flex items-center justify-between border-l-4 transition-all duration-300 relative
                  ${active 
                    ? 'border-[#DDC5A9] bg-[#493931]' 
                    : 'border-transparent text-[#978579] hover:bg-[#43352D] hover:text-[#EFEAE2]'}`}
              >
                <div className="flex items-center gap-4">
                   <div className={`p-2 rounded-lg ${active ? 'bg-[#5F4A40]' : 'bg-[#43352D]'}`}>
                      <Icon className="w-5 h-5" />
                   </div>
                   <div className="flex flex-col">
                     <span className={`text-[11px] font-bold uppercase tracking-widest ${active ? 'text-[#DDC5A9]' : 'text-[#8C7A6D]'}`}>{inf.title}</span>
                     <span className="text-sm font-medium">{inf.sub}</span>
                   </div>
                </div>
                {numDone === numAll && numAll > 0 && (
                  <Check className={`w-4 h-4 ${active ? 'text-[#A5C082]' : 'text-[#6A7859]'}`} />
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-8 border-t border-[#4A3B33] flex flex-col gap-4">
          {lastSaved && (
             <div className="text-xs text-[#8C7A6D] flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" />
                Rascunho salvo às {lastSaved.getHours().toString().padStart(2, '0')}:{lastSaved.getMinutes().toString().padStart(2, '0')}
             </div>
          )}
          <button 
             onClick={() => setIsInviteModalOpen(true)}
             className="flex items-center gap-3 text-sm font-medium text-[#A29184] hover:text-[#DDC5A9] transition"
          >
             <Share2 className="w-4 h-4" /> Delegar Perguntas
          </button>
          <button 
            onClick={() => handleSave(undefined, false, true)}
            className="flex items-center gap-3 text-sm font-medium text-[#A29184] hover:text-[#DDC5A9] transition"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER (Alternative to sidebar) */}
      <div className="lg:hidden fixed top-0 left-0 w-full h-16 bg-[#362A24] text-[#EFEAE2] flex items-center justify-between px-4 z-50 shadow-md">
         <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-[#A18A72]" />
            <span className="font-serif font-bold text-sm tracking-wider text-[#DDC5A9] uppercase">Eco de</span>
         </div>
         <div className="flex items-center gap-2">
            <button onClick={handleTestFill} className="p-2 text-[#DDC5A9] flex items-center justify-center bg-[#493931] rounded-lg" title="Preencher Teste">
               🧪
            </button>
            <button onClick={() => setIsGalleryModalOpen(true)} className="p-2 text-[#DDC5A9] flex items-center justify-center bg-[#493931] rounded-lg">
               <ImageIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setIsInviteModalOpen(true)} className="p-2 text-[#DDC5A9] flex items-center justify-center bg-[#493931] rounded-lg">
               <Share2 className="w-5 h-5" />
            </button>
            <button onClick={() => handleSave(undefined, false, true)} className="p-2 text-white">
               <LogOut className="w-5 h-5" />
            </button>
         </div>
      </div>

      {/* Loading Modal OVERLAY */}
      {isGeneratingBio && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-0">
             <LoadingScreen 
               isGenerating={isGeneratingBio} 
               isComplete={generationComplete}
               statusMessage="Isso pode levar cerca de um minuto. Não feche esta tela."
             />
          </div>
        </div>
      )}

      {/* MAIN CONTENT DIV */}
      <main ref={contentRef} className="flex-1 w-full h-full overflow-y-auto pt-16 lg:pt-0 relative bg-[#FDFBF7]">
        
        {/* Mobile "Voltar ao painel" button (visible only on mobile) */}
        <div className="lg:hidden px-4 pt-4">
           <button 
             onClick={() => handleSave(undefined, false, true)}
             className="text-[#65554B] hover:text-[#2A211A] flex items-center gap-2 text-sm font-semibold tracking-wide transition-colors"
           >
             <ArrowLeft className="w-4 h-4" /> Voltar ao painel
           </button>
        </div>

        {/* TOP NAVBAR inside content (Desktop only) */}
        <div className="hidden lg:flex sticky top-0 bg-[#FDFBF7]/90 backdrop-blur-md z-30 w-full px-12 py-6 items-center justify-between border-b-transparent transition-all border-b border-[#EBE3D7]/0">
           <button 
             onClick={() => handleSave(undefined, false, true)}
             className="text-[#65554B] hover:text-[#2A211A] flex items-center gap-2 text-sm font-semibold tracking-wide transition-colors"
           >
             <ArrowLeft className="w-4 h-4" /> Voltar para o painel principal
           </button>
           
           <div className="flex items-center gap-4">
              <button 
                onClick={handleTestFill}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors shadow-sm text-sm"
              >
                🧪 Preencher Teste
              </button>
              <button 
                onClick={() => setIsGalleryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#F2eAE0] text-[#5A453A] rounded-lg font-medium hover:bg-[#EBE5DE] transition-colors shadow-sm text-sm"
              >
                <ImageIcon className="w-4 h-4" />
                Gerenciar Fotos
              </button>
              <span className="text-xs font-semibold text-[#8C8077] uppercase tracking-widest flex items-center gap-1.5">
                {saving ? (
                   <> Salvando... <Loader2 className="w-3 h-3 animate-spin"/> </>
                ) : lastSaved ? (
                   <> Salvo às {lastSaved.getHours().toString().padStart(2, '0')}:{lastSaved.getMinutes().toString().padStart(2, '0')} <CheckCircle2 className="w-3 h-3 text-[#7B9559]"/> </>
                ) : null}
              </span>
              <div className="w-10 h-10 rounded-full bg-[#E5DDD2] border-2 border-white shadow-sm flex items-center justify-center font-bold text-[#55473E] uppercase overflow-hidden">
                {memorial?.nome_homenageado.charAt(0)}
              </div>
           </div>
        </div>

        <div className="max-w-[800px] w-full mx-auto px-6 pb-24 lg:pb-32 pt-8 lg:pt-12">
           
           {/* HERO BANNER */}
           <div className={`w-full rounded-3xl p-8 lg:p-12 mb-12 shadow-sm border border-[#EBE5DE] bg-gradient-to-br ${infoAtual.bg} relative overflow-hidden`}>
              <div className="absolute -bottom-16 -right-16 opacity-10 pointer-events-none">
                 <infoAtual.icon className="w-64 h-64 text-[#5A453A]" />
              </div>
              <div className="relative z-10">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#806B5E] mb-3 block">
                  Gaveta {currentIndex + 1} de 4
                </span>
                <h2 className="font-serif text-3xl lg:text-4xl text-[#362A24] font-bold mb-4 tracking-tight">
                  {infoAtual.fullTitle}
                </h2>
                <p className="text-[#5A453A] font-medium leading-relaxed max-w-lg text-sm lg:text-base">
                  {infoAtual.desc}
                </p>
              </div>
           </div>

           {/* PROGRESS STEPS for this Gaveta */}
           {perguntasDaGaveta.length > 0 && (
             <div className="flex items-center justify-center gap-2 lg:gap-4 mb-4 px-4">
               {perguntasDaGaveta.map((p, idx) => {
                 const isRendered = formValues[p.id]?.trim() !== '';
                 return (
                   <div key={p.id} className="flex items-center gap-2 lg:gap-4 flex-1 last:flex-none">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                       ${isRendered ? 'bg-[#96B16F] text-white' : 'bg-[#EAE4DB] text-[#8C8077]'}`}>
                        {idx + 1}
                     </div>
                     {idx !== perguntasDaGaveta.length - 1 && (
                       <div className="h-px flex-1 bg-[#EAE4DB] w-full" />
                     )}
                   </div>
                 )
               })}
             </div>
           )}

           <div className="mb-12 flex justify-center">
              <button 
                onClick={handleLoadMockData}
                disabled={saving}
                className="bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors"
                title="Botão temporário! Informar Gerente (deve ser removido depois)"
              >
                 🧪 [DEV] Auto-preencher respostas (Teste)
              </button>
           </div>

           {mensagem.texto && (
             <div className="mb-8 p-4 rounded-xl flex items-start gap-3 bg-[#FCF8F5] text-[#C44A4A] border border-[#F2D7D7]">
               <AlertCircle className="w-5 h-5 flex-shrink-0" />
               <p className="text-sm font-medium">{mensagem.texto}</p>
             </div>
           )}

           {/* QUESTIONS */}
           <div className="space-y-10">
             {perguntasDaGaveta.length === 0 ? (
                <p className="text-[#8C8077] italic text-sm text-center py-10">Nenhuma pergunta para esta gaveta.</p>
             ) : (
                perguntasDaGaveta.map((p, idx) => (
                  <div key={p.id} className="bg-white p-6 lg:p-8 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-[#EFEAE2] transition-colors focus-within:border-[#C4B7AA] focus-within:ring-2 focus-within:ring-[#EAE2D8]">
                     <div className="flex gap-4">
                       <div className="hidden sm:flex w-10 h-10 rounded-full bg-[#F5EFE8] text-[#746054] font-bold flex-shrink-0 items-center justify-center font-serif text-lg">
                          {idx + 1}
                       </div>
                       <div className="flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2">
                             <label htmlFor={p.id} className="text-lg lg:text-xl font-bold text-[#3B2F2A] leading-tight">
                                {p.id === 'ide_01' ? 'Onde nasceu?' : p.id === 'ide_02' ? 'Como era o lugar onde nasceu?' : p.texto_pergunta}
                             </label>
                             {p.obrigatoria ? (
                                <span className="bg-[#FDF2F2] text-[#C44A4A] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 mt-1 border border-[#F2D7D7]">
                                  Obrigatório
                                </span>
                             ) : (
                                <span className="bg-[#F2ECE4] text-[#857467] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 mt-1">
                                  Opcional
                                </span>
                             )}
                          </div>
                          
                          {p.placeholder && p.placeholder !== 'Sua resposta (pode ser breve)' && p.placeholder !== 'Conte os detalhes e lembranças sobre isso...' && (
                            <p className="text-sm text-[#8C8077] mb-5 leading-relaxed">{p.id === 'ide_01' ? 'Cidade e estado de nascimento.' : p.placeholder}</p>
                          )}
                          
                          <div className={`mt-5 relative ${!p.placeholder ? 'pt-2' : ''}`}>
                             {p.tipo_saida === 'fato' ? (
                                <input
                                  id={p.id}
                                  type="text"
                                  value={formValues[p.id] || ''}
                                  onChange={(e) => handleInputChange(p.id, e.target.value)}
                                  placeholder="Digite sua resposta aqui..."
                                  onBlur={() => handleSave(undefined, false, false, true)}
                                  className="w-full bg-[#FDFBF7] border border-[#E6DDD3] text-[#3B2F2A] rounded-xl px-5 py-4 focus:outline-none focus:ring-0 focus:border-[#A28F81] transition-colors placeholder:text-[#B5AAA2] shadow-inner"
                                />
                             ) : (
                                <textarea
                                  id={p.id}
                                  rows={5}
                                  value={formValues[p.id] || ''}
                                  onChange={(e) => handleInputChange(p.id, e.target.value)}
                                  onBlur={() => handleSave(undefined, false, false, true)}
                                  placeholder="Digite aqui de forma livre e detalhada..."
                                  className="w-full bg-[#FDFBF7] border border-[#E6DDD3] text-[#3B2F2A] rounded-xl px-5 py-4 focus:outline-none focus:ring-0 focus:border-[#A28F81] transition-colors placeholder:text-[#B5AAA2] shadow-inner resize-y leading-relaxed"
                                />
                             )}
                          </div>
                          
                          {/* Character Counter */}
                          <div className="mt-2 text-right min-h-[16px]">
                             {(formValues[p.id] || '').length > 0 && (
                               <span className="text-[11px] font-medium text-[#ACA298]">
                                 {(formValues[p.id] || '').length} caracteres
                               </span>
                             )}
                          </div>
                       </div>
                     </div>
                  </div>
                ))
             )}
           </div>

           {/* BOTTOM NAVIGATION FOOTER */}
           <div className="mt-16 pt-8 border-t border-[#EAE4DB] flex flex-col-reverse sm:flex-row items-center justify-between gap-6">
              
              <button 
                onClick={hasPrev ? goToPrev : () => handleSave(undefined, false, true)} 
                className="w-full sm:w-auto px-6 py-3.5 text-[#65554B] hover:bg-[#F2ECE4] rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" /> 
                {hasPrev ? 'Voltar gaveta' : 'Voltar ao painel'}
              </button>

              <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-[#806B5E] mr-2">Tela {currentIndex + 1} de 4</span>
                 {abas.map((a, i) => (
                    <div key={a} className={`w-2 h-2 rounded-full ${i === currentIndex ? 'bg-[#5A453A]' : 'bg-[#DDC5A9]'}`} />
                 ))}
              </div>

              {hasNext ? (
                <button 
                  onClick={goToNext} 
                  className="w-full sm:w-auto bg-[#362A24] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-[#201814] shadow-lg shadow-[#362A24]/20 transition flex items-center justify-center gap-2"
                >
                  Próxima etapa
                </button>
              ) : (
                <button 
                  onClick={(e) => handleSave(e, true)} 
                  disabled={saving || isGeneratingBio} 
                  className="w-full sm:w-auto bg-[#362A24] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-[#201814] shadow-lg shadow-[#362A24]/20 transition flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  Gerar Biografia
                </button>
              )}

           </div>
           
           <p className="text-center text-[#B5AAA2] text-[11px] uppercase tracking-widest font-bold mt-12 flex justify-center items-center gap-2">
             <Fingerprint className="w-3 h-3" /> Seus dados são privados e seguros
           </p>

        </div>
      </main>

      <NewLinkModal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        memorial={memorial}
        initialTab="gallery"
        onGenerate={(data) => {
          setMemorial(data);
        }}
      />
      
      <CompartilharModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        memorialId={memorial?.id || ''}
        perguntas={perguntas}
      />
    </div>
  );
}

