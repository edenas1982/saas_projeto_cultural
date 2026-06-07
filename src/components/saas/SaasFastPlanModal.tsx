import { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, AlertCircle, Crown, Briefcase, Loader2, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SaasFastPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorialId: string;
  currentPlan: string;
  editsUsed: number;
  walletBalance: number;
  hasBio: boolean;
  onPlanChanged: (newPlan: string, newWalletBalance?: number) => void; // Trigger a refresh
  suppressNavigation?: boolean;
}

const PLAN_COSTS = { basico: 2, premium: 4, enterprise: 6 };
const EDITS_LIMITS = { basico: 3, premium: 4, enterprise: 5 };
const PLAN_LEVELS = { basico: 1, premium: 2, enterprise: 3 };

export function SaasFastPlanModal({ isOpen, onClose, memorialId, currentPlan, editsUsed, walletBalance, hasBio, onPlanChanged, suppressNavigation }: SaasFastPlanModalProps) {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<'basico' | 'enterprise' | 'premium'>((currentPlan || 'basico') as any);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedPlan((currentPlan || 'basico') as any);
      setErrorMsg('');
    }
  }, [isOpen, currentPlan]);

  if (!isOpen) return null;

  const old_level = PLAN_LEVELS[currentPlan as 'basico' | 'enterprise' | 'premium'] || 1;
  const new_level = PLAN_LEVELS[selectedPlan];
  const isUpgrade = new_level > old_level;
  const isDowngrade = new_level < old_level;
  const samePlan = new_level === old_level;

  const old_plan_cost = PLAN_COSTS[currentPlan as 'basico' | 'enterprise' | 'premium'] || 2;
  const new_plan_cost = PLAN_COSTS[selectedPlan];
  const creditDiff = Math.abs(new_plan_cost - old_plan_cost);

  const isDowngradeBlocked = !hasBio && isDowngrade && editsUsed >= EDITS_LIMITS[selectedPlan];

  const handleConfirm = async () => {
    if (samePlan) {
      onClose();
      return;
    }

    // Downgrade block check was removed because backend wipes it if hasBio.
    // Wait, the `isDowngradeBlocked` variable checks if editsUsed > LIMIT, but the backend says IF hasBio IT WIPES IT AND EDITS BECAME 0!
    // So `isDowngradeBlocked` should only block if !hasBio !

    setErrorMsg('');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/memorial/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          memorial_id: memorialId,
          new_plan: selectedPlan
        })
      });

      if (!response.ok) {
        let msg = 'Erro ao processar alteração de plano.';
        try {
          const text = await response.text();
          const errData = JSON.parse(text);
          msg = errData.error || msg;
        } catch { }
        throw new Error(msg);
      }

      let newWallet = walletBalance;
      try {
         const data = await response.json();
         console.log("change-plan API response data:", data);
         if (typeof data.new_wallet_balance === 'number') {
            newWallet = data.new_wallet_balance;
         }
      } catch (e) {
         console.error("change-plan failed to parse json", e);
      }
      
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.refreshSession();
        console.log("Session refreshed after plan change. new wallet:", sessionData?.session?.user?.user_metadata?.wallet_balance, "err:", sessionErr);
      } catch(e) { }

      onPlanChanged(selectedPlan, newWallet);
      onClose();
      
      if (hasBio && !suppressNavigation) {
        navigate(`/saas/memorial/${memorialId}/gerar`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar o plano.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Alterar Plano</h3>
            <p className="text-xs text-slate-500">Mude a categoria de processamento deste memorial</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div 
              onClick={() => setSelectedPlan('basico')}
              className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-center items-center gap-1 ${selectedPlan === 'basico' ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">BÁSICO</span>
              <span className="text-[10px] font-bold text-slate-400">2 Créditos</span>
            </div>

            <div 
              onClick={() => setSelectedPlan('premium')}
              className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-center items-center gap-1 ${selectedPlan === 'premium' ? 'border-amber-500 bg-amber-50/30 text-amber-700' : 'border-slate-100 hover:border-amber-200'}`}
            >
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <Crown className="w-3 h-3"/> PREMIUM
              </span>
              <span className="text-[10px] font-bold text-amber-500">4 Créditos</span>
            </div>

            <div 
              onClick={() => setSelectedPlan('enterprise')}
              className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col justify-center items-center gap-1 ${selectedPlan === 'enterprise' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-100 hover:border-indigo-100'}`}
            >
              <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <Briefcase className="w-3 h-3"/> ENTERPRISE
              </span>
              <span className="text-[10px] font-bold text-indigo-400">6 Créditos</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-sm mb-2 border border-slate-100">
            {samePlan && (
               <p className="text-slate-500">Plano atualmente ativo no memorial.</p>
            )}

            {isUpgrade && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-bold">
                   <ArrowUpCircle className="w-5 h-5"/>
                   <span>Confirmar Upgrade</span>
                </div>
                <p className="text-slate-600 text-xs">Custo de <strong className="text-indigo-600">{creditDiff} créditos</strong>, descontados instantaneamente do saldo global de carteira ({walletBalance.toFixed(2)} disponíveis).</p>
                {walletBalance < creditDiff && (
                  <p className="text-red-600 text-xs mt-1 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Saldo insuficiente.</p>
                )}
              </div>
            )}

            {isDowngradeBlocked && (
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-red-600 font-bold">
                   <AlertCircle className="w-5 h-5"/>
                   <span>Downgrade Indisponível</span>
                 </div>
                 <p className="text-red-700 text-xs leading-relaxed">Você já excedeu o limite de edições (<strong className="font-bold">{editsUsed} realizadas / {EDITS_LIMITS[selectedPlan]} permitidas</strong> no plano escolhido) sem que a biografia fosse zerada. Exclua a biografia primeiro para liberar este downgrade.</p>
              </div>
            )}

            {isDowngrade && !isDowngradeBlocked && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 font-bold">
                   <ArrowDownCircle className="w-5 h-5"/>
                   <span>Confirmar Downgrade</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Reduzir o plano reembolsa <strong className="text-amber-600">+{creditDiff} créditos</strong> na sua carteira.
                </p>
              </div>
            )}

            {hasBio && !samePlan && !isDowngradeBlocked && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-[11px] leading-relaxed flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Atenção:</strong> Ao alterar o plano, o texto e o áudio atuais serão <strong>excluídos</strong> para que uma nova narrativa seja gerada na qualidade e nos limites do novo pacote. O status voltará para "Aguardando Geração" e os limites de edição serão zerados para este plano. Para sua segurança, você vai ser levado à tela de Edição e Geração.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={loading || (isUpgrade && walletBalance < creditDiff) || isDowngradeBlocked || samePlan}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50 
              ${isDowngrade ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin"/>}
            {isDowngrade ? 'Confirmar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
