import { useState } from 'react';
import { X, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SaasToggleBioStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorial: any;
  onStatusToggled: () => void;
}

export function SaasToggleBioStatusModal({ isOpen, onClose, memorial, onStatusToggled }: SaasToggleBioStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !memorial) return null;

  const isCurrentlyActive = memorial.status_memorial !== 'suspenso';

  const handleConfirmToggle = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/memorial/${memorial.id}/toggle-bio-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const contentType = response.headers.get('content-type');
      let resData: any = {};
      
      if (contentType && contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        const rawText = await response.text();
        throw new Error(rawText || `Erro de rede/servidor (Código ${response.status})`);
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao alterar o status do memorial.');
      }

      onStatusToggled();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro ao alterar o status do memorial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col border border-slate-100">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isCurrentlyActive ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {isCurrentlyActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isCurrentlyActive ? 'Inativar Memorial' : 'Reativar Memorial'}
              </h3>
              <p className="text-xs text-slate-500">
                {memorial.nome_homenageado}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="font-semibold">{errorMsg}</div>
            </div>
          )}

          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            {isCurrentlyActive ? (
              <>
                <p>
                  Tem certeza de que deseja <strong>inativar temporariamente</strong> o memorial de <strong>{memorial.nome_homenageado}</strong>?
                </p>
                <p className="bg-amber-50/60 text-amber-800 text-xs p-3.5 rounded-xl border border-amber-200">
                  ⚠️ Esta ação ocultará o memorial da listagem principal do painel e suspenderá o acesso público à timeline e ao QR code.
                </p>
              </>
            ) : (
              <>
                <p>
                  Deseja <strong>reativar</strong> o memorial de <strong>{memorial.nome_homenageado}</strong>?
                </p>
                <p className="bg-indigo-50/60 text-indigo-850 text-xs p-3.5 rounded-xl border border-indigo-100">
                  ✨ Isso restabelecerá o status original do memorial, tornando-o novamente ativo e visível na listagem principal.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Rodapé / Botões */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-white text-slate-750 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleConfirmToggle}
            disabled={loading}
            className={`px-5 py-2 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 ${
              isCurrentlyActive 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : 'bg-indigo-650 hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                Processando...
              </>
            ) : isCurrentlyActive ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Confirmar Inativação
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Confirmar Reativação
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
