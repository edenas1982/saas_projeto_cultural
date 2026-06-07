import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ArrowLeft, Check, X, MessageSquare } from 'lucide-react';

interface Mensagem {
  id: string;
  autor_nome: string;
  conteudo: string;
  aprovado: boolean;
  created_at: string;
}

export default function MensagensModeracao() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memorialName, setMemorialName] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMensagens();
  }, [id]);

  const fetchMensagens = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (!id) return;

      const { data: memDataArray } = await supabase
        .from('memoriais')
        .select('nome_homenageado')
        .eq('id', id)
        .eq('user_id', user.id)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .limit(1);
        
      const memData = memDataArray?.[0];
      if (memData) {
        setMemorialName(memData.nome_homenageado);
      } else {
        throw new Error('Memorial não encontrado ou não pertence a este usuário.');
      }

      const { data, error } = await supabase
        .from('mensagens_visitantes')
        .select('*')
        .eq('memorial_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (msgId: string, aprovar: boolean) => {
    try {
      setProcessingId(msgId);
      const { error } = await supabase
        .from('mensagens_visitantes')
        .update({ aprovado: aprovar })
        .eq('id', msgId);

      if (error) throw error;
      
      setMensagens(prev => prev.map(m => m.id === msgId ? { ...m, aprovado: aprovar } : m));
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
      alert('Erro ao processar a solicitação.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExcluir = async (msgId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mensagem permanentemente?')) return;
    
    try {
      setProcessingId(msgId);
      const { error } = await supabase
        .from('mensagens_visitantes')
        .delete()
        .eq('id', msgId);

      if (error) throw error;
      setMensagens(prev => prev.filter(m => m.id !== msgId));
    } catch (error) {
      console.error('Erro ao excluir mensagem:', error);
      alert('Erro ao excluir a mensagem.');
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const pendentes = mensagens.filter(m => !m.aprovado);
  const aprovadas = mensagens.filter(m => m.aprovado);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/painel')}
          className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1.5 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-gray-400" /> Moderação de Mensagens
        </h1>
        <p className="text-gray-500 mt-1">Gerencie as homenagens recebidas para {memorialName}</p>
      </div>

      <div className="space-y-10">
        {/* Pendentes */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
            Aguardando Aprovação
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendentes.length}
            </span>
          </h2>
          
          {pendentes.length === 0 ? (
             <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 border border-gray-100 border-dashed">
                Nenhuma mensagem pendente no momento.
             </div>
          ) : (
             <div className="grid gap-4">
                {pendentes.map(msg => (
                  <div key={msg.id} className="bg-white border text-left border-gray-200 rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md">
                     <p className="text-gray-800 mb-3 text-lg font-serif">"{msg.conteudo}"</p>
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-3">
                        <div>
                          <p className="font-semibold text-gray-900">{msg.autor_nome}</p>
                          <p className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="flex gap-2 justify-end w-full sm:w-auto">
                          <button 
                            disabled={processingId === msg.id}
                            onClick={() => handleExcluir(msg.id)}
                            className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" /> Rejeitar/Excluir
                          </button>
                          <button 
                            disabled={processingId === msg.id}
                            onClick={() => handleAprovar(msg.id, true)}
                            className="text-green-700 bg-green-50 hover:bg-green-100 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {processingId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovar
                          </button>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          )}
        </section>

        {/* Aprovadas */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2 mt-8">
            Mensagens Aprovadas
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {aprovadas.length}
            </span>
          </h2>
          
          {aprovadas.length === 0 ? (
             <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 border border-gray-100 border-dashed">
                Nenhuma mensagem aprovada ainda.
             </div>
          ) : (
             <div className="grid gap-4">
                {aprovadas.map(msg => (
                  <div key={msg.id} className="bg-white border text-left border-gray-200 rounded-xl p-5 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                     <p className="text-gray-800 mb-3 text-lg font-serif">"{msg.conteudo}"</p>
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-3">
                        <div>
                          <p className="font-semibold text-gray-900">{msg.autor_nome}</p>
                          <p className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                        <button 
                          disabled={processingId === msg.id}
                          onClick={() => handleAprovar(msg.id, false)}
                          className="text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 w-full sm:w-auto mt-2 sm:mt-0"
                        >
                          <X className="w-4 h-4" /> Esconder (Desaprovar)
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          )}
        </section>
      </div>
    </div>
  );
}
