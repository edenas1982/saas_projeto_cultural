import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Key, AlertCircle, Loader2, CheckCircle2, ChevronRight, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function Saas_ReceberMemorial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkToken();
  }, [token]);

  const checkToken = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('question_invites')
        .select(`
          id,
          status,
          destinatario_nome,
          perguntas_ids,
          memoriais ( id, nome_homenageado )
        `)
        .eq('token', token)
        .single();
        
      if (fetchError || !data) throw new Error('Link convite inválido ou expirado.');
      
      if (!data.perguntas_ids?.includes('TRANSFERENCIA_CONTROLE')) {
        throw new Error('Este link não é um convite de transferência válido.');
      }
      
      if (data.status === 'concluido') {
        throw new Error('Este convite já foi utilizado.');
      }
      
      setInviteData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!user || !inviteData) return;
    
    setIsProcessing(true);
    setError('');
    try {
      const jwt = (await supabase.auth.getSession()).data.session?.access_token;
      
      const res = await fetch('/api/memoriais/accept-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ token })
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Erro ao processar transferência');
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/painel');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Validando link de acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6">
          <Key className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Acesso Familiar
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Assuma a gestão do memorial e aprove mensagens de carinho.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/40 sm:rounded-2xl sm:px-10 border border-slate-100">
          
          {error && (
            <div className="rounded-lg bg-red-50 p-4 mb-6 border border-red-100">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro no Acesso</h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Acesso Confirmado!</h3>
              <p className="text-sm text-slate-500 mb-6">
                O memorial agora está vinculado à sua conta. Redirecionando para o seu painel...
              </p>
              <button disabled className="w-full inline-flex justify-center flex-row items-center bg-slate-100 text-slate-400 py-3 rounded-xl font-medium">
                <Loader2 className="w-5 h-5 mr-3 animate-spin text-slate-400" />
                Carregando Painel
              </button>
            </div>
          ) : !error && inviteData ? (
             <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                   <p className="text-sm text-slate-600 text-center mb-1">Passando o controle do memorial de:</p>
                   <p className="text-xl font-bold text-slate-900 text-center">{inviteData.memoriais?.nome_homenageado}</p>
                   <p className="text-sm text-slate-500 text-center mt-3">Para: <span className="font-semibold">{inviteData.destinatario_nome}</span></p>
                </div>
                
                {!user ? (
                   <div>
                     <p className="text-sm text-slate-600 text-center mb-4">
                       Para assumir a gestão, você precisa acessar ou criar uma conta gratuita no Ecos de Memória.
                     </p>
                     <Link to={`/login?redirect=receber-memorial/${token}`}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-3 font-semibold hover:bg-indigo-700 transition shadow-sm"
                     >
                       <LogIn className="w-5 h-5" />
                       Acessar ou Criar Conta
                     </Link>
                   </div>
                ) : (
                   <div>
                     <p className="text-sm text-slate-600 text-center mb-4">
                       Você está autenticado como <span className="font-semibold text-slate-900">{user.email}</span>.
                     </p>
                     <button
                        onClick={handleClaim}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-3 font-semibold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                     >
                       {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                       {isProcessing ? 'Processando...' : 'Assumir Gestão do Memorial'}
                     </button>
                   </div>
                )}
             </div>
          ) : null}
          
        </div>
      </div>
    </div>
  );
}
