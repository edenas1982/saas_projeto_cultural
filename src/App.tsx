import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { SaasLayout } from './layouts/SaasLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SaasLogin from './pages/saas/SaasLogin';
import SaasDashboard from './pages/saas/SaasDashboard';
import SaasGerarBiografia from './pages/saas/SaasGerarBiografia';
import UpdatePassword from './pages/UpdatePassword';
import RascunhoMemorial from './pages/RascunhoMemorial';
import GestaoMemorial from './pages/GestaoMemorial';
import RevisarMemorial from './pages/RevisarMemorial';
import PublicMemorial from './pages/PublicMemorial';
import PublicPortal from './pages/PublicPortal';
import PublicInvite from './pages/PublicInvite';
import Saas_ReceberMemorial from './pages/saas/Saas_ReceberMemorial';
import SaasCondolenciasVisitante from './pages/saas/SaasCondolenciasVisitante';
import SaasModeracaoMensagens from './pages/saas/SaasModeracaoMensagens';
import LandingPage from './pages/LandingPage';
import Acompanhar from './pages/Acompanhar';
import ProjetoCultural from './pages/ProjetoCultural';
import Tecnologia from './pages/Tecnologia';
import ParaEmpresas from './pages/ParaEmpresas';
import DemoPage from './pages/DemoPage';
import SobreStartup from './pages/SobreStartup';
import ParaAvaliadores from './pages/ParaAvaliadores';
import TelemetryCockpitPage from './pages/startup/TelemetryCockpitPage';
import MensagensModeracao from './pages/MensagensModeracao';
import { APP_VERSION } from './version';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/acompanhar" element={<Acompanhar />} />
          <Route path="/projeto-cultural" element={<ProjetoCultural />} />
          <Route path="/tecnologia" element={<Tecnologia />} />
          <Route path="/para-empresas" element={<ParaEmpresas />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/sobre" element={<SobreStartup />} />
          <Route path="/startup" element={<ParaAvaliadores />} />
          <Route path="/startup/telemetria" element={<TelemetryCockpitPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/saas/login" element={<SaasLogin />} />
          <Route path="/receber-memorial/:token" element={<Saas_ReceberMemorial />} />
          <Route path="/portal" element={<PublicPortal />} />
          <Route path="/invite/:token" element={<PublicInvite />} />
          <Route path="/memorial/:id" element={<PublicMemorial />} />
          <Route path="/m/:id" element={<PublicMemorial />} />
          <Route path="/memorial/:id/rascunho" element={<RascunhoMemorial />} />
          <Route path="/m/:id/rascunho" element={<RascunhoMemorial />} />
          <Route path="/saas/m/:id/condolencias" element={<SaasCondolenciasVisitante />} />
          
          {/* Rotas Privadas (Sem Layout) */}
          <Route element={<ProtectedRoute />}>
             <Route path="/atualizar-senha" element={<UpdatePassword />} />
          </Route>

          {/* Rotas Privadas (Com AppLayout - B2C / Projeto Cultural) */}
          <Route element={<ProtectedRoute />}>
             <Route element={<AppLayout />}>
                <Route path="/painel" element={<Dashboard />} />
                <Route path="/memorial/:id/gerenciar" element={<GestaoMemorial />} />
                <Route path="/memorial/:id/revisar" element={<RevisarMemorial />} />
                <Route path="/memorial/:id/mensagens" element={<MensagensModeracao />} />
             </Route>
          </Route>

          {/* Rotas Privadas (Com SaasLayout - B2B Corporativo) */}
          <Route element={<ProtectedRoute />}>
             <Route element={<SaasLayout />}>
                <Route path="/saas" element={<SaasDashboard />} />
                <Route path="/saas/memorial/:id/gerar" element={<SaasGerarBiografia />} />
                <Route path="/saas/memorial/:id/mensagens" element={<SaasModeracaoMensagens />} />
                {/* Outras rotas SaaS B2B entrarão aqui */}
             </Route>
          </Route>
        </Routes>
        
        {/* Indicador de Versão para Testes */}
        <div className="fixed bottom-2 right-2 text-[10px] font-mono text-gray-400/60 pointer-events-none z-50">
          v{APP_VERSION}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
