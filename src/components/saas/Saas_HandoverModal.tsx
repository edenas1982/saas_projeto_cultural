import { useState } from 'react';
import { X, Key, Share2, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Saas_HandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorialId: string;
  memorialName: string;
}

export function Saas_HandoverModal({ isOpen, onClose, memorialId, memorialName }: Saas_HandoverModalProps) {
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successLink, setSuccessLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !contato.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      // Usamos a tabela question_invites como work-around amigável para envio de token sem criar nova tabela
      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      
      if (!user) throw new Error('Não autenticado');
      
      const { data: memorial } = await supabase
        .from('memoriais')
        .select('family_account_id')
        .eq('id', memorialId)
        .single();

      const expira_em = new Date();
      expira_em.setDate(expira_em.getDate() + 30); // 30 dias

      const { data, error } = await supabase
        .from('question_invites')
        .insert({
          memorial_id: memorialId,
          family_account_id: memorial?.family_account_id || user.id, // Fallback se null
          destinatario_nome: nome,
          destinatario_tel: contato,
          perguntas_ids: ['TRANSFERENCIA_CONTROLE'],
          status: 'pendente',
          expira_em: expira_em.toISOString()
        })
        .select('token')
        .single();
        
      if (error) throw error;
      
      setSuccessLink(`${window.location.origin}/receber-memorial/${data.token}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gerar link de transferência.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(successLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    const cleanPhone = contato.replace(/\D/g, '');
    const text = `Olá, ${nome}. A agência preparou e finalizou o memorial de ${memorialName}. Acesse o link abaixo para assumir o controle do painel, onde você poderá aprovar homenagens e mensagens de carinho:\n\n${successLink}`;
    const url = `https://wa.me/${cleanPhone ? `55${cleanPhone}` : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Repassar Memorial</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {!successLink ? (
            <>
              <p className="text-sm text-slate-600 mb-6">
                Gere um acesso exclusivo para a família de <span className="font-semibold text-slate-900">{memorialName}</span>. Eles poderão aprovar mensagens de condolências na página pública.
              </p>
              
              {errorMsg && (
                 <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                   {errorMsg}
                 </div>
              )}

              <form onSubmit={handleGenerateHandover} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Familiar</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-shadow"
                    placeholder="Ex: João da Silva"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp / Contato</label>
                  <input
                    type="tel"
                    required
                    value={contato}
                    onChange={(e) => setContato(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-shadow"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 mt-2"
                >
                  {isLoading ? 'Gerando Acesso...' : 'Gerar Link de Acesso'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Acesso Gerado!</h4>
              <p className="text-sm text-slate-600 mb-6">
                Envie este link para {nome}. Ao acessar, ele(a) poderá assumir a gestão do memorial.
              </p>
              
              <div className="flex items-center gap-2 mb-6">
                <input 
                  type="text"
                  readOnly
                  value={successLink}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none"
                />
                <button 
                  onClick={copyToClipboard}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition tooltip-trigger relative"
                  title="Copiar Link"
                >
                  {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={openWhatsApp}
                  className="flex-1 bg-emerald-500 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-600 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Share2 className="w-4 h-4" /> Enviar no WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
