import React, { useState } from 'react';
import { X, Send, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CompartilharModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorialId: string;
  perguntas: any[];
}

export default function CompartilharModal({ isOpen, onClose, memorialId, perguntas }: CompartilharModalProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [perguntasSelecionadas, setPerguntasSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [lastInviteId, setLastInviteId] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [convites, setConvites] = useState<any[]>([]);
  const [loadingConvites, setLoadingConvites] = useState(false);

  React.useEffect(() => {
    if (isOpen && memorialId) {
      carregarConvites();
      // Reset form variables
      setInviteLink('');
      setLastInviteId('');
      setNome('');
      setWhatsapp('');
      setPerguntasSelecionadas([]);
    }
  }, [isOpen, memorialId]);

  const carregarConvites = async () => {
    setLoadingConvites(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch(`/api/invites/memorial/${memorialId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await res.json();
        if (res.ok && json.invites) {
          setConvites(json.invites);
        }
      } else {
        console.warn(`Não foi possível carregar convites: formato de resposta inválido (${res.status})`);
      }
    } catch(err) {
      console.error(err);
    }
    setLoadingConvites(false);
  };

  if (!isOpen) return null;

  const togglePergunta = (id: string) => {
    setPerguntasSelecionadas(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleCreateInvite = async () => {
    if (!nome.trim() || perguntasSelecionadas.length === 0) {
      alert("Preencha o nome do destinatário e selecione pelo menos uma pergunta.");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          memorial_id: memorialId,
          destinatario_nome: nome,
          destinatario_tel: whatsapp,
          perguntas_ids: perguntasSelecionadas
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar convite');

      const link = `${window.location.origin}/invite/${data.invite.token}`;
      setInviteLink(link);
      setLastInviteId(data.invite.id);
      await carregarConvites();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateInviteStatus = async (id: string, newStatus: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      await fetch(`/api/invites/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      await carregarConvites();
    } catch(err) {
      console.error(err);
    }
  };

  const handleCopyNew = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    updateInviteStatus(id, 'enviado');
  };

  const handleCopyExisting = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    updateInviteStatus(id, 'enviado');
  };

  const handleWhatsApp = (id: string, destinatario: string, whatsappNumber: string, link: string) => {
    const text = encodeURIComponent(`Olá ${destinatario}, estou criando o memorial e gostaria de sua ajuda com algumas lembranças. Por favor, responda neste link seguro: ${link}`);
    window.open(`https://wa.me/${whatsappNumber.replace(/\D/g,'')}?text=${text}`, '_blank');
    updateInviteStatus(id, 'enviado');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Pedir Ajuda para Responder</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {inviteLink ? (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} />
              </div>
              <h3 className="text-xl font-medium text-gray-900">Link Gerado com Sucesso!</h3>
              <p className="text-gray-600">
                O link temporário seguro (válido por 7 dias) foi criado exclusivamente para {nome}.
              </p>
              
              <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
                <input 
                  type="text" 
                  value={inviteLink} 
                  readOnly 
                  className="bg-transparent flex-1 outline-none text-sm text-gray-600"
                />
                <button 
                  onClick={() => handleCopyNew(lastInviteId, inviteLink)}
                  className="text-emerald-700 hover:bg-emerald-50 p-2 rounded flex items-center gap-1 text-sm font-medium transition"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  Copiar
                </button>
              </div>

              {whatsapp && (
                <button 
                  onClick={() => handleWhatsApp(lastInviteId, nome, whatsapp, inviteLink)}
                  className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 flex justify-center items-center gap-2 transition"
                >
                  <Send size={18} />
                  Enviar no WhatsApp
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Destinatário</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Tio João"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (opcional)</label>
                <input 
                  type="text" 
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
                  Quais perguntas ele(a) deve responder?
                </label>
                <div className="border rounded-lg overflow-hidden divide-y max-h-64 overflow-y-auto">
                  {perguntas.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={perguntasSelecionadas.includes(p.id)}
                        onChange={() => togglePergunta(p.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                      />
                      <span className="text-sm text-gray-800">{p.texto_pergunta}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {convites.length > 0 && !inviteLink && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Links Existentes & Respostas</h3>
              <div className="space-y-3">
                {convites.map(c => {
                  const url = `${window.location.origin}/invite/${c.token}`;
                  return (
                    <div key={c.id} className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900 truncate">{c.destinatario_nome}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' :
                            c.status === 'acessado' ? 'bg-blue-100 text-blue-700' :
                            c.status === 'enviado' ? 'bg-indigo-100 text-indigo-700' :
                            c.status === 'expirado' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {c.perguntas_ids?.length || 0} pergunta(s)
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {c.status !== 'concluido' && c.status !== 'expirado' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCopyExisting(c.id, url)}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Copiar Link"
                            >
                              <Copy size={16} />
                            </button>
                            {c.destinatario_tel && (
                              <button
                                onClick={() => handleWhatsApp(c.id, c.destinatario_nome, c.destinatario_tel, url)}
                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Enviar via WhatsApp"
                              >
                                <Send size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!inviteLink && (
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreateInvite}
              disabled={loading || perguntasSelecionadas.length === 0 || !nome}
              className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Gerando...' : 'Gerar Link Seguro'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
