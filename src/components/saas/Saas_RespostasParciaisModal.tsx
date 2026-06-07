import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Saas_RespostasParciaisModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorial: any;
}

export function Saas_RespostasParciaisModal({ isOpen, onClose, memorial }: Saas_RespostasParciaisModalProps) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && memorial) {
      fetchInvites();
    }
  }, [isOpen, memorial]);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('supabase.auth.token') || '';
      // We take the access token. If user is using Supabase auth directly, it's stored in localstorage usually as 'sb-<project>-auth-token' or we can get it from supabase client.
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      const res = await fetch(`/api/invites/memorial/${memorial.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!res.ok) throw new Error('Erro ao buscar convites');
      const { invites } = await res.json();
      
      // Filtra invites de transferencia de controle se houver necessidade
      const filtered = (invites || []).filter((i: any) => 
        !i.perguntas_ids?.includes('TRANSFERENCIA_CONTROLE')
      );
      setInvites(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async (invite: any) => {
    setReenviando(invite.id);
    try {
      // O link do invite já existe via token
      const link = `${window.location.origin}/invite/${invite.token}`;
      const msg = `Olá ${invite.destinatario_nome}, as perguntas para a biografia de ${memorial.nome_homenageado} estão aguardando suas respostas: ${link}`;
      
      // Se for mobile/whatsapp ou copiado para a area de transferencia
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      
      // Update the state so it is re-sending wait time? (not necessary)
    } finally {
      setReenviando(null);
    }
  };

  if (!isOpen || !memorial) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido': return '✅';
      case 'expirado': return '❌';
      case 'acessado': return '⏳';
      default: return '🔴';
    }
  };

  const getStatusText = (invite: any) => {
    switch (invite.status) {
      case 'concluido': return 'Respondeu';
      case 'expirado': return 'Link expirado';
      case 'acessado': return 'Acessou — não concluiu';
      default: return 'Não acessou ainda';
    }
  };

  const totalRespondidas = memorial.total_perguntas_respondidas || 0;
  const perc = totalRespondidas > 0 ? Math.min(100, Math.round((totalRespondidas / 20) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Respostas dos Familiares</h3>
            <p className="text-sm text-slate-500 font-medium">Memorial: {memorial.nome_homenageado}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
          {loading ? (
            <div className="flex justify-center p-8 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Nenhum convite encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map(invite => (
                <div key={invite.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        {getStatusIcon(invite.status)} {invite.destinatario_nome} <span className="font-normal text-slate-500 text-sm">({invite.parentesco})</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1 pl-6">
                        {getStatusText(invite)}
                      </div>
                    </div>
                    {invite.status !== 'concluido' && (
                      <button
                        onClick={() => handleReenviar(invite)}
                        disabled={reenviando === invite.id}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Reenviar link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!loading && (
            <div className="pt-4 mt-6 border-t border-slate-100">
               <div className="text-sm font-semibold text-slate-700 mb-2">
                 {totalRespondidas} de 20 perguntas respondidas globalmente
               </div>
               <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                 <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${perc}%` }}></div>
               </div>
               <div className="text-right text-xs text-slate-500 font-mono mt-1">{perc}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
