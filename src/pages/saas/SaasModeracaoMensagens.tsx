import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, ArrowLeft, Check, X, MessageSquare, AlertCircle } from 'lucide-react';

interface Mensagem {
  id: string;
  autor_nome: string;
  conteudo: string;
  aprovado: boolean;
  created_at: string;
}

export default function SaasModeracaoMensagens() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memorialName, setMemorialName] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (id) {
      fetchMensagens();
    }
  }, [id]);

  const fetchMensagens = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      if (!id) return;

      // 1. Validar memorial e obter dados do homenageado
      const { data: memDataArray, error: memError } = await supabase
        .from('memoriais')
        .select('nome_homenageado')
        .eq('id', id)
        .limit(1);

      const memData = memDataArray?.[0];
      if (memError || !memData) {
        setErrorMsg('Memorial não encontrado ou você não tem permissão para acessá-lo.');
        return;
      }

      setMemorialName(memData.nome_homenageado);

      // 2. Buscar mensagens associadas
      const { data, error } = await supabase
        .from('mensagens_visitantes')
        .select('*')
        .eq('memorial_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar mensagens:', error);
      setErrorMsg('Ocorreu um erro ao carregar as mensagens de condolências.');
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
    } catch (error: any) {
      console.error('Erro ao atualizar mensagem:', error);
      alert('Não foi possível alterar o status da mensagem: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExcluir = async (msgId: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir permanentemente esta mensagem?')) return;
    
    try {
      setProcessingId(msgId);
      const { error } = await supabase
        .from('mensagens_visitantes')
        .delete()
        .eq('id', msgId);

      if (error) throw error;
      setMensagens(prev => prev.filter(m => m.id !== msgId));
    } catch (error: any) {
      console.error('Erro ao excluir mensagem:', error);
      alert('Erro ao excluir a mensagem: ' + error.message);
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center max-w-md mx-auto my-12">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Acesso Restrito</h3>
        <p className="text-slate-500 text-sm mb-6">{errorMsg}</p>
        <button 
          onClick={() => navigate('/saas')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const pendentes = mensagens.filter(m => !m.aprovado);
  const aprovadas = mensagens.filter(m => m.aprovado);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/saas')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Moderação de Homenagens</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gerenciamento de mensagens públicas para <span className="font-semibold text-slate-800">{memorialName}</span></p>
          </div>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <div className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg">
            {pendentes.length} Pendentes
          </div>
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">
            {aprovadas.length} Aprovadas
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Coluna 1: Pendentes */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Aguardando Aprovação ({pendentes.length})</h2>
          
          {pendentes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
              Nenhuma homenagem pendente de aprovação.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map(msg => (
                <div key={msg.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-left">
                  <p className="text-slate-800 text-sm italic font-serif leading-relaxed">"{msg.conteudo}"</p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{msg.autor_nome}</span>
                      <span className="text-[10px] text-slate-500">{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <button 
                        disabled={processingId === msg.id}
                        onClick={() => handleExcluir(msg.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition"
                        title="Rejeitar e Excluir"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={processingId === msg.id}
                        onClick={() => handleAprovar(msg.id, true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {processingId === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Aprovar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna 2: Aprovadas */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Exibidas no Memorial ({aprovadas.length})</h2>
          
          {aprovadas.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
              Nenhuma homenagem aprovada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {aprovadas.map(msg => (
                <div key={msg.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 opacity-85 hover:opacity-100 transition-opacity text-left">
                  <p className="text-slate-800 text-sm italic font-serif leading-relaxed">"{msg.conteudo}"</p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{msg.autor_nome}</span>
                      <span className="text-[10px] text-slate-500">{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <button 
                        disabled={processingId === msg.id}
                        onClick={() => handleExcluir(msg.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Excluir Definitivamente"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={processingId === msg.id}
                        onClick={() => handleAprovar(msg.id, false)}
                        className="border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
