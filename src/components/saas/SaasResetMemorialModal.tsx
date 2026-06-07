import { useState } from 'react';
import { X, RefreshCw, AlertTriangle, AlertCircle, Coins, Heart, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SaasResetMemorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorial: any;
  walletBalance: number;
  onResetCompleted: (newBalance: number, newEditsUsed: number, newCiclo: number) => void;
}

const PLAN_COSTS = { basico: 2, premium: 4, enterprise: 6 };
const EDITS_LIMITS = { basico: 3, premium: 4, enterprise: 5 };

export function SaasResetMemorialModal({ isOpen, onClose, memorial, walletBalance, onResetCompleted }: SaasResetMemorialModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !memorial) return null;

  const editsUsed = typeof memorial.edits_used === 'number' ? memorial.edits_used : 0;
  const editsLimit = typeof memorial.edits_limit === 'number' ? memorial.edits_limit : 3;
  const plano = (memorial.plano_geracao || 'basico') as 'basico' | 'premium' | 'enterprise';

  const isCycleExceeded = editsUsed >= editsLimit;
  const cost = isCycleExceeded ? PLAN_COSTS[plano] : 0;
  const isBalanceInsufficient = walletBalance < cost;

  const handleConfirmReset = async () => {
    if (isBalanceInsufficient && cost > 0) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/memorial/${memorial.id}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao reiniciar o memorial.');
      }

      // Atualiza o estado global e do dashboard
      onResetCompleted(
        resData.new_wallet_balance !== undefined ? resData.new_wallet_balance : walletBalance - cost,
        resData.new_edits_used !== undefined ? resData.new_edits_used : editsUsed,
        resData.new_ciclo !== undefined ? resData.new_ciclo : (memorial.ciclo_contrato_plano || 1)
      );
      
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro ao reiniciar o memorial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col border border-slate-100">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Reiniciar Memorial</h3>
              <p className="text-xs text-slate-500">Zerar respostas e biografia de {memorial.nome_homenageado}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-200/60 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* O que é preservado? */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex gap-3 text-emerald-800 text-xs">
            <Heart className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 fill-emerald-100" />
            <div className="space-y-1">
              <span className="font-semibold block text-emerald-900">O que será PRESERVADO:</span>
              <p className="leading-relaxed">
                As condolências e mensagens enviadas pelos visitantes, bem como as configurações de moderação e o link/QR Code pública do memorial <strong>NÃO</strong> serão alterados.
              </p>
            </div>
          </div>

          {/* O que é apagado? */}
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-amber-900">O que será APAGADO / ARQUIVADO:</span>
              <p className="leading-relaxed">
                As respostas da entrevista serão deletadas de forma definitiva. A biografia em rascunho ou publicada será arquivada e o arquivo de áudio timeline físico (`.mp3` no storage) será <strong>deletado fisicamente</strong>. O memorial retornará ao status "Aguardando Envio" para ser reiniciado.
              </p>
            </div>
          </div>

          {/* Verificação do Ciclo de Alterações */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>Status do Ciclo de Edição</span>
              <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-800 font-mono">
                {editsUsed} / {editsLimit} Usadas
              </span>
            </div>
            
            <div className="p-4 space-y-3.5">
              {!isCycleExceeded ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Coins className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800">Reset Gratuito</h4>
                    <p className="text-slate-500 text-xs">
                      A funerária ainda possui edições restantes no ciclo do plano <strong>{plano.toUpperCase()}</strong>. Nenhum crédito será cobrado.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Coins className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-800">Ciclo de Edição Esgotado</h4>
                      <p className="text-slate-500 text-xs">
                        Todas as {editsLimit} edições do plano {plano.toUpperCase()} já foram utilizadas. Reiniciar este memorial exigirá uma nova compra do plano atual.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">Custo do Reset</span>
                      <strong className="text-slate-800 text-sm font-extrabold">{cost} Créditos</strong>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${isBalanceInsufficient ? 'bg-red-50 border-red-100 text-red-800' : 'bg-slate-50 border-slate-100 text-slate-800'}`}>
                      <span className="text-slate-400 block font-medium">Saldo Atual</span>
                      <strong className="text-sm font-extrabold">{walletBalance.toFixed(2)} Créditos</strong>
                    </div>
                  </div>

                  {isBalanceInsufficient && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <p className="font-semibold leading-normal">
                        Saldo insuficiente na carteira global da funerária. Recarregue créditos no painel de cobrança para poder reiniciar este memorial.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé / Botões */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleConfirmReset}
            disabled={loading || (isCycleExceeded && isBalanceInsufficient)}
            className={`px-5 py-2.5 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50 
              ${isCycleExceeded ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin"/>
                Reiniciando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {cost > 0 ? `Pagar e Reiniciar (${cost} crd)` : 'Reiniciar Gratuitamente'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
