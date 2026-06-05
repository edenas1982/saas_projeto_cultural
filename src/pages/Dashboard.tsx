import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Memorial } from '../types';
import { Loader2, Plus, Trash2, Edit2, X, AlertCircle, Sparkles, FileText, QrCode, Download, MessageSquare, User } from 'lucide-react';
import { formatName, calculateLifespan } from '../lib/utils';
import { QRCodeCanvas } from 'qrcode.react';
import { NewLinkModal } from '../components/NewLinkModal';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [memoriais, setMemoriais] = useState<Memorial[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemorial, setEditingMemorial] = useState<Memorial | null>(null);

  const [deleteModalData, setDeleteModalData] = useState<{isOpen: boolean; id: string; name: string}>({
    isOpen: false,
    id: '',
    name: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
  const [totalPerguntas, setTotalPerguntas] = useState(0);
  const [msgCounts, setMsgCounts] = useState<Record<string, number>>({});

  const [qrModalData, setQrModalData] = useState<{isOpen: boolean; id: string; name: string}>({
    isOpen: false,
    id: '',
    name: ''
  });

  useEffect(() => {
    if (location.state?.showQrId && location.state?.showQrName) {
      setQrModalData({
        isOpen: true,
        id: location.state.showQrId,
        name: location.state.showQrName
      });
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

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

  useEffect(() => {
    fetchMemoriais();
    fetchTotalPerguntas();
  }, []);

  const fetchTotalPerguntas = async () => {
    try {
      const { count, error } = await supabase
        .from('perguntas')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      setTotalPerguntas(count || 0);
    } catch (error) {
      console.error('Erro ao buscar total de perguntas:', error);
    }
  };

  const gerarBiografia = (memorial: Memorial) => {
    if (!memorial.confirmado_pelo_usuario && memorial.status !== 'gerado' && memorial.status !== 'publicado') {
      alert('É necessário preencher as perguntas obrigatórias antes de gerar.');
      return;
    }
    
    // Se já foi gerado ou publicado, vai para revisar
    if (memorial.status === 'gerado' || memorial.status === 'publicado') {
      navigate(`/memorial/${memorial.id}/revisar`);
    } else {
      // Se não, vai para configurar tom que chamará a API
      navigate(`/memorial/${memorial.id}/gerenciar`);
    }
  };

  const fetchMemoriais = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('memoriais')
        .select(`
          *,
          respostas (id)
        `)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const toUpdate = data?.filter(m => (m.status === 'publicado' || m.status === 'finalizado') && !m.publico);
      if (toUpdate && toUpdate.length > 0) {
        for (const mem of toUpdate) {
          await supabase.from('memoriais').update({ publico: true }).eq('id', mem.id);
          mem.publico = true;
        }
      }
      
      setMemoriais(data || []);
      
      if (data && data.length > 0) {
        const ids = data.map(m => m.id);
        const { data: msgs, error: msgsError } = await supabase
          .from('mensagens_visitantes')
          .select('memorial_id')
          .in('memorial_id', ids)
          .eq('aprovado', false);
          
        if (!msgsError && msgs) {
          const counts: Record<string, number> = {};
          msgs.forEach(msg => {
            counts[msg.memorial_id] = (counts[msg.memorial_id] || 0) + 1;
          });
          setMsgCounts(counts);
        }
      }
      
    } catch (error) {
      console.error('Erro ao buscar memoriais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSuccess = (data: any, isNew?: boolean) => {
    // Se o backend não nos disser se é novo de forma explícita, podemos tentar deduzir ou sempre redirecionar/recarregar
    fetchMemoriais();
    fechaModal();
  };

  const openEditModal = (memorial: Memorial) => {
    setEditingMemorial(memorial);
    setIsModalOpen(true);
  };

  const openDeleteModal = (memorial: Memorial) => {
    setDeleteModalData({
      isOpen: true,
      id: memorial.id,
      name: memorial.nome_homenageado
    });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('memoriais')
        .delete()
        .eq('id', deleteModalData.id);

      if (error) throw error;
      setMemoriais(memoriais.filter(m => m.id !== deleteModalData.id));
      setDeleteModalData({ isOpen: false, id: '', name: '' });
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Não foi possível excluir o memorial.');
    } finally {
      setIsDeleting(false);
    }
  };

  const fechaModal = () => {
    setIsModalOpen(false);
    setEditingMemorial(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Painel Principal</h2>
          <p className="text-gray-500 mt-1">Gerencie os memoriais e conteúdos associados.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Memorial
        </button>
      </div>

      {/* Dashboard Grid de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <h3 className="font-semibold text-gray-900">Meus Memoriais</h3>
          <p className="text-3xl font-bold mt-2 text-gray-900">
            {loading ? '-' : memoriais.length}
          </p>
        </div>
      </div>

      {/* Listagem */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seus Memoriais</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : memoriais.length === 0 ? (
          <div className="bg-white border text-center border-gray-200 border-dashed rounded-2xl p-10 flex flex-col items-center">
            <p className="text-gray-500 mb-4">Você ainda não tem nenhum memorial criado.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-gray-900 font-medium hover:underline inline-flex items-center gap-1"
            >
              Criar o meu primeiro memorial <Plus className="w-4 h-4"/>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memoriais.map((memorial) => {
              const hasAnswers = (memorial.respostas && memorial.respostas.length > 0) || memorial.total_perguntas_respondidas > 0;
              const lifespan = (memorial.data_nascimento && memorial.data_falecimento) 
                ? calculateLifespan(memorial.data_nascimento, memorial.data_falecimento) 
                : null;
              
              return (
              <div key={memorial.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
                
                {/* Cabeçalho do Card */}
                <div className="flex items-start gap-4 mb-2">
                  {memorial.foto_url ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                      <img src={memorial.foto_url} alt={memorial.nome_homenageado} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full flex-shrink-0 bg-gray-100 border border-gray-200 flex items-center justify-center">
                       <User size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-gray-900 truncate pr-2" title={memorial.nome_homenageado}>
                        {memorial.nome_homenageado}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-md font-medium uppercase tracking-wider shrink-0
                        ${memorial.status === 'rascunho' ? (memorial.confirmado_pelo_usuario ? 'bg-blue-100 text-blue-800' : (hasAnswers ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800')) : ''}
                        ${memorial.status === 'gerado' ? 'bg-indigo-100 text-indigo-800' : ''}
                        ${memorial.status === 'publicado' ? 'bg-green-100 text-green-800' : ''}
                      `}>
                        {memorial.status === 'rascunho' 
                          ? (memorial.confirmado_pelo_usuario ? 'Pronto para Gerar' : (hasAnswers ? 'Em Preenchimento' : 'Rascunho')) 
                          : memorial.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="text-sm text-gray-500 space-y-1 mb-4">
                  <p>
                    <span className="font-medium text-gray-700">Nascimento:</span> {memorial.data_nascimento ? new Date(memorial.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informado'}
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Falecimento:</span> {memorial.data_falecimento ? new Date(memorial.data_falecimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informado'}
                  </p>
                  {lifespan && (
                    <p className="mt-2 text-[#6B5D50] bg-[#F4F1EC] inline-block px-2.5 py-0.5 rounded-md font-medium border border-[#E8E4DB]">
                      {lifespan} de vida
                    </p>
                  )}
                </div>

                {/* Progresso do Questionário */}
                {totalPerguntas > 0 && (
                  <div className="mb-6 pt-2 border-t border-gray-50 mt-auto">
                    <div className="flex justify-between text-xs font-medium text-gray-600 mb-1.5">
                      <span>Questionário</span>
                      <span>{memorial.respostas?.length || memorial.total_perguntas_respondidas || 0} de {totalPerguntas}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${memorial.confirmado_pelo_usuario ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, Math.round(((memorial.respostas?.length || memorial.total_perguntas_respondidas || 0) / totalPerguntas) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {/* Ações Restruturadas */}
                <div className="border-t border-gray-100 pt-4 flex flex-col gap-2.5 mt-auto">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {/* Botão de Questionário */}
                    <button 
                      onClick={() => navigate(`/memorial/${memorial.id}/rascunho`)}
                      className="flex-1 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold py-2.5 px-3 rounded-lg transition flex justify-center items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 shrink-0" /> 
                      {memorial.confirmado_pelo_usuario ? 'Alterar Respostas' : 'Responder Questionário'}
                    </button>
                    
                    {/* Botão de Biografia */}
                    <button 
                      onClick={() => gerarBiografia(memorial)}
                      disabled={(!memorial.confirmado_pelo_usuario && memorial.status !== 'gerado' && memorial.status !== 'publicado') || isGeneratingId === memorial.id}
                      title={!memorial.confirmado_pelo_usuario ? "Preencha as perguntas obrigatórias do questionário primeiro" : ""}
                      className={`flex-1 text-sm font-semibold py-2.5 px-3 rounded-lg transition flex justify-center items-center gap-1.5
                        ${(memorial.confirmado_pelo_usuario || memorial.status === 'gerado' || memorial.status === 'publicado') 
                          ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                        ${isGeneratingId === memorial.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isGeneratingId === memorial.id ? (
                        <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className={`w-4 h-4 shrink-0 ${memorial.status === 'rascunho' && !memorial.confirmado_pelo_usuario ? 'opacity-50' : 'text-amber-400'}`} />
                      )}
                      {isGeneratingId === memorial.id ? 'Gerando...' : (memorial.status === 'gerado' || memorial.status === 'publicado' ? 'Ver Biografia' : 'Gerar Biografia')}
                    </button>
                  </div>

                  <div className="flex gap-2.5">
                    {memorial.status === 'publicado' && (
                      <>
                        <button 
                          onClick={() => setQrModalData({ isOpen: true, id: memorial.id, name: memorial.nome_homenageado })}
                          className="px-3 py-2 text-gray-900 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition flex items-center justify-center shadow-sm"
                          title="Ver QR Code"
                        >
                          <QrCode className="w-4 h-4 shrink-0" />
                        </button>
                        <button 
                          onClick={() => navigate(`/memorial/${memorial.id}/mensagens`)}
                          className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-200 py-2 px-3 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-1.5 shadow-sm relative overflow-visible"
                        >
                          <MessageSquare className="w-4 h-4 shrink-0" />
                          Mensagens
                          {msgCounts[memorial.id] > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                              {msgCounts[memorial.id]}
                            </span>
                          )}
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => openEditModal(memorial)}
                      className="flex-1 text-sm font-semibold text-gray-600 bg-white border border-gray-200 py-2 px-3 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Edit2 className="w-4 h-4 shrink-0" />
                      Editar Informações
                    </button>
                    <button 
                      onClick={() => openDeleteModal(memorial)}
                      className="px-3 py-2 text-red-500 bg-white border border-red-100 hover:border-red-200 hover:text-red-700 hover:bg-red-50 rounded-lg transition flex items-center justify-center shadow-sm" 
                      title="Excluir Memorial"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <NewLinkModal 
        isOpen={isModalOpen} 
        onClose={fechaModal} 
        memorial={editingMemorial} 
        onGenerate={handleSaveSuccess}
      />

      {/* Modal - Confirmação de Exclusão */}
      {deleteModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Excluir Memorial</h3>
              <p className="text-gray-500 text-center text-sm mb-6">
                Tem certeza que deseja excluir permanentemente o memorial de <span className="font-semibold text-gray-900">{deleteModalData.name}</span>? 
                <br /><br />
                <span className="text-red-600 font-medium tracking-tight bg-red-50 px-2 py-1 rounded inline-block">Esta ação é irreversível.</span> 
                Todos os dados, rascunhos e biografias anexadas a ele serão apagados do sistema.
              </p>
              
              <div className="flex gap-3 justify-center mt-6">
                <button 
                  onClick={() => setDeleteModalData({ isOpen: false, id: '', name: '' })}
                  disabled={isDeleting}
                  className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center min-w-[120px] shadow-sm"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
