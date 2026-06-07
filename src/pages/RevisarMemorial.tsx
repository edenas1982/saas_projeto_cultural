import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Check, Edit2, RefreshCw, Send, Copy, Save, X, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { IntentModal } from '../components/IntentModal';
import { LoadingScreen } from '../components/LoadingScreen';

interface Narrativa {
  id: string;
  conteudo_completo: string;
  versao: number;
  modo_conteudo?: string;
  audio_url?: string;
}

export default function RevisarMemorial() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [narrativa, setNarrativa] = useState<Narrativa | null>(null);
  const [memorialStatus, setMemorialStatus] = useState<string>('novo');
  const [memorialName, setMemorialName] = useState<string>('');
  const [memorialFotoUrl, setMemorialFotoUrl] = useState<string>('');
  const [memorialContexto, setMemorialContexto] = useState<{
    densidade?: string;
    tom?: string;
    voz?: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ajusteComplete, setAjusteComplete] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error' | 'info', texto: string } | null>(null);
  
  // Intent Modal
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const [qrModalData, setQrModalData] = useState<{isOpen: boolean; id: string; name: string}>({
    isOpen: false,
    id: '',
    name: ''
  });

  const handleDownloadQr = () => {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    // Create an image element with high resolution
    const pngUrl = canvas
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream');
    
    let downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_Code_${qrModalData.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
  };

  useEffect(() => {
    fetchNarrativa();
  }, [id]);

  const cleanTags = (text: string) => {
    return text.replace(/(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)/g, '')
               .replace(/\n{3,}/g, '\n\n')
               .trim();
  };

  const fetchNarrativa = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // Fetch memorial status
      const { data: memDataArray, error: memorialError } = await supabase
        .from('memoriais')
        .select('status, nome_homenageado, foto_url, densidade, perfil_tom_manual, perfil_tom_inferido, perfil_voz')
        .eq('id', id)
        .eq('user_id', user.id)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .limit(1);
        
      const memData = memDataArray?.[0];
      if (memData) {
        setMemorialStatus(memData.status);
        setMemorialName(memData.nome_homenageado);
        setMemorialFotoUrl(memData.foto_url || '');
        setMemorialContexto({
          densidade: memData.densidade,
          tom: memData.perfil_tom_manual || memData.perfil_tom_inferido,
          voz: memData.perfil_voz
        });
      }
      
      const { data, error } = await supabase
        .from('narrativas')
        .select('*')
        .eq('memorial_id', id)
        .order('gerado_em', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        data.conteudo_completo = cleanTags(data.conteudo_completo || '');
        setNarrativa(data);
        setEditedContent(data.conteudo_completo);

        // Auto-gerar áudio se não existir (corrige narrativas antigas)
        if (!data.audio_url && memData?.status === 'publicado') {
           apiFetch('/api/narrativas/audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ narrativa_id: data.id, voz: memData.perfil_voz }),
           })
           .then(async res => {
              const json = await res.json();
              if (res.ok && json.success && json.audio_url) {
                 setNarrativa(prev => prev ? { ...prev, audio_url: json.audio_url } : prev);
              } else {
                 console.error('Falha ao auto-gerar:', json);
              }
           })
           .catch(err => console.error('Erro ao auto-gerar áudio:', err));
        }

      } else {
        // Se nao tem narrativa, avisa
        setMensagem({ tipo: 'error', texto: 'Nenhuma biografia gerada.' });
      }
    } catch (error) {
      console.error('Erro ao buscar narrativa:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao carregar a biografia.' });
    } finally {
      setLoading(false);
    }
  };

  const salvarEdicao = async () => {
    try {
      if (narrativa && editedContent !== narrativa.conteudo_completo) {
        setIsGenerating(true);
        setLoadingMsg('Salvando alterações...');

        await supabase
          .from('narrativas')
          .update({ 
            conteudo_completo: editedContent,
            modo_conteudo: 'editado_pelo_usuario',
            audio_url: null
          })
          .eq('id', narrativa.id);
          
        await supabase
          .from('eventos_geracao')
          .insert({
            memorial_id: id,
            narrativa_id: narrativa.id,
            motivo_geracao: 'edicao_manual'
          });
          
        setNarrativa({ 
          ...narrativa, 
          conteudo_completo: editedContent,
          modo_conteudo: 'editado_pelo_usuario',
          audio_url: undefined
        });
        
        if (memorialStatus === 'publicado') {
          setLoadingMsg('Gerando o áudio...');
          // Espera a geração de áudio recriar o arquivo
          await apiFetch('/api/narrativas/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ narrativa_id: narrativa.id, voz: memorialContexto.voz }),
          });
        }

        // Simula conclusão
        setAjusteComplete(true);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar a edição. Tente novamente.' });
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    if (narrativa?.conteudo_completo) {
      try {
        await navigator.clipboard.writeText(narrativa.conteudo_completo);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        setMensagem({ tipo: 'success', texto: 'Texto copiado. Ajuste onde preferir e volte para colar aqui.' });
      } catch (err) {
        console.error('Erro ao copiar texto:', err);
      }
    }
  };

  const confirmarEPublicar = async () => {
    try {
      setIsGenerating(true);
      setLoadingMsg('Estamos trabalhando nisso...');
      
      let modoConteudo = narrativa?.modo_conteudo || 'gerado_ia';
      
      // Salvar a edição atual (se o conteúdo foi alterado)
      if (narrativa && editedContent !== narrativa.conteudo_completo) {
        modoConteudo = 'editado_pelo_usuario';
        
        await supabase
          .from('narrativas')
          .update({ 
            conteudo_completo: editedContent,
            modo_conteudo: 'editado_pelo_usuario'
          })
          .eq('id', narrativa.id);
      }

      await supabase
        .from('memoriais')
        .update({ 
          status: 'publicado',
          confirmado_pelo_usuario: true,
          publico: true
        })
        .eq('id', id);

      setMemorialStatus('publicado');
      if (narrativa && editedContent !== narrativa.conteudo_completo) {
        setNarrativa({ ...narrativa, conteudo_completo: editedContent, modo_conteudo: 'editado_pelo_usuario' });
      }

      // Disparar geração de áudio
      if (narrativa) {
        setLoadingMsg('Gerando áudio biográfico...');
        try {
          const res = await apiFetch('/api/narrativas/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ narrativa_id: narrativa.id, voz: memorialContexto.voz }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            console.error('Erro ao gerar áudio da nuvem:', json);
            setMensagem({ tipo: 'info', texto: 'A biografia foi aprovada, mas houve um erro temporário na geração do áudio. Entre em contato com o suporte.' });
          }
        } catch (err) {
          console.error('Erro ao disparar áudio:', err);
        }
      }

      setLoadingMsg('Processando a timeline biográfica...');
      setTimeout(() => {
        setAjusteComplete(true);
      }, 1500);
    } catch (error) {
      console.error('Erro ao confirmar:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao confirmar a biografia.' });
      setIsGenerating(false);
    }
  };

  const gerarNovamente = () => {
    setIsIntentModalOpen(true);
  };

  const handleActionSelect = (action: 'adjust' | 'regenerate' | 'manual-edit') => {
    setIsIntentModalOpen(false);

    if (action === 'adjust') {
      navigate(`/memorial/${id}/gerenciar`, {
        state: { 
          fromReview: true, 
          action: 'adjust',
          showContextField: true,
          textoAtual: editedContent 
        } 
      });
    } else if (action === 'manual-edit') {
      setIsEditing(true);
    } else if (action === 'regenerate') {
      navigate(`/memorial/${id}/gerenciar`, { state: { fromReview: true, action: 'regenerate' } });
    }
  };

  if (loading && !narrativa) {
    return (
      <div className="max-w-4xl mx-auto py-8 text-center text-gray-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/painel')}
            className="p-2 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Revisar Biografia</h1>
            <p className="text-sm text-gray-500 mt-1">
              Leia como a inteligência artificial construiu a narrativa com base nas suas memórias.
            </p>
          </div>
        </div>

        <div className="flex z-10 items-center justify-start gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm w-full md:w-auto">
          {memorialFotoUrl ? (
            <img 
              src={memorialFotoUrl} 
              alt="Homenageado" 
              className="w-14 h-14 rounded-full object-cover border border-stone-200"
              
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xl border border-stone-200">
              {memorialName ? memorialName.charAt(0) : ''}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Homenageado</span>
            <h2 className="text-lg font-bold text-stone-800 leading-tight truncate max-w-[200px] md:max-w-xs">
              {memorialName}
            </h2>
          </div>
        </div>
      </div>

      {(() => {
        let modeMsg = '';
        let bgColor = 'bg-yellow-50 border-yellow-200 text-yellow-800';

        if (memorialStatus === 'publicado') {
          if (narrativa?.modo_conteudo === 'editado_pelo_usuario') {
            modeMsg = 'Esta biografia já está publicada e contém alterações manuais feitas por você.';
            bgColor = 'bg-blue-50 border-blue-200 text-blue-800';
          } else if (narrativa?.modo_conteudo === 'ajuste_ia') {
             modeMsg = 'Esta biografia já está publicada e contém ajustes solicitados à inteligência artificial.';
             bgColor = 'bg-blue-50 border-blue-200 text-blue-800';
          } else {
            modeMsg = 'Esta biografia já foi revisada e publicada. O texto inicial foi criado por inteligência artificial.';
            bgColor = 'bg-green-50 border-green-200 text-green-800';
          }
        } else {
          if (narrativa?.modo_conteudo === 'editado_pelo_usuario') {
            modeMsg = 'Você fez alterações manuais nesta biografia. Revise e confirme para publicar.';
            bgColor = 'bg-blue-50 border-blue-200 text-blue-800';
          } else if (narrativa?.modo_conteudo === 'ajuste_ia') {
             modeMsg = 'Esta biografia foi reescrita pela IA com seus ajustes. Revise e confirme para publicar.';
             bgColor = 'bg-blue-50 border-blue-200 text-blue-800';
          } else {
            modeMsg = 'Esta biografia foi gerada com base em suas respostas. A inteligência artificial foi utilizada para criar o texto e podem existir imprecisões. Revise com atenção antes de publicar.';
            bgColor = 'bg-yellow-50 border-yellow-200 text-yellow-800';
          }
        }

        return (
          <div className={`border p-4 rounded-lg mb-8 text-sm font-medium ${bgColor}`}>
            {modeMsg}
          </div>
        );
      })()}

      {mensagem && (
        <div className={`p-4 rounded-lg mb-6 text-sm ${
          mensagem.tipo === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {mensagem.texto}
        </div>
      )}

      {/* Context info markers */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
          Tamanho: {
            !memorialContexto.densidade ? 'Curta / Resumo (Padrão)' :
            memorialContexto.densidade === 'minimo' ? 'Curta / Resumo' :
            memorialContexto.densidade === 'medio' ? 'Média' :
            memorialContexto.densidade === 'documental' ? 'Longa / Documental' : 
            memorialContexto.densidade
          }
        </span>
        
        <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
          Tom: {memorialContexto.tom || 'Emotivo (Padrão)'}
        </span>
        
        <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold capitalize border border-stone-200 shadow-sm flex items-center gap-1.5 break-keep">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
          Voz: {
            !memorialContexto.voz ? 'Feminina 1 (Padrão)' :
            memorialContexto.voz === 'pt-BR-Journey-D' ? 'Masculina 1' :
            memorialContexto.voz === 'pt-BR-Journey-F' ? 'Feminina 1' :
            memorialContexto.voz === 'pt-BR-Neural2-A' ? 'Feminina 2' :
            memorialContexto.voz === 'pt-BR-Neural2-B' ? 'Masculina 2' : 
            memorialContexto.voz
          }
        </span>
      </div>

      {/* Loading Screen just like the first time */}
      <LoadingScreen 
        isGenerating={isGenerating} 
        isComplete={ajusteComplete}
        statusMessage={loadingMsg}
        onComplete={() => {
          setAjusteComplete(false);
          setIsGenerating(false);
          // Only show QR modal if it's the specific success flow.
          if (memorialStatus === 'publicado' || true) { // We can just un-condition it since we successfully fired `setAjusteComplete(true)`! Wait no, I will just open the modal.
            setQrModalData({ isOpen: true, id: id || '', name: memorialName });
          }
        }}
      />

      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-medium text-gray-900">Resultado da Biografia</h2>
          {isEditing && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedContent(narrativa?.conteudo_completo || '');
                }}
                className="text-sm flex items-center gap-1.5 text-gray-600 hover:text-gray-700 font-medium"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editedContent}
                onChange={(e) => {
                  if (e.target.value.length <= 10000) {
                    setEditedContent(e.target.value);
                  }
                }}
                maxLength={10000}
                className="w-full min-h-[500px] p-4 text-sm font-serif leading-relaxed text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
              />
              <div className="text-right text-xs text-gray-500 font-medium space-x-1">
                <span className={editedContent.length > 9000 ? 'text-orange-500' : ''}>
                  {editedContent.length.toLocaleString('pt-BR')}
                </span>
                <span>de 10.000 caracteres</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="prose prose-sm md:prose-base prose-gray max-w-none font-serif leading-relaxed whitespace-pre-wrap">
                {narrativa ? narrativa.conteudo_completo : 'Nenhuma narrativa encontrada.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6">
        <button
          onClick={gerarNovamente}
          disabled={isGenerating || isEditing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 focus:outline-none transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          Opções de Alteração
        </button>

        {isEditing ? (
          <div className="flex items-center gap-3">
             <button
               onClick={salvarEdicao}
               className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none transition-all"
             >
               <Save className="w-4 h-4" />
               Salvar
             </button>
          </div>
        ) : memorialStatus === 'publicado' ? (
          <div className="flex items-center gap-3">
             <button
               onClick={() => navigate('/painel', { state: { showQrId: id, showQrName: memorialName } })}
               className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none transition-all"
             >
               Voltar ao Painel
             </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={confirmarEPublicar}
              disabled={isGenerating || (!narrativa && !editedContent)}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Gerar Memorial
            </button>
          </div>
        )}
      </div>
      
      <IntentModal 
        isOpen={isIntentModalOpen}
        onClose={() => setIsIntentModalOpen(false)}
        onSelectAction={handleActionSelect}
        nome_homenageado={memorialName}
        foto_url={memorialFotoUrl}
      />

      {/* Modal - QR Code */}
      {qrModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">QR Code da Homenagem</h3>
              <button 
                onClick={() => setQrModalData({ isOpen: false, id: '', name: '' })} 
                className="text-gray-400 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 inline-block">
                <QRCodeCanvas 
                  id="qr-canvas"
                  value={`${window.location.origin}/memorial/${qrModalData.id}`} 
                  size={200}
                  level={"H"}
                  includeMargin={true}
                />
              </div>
              <p className="text-center text-gray-600 mb-6 text-sm">
                Aponte a câmera do celular para este código para acessar a página pública contendo a história de <span className="font-semibold">{qrModalData.name}</span>.
              </p>
              
              <div className="flex flex-col sm:flex-row w-full gap-3">
                <button 
                  onClick={handleDownloadQr}
                  className="flex-1 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Salvar Imagem
                </button>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/memorial/${qrModalData.id}`;
                    window.open(url, '_blank');
                  }}
                  className="flex-1 bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  Abrir Página
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
