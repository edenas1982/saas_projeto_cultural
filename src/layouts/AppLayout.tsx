import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Settings } from 'lucide-react';

export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* HEADER FIXO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/painel" className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-gray-900" />
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Ecos de Memória</h1>
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline-block font-medium">
                {user?.user_metadata?.name || user?.email}
              </span>
              
              <button
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Configurações"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              
              <button
                onClick={signOut}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium sr-only sm:not-sr-only">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO (OUTLET RENDERIZA AS ROTAS FILHAS AQUI) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
