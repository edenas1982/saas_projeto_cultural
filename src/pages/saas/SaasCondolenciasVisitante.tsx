import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Heart, Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';
import { calculateLifespan } from '../../lib/utils';

// Helper functions for cookies
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}${expires}; path=/; SameSite=Lax`;
}

function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem('ecos_device_id') || getCookie('ecos_device_id');
  if (!deviceId) {
    // Simple UUID v4 generator
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  // Sync back to both
  localStorage.setItem('ecos_device_id', deviceId);
  setCookie('ecos_device_id', deviceId);
  return deviceId;
}


export default function SaasCondolenciasVisitante() {
  const { id } = useParams<{ id: string }>();
  const [nomeHomenageado, setNomeHomenageado] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [dataNasc, setDataNasc] = useState<string | null>(null);
  const [dataFalec, setDataFalec] = useState<string | null>(null);
  const [permitirMensagens, setPermitirMensagens] = useState<boolean>(true);
  const [autoAprovar, setAutoAprovar] = useState<boolean>(true);

  // Form & Interaction states
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviadoStatus, setEnviadoStatus] = useState<'idle' | 'success' | 'offline_saved'>('idle');
  const [jaEnviou, setJaEnviou] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (id) {
      fetchMemorialAndCheckDevice();
    }
  }, [id]);

  const fetchMemorialAndCheckDevice = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch Memorial
      const { data, error } = await supabase
        .from('memoriais')
        .select('nome_homenageado, foto_url, data_nascimento, data_falecimento, permitir_mensagens, auto_aprovar_mensagens')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg('Memorial não encontrado.');
        return;
      }

      setNomeHomenageado(data.nome_homenageado);
      setFotoUrl(data.foto_url);
      setDataNasc(data.data_nascimento);
      setDataFalec(data.data_falecimento);
      setPermitirMensagens(data.permitir_mensagens !== false);
      setAutoAprovar(data.auto_aprovar_mensagens !== false);

      // 2. Check duplicate submission by device
      const localSent = localStorage.getItem(`has_sent_condolence_${id}`) === 'true';
      if (localSent) {
        setJaEnviou(true);
      } else {
        const deviceId = getOrCreateDeviceId();
        const { data: alreadySent, error: rpcError } = await supabase.rpc('check_device_message_exists', {
          p_memorial_id: id,
          p_device_id: deviceId
        });
        
        if (!rpcError && alreadySent) {
          setJaEnviou(true);
          localStorage.setItem(`has_sent_condolence_${id}`, 'true');
        }
      }
    } catch (e: any) {
      console.error('Erro ao buscar memorial:', e);
      setErrorMsg('Não foi possível carregar as informações do memorial.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !mensagem.trim() || !id || jaEnviou) return;

    setEnviando(true);
    const deviceId = getOrCreateDeviceId();
    try {
      // 1. Envia para o Supabase
      const { error } = await supabase.from('mensagens_visitantes').insert({
        memorial_id: id,
        autor_nome: nome.trim(),
        conteudo: mensagem.trim(),
        aprovado: autoAprovar,
        device_id: deviceId
      });

      if (error) throw error;

      // Grava no dispositivo a confirmação de envio para bloquear futuros spams
      localStorage.setItem(`has_sent_condolence_${id}`, 'true');
      setEnviadoStatus('success');
      setJaEnviou(true);
      setNome('');
      setMensagem('');
    } catch (err: any) {
      console.warn('Erro ao salvar no banco (salvando localmente para resiliência):', err);
      
      // 2. Fallback resiliente offline no localStorage
      try {
        const fallbackMessage = {
          memorial_id: id,
          autor_nome: nome.trim(),
          conteudo: mensagem.trim(),
          device_id: deviceId,
          saved_at: new Date().toISOString()
        };
        const localKey = `offline_condolences_${id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        existing.push(fallbackMessage);
        localStorage.setItem(localKey, JSON.stringify(existing));
        
        localStorage.setItem(`has_sent_condolence_${id}`, 'true');
        setEnviadoStatus('offline_saved');
        setJaEnviou(true);
        setNome('');
        setMensagem('');
      } catch (storageErr) {
        console.error('Erro ao salvar no localStorage:', storageErr);
        localStorage.setItem(`has_sent_condolence_${id}`, 'true');
        setEnviadoStatus('offline_saved');
        setJaEnviou(true);
      }
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-slate-500 text-sm font-medium">Carregando livro de condolências...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Página Indisponível</h3>
        <p className="text-slate-500 text-sm max-w-xs">{errorMsg}</p>
      </div>
    );
  }

  if (!permitirMensagens) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Mensagens Desativadas</h3>
        <p className="text-slate-500 text-sm max-w-xs">
          O livro de condolências digital para este memorial foi encerrado ou desativado pela família.
        </p>
      </div>
    );
  }

  const lifespan = (dataNasc && dataFalec) 
    ? calculateLifespan(dataNasc, dataFalec) 
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col my-auto animate-in fade-in duration-500">
        
        {/* Topo do Homenageado */}
        <div className="bg-slate-900 text-white px-6 py-8 flex flex-col items-center text-center relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 opacity-90 z-0"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {fotoUrl ? (
              <button 
                onClick={() => setIsZoomed(true)} 
                className="relative group focus:outline-none mb-3"
                title="Clique para ampliar a foto"
              >
                <img 
                  src={fotoUrl} 
                  alt={nomeHomenageado} 
                  className="w-20 h-20 rounded-full object-cover border-4 border-slate-800/80 shadow-md transition group-hover:scale-105 duration-200 cursor-zoom-in"
                />
              </button>
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-slate-700/50 flex items-center justify-center mb-3">
                <User className="w-8 h-8 text-slate-500" />
              </div>
            )}
            
            <h2 className="text-lg font-bold tracking-tight text-white/90">
              {nomeHomenageado}
            </h2>
            
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1">
              {dataNasc && new Date(dataNasc).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              {dataFalec && ` ✝ ${new Date(dataFalec).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
            </p>
            {lifespan && (
              <p className="text-xs text-indigo-400 font-medium mt-1.5 bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-500/20">
                {lifespan} de vida
              </p>
            )}
            
            <div className="h-px w-12 bg-indigo-500/30 my-4"></div>
            
            <h1 className="text-xl font-serif text-slate-100 font-medium">
              Livro de Condolências
            </h1>
          </div>
        </div>

        {/* Formulário / Status */}
        <div className="p-6 flex-1 flex flex-col justify-center">
          
          {jaEnviou ? (
            <div className="text-center py-6 animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                {enviadoStatus === 'offline_saved' ? <Heart className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Homenagem Registrada</h3>
              <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                {enviadoStatus === 'offline_saved' 
                  ? 'Agradecemos de coração a sua homenagem. Ela foi salva em seu aparelho e será publicada assim que houver rede.'
                  : 'Sua homenagem foi registrada com sucesso e enviada ao livro digital. Agradecemos o carinho.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Seu Nome
                </label>
                <input 
                  type="text" 
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como você gostaria de ser identificado?"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Mensagem
                </label>
                <textarea 
                  required
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  placeholder="Deixe uma palavra de conforto..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-shadow resize-none"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={enviando || !nome.trim() || !mensagem.trim()}
                className="w-full flex items-center justify-center py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
              >
                {enviando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2 fill-current" />
                    Enviar Mensagem
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      
      <p className="text-[10px] text-slate-400 mt-6 font-medium">
        Ecos de Memória &copy; {new Date().getFullYear()}
      </p>

      {/* Lightbox / Foto Tela Cheia */}
      {isZoomed && fotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <img 
            src={fotoUrl} 
            alt={nomeHomenageado} 
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 select-none animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
