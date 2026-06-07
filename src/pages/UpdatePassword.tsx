import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UpdatePassword() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // A redirect happens when a user clicks the recovery link.
  // The system catches it and redirects to this exact page. 
  // Normally the user MUST be logged in (via the session token inside the link hash).
  useEffect(() => {
    if (!session) {
      // If someone randomly navigates here without a session, they can't change password
      navigate('/login');
    }
  }, [session, navigate]);

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    if (password !== confirmPassword) {
      setMensagem({ tipo: 'error', texto: 'As senhas não coincidem.' });
      return;
    }

    if (password.length < 6) {
      setMensagem({ tipo: 'error', texto: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setMensagem({ tipo: 'success', texto: 'Senha atualizada com sucesso! Redirecionando...' });
      
      setTimeout(() => {
        navigate('/painel');
      }, 2000);
      
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao atualizar a senha.' });
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Nova Senha
          </h1>
          <p className="text-gray-500">
            Digite sua nova senha abaixo.
          </p>
        </div>

        {mensagem.texto && (
          <div className={`p-4 rounded-xl flex items-start gap-3 mb-6 ${mensagem.tipo === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{mensagem.texto}</p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
              placeholder="Minimo de 6 caracteres"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 transition-shadow"
              placeholder="Digite a senha novamente"
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50 flex justify-center mt-6"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Atualizar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
