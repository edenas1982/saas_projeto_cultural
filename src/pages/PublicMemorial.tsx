import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Memorial, Narrativa, Midia, Fato, MensagemVisitante } from '../types';
import { Loader2, AlertCircle, PlayCircle, Heart, Calendar, Image as ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { calculateLifespan } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

const getInitials = (name: string) => {
  if (!name) return '';
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const parseAutorNome = (autorNome: string) => {
  if (!autorNome) return { nome: '', relacao: '' };
  const match = autorNome.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return { nome: match[1].trim(), relacao: match[2].trim() };
  }
  return { nome: autorNome.trim(), relacao: '' };
};

export default function PublicMemorial() {
  const { id } = useParams<{ id: string }>();
  const [memorial, setMemorial] = useState<Memorial | null>(null);
  const [narrativa, setNarrativa] = useState<Narrativa | null>(null);
  const [fotoPrincipal, setFotoPrincipal] = useState<string | null>(null);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [fatos, setFatos] = useState<Fato[]>([]);
  const [mensagens, setMensagens] = useState<MensagemVisitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States for sending a message
  const [novaMensagem, setNovaMensagem] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaRelacao, setNovaRelacao] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [mensagemEnviada, setMensagemEnviada] = useState(false);
  
  // Biografia expand
  const [textoExpandido, setTextoExpandido] = useState(false);

  // Gallery slider states
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (id) {
      loadMemorial(id);
      registerQRAccess(id);
    }
  }, [id]);

  const registerQRAccess = async (memorialId: string) => {
    try {
      const { data } = await supabase.from('qrcodes').select('id, total_acessos').eq('memorial_id', memorialId).maybeSingle();
      if (data) {
        await supabase.from('qrcodes').update({ 
          total_acessos: (data.total_acessos || 0) + 1,
          ultimo_acesso: new Date().toISOString()
        }).eq('id', data.id);
      }
    } catch {
      // Falha silenciosa para não quebrar a página
    }
  };

  const loadMemorial = async (memorialId: string) => {
    setLoading(true);
    setError('');
    try {
      // 1. Carregar Memorial
      const { data: memorialData, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorialId)
        .maybeSingle();

      if (memorialError || !memorialData) {
        throw new Error('Memorial não encontrado.');
      }

      setMemorial(memorialData);
      if (memorialData.foto_url) {
         setFotoPrincipal(memorialData.foto_url);
      }

      if (memorialData.status !== 'publicado' && memorialData.status !== 'gerado' && memorialData.status_memorial !== 'concluido') {
         throw new Error('Este memorial ainda não está pronto para visitação.');
      }

      // 2. Fetch Narrativa
      const { data: narrativaData } = await supabase
        .from('narrativas')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('status_publicacao', 'oficial')
        .order('gerado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (narrativaData) {
        setNarrativa(narrativaData);
      }

      // 3. Fetch Midias (Galeria)
      const { data: midiasData } = await supabase
        .from('midias')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('tipo_midia', 'foto')
        .order('ordem', { ascending: true });
        
      if (midiasData) {
         setMidias(midiasData);
      }

      // 4. Fetch Fatos (Linha do Tempo)
      const { data: fatosData } = await supabase
        .from('fatos')
        .select('*')
        .eq('memorial_id', memorialId)
        .order('ano_referencia', { ascending: true }) // Using ano_referencia for ordering conceptually
        .order('created_at', { ascending: true });
        
      if (fatosData) {
         setFatos(fatosData);
      }

      // 5. Fetch Mensagens (Somente aprovadas)
      const { data: msgsData } = await supabase
        .from('mensagens_visitantes')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('aprovado', true)
        .order('created_at', { ascending: false });
        
      if (msgsData) {
         setMensagens(msgsData);
      }

    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o memorial.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || !novaMensagem.trim() || !id) return;
    
    setEnviandoMensagem(true);
    try {
      const { error } = await supabase.from('mensagens_visitantes').insert({
        memorial_id: id,
        autor_nome: novaRelacao.trim() ? `${novoNome.trim()} (${novaRelacao.trim()})` : novoNome.trim(),
        conteudo: novaMensagem.trim(),
        aprovado: memorial?.auto_aprovar_mensagens ?? true
      });
      
      if (error) throw error;
      
      setMensagemEnviada(true);
      setNovoNome('');
      setNovaMensagem('');
      setNovaRelacao('');
      
      if (memorial?.auto_aprovar_mensagens !== false) {
        // Reload messages list so it appears immediately
        const { data: newMsgsData } = await supabase
          .from('mensagens_visitantes')
          .select('*')
          .eq('memorial_id', id)
          .eq('aprovado', true)
          .order('created_at', { ascending: false });
        if (newMsgsData) {
          setMensagens(newMsgsData);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Não foi possível enviar sua mensagem no momento. Tente novamente mais tarde.');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#8C7A6B]" />
          <p className="text-[#8C7A6B] font-medium">Lembrando a história...</p>
        </div>
      </div>
    );
  }

  if (error || !memorial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-sm border border-[#E8E4DB] text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#4A3F35] mb-2">Página Indisponível</h2>
          <p className="text-[#6B5D50]">{error}</p>
        </div>
      </div>
    );
  }

  const lifespan = (memorial.data_nascimento && memorial.data_falecimento) 
    ? calculateLifespan(memorial.data_nascimento, memorial.data_falecimento) 
    : null;

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-sans text-[#4A3F35] selection:bg-[#E8E4DB] overflow-x-hidden">
      
      {/* 1. FOTO PRINCIPAL & HEADER */}
      <section className="relative w-full min-h-[60vh] flex flex-col justify-end items-center px-4 py-20 text-center">
        {fotoPrincipal ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[#FAF8F5]/60 z-10 backdrop-blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FAF8F5]/50 to-[#FAF8F5] z-10"></div>
            <img 
              src={fotoPrincipal} 
              alt={memorial.nome_homenageado} 
              className="w-full h-full object-cover object-top opacity-40 mix-blend-multiply"
              
            />
          </div>
        ) : (
          <div className="absolute top-8 w-24 h-24 bg-[#E8E4DB] rounded-full flex items-center justify-center mb-6">
            <ImageIcon className="w-8 h-8 text-[#8C8077]" />
          </div>
        )}
        
        <div className="relative z-20 max-w-4xl mx-auto flex flex-col items-center mt-12">
          {fotoPrincipal && (
             <div className="w-40 h-40 md:w-52 md:h-52 rounded-full ring-8 ring-[#FAF8F5] shadow-2xl overflow-hidden mb-10 bg-[#E8E4DB]">
               <img src={fotoPrincipal} alt={memorial.nome_homenageado} className="w-full h-full object-cover"    />
             </div>
          )}

          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold font-serif mb-6 text-[#3B2F2A] leading-tight tracking-tight drop-shadow-sm px-4">
            {memorial.nome_homenageado}
          </h1>
          
          <div className="flex items-center justify-center gap-4 text-[#8C7A6B] font-medium tracking-widest text-sm md:text-base uppercase bg-white/50 backdrop-blur-sm px-6 py-2 rounded-full border border-white shadow-sm">
             {memorial.data_nascimento && (
               <span>{new Date(memorial.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
             )}
             {(memorial.data_nascimento || memorial.data_falecimento) && (
               <span className="w-1.5 h-1.5 rounded-full bg-[#8C7A6B]/50"></span>
             )}
             {memorial.data_falecimento && (
               <span>{new Date(memorial.data_falecimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
             )}
          </div>
          {lifespan && (
            <span className="text-sm mt-2 text-[#8C8077] italic">{lifespan} de vida</span>
          )}

          {/* Frase de Destaque */}
          {memorial.frase_destaque && (
            <div className="mt-16 max-w-2xl px-6 relative pb-8">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6 text-6xl text-[#8C7A6B]/20 font-serif leading-none">"</div>
              <p className="font-serif text-2xl md:text-3xl text-[#4A3F35] leading-relaxed text-center italic relative z-10 pt-4">
                {memorial.frase_destaque}
              </p>
            </div>
          )}
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 md:px-8 pb-24 relative z-20">
        
        {/* 2. PLAYER DE ÁUDIO */}
        {narrativa?.audio_url && narrativa.audio_url === 'mock_audio_url' ? (
          <section className="mb-16 -mt-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8E4DB] flex items-center justify-center text-center">
               <p className="text-[#6B5D50] italic font-medium">
                  [AMBIENTE DE TESTE] O áudio da locução biográfica seria exibido aqui e tocado se estivéssemos no ambiente de produção.
               </p>
            </div>
          </section>
        ) : narrativa?.audio_url ? (
          <section className="mb-16 -mt-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8E4DB] flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#3B2F2A] flex items-center justify-center shrink-0">
                <PlayCircle className="w-6 h-6 text-[#FAF8F5] ml-0.5" />
              </div>
              <div className="flex-1">
                 <h3 className="font-medium text-[#3B2F2A] mb-1">Ouvir a história</h3>
                 <audio controls className="w-full h-8" preload="none">
                    <source src={narrativa.audio_url} type="audio/mpeg" />
                    Seu navegador não suporta o elemento de áudio.
                 </audio>
              </div>
            </div>
          </section>
        ) : null}

        {/* 3. BIOGRAFIA COMPLETA */}
        <section className="mb-24">
          <h2 className="text-3xl font-serif font-medium text-[#3B2F2A] mb-12 text-center flex items-center justify-center gap-4">
             <span className="w-16 h-px bg-gradient-to-r from-transparent to-[#8C7A6B]/40"></span>
             História de Vida
             <span className="w-16 h-px bg-gradient-to-l from-transparent to-[#8C7A6B]/40"></span>
          </h2>
          
          <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-2xl mx-auto">
            <span className="px-3 py-1 bg-[#8C7A6B]/10 text-[#6B5D50] rounded-full text-xs font-semibold capitalize border border-[#8C7A6B]/20 flex items-center gap-1.5">
              Tamanho: {
                !memorial.densidade ? 'Curta / Resumo (Padrão)' :
                memorial.densidade === 'minimo' ? 'Curta / Resumo' :
                memorial.densidade === 'medio' ? 'Média' :
                memorial.densidade === 'documental' ? 'Longa / Documental' : 
                memorial.densidade
              }
            </span>
            <span className="px-3 py-1 bg-[#8C7A6B]/10 text-[#6B5D50] rounded-full text-xs font-semibold capitalize border border-[#8C7A6B]/20 flex items-center gap-1.5">
              Tom: {memorial.perfil_tom_manual || memorial.perfil_tom_inferido || 'Emotivo (Padrão)'}
            </span>
            <span className="px-3 py-1 bg-[#8C7A6B]/10 text-[#6B5D50] rounded-full text-xs font-semibold capitalize border border-[#8C7A6B]/20 flex items-center gap-1.5">
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

          <article className="prose prose-gray md:prose-lg mx-auto font-serif leading-loose text-[#4A3F35] prose-p:mb-6 prose-headings:text-[#3B2F2A] max-w-[65ch]">
            {narrativa?.conteudo_completo ? (
              <>
                <div className={`relative ${!textoExpandido ? 'max-h-[400px] overflow-hidden' : ''}`}>
                  <div className="text-[#4A3F35] text-[1.05rem] md:text-[1.15rem] text-justify space-y-6">
                    <ReactMarkdown>{narrativa.conteudo_completo}</ReactMarkdown>
                  </div>
                  {!textoExpandido && (
                    <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none"></div>
                  )}
                </div>
                {!textoExpandido && (
                  <div className="text-center mt-6">
                    <button 
                      onClick={() => setTextoExpandido(true)}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-[#8C7A6B]/30 text-[#6B5D50] hover:bg-[#8C7A6B]/5 hover:text-[#3B2F2A] transition-colors"
                    >
                      Ler história completa
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </button>
                  </div>
                )}
                {textoExpandido && (
                  <div className="text-center mt-8">
                    <button 
                      onClick={() => setTextoExpandido(false)}
                      className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-[#8C8077] hover:bg-[#8C7A6B]/5 hover:text-[#3B2F2A] transition-colors text-sm"
                    >
                      Mostrar menos
                      <ChevronRight className="w-4 h-4 -rotate-90" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="italic text-center text-[#8C8077]">A biografia está sendo preparada.</p>
            )}
          </article>
        </section>

        {/* 4. LINHA DO TEMPO VISUAL (Fatos) */}
        {fatos.length > 0 && (
          <section className="mb-24 max-w-2xl mx-auto">
            <h2 className="text-3xl font-serif font-medium text-[#3B2F2A] mb-12 text-center flex items-center justify-center gap-4">
               <span className="w-16 h-px bg-gradient-to-r from-transparent to-[#8C7A6B]/40"></span>
               Marcos da Vida
               <span className="w-16 h-px bg-gradient-to-l from-transparent to-[#8C7A6B]/40"></span>
            </h2>
            <div className="relative border-l border-[#8C7A6B]/20 ml-3 md:ml-6 space-y-8">
              {fatos.map((fato) => (
                <div key={fato.id} className="relative pl-8 md:pl-10">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#8C7A6B] ring-4 ring-[#FAF8F5]"></div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#E8E4DB]">
                    <span className="inline-block px-2.5 py-1 bg-[#F4F1EB] text-[#6B5D50] text-xs font-bold rounded mb-2 uppercase tracking-wide">
                      {fato.ano_referencia || 'Data não informada'}
                    </span>
                    <h3 className="text-lg font-semibold text-[#3B2F2A] mb-1">{fato.tipo_fato}</h3>
                    {fato.conteudo && <p className="text-[#6B5D50] text-sm leading-relaxed">{fato.conteudo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. GALERIA DE FOTOS */}
        {midias.length > 0 && (
          <section className="mb-24">
            <h2 className="text-3xl font-serif font-medium text-[#3B2F2A] mb-12 text-center flex items-center justify-center gap-4">
               <span className="w-16 h-px bg-gradient-to-r from-transparent to-[#8C7A6B]/40"></span>
               Lembranças em Imagens
               <span className="w-16 h-px bg-gradient-to-l from-transparent to-[#8C7A6B]/40"></span>
            </h2>
            
            <div className="relative w-full group max-w-5xl mx-auto">
              {midias.length > 1 && (
                <button 
                  onClick={scrollLeft}
                  className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-[#3B2F2A] border border-[#E8E4DB] shadow-lg flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-all duration-300 disabled:opacity-0 hover:bg-white hover:scale-110 focus:outline-none"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
                </button>
              )}

              <div 
                ref={scrollContainerRef}
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 px-6 -mx-6 md:px-4 md:mx-0 hide-scrollbar" 
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {midias.map((midia, index) => (
                  <div 
                    key={midia.id} 
                    className="shrink-0 w-[80%] sm:w-[45%] md:w-[35%] lg:w-[28%] rounded-[1.5rem] bg-white p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E8E4DB]/50 relative cursor-pointer snap-center group/item hover:-translate-y-1 transition-all duration-300"
                    onClick={() => setImagemAmpliada(midia.url)}
                  >
                    <div className="aspect-[4/5] relative rounded-[1rem] overflow-hidden">
                      <img 
                        src={midia.url} 
                        alt={midia.descricao || `Lembrança ${index + 1}`} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-105"
                        
                        />
                      <div className="absolute inset-0 bg-[#3B2F2A]/0 group-hover/item:bg-[#3B2F2A]/10 transition-colors duration-300"></div>
                    </div>
                  </div>
                ))}
              </div>

              {midias.length > 1 && (
                <button 
                  onClick={scrollRight}
                  className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 text-[#3B2F2A] border border-[#E8E4DB] shadow-lg flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-all duration-300 disabled:opacity-0 hover:bg-white hover:scale-110 focus:outline-none"
                  aria-label="Próxima"
                >
                  <ChevronRight className="w-6 h-6" strokeWidth={1.5} />
                </button>
              )}
            </div>
            
            {midias.length > 1 && (
              <p className="text-center text-xs text-[#8C8077] mt-2 italic md:hidden">Deslize para ver mais</p>
            )}
          </section>
        )}

        {/* 6. MENSAGENS DE VISITANTES */}
        {memorial.permitir_mensagens !== false && (
          <section className="mb-24">
            {/* Form to leave a message */}
            <div className="max-w-xl mx-auto mb-20">
              <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_12px_40px_rgba(140,122,107,0.06)] border border-[#E8E4DB] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#8C7A6B]/40 to-transparent"></div>
                
                <div className="flex flex-col items-center gap-2 justify-center mb-8 text-[#3B2F2A]">
                  <div className="w-12 h-12 rounded-full bg-[#FAF6F0] border border-[#EADCC9] flex items-center justify-center transition-transform duration-300 hover:scale-105 mb-1">
                    <Heart className="w-5 h-5 text-[#8C7A6B] fill-current" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-serif font-medium text-center">Deixar uma Palavra</h3>
                  <p className="text-xs text-[#8C8077] text-center max-w-xs leading-relaxed">Sua homenagem será guardada com carinho pela família.</p>
                </div>
              
              {mensagemEnviada ? (
                <div className="text-center bg-[#FCFAF7] p-8 rounded-2xl border border-[#E8E4DB]/50">
                  <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4 border border-green-200">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-[#4A3F35] font-serif text-xl mb-1.5">Sua mensagem foi enviada!</p>
                  <p className="text-xs text-[#8C8077] mb-6 leading-relaxed max-w-xs mx-auto">
                    {memorial?.auto_aprovar_mensagens !== false 
                      ? "Sua homenagem já está visível para a família e outros visitantes na timeline." 
                      : "Sua homenagem foi salva e estará visível na timeline após aprovação."}
                  </p>
                  <button 
                    onClick={() => setMensagemEnviada(false)}
                    className="text-[#3B2F2A] font-semibold text-xs uppercase tracking-wider hover:text-black transition-colors border-b border-[#3B2F2A]/30 pb-0.5"
                  >
                    Escrever outra homenagem
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnviarMensagem} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8C7A6B] tracking-wider uppercase mb-2">Seu Nome *</label>
                    <input 
                      type="text" 
                      required
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      className="w-full bg-[#FCFAF7] border border-[#E8E4DB] rounded-xl px-4 py-3.5 text-sm text-[#4A3F35] focus:bg-white focus:outline-none focus:border-[#8C7A6B] focus:ring-4 focus:ring-[#8C7A6B]/10 transition-all duration-300 placeholder:text-[#B5AC9F]/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8C7A6B] tracking-wider uppercase mb-2">Sua Mensagem *</label>
                    <textarea 
                      required
                      value={novaMensagem}
                      onChange={(e) => setNovaMensagem(e.target.value)}
                      rows={4}
                      className="w-full bg-[#FCFAF7] border border-[#E8E4DB] rounded-xl px-4 py-3.5 text-sm text-[#4A3F35] focus:bg-white focus:outline-none focus:border-[#8C7A6B] focus:ring-4 focus:ring-[#8C7A6B]/10 transition-all duration-300 placeholder:text-[#B5AC9F]/80 resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]"
                      placeholder="Escreva sua homenagem ou lembrança..."
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    disabled={enviandoMensagem}
                    className="w-full py-4 mt-2 bg-[#3B2F2A] hover:bg-[#2A211D] text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-55 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {enviandoMensagem ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>Enviar Homenagem</span>
                      </>
                    )}
                  </button>
                </form>
              )}
              </div>
            </div>

            <h2 className="text-3xl font-serif font-medium text-[#3B2F2A] mb-12 text-center flex items-center justify-center gap-4">
              <span className="w-16 h-px bg-gradient-to-r from-transparent to-[#8C7A6B]/40"></span>
              Homenagens
              <span className="w-16 h-px bg-gradient-to-l from-transparent to-[#8C7A6B]/40"></span>
            </h2>

            <div className="space-y-6 max-w-2xl mx-auto">
              {mensagens.length > 0 ? (
                mensagens.map((msg, index) => {
                  const isEven = index % 2 === 0;
                  
                  // Secondary color schemes under Material Design principles
                  // Even: White card, sage green border/avatar (serenity/hope)
                  // Odd: Soft linen card, warm terracotta border/avatar (legacy/memory)
                  const cardBg = isEven ? 'bg-white' : 'bg-[#FAF5EC]';
                  const cardBorder = isEven ? 'border-[#E2ECE7]' : 'border-[#EADCC9]';
                  const avatarBgText = isEven ? 'bg-[#E3EFE9] text-[#244A39]' : 'bg-[#F9ECE0] text-[#7A451C]';
                  const heartColor = isEven ? 'text-[#244A39]/10' : 'text-[#7A451C]/10';

                  const { nome, relacao } = parseAutorNome(msg.autor_nome);

                  return (
                    <div key={msg.id} className={`${cardBg} ${cardBorder} pt-1.5 pl-1.5 pb-4 pr-4 sm:pt-2 sm:pl-2 sm:pb-5 sm:pr-5 rounded-3xl shadow-sm border relative transition-all duration-300 hover:shadow-md text-left`}>
                      <Heart className={`w-5 h-5 ${heartColor} absolute top-2 right-2 sm:top-2.5 sm:right-2.5 fill-current`} />
                      
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 select-none ${avatarBgText}`}>
                          {getInitials(msg.autor_nome)}
                        </div>
                        
                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm sm:text-base text-[#3B2F2A] leading-tight">
                              {nome}
                            </span>
                            <span className="text-[10px] sm:text-xs text-[#8C8077]/80 mt-0.5">
                              {relacao ? `${relacao} • ` : ''}{msg.created_at && new Date(msg.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          <p className="text-[#4A3F35] font-serif text-sm sm:text-base leading-relaxed mt-2.5 pr-2 whitespace-pre-wrap">
                            "{msg.conteudo}"
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-[#8C8077] italic py-8">Nenhuma mensagem registrada. Seja o primeiro a deixar uma homenagem.</p>
              )}
            </div>
          </section>
        )}

      </main>

      <footer className="text-center text-sm text-[#8C8077] pb-8 pt-4">
        <p>Ecos de Memória &copy; {new Date().getFullYear()}</p>
      </footer>

      {/* Lightbox Modal */}
      {imagemAmpliada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-sm"
          onClick={() => setImagemAmpliada(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setImagemAmpliada(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={imagemAmpliada} 
            alt="Imagem ampliada" 
            className="max-w-full max-h-full object-contain select-none"
            onClick={(e) => e.stopPropagation()}
            
          />
        </div>
      )}
    </div>
  );
}
