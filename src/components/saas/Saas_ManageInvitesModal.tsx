import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Edit2, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memorial: any;
}

export function Saas_ManageInvitesModal({ isOpen, onClose, memorial }: Props) {
  const { session } = useAuth();
  const token = session?.access_token;
  
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orphans, setOrphans] = useState<string[]>([]);

  // States for inline editing & adding (to replace window.prompt/confirm)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTel, setEditTel] = useState('');
  
  const [showAdd, setShowAdd] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTel, setNewTel] = useState('');

  const [showAddOrphan, setShowAddOrphan] = useState(false);
  const [newOrphanNome, setNewOrphanNome] = useState('');
  const [newOrphanTel, setNewOrphanTel] = useState('');
  
  useEffect(() => {
    if (!isOpen || !memorial?.id) return;
    fetchInvites();
    
    const channel = supabase.channel('invites_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_invites', filter: `memorial_id=eq.${memorial.id}` }, () => {
        fetchInvites();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [isOpen, memorial?.id]);

  const fetchInvites = async () => {
    if (!memorial?.id || !token) return;
    try {
      const [resInvites, { data: allQ }] = await Promise.all([
        fetch(`/api/invites/memorial/${memorial.id}`, {
           headers: { 'Authorization': `Bearer ${token}` }
        }),
        supabase.from('perguntas').select('id')
      ]);
      
      const jsonInv = await resInvites.json();
      if (!resInvites.ok) {
         console.error("Error fetching invites:", jsonInv);
         alert("Erro ao carregar convites: " + (jsonInv.error || 'Erro desconhecido'));
      }
      const activeInvites = (jsonInv.invites || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setInvites(activeInvites);
      
      const assigned = new Set();
      activeInvites.forEach((inv: any) => {
        (inv.perguntas_ids || []).forEach((id: string) => assigned.add(id));
      });
      
      const orphanIds = (allQ || []).map(q => q.id).filter(id => !assigned.has(id));
      setOrphans(orphanIds);
    } catch (e: any) {
      console.error("Exception in fetchInvites:", e);
      alert("Erro ao buscar convites: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteInvite = async (id: string) => {
    try {
      if (!token) return;
      const res = await fetch(`/api/invites/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
         const json = await res.json();
         alert("Erro ao excluir: " + (json.error || ""));
      } else {
         await fetchInvites();
      }
    } catch (e) { console.error(e); }
  };

  const reenableInvite = async (id: string) => {
    try {
      if (!token) return;
      const res = await fetch(`/api/invites/${id}/reenable`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) { const json = await res.json(); alert("Erro ao reabilitar: " + (json.error || "")); }
      else await fetchInvites();
    } catch (e) { console.error(e); }
  };

  const sendWhatsApp = (inviteLink: string, nome: string, whatsapp: string) => {
    let num = whatsapp.replace(/\D/g, '');
    if (!num.startsWith('55')) num = '55' + num;
    const msg = `Olá ${nome}! Aqui está o link para você participar do memorial: ${inviteLink}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden my-4 relative">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">🔗 Gerenciar Participantes</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6">
          {loading ? (
            <p className="text-center text-slate-500">Caregando...</p>
          ) : (
            <div className="space-y-4">
              {orphans.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                    <AlertTriangle className="w-5 h-5"/> {orphans.length} perguntas sem destinatário
                  </div>
                  <p className="text-sm text-amber-700 mb-4">Estas perguntas ficaram órfãs. Escolha quem vai respondê-las:</p>
                  <div className="flex flex-col gap-2">
                    {showAddOrphan ? (
                      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-amber-200">
                        <input type="text" placeholder="Nome" value={newOrphanNome} onChange={e => setNewOrphanNome(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none" />
                        <input type="text" placeholder="WhatsApp" value={newOrphanTel} onChange={e => setNewOrphanTel(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none" />
                        <div className="flex gap-2">
                           <button onClick={() => setShowAddOrphan(false)} className="flex-1 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg">Cancelar</button>
                           <button onClick={async () => {
                              if(!newOrphanNome || !newOrphanTel) return;
                              if (!token) return;
                              const r = await fetch('/api/invites/create', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ memorial_id: memorial.id, destinatario_nome: newOrphanNome, destinatario_tel: newOrphanTel, perguntas_ids: orphans })
                              });
                              if (!r.ok) { const er = await r.json(); alert('Erro ao criar: ' + (er.error || '')); }
                              else {
                                 setNewOrphanNome('');
                                 setNewOrphanTel('');
                                 setShowAddOrphan(false);
                                 await fetchInvites();
                              }
                           }} className="flex-1 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddOrphan(true)} className="bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm font-semibold text-left transition-colors">
                        + Adicionar novo familiar
                      </button>
                    )}
                    {invites.length > 0 && (
                      <select onChange={async (e) => {
                        if (!e.target.value) return;
                        if (!token) return;
                        await fetch(`/api/invites/${e.target.value}/append`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ questions: orphans })
                        });
                        await fetchInvites();
                      }} className="w-full bg-white border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm font-semibold outline-none appearance-none cursor-pointer">
                        <option value="">Enviar para familiar existente ↓</option>
                        {invites.map(inv => (
                          <option key={inv.id} value={inv.id}>{inv.destinatario_nome}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {invites.map((inv, idx) => (
                <div key={inv.id} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{idx === 0 ? 'Responsável principal' : `Familiar ${idx + 1}`}</span>
                      <span className="font-semibold text-slate-800 text-sm">{inv.destinatario_nome}</span>
                      <span className="text-xs text-slate-500">{inv.destinatario_tel}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] bg-white border border-slate-200 px-2 flex items-center justify-center font-bold text-slate-600 rounded-full h-5">
                        {inv.perguntas_ids?.length || 0} perguntas
                      </span>
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 mt-1
                        ${inv.status === 'concluido' ? 'text-emerald-700 bg-emerald-100 border border-emerald-200' : 
                          inv.status === 'pendente' ? 'text-amber-700 bg-amber-100 border border-amber-200' :
                          inv.status === 'pendente_reabilitado' ? 'text-blue-700 bg-blue-100 border border-blue-200' :
                          'text-indigo-700 bg-indigo-100 border border-indigo-200'}`}>
                        {inv.status === 'concluido' ? '✅ Respondeu' : 
                         inv.status === 'pendente_reabilitado' ? 'Reabilitado' : inv.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-2 flex items-center gap-2">
                    {editingId === inv.id ? (
                      <div className="flex-1 flex flex-col gap-1 w-full bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input type="text" className="w-full text-xs p-1.5 border border-slate-200 rounded outline-none" value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome" />
                        <input type="text" className="w-full text-xs p-1.5 border border-slate-200 rounded outline-none" value={editTel} onChange={e => setEditTel(e.target.value)} placeholder="WhatsApp" />
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-200 text-slate-600 text-xs py-1 rounded">Cancelar</button>
                          <button onClick={async () => {
                             if(!editNome && !editTel) return;
                             if (!token) return;
                             const r = await fetch(`/api/invites/${inv.id}`, {
                               method: 'PUT',
                               headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                               body: JSON.stringify({ nome: editNome || inv.destinatario_nome, telefone: editTel || inv.destinatario_tel })
                             });
                             if (!r.ok) { const er = await r.json(); alert('Erro ao editar: ' + (er.error || '')); }
                             else {
                               setEditingId(null);
                               await fetchInvites();
                             }
                          }} className="flex-1 bg-indigo-500 text-white text-xs py-1 rounded">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => {
                           setEditingId(inv.id);
                           setEditNome(inv.destinatario_nome);
                           setEditTel(inv.destinatario_tel);
                        }} className="flex-1 border border-slate-200 hover:bg-slate-50 py-1.5 rounded-lg text-xs font-semibold text-slate-600 flex items-center justify-center gap-1">
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                        {inv.status === 'concluido' ? (
                          <button onClick={() => reenableInvite(inv.id)} className="flex-1 border border-slate-200 hover:bg-slate-50 py-1.5 rounded-lg text-xs font-semibold text-slate-600 flex items-center justify-center gap-1">
                            <Send className="w-3.5 h-3.5" /> Reabilitar link
                          </button>
                        ) : inv.status === 'pendente_reabilitado' ? (
                          <button onClick={async () => {
                            if (!token) return;
                            const r = await fetch(`/api/invites/${inv.id}/revoke`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
                            if (!r.ok) { const er = await r.json(); alert('Erro ao revogar: ' + (er.error || '')); }
                            else await fetchInvites();
                          }} className="flex-1 border border-rose-200 hover:bg-rose-50 text-rose-600 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                            Revogar Reabilitação
                          </button>
                        ) : (
                          <button onClick={() => sendWhatsApp(`${window.location.origin}/invite/${inv.token}`, inv.destinatario_nome, inv.destinatario_tel)} className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
                            <Send className="w-3.5 h-3.5" /> Reenviar link
                          </button>
                        )}
                        {(idx !== 0) && (
                          <button onClick={() => deleteInvite(inv.id)} className="px-3 border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 hover:border-rose-200 py-1.5 rounded-lg transition-colors flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              {showAdd ? (
                 <div className="w-full flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                   <input type="text" placeholder="Nome do familiar" value={newNome} onChange={e => setNewNome(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-400" />
                   <input type="text" placeholder="WhatsApp (ex: 11999999999)" value={newTel} onChange={e => setNewTel(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-400" />
                   <div className="flex gap-2">
                      <button onClick={() => setShowAdd(false)} className="flex-1 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                      <button onClick={async () => {
                         if(!newNome || !newTel) return;
                         if (!token) return;
                         const r = await fetch('/api/invites/create', {
                           method: 'POST',
                           headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                           body: JSON.stringify({ memorial_id: memorial.id, destinatario_nome: newNome, destinatario_tel: newTel })
                         });
                         if (!r.ok) { const er = await r.json(); alert('Erro ao adicionar: ' + (er.error || '')); }
                         else {
                            setNewNome('');
                            setNewTel('');
                            setShowAdd(false);
                            await fetchInvites();
                         }
                      }} className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">Salvar</button>
                   </div>
                 </div>
              ) : (
                <button onClick={() => setShowAdd(true)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                   <UserPlus className="w-4 h-4"/> Adicionar familiar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
           <button onClick={onClose} disabled={orphans.length > 0} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-800 transition-colors">Concluir</button>
        </div>
      </div>
    </div>
  );
}
