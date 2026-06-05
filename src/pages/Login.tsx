import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatName } from '../lib/utils';

type AuthMode = 'login' | 'register' | 'forgot_password';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [mode, setMode] = useState<AuthMode>('login');

  // Se já logado, não deixa acessar a tela de login
  if (session) {
    return <Navigate to="/painel" replace />;
  }

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      if (mode === 'register') {
        const _nome = formatName(nome);
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              name: _nome
            }
          }
        });
        if (error) throw error;
        setMensagem({ tipo: 'success', texto: 'Cadastro realizado! Verifique sua caixa de email para validar a conta.' });
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/painel');
      } else if (mode === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/atualizar-senha`,
        });
        if (error) throw error;
        setMensagem({ tipo: 'success', texto: 'Instruções de recuperação enviadas para o seu e-mail.' });
        // Limpa o campo para evitar confusões
        setEmail('');
      }
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao processar sua solicitação.' });
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (newMode: AuthMode) => {
    setMode(newMode);
    setMensagem({ tipo: '', texto: '' });
    setPassword('');
    setNome('');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Título e Subtítulo */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-serif text-[#111827] mb-2">
          Ecos de Memória
        </h1>
        <p className="text-xs md:text-sm text-[#8C8077] uppercase tracking-widest font-semibold">
          Santo Augusto em QR
        </p>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#E8E4DB] p-8 sm:p-10 relative z-10">
        
        {mode === 'forgot_password' && (
          <button 
            onClick={() => changeMode('login')}
            className="flex items-center text-sm text-gray-500 hover:text-[#111827] mb-6 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </button>
        )}

        <div className="text-center mb-8">
          <p className="text-[#8C8077] text-sm">
            {mode === 'login' && 'Faça login para acessar o painel'}
            {mode === 'register' && 'Crie sua conta para começar'}
            {mode === 'forgot_password' && 'Recupere o acesso à sua conta'}
          </p>
        </div>

        {mensagem.texto && (
          <div className={`p-4 rounded-xl flex items-start gap-3 mb-6 ${mensagem.tipo === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{mensagem.texto}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
                placeholder="Seu nome"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          {mode !== 'forgot_password' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Senha</label>
                {mode === 'login' && (
                  <button 
                    type="button"
                    onClick={() => changeMode('forgot_password')}
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
                placeholder="••••••••"
                required
              />
            </div>
          )}
          
          <button 
            type="submit"
            disabled={loading || !email || (mode !== 'forgot_password' && !password) || (mode === 'register' && !nome)}
            className="w-full bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex justify-center mt-6"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              mode === 'login' ? 'Entrar no Sistema' : 
              mode === 'register' ? 'Criar Conta' : 
              'Enviar link de recuperação'
            )}
          </button>
        </form>

        {mode !== 'forgot_password' && (
          <div className="mt-8 text-center pt-6 border-t border-gray-100 flex flex-col gap-3">
            <button 
              type="button"
              onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
            >
              {mode === 'login' ? 'Ainda não tem conta? Crie uma agora' : 'Já possui uma conta? Acesse aqui'}
            </button>
          </div>
        )}
      </div>

      {/* Logos no rodapé (Apoio e Realização) */}
      <div className="mt-12 flex flex-col items-center justify-center gap-6 relative w-full max-w-4xl opacity-90 mix-blend-multiply">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8C8077] font-bold text-center">
          Apoio e Realização
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <img 
              src="/logos/prefeitura.webp" 
              alt="Prefeitura Municipal de Santo Augusto" 
              className="w-24 md:w-32 object-contain hover:scale-110 transition-transform duration-300" 
            />
            <img 
              src="/logos/secute.webp" 
              alt="Secretaria Municipal de Cultura" 
              className="w-20 md:w-28 object-contain hover:scale-110 transition-transform duration-300" 
            />
            <img 
              src="/logos/aldir-blank.webp" 
              alt="Lei Aldir Blanc" 
              className="h-10 md:h-14 object-contain hover:scale-110 transition-transform duration-300" 
            />
        </div>
      </div>
    </div>
  );
}
