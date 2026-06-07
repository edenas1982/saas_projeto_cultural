import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Se não tem sessão ativa, joga para a tela de login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se tem sessão, renderiza a rota filha
  return <Outlet />;
}
