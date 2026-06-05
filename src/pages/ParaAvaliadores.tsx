import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, Building2 } from 'lucide-react';

export default function ParaAvaliadores() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-20 pb-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-slate-900 tracking-tight mb-6">
            Estratégia Google for Startups
          </h1>
          <p className="text-lg text-slate-500 mb-10">
            Pitch deck e aprovação técnica. Em construção... Fase F7.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-2xl mx-auto">
            <Link 
              to="/login"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100"
            >
              Acessar Login B2C (Familiar)
            </Link>
            <Link 
              to="/saas/login"
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Building2 className="w-5 h-5 text-slate-300" />
              Acessar Painel B2B SaaS (Funerária)
            </Link>
            <Link 
              to="/startup/telemetria"
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-medium py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Activity className="w-5 h-5 text-slate-600" />
              Cockpit de Telemetria (Fase 0)
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
