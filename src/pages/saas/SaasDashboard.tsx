import { useState, useEffect, useRef } from 'react';
import { Users, Link as LinkIcon, TrendingUp, AlertCircle, Copy, CheckCircle2, Search, Filter, Edit, Image as ImageIcon, Share2, Loader2, MoreVertical, MessageCircle, Send, Wand2, RefreshCw, QrCode, Download, X, Upload, Key, Crown, Briefcase, Bell, EyeOff, Eye, Camera } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Saas_NewLinkModal } from '../../components/saas/Saas_NewLinkModal';
import { Saas_ManageInvitesModal } from '../../components/saas/Saas_ManageInvitesModal';
import { Saas_QrCodeModal } from '../../components/saas/Saas_QrCodeModal';
import { Saas_HandoverModal } from '../../components/saas/Saas_HandoverModal';
import { SaasFastPlanModal } from '../../components/saas/SaasFastPlanModal';
import { SaasResetMemorialModal } from '../../components/saas/SaasResetMemorialModal';
import { SaasToggleBioStatusModal } from '../../components/saas/SaasToggleBioStatusModal';
import { Saas_RespostasParciaisModal } from '../../components/saas/Saas_RespostasParciaisModal';
import { supabase } from '../../lib/supabase';
import { format, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useAuth } from '../../contexts/AuthContext';

export default function SaasDashboard() {
  const navigate = useNavigate();
  const { session, user, walletBalance, setWalletBalance, refreshWallet } = useAuth();
  
  const [showDebugCreditInput, setShowDebugCreditInput] = useState(false);
  const [debugCreditAmt, setDebugCreditAmt] = useState('40');
  
  const [toastNotification, setToastNotification] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = (message: string) => {
    setToastNotification({ message, visible: true });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [memoriais, setMemoriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [planoFilter, setPlanoFilter] = useState('todos');

  const [editingMemorial, setEditingMemorial] = useState<any>(null);
  const [sharingMemorial, setSharingMemorial] = useState<any>(null);
  const [manualInviteLink, setManualInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [qrModalData, setQrModalData] = useState({ isOpen: false, id: '', name: '' });
  const [respostasModalData, setRespostasModalData] = useState<{isOpen: boolean, memorial: any | null}>({isOpen: false, memorial: null});
  const [handoverModalData, setHandoverModalData] = useState({ isOpen: false, id: '', name: '' });
  const [photoModalData, setPhotoModalData] = useState({ isOpen: false, id: '', fotoUrl: '', isUploading: false, error: '' });
  const [galleryModalData, setGalleryModalData] = useState({ isOpen: false, id: '', images: [] as any[], isUploading: false, error: '' });
  const [fastPlanModal, setFastPlanModal] = useState<{ isOpen: boolean, memorialId: string, currentPlan: string, editsUsed: number, hasBio: boolean }>({ isOpen: false, memorialId: '', currentPlan: '', editsUsed: 0, hasBio: false });
  const [chooseGenModal, setChooseGenModal] = useState<any>(null);
  const [resetModalData, setResetModalData] = useState<{ isOpen: boolean; memorial: any | null }>({ isOpen: false, memorial: null });
  const [toggleBioModalData, setToggleBioModalData] = useState<{ isOpen: boolean; memorial: any | null }>({ isOpen: false, memorial: null });
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [fotoLinkModal, setFotoLinkModal] = useState<{ isOpen: boolean; memorialId: string; link: string | null; loading: boolean; copied: boolean }>({ isOpen: false, memorialId: '', link: null, loading: false, copied: false });

  const handleGerarFotoLink = async (memorialId: string) => {
    setFotoLinkModal({ isOpen: true, memorialId, link: null, loading: true, copied: false });
    try {
      const { data: authData } = await supabase.auth.getSession();
      const jwt = authData.session?.access_token;
      const res = await fetch(`/api/memoriais/${memorialId}/photo-invite/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` }
      });
      const data = await res.json();
      if (!res.ok || !data.invite?.token) throw new Error(data.error || 'Falha ao gerar link');
      const link = `${window.location.origin}/fotos/${data.invite.token}`;
      setFotoLinkModal(prev => ({ ...prev, link, loading: false }));
    } catch (err: any) {
      setFotoLinkModal(prev => ({ ...prev, loading: false, link: null }));
      showToast('Erro ao gerar link de fotos: ' + (err.message || 'Erro desconhecido'));
    }
  };
  
  // SUPPORT MODAL TEST STATE
  const [supportModalData, setSupportModalData] = useState({ isOpen: false, question: '', response: '', isLoading: false, error: '' });
  const [supportSessionId, setSupportSessionId] = useState<string>('');


  const openWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const url = `https://wa.me/${cleanPhone ? `55${cleanPhone}` : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchMemoriais();

    // Canal 1: escuta atualizações na tabela memoriais (status_memorial, etc.)
    const memorialChannel = supabase.channel('memorial_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'memoriais' },
        (payload) => {
          const updatedMemorial = payload.new;

          // Toast de notificação quando família conclui as respostas
          if (
            updatedMemorial.status_memorial === 'respostas_recebidas' ||
            updatedMemorial.status_memorial === 'Respondido'
          ) {
            showToast(`🔔 A família de ${updatedMemorial.nome_homenageado || 'um homenageado'} acabou de enviar as respostas!`);
          }

          // Recarrega a lista completa para garantir que question_invites (joined) fique atualizado
          fetchMemoriais();
        }
      )
      .subscribe();

    // Canal 2: escuta atualizações na tabela question_invites
    // Quando um familiar conclui a entrevista (status -> 'concluido'), atualiza o badge imediatamente
    const inviteChannel = supabase.channel('invite_status_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'question_invites' },
        () => {
          fetchMemoriais();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memorialChannel);
      supabase.removeChannel(inviteChannel);
    };
  }, []);



  // O auto-gerador de links no nível do dashboard foi removido para evitar concorrência e duplicação.
  // Todo o fluxo de verificação, deduplicação e geração de convites agora é gerenciado pelo modal Saas_NewLinkModal.tsx.

  const fetchMemoriais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('memoriais')
        .select(`*, midias(count), question_invites(status), respostas(count), narrativas(id, audio_url, audio_status, conteudo_completo, status_publicacao)`)
        .eq('origem_sistema', 'saas')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemoriais(data || []);
    } catch (err) {
      console.error("Erro ao buscar memoriais:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = (data: any) => {
    console.log("Dados do memorial gerado:", data);
    setGeneratedLink(data.linkGerado);
    fetchMemoriais(); // Recarrega a lista
  };

  const copyToClipboard = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpdateFotoUrl = async (newUrl: string) => {
    try {
      setPhotoModalData(prev => ({ ...prev, isUploading: true, error: '' }));

      const oldMemorial = memoriais.find(m => m.id === photoModalData.id);
      if (oldMemorial && oldMemorial.foto_url && oldMemorial.foto_url !== newUrl) {
          const oldPath = oldMemorial.foto_url.split('/memoriais/')[1];
          // Delete only if it is a Supabase Storage path
          if (oldPath) {
              await supabase.storage.from('memoriais').remove([oldPath]);
          }
      }

      const { error } = await supabase.from('memoriais').update({ foto_url: newUrl }).eq('id', photoModalData.id);
      if (error) throw error;
      setMemoriais(memoriais.map(m => m.id === photoModalData.id ? { ...m, foto_url: newUrl } : m));
      setPhotoModalData({ isOpen: false, id: '', fotoUrl: '', isUploading: false, error: '' });
    } catch (err: any) {
      setPhotoModalData(prev => ({ ...prev, error: err.message, isUploading: false }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPhotoModalData(prev => ({ ...prev, isUploading: true, error: '' }));
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${photoModalData.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('memoriais').upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('memoriais').getPublicUrl(filePath);
      
      await handleUpdateFotoUrl(publicUrl);
    } catch (err: any) {
      setPhotoModalData(prev => ({ ...prev, error: err.message, isUploading: false }));
    }
  };

  const handleOpenGallery = async (memorialId: string) => {
    setGalleryModalData({ isOpen: true, id: memorialId, images: [], isUploading: true, error: '' });
    try {
      const { data, error } = await supabase
        .from('midias')
        .select('*')
        .eq('memorial_id', memorialId)
        .eq('tipo_midia', 'foto')
        .order('ordem', { ascending: true });
        
      if (error) throw error;
      setGalleryModalData({ isOpen: true, id: memorialId, images: data || [], isUploading: false, error: '' });
    } catch (err: any) {
      setGalleryModalData(prev => ({ ...prev, error: err.message, isUploading: false }));
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const limit = 10 - galleryModalData.images.length;
    const filesToUpload = files.slice(0, limit);

    if (files.length > limit) {
      setGalleryModalData(prev => ({ ...prev, error: `Você só pode adicionar mais ${limit} foto(s). O limite é 10.` }));
    }

    try {
      setGalleryModalData(prev => ({ ...prev, isUploading: true, error: '' }));

      const session = await supabase.auth.getSession();
      const user = session.data.session?.user;
      if (!user) throw new Error("Usuário não autenticado");

      const newImages = [];
      let currentOrder = galleryModalData.images.length;

      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const filePath = `galeria/${galleryModalData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('memoriais').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('memoriais').getPublicUrl(filePath);
        
        const { data: midiaData, error: insertError } = await supabase
          .from('midias')
          .insert({
            memorial_id: galleryModalData.id,
            tipo_midia: 'foto',
            url: publicUrl,
            ordem: currentOrder++,
            created_by: user.id
          })
          .select()
          .single();

        if (insertError) throw insertError;
        newImages.push(midiaData);
      }

      setGalleryModalData(prev => ({ ...prev, images: [...prev.images, ...newImages], isUploading: false }));
      
      // Update count in table
      setMemoriais(memoriais.map(m => {
        if (m.id === galleryModalData.id) {
          const midiasList = [...(m.midias || [])];
          if (midiasList.length === 0) {
              midiasList.push({ count: galleryModalData.images.length + newImages.length });
          } else {
              midiasList[0] = { count: galleryModalData.images.length + newImages.length };
          }
          return { ...m, midias: midiasList };
        }
        return m;
      }));

    } catch (err: any) {
      setGalleryModalData(prev => ({ ...prev, error: err.message, isUploading: false }));
    }
  };

  const removeGalleryImage = async (mediaId: string, url: string) => {
    try {
      setGalleryModalData(prev => ({ ...prev, isUploading: true, error: '' }));
      
      const { error } = await supabase.from('midias').delete().eq('id', mediaId);
      if (error) throw error;
      
      // Try to remove from storage if needed (optional based on your policy)
      const pathPart = url.split('/memoriais/')[1];
      if (pathPart) {
        await supabase.storage.from('memoriais').remove([pathPart]);
      }

      setGalleryModalData(prev => ({ 
        ...prev, 
        images: prev.images.filter(img => img.id !== mediaId),
        isUploading: false 
      }));

      // Update count in table
      setMemoriais(memoriais.map(m => {
        if (m.id === galleryModalData.id) {
          const currentCount = (m.midias?.[0]?.count || 1) - 1;
          return { ...m, midias: [{ count: currentCount }] };
        }
        return m;
      }));

    } catch (err: any) {
      setGalleryModalData(prev => ({ ...prev, error: err.message, isUploading: false }));
    }
  };

  const getEffectiveStatus = (m: any) => {
    const isSuspended = m.narrativas?.some((n: any) => n.status_publicacao === 'suspenso');
    if (isSuspended) {
      return 'suspenso';
    }

    const hasRascunho = m.narrativas?.some((n: any) => n.status_publicacao === 'rascunho');
    if (hasRascunho) {
      return 'edicao_pendente';
    }

    let displayStatus = m.status_memorial || m.status;
    const hasNarrative = m.narrativas?.some((n: any) => n.conteudo_completo && n.status_publicacao === 'oficial');
    if (hasNarrative) {
      displayStatus = 'concluido';
    }
    return displayStatus;
  };

  const filteredMemoriais = memoriais.filter(m => {
    const matchesName = (m.nome_homenageado || '').toLowerCase().includes(searchQuery.toLowerCase());
    const displayStatus = getEffectiveStatus(m);
    
    // Ocultar inativos por padrão, a menos que o filtro de status seja explicitamente 'suspenso'
    if (displayStatus === 'suspenso' && statusFilter !== 'suspenso') {
      return false;
    }

    let matchesStatus = false;
    if (statusFilter === 'todos') {
      matchesStatus = true;
    } else if (statusFilter === 'aguardando') {
      matchesStatus = displayStatus === 'aguardando' || displayStatus === 'em_progresso';
    } else if (statusFilter === 'concluido') {
      matchesStatus = displayStatus === 'concluido' || displayStatus === 'gerado' || displayStatus === 'publicado';
    } else {
      matchesStatus = displayStatus === statusFilter;
    }

    let matchesPlano = false;
    if (planoFilter === 'todos') {
      matchesPlano = true;
    } else {
      matchesPlano = (m.plano_geracao || 'basico') === planoFilter;
    }
                          
    return matchesName && matchesStatus && matchesPlano;
  });

  const getPlanoStyle = (plano: string) => {
    switch(plano) {
      case 'basico': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'enterprise': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'premium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getPlanoLabel = (plano: string) => {
    switch(plano) {
      case 'basico': return 'Básico';
      case 'enterprise': return 'Enterprise';
      case 'premium': return 'Premium';
      default: return 'Básico';
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'rascunho': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'edicao_pendente': return 'bg-amber-500 text-amber-50 border-amber-500';
      case 'em_progresso': 
      case 'aguardando': return 'bg-amber-100 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-200';
      case 'respostas_parciais': return 'bg-amber-100 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-200';
      case 'respostas_recebidas': return 'bg-blue-100 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-200';
      case 'suspenso': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'gerado':
      case 'publicado': 
      case 'concluido': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string, m?: any) => {
    switch(status) {
      case 'rascunho': return 'Criado / Aguardando Envio';
      case 'edicao_pendente': return 'Atenção / Edição Pendente';
      case 'em_progresso': 
      case 'aguardando': return m?.total_invites_criados > 0 ? `Enviado / Aguardando: ${m?.total_invites_concluidos || 0}/${m?.total_invites_criados}` : 'Enviado / Aguardando Resposta';
      case 'respostas_parciais': return `Enviado / Aguardando Respostas: ${m?.total_invites_concluidos || 0}/${m?.total_invites_criados || 0}`;
      case 'respostas_recebidas': return m?.total_invites_criados && m?.total_invites_criados > 0 ? `Retorno / Perguntas Respondidas: ${m.total_invites_concluidos}/${m.total_invites_criados} ✓` : 'Retorno / Perguntas Respondidas';
      case 'suspenso': return 'Biografia Suspensa / Inativa';
      case 'gerado':
      case 'publicado': 
      case 'concluido': return 'Finalizado / Biografia Criada';
      default: return status;
    }
  };

  const openLinksCount = memoriais.filter(m => {
    const displayStatus = getEffectiveStatus(m);
    return displayStatus === 'aguardando' || displayStatus === 'em_progresso';
  }).length;

  return (
    <div className="space-y-6">
      {/* Toast Notificação */}
      {toastNotification.visible && (
        <div className="fixed top-4 right-4 z-[9999] bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-bold">{toastNotification.message}</span>
        </div>
      )}

      {/* Aviso de Sucesso - Link Gerado */}
      {generatedLink && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="font-medium text-sm">Link Mágico gerado com sucesso!</p>
              <p className="text-xs text-emerald-600">Envie este link para o familiar cadastrado.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <code className="bg-white px-3 py-1.5 rounded border border-emerald-100 text-xs text-slate-600 truncate max-w-[200px]">
              {generatedLink}
            </code>
            <button 
              onClick={() => copyToClipboard(generatedLink)}
              className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-colors shrink-0"
              title="Copiar Link"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Visão Geral</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe as métricas e acessos da sua agência.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 font-medium text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors shadow-sm gap-2 w-full sm:w-auto"
        >
          <LinkIcon className="w-4 h-4" />
          Gerar Novo Memorial
        </button>
      </div>

      <Saas_NewLinkModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onGenerate={handleGenerateLink} 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-medium">Famílias Atendidas</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{memoriais.length}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> +12%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Neste mês</p>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-2">
            <LinkIcon className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-medium">Links Abertos</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{openLinksCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Aguardando preenchimento familiar</p>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white border-transparent relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-slate-300 mb-2">
              <h3 className="text-sm font-medium">Seu Saldo</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{walletBalance !== null ? Math.floor(walletBalance) : '--'}</span>
              <span className="text-sm text-slate-300">créditos</span>
            </div>
            <div className="flex items-center gap-2 mt-3 block">
              <Link to="/saas/faturamento" className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-colors">
                Comprar mais pacotes &rarr;
              </Link>
            </div>
            {/* DEBUG BUTTONS - Apenas para testes do sistema */}
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
               {showDebugCreditInput ? (
                 <div className="flex items-center gap-2">
                   <input
                     type="number"
                     value={debugCreditAmt}
                     onChange={(e) => setDebugCreditAmt(e.target.value)}
                     className="w-16 h-7 bg-slate-800 text-white text-xs px-2 py-1 rounded outline-none border border-slate-600"
                   />
                   <button 
                     onClick={() => {
                       supabase.auth.getSession().then(({ data: authData }) => {
                         fetch('/api/wallet/debug', {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                             ...(authData.session ? { 'Authorization': `Bearer ${authData.session.access_token}` } : {})
                           },
                           body: JSON.stringify({ type: 'set', amount: parseFloat(debugCreditAmt) || 0 })
                         }).then(res => res.json()).then(resData => {
                           if (resData.new_wallet_balance !== undefined) setWalletBalance(resData.new_wallet_balance);
                           setShowDebugCreditInput(false);
                         }).catch(console.error);
                       });
                     }}
                     className="text-[10px] px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                     Salvar
                   </button>
                   <button 
                     onClick={() => setShowDebugCreditInput(false)}
                     className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors">
                     Cancelar
                   </button>
                 </div>
               ) : (
                 <div className="flex gap-2">
                   <button 
                     onClick={() => setShowDebugCreditInput(true)}
                     className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors">
                     Setar Créditos
                   </button>
                   <button 
                      onClick={async () => {
                       try {
                         const { data: authData } = await supabase.auth.getSession();
                         const res = await fetch('/api/wallet/debug', {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                             ...(authData.session ? { 'Authorization': `Bearer ${authData.session.access_token}` } : {})
                           },
                           body: JSON.stringify({ type: 'reset', amount: 0 })
                         });
                         const resData = await res.json();
                         if (res.ok) setWalletBalance(resData.new_wallet_balance);
                       } catch(e) { console.error('Erro debug wallet'); }
                     }}
                     className="text-[10px] px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded border border-red-800 transition-colors">
                     Zerar Créditos
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Listagem Dinâmica e Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Filtros */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome do homenageado..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={planoFilter}
              onChange={(e) => setPlanoFilter(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm py-2 px-3 text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-auto"
            >
              <option value="todos">Todos os Planos</option>
              <option value="basico">Básico</option>
              <option value="enterprise">Enterprise</option>
              <option value="premium">Premium</option>
            </select>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm py-2 px-3 text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-auto"
            >
              <option value="todos">Todos os Status</option>
              <option value="rascunho">Criado / Aguardando Envio</option>
              <option value="aguardando">Enviado / Aguardando Resposta</option>
              <option value="respostas_recebidas">Retorno / Perguntas Respondidas</option>
              <option value="concluido">Finalizado / Biografia Criada</option>
              <option value="edicao_pendente">Atenção / Edição Pendente</option>
              <option value="suspenso">Inativados / Suspensos</option>
            </select>
          </div>
        </div>

        {/* Header Tabela (Oculto no mobile) */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 bg-white text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="col-span-5">Memorial</div>
          <div className="col-span-3">Status do Processo</div>
          <div className="col-span-2">Criado em</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {/* Lista */}
        <div className="divide-y divide-slate-100 flex-1 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando memoriais...</p>
            </div>
          ) : filteredMemoriais.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-700">Nenhum memorial encontrado.</p>
              <p className="text-sm mt-1 text-center">Tente ajustar seus filtros ou crie um novo memorial.</p>
            </div>
          ) : (
            filteredMemoriais.map((memorial) => {
              const hasText = memorial.narrativas?.some((n: any) => n.conteudo_completo && (n.status_publicacao === 'oficial' || n.status_publicacao === 'rascunho'));
              const hasAudio = memorial.narrativas?.some((n: any) => n.audio_url && n.audio_status === 'success' && n.status_publicacao === 'oficial');
              const isIncomplete = hasText && !hasAudio;

              return (
                <div key={memorial.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-slate-50 transition-colors group">
                <div className="sm:col-span-5 flex items-center gap-4">
                  <div className="relative pt-3 flex-shrink-0">
                    <button 
                      onClick={() => setPhotoModalData({ isOpen: true, id: memorial.id, fotoUrl: memorial.foto_url || '', isUploading: false, error: '' })}
                      className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-200 group/avatar flex-shrink-0"
                      title="Alterar/Incluir foto do perfil"
                    >
                      {memorial.foto_url ? (
                        <img src={memorial.foto_url} alt={memorial.nome_homenageado} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                        <Edit className="w-5 h-5 text-white" />
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFastPlanModal({ isOpen: true, memorialId: memorial.id, currentPlan: memorial.plano_geracao, editsUsed: memorial.edits_used || 0, hasBio: memorial.narrativas?.length > 0 }); }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 transition-transform hover:scale-105 active:scale-95"
                      title="Alterar Plano"
                    >
                      {memorial.plano_geracao === 'premium' ? (
                        <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-amber-200"><Crown className="w-3 h-3"/> PREMIUM</span>
                      ) : memorial.plano_geracao === 'enterprise' ? (
                        <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-indigo-300"><Briefcase className="w-3 h-3"/> ENTERPRISE</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-slate-200">BÁSICO</span>
                      )}
                    </button>
                  </div>
                  {isIncomplete && (
                    <button
                      onClick={() => navigate(`/saas/memorial/${memorial.id}/gerar`)}
                      className="flex-shrink-0 p-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition-colors animate-pulse flex items-center justify-center shadow-sm"
                      title="Áudio pendente! Clique para gerar o áudio e concluir o processo."
                    >
                      <Bell className="w-4 h-4 fill-red-500" />
                    </button>
                  )}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                       <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                         {memorial.nome_homenageado || 'Sem nome'}
                       </h4>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
                        <span className="flex-shrink-0 flex items-center gap-1.5">
                          {memorial.data_nascimento && memorial.data_falecimento ? (
                            <>
                              <span>* {format(new Date(memorial.data_nascimento), 'yyyy')} ✝ {format(new Date(memorial.data_falecimento), 'yyyy')}</span>
                              <span className="opacity-75 font-medium">
                                ({differenceInYears(new Date(memorial.data_falecimento), new Date(memorial.data_nascimento))} anos)
                              </span>
                            </>
                          ) : (
                            'Datas não informadas'
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-medium text-slate-400 text-xs" title="Status de Mídia">
                        <button 
                          onClick={() => setPhotoModalData({ isOpen: true, id: memorial.id, fotoUrl: memorial.foto_url || '', isUploading: false, error: '' })}
                          className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          <div className={`w-2 h-2 rounded-full ${memorial.foto_url ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
                          Capa
                        </button>
                        {(() => {
                          const maxMidias = 10;
                          const midiasCount = memorial.midias?.[0]?.count || 0;
                          let dotColor = 'bg-red-400';
                          if (midiasCount >= maxMidias) {
                            dotColor = 'bg-emerald-500';
                          } else if (midiasCount > 0) {
                            dotColor = 'bg-amber-400';
                          }
                          return (
                            <button 
                              onClick={() => handleOpenGallery(memorial.id)}
                              className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                              Galeria {midiasCount > 0 ? <span className="text-[10px] leading-none opacity-80">({midiasCount}/{maxMidias})</span> : ''}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-3 flex flex-col items-start gap-1.5">
                  <span 
                    onClick={(e) => {
                        e.stopPropagation();
                        const status = getEffectiveStatus(memorial);
                        if (status === 'respostas_parciais' || status === 'respostas_recebidas' || status === 'aguardando' || status === 'em_progresso') {
                           setRespostasModalData({ isOpen: true, memorial });
                        }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(getEffectiveStatus(memorial))}`}
                  >
                    {getStatusLabel(getEffectiveStatus(memorial), memorial)}
                  </span>
                  
                  {getEffectiveStatus(memorial) !== 'publicado' && getEffectiveStatus(memorial) !== 'concluido' && getEffectiveStatus(memorial) !== 'gerado' && (
                    <span className="text-[10px] text-slate-500 font-medium tracking-wide font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      RESPOSTAS: {memorial.respostas?.[0]?.count || 0}/20
                    </span>
                  )}
                </div>

                <div className="sm:col-span-2 text-sm text-slate-500">
                  {memorial.created_at ? format(new Date(memorial.created_at), "dd MMM, yyyy", { locale: ptBR }) : '-'}
                </div>

                <div className="sm:col-span-2 flex items-center justify-end gap-1.5 relative">
                  {/* Ação Primária 1: Compartilhar / Enviar Link */}
                  <button 
                    disabled={['respostas_recebidas', 'gerado', 'publicado', 'concluido', 'edicao_pendente'].includes(getEffectiveStatus(memorial))}
                    onClick={() => setSharingMemorial(memorial)}
                    className={`p-2 rounded-lg transition-colors ${
                      !['respostas_recebidas', 'gerado', 'publicado', 'concluido', 'edicao_pendente'].includes(getEffectiveStatus(memorial))
                        ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        : 'text-slate-300 bg-slate-50/50 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      !['respostas_recebidas', 'gerado', 'publicado', 'concluido', 'edicao_pendente'].includes(getEffectiveStatus(memorial))
                        ? "Compartilhar / Enviar Link de Entrevista"
                        : "Perguntas já respondidas (Link de entrevista desabilitado)"
                    }
                  >
                    <Send className="w-4 h-4" />
                  </button>

                  {/* Ação FotoLink: Enviar link de fotos para a família */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGerarFotoLink(memorial.id); }}
                    className="p-2 rounded-lg transition-colors text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                    title="Enviar link de fotos para a família (FotoLink)"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Ação Primária 2: Gerar/Revisar Biografia (IA) */}
                  <button 
                    disabled={!['respostas_recebidas', 'gerado', 'publicado', 'concluido', 'edicao_pendente'].includes(getEffectiveStatus(memorial))}
                    onClick={() => {
                        navigate(`/saas/memorial/${memorial.id}/gerar`);
                    }}
                    className={`p-2 rounded-lg transition-colors tooltip-trigger ${
                      ['gerado', 'publicado', 'concluido', 'edicao_pendente'].includes(getEffectiveStatus(memorial))
                        ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
                        : ['respostas_recebidas'].includes(getEffectiveStatus(memorial))
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                    title={
                       ['edicao_pendente'].includes(getEffectiveStatus(memorial)) ? "Retomar Edição Pendente" :
                       ['gerado', 'publicado', 'concluido'].includes(getEffectiveStatus(memorial)) ? "Revisar Biografia ou Gerar Novamente" :
                       ['respostas_recebidas'].includes(getEffectiveStatus(memorial)) ? "Gerar Biografia (IA)" : 
                       ['respostas_parciais'].includes(getEffectiveStatus(memorial)) ? `Aguardando ${memorial.total_invites_criados && memorial.total_invites_concluidos ? memorial.total_invites_criados - memorial.total_invites_concluidos : 'mais'} familiar(es) responder` :
                       "Aguardando respostas para gerar biografia"
                    }
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>

                  {/* Ação Primária 3: QR Code / Timeline */}
                  <button 
                    onClick={() => setQrModalData({ isOpen: true, id: memorial.id, name: memorial.nome_homenageado })}
                    disabled={getEffectiveStatus(memorial) === 'edicao_pendente' || isIncomplete || !memorial.narrativas?.some((n: any) => n.conteudo_completo && n.audio_url && n.status_publicacao === 'oficial')}
                    className={`p-2 rounded-lg transition-colors ${
                      getEffectiveStatus(memorial) !== 'edicao_pendente' && !isIncomplete && memorial.narrativas?.some((n: any) => n.conteudo_completo && n.audio_url && n.status_publicacao === 'oficial')
                        ? 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 border border-indigo-200 shadow-sm' 
                        : 'text-slate-300 bg-slate-50/50 cursor-not-allowed border border-transparent'
                    }`}
                    title={
                      getEffectiveStatus(memorial) === 'edicao_pendente'
                        ? "Timeline indisponível (Edição Pendente)"
                        : isIncomplete
                        ? "Processo de áudio incompleto. Clique no sino vermelho para gerar o áudio."
                        : memorial.narrativas?.some((n: any) => n.conteudo_completo && n.audio_url && n.status_publicacao === 'oficial')
                        ? "Timeline Pública / QR Code"
                        : "Timeline indisponível (Aguardando biografia e áudio)"
                    }
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  {/* Menu Dropdown - Ações Secundárias */}
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(activeDropdownId === memorial.id ? null : memorial.id);
                      }}
                      className={`p-2 rounded-lg transition-colors border ${
                        activeDropdownId === memorial.id 
                          ? 'bg-slate-100 text-slate-700 border-slate-300' 
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-transparent'
                      }`}
                      title="Mais Ações"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeDropdownId === memorial.id && (
                      <>
                        {/* Overlay invisível para fechar ao clicar fora */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(null);
                          }}
                        />
                        {/* Dropdown Card */}
                        <div 
                          className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveDropdownId(null);
                              setEditingMemorial(memorial);
                            }}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-650 hover:text-slate-800 hover:bg-slate-50 flex items-center gap-2 transition"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-400" />
                            Editar Informações
                          </button>
                          
                          <button
                            onClick={() => {
                              setActiveDropdownId(null);
                              navigate(`/saas/memorial/${memorial.id}/mensagens`);
                            }}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-650 hover:text-slate-800 hover:bg-slate-50 flex items-center gap-2 transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                            Moderação de Mensagens
                          </button>

                          <button
                            onClick={() => {
                              setActiveDropdownId(null);
                              setHandoverModalData({ isOpen: true, id: memorial.id, name: memorial.nome_homenageado });
                            }}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-650 hover:text-slate-800 hover:bg-slate-50 flex items-center gap-2 transition"
                          >
                            <Key className="w-3.5 h-3.5 text-slate-400" />
                            Repassar Controle
                          </button>

                          {(() => {
                            const isCurrentlySuspended = memorial.status_memorial === 'suspenso';
                            
                            return (
                              <button
                                onClick={() => {
                                  setActiveDropdownId(null);
                                  setToggleBioModalData({ isOpen: true, memorial });
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-650 hover:text-slate-800 hover:bg-slate-50 flex items-center gap-2 transition"
                              >
                                {!isCurrentlySuspended ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                    Inativar Memorial
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    Ativar Memorial
                                  </>
                                )}
                              </button>
                            );
                          })()}

                          <div className="border-t border-slate-100 my-1"></div>

                          <button
                            onClick={() => {
                              setActiveDropdownId(null);
                              setResetModalData({ isOpen: true, memorial });
                            }}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-red-650 hover:bg-red-50 flex items-center gap-2 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                            Reiniciar Memorial
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
            })
          )}
        </div>
      </div>

      <Saas_NewLinkModal
        isOpen={!!editingMemorial}
        onClose={() => setEditingMemorial(null)}
        memorial={editingMemorial}
        onGenerate={() => {
          fetchMemoriais(); 
          setEditingMemorial(null);
        }}
        onRequestPlanChange={() => {
          const memorial = editingMemorial;
          setEditingMemorial(null);
          setFastPlanModal({
            isOpen: true,
            memorialId: memorial.id,
            currentPlan: memorial.plano_geracao || 'basico',
            editsUsed: memorial.edits_used || 0,
            hasBio: !!(memorial.narrativas && memorial.narrativas.length > 0 && memorial.narrativas[0].conteudo_completo)
          });
        }}
      />

      {/* Modal FotoLink — Enviar link de fotos para a família */}
      {fotoLinkModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-600" />
                Link de Fotos (FotoLink)
              </h3>
              <button
                onClick={() => setFotoLinkModal({ isOpen: false, memorialId: '', link: null, loading: false, copied: false })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Compartilhe este link com a família. Ao acessar, eles poderão enviar a <strong>foto de perfil</strong> e as <strong>fotos da galeria</strong> diretamente do celular — sem precisar de login.
              </p>
              {fotoLinkModal.loading ? (
                <div className="flex items-center justify-center gap-3 p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  <span className="text-sm text-slate-500">Gerando link seguro...</span>
                </div>
              ) : fotoLinkModal.link ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl p-3">
                    <input
                      type="text"
                      readOnly
                      value={fotoLinkModal.link}
                      className="flex-1 text-xs text-teal-800 bg-transparent outline-none font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fotoLinkModal.link || '');
                        setFotoLinkModal(prev => ({ ...prev, copied: true }));
                        setTimeout(() => setFotoLinkModal(prev => ({ ...prev, copied: false })), 2500);
                      }}
                      className="flex-shrink-0 p-1.5 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg transition-colors"
                      title="Copiar link"
                    >
                      {fotoLinkModal.copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {fotoLinkModal.copied && (
                    <p className="text-xs text-emerald-600 text-center font-medium">✓ Link copiado para a área de transferência!</p>
                  )}
                  <button
                    onClick={() => {
                      const msg = `Olá! Acesse este link para enviar as fotos do memorial diretamente do seu celular 📷\n\n${fotoLinkModal.link}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar via WhatsApp
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">
                  Não foi possível gerar o link. Tente novamente.
                </div>
              )}
              <p className="text-[11px] text-slate-400 text-center">
                Link válido por 30 dias · Expira automaticamente ao publicar o memorial
              </p>
            </div>
          </div>
        </div>
      )}

      <Saas_ManageInvitesModal
        isOpen={!!sharingMemorial}
        onClose={() => { setSharingMemorial(null); setManualInviteLink(null); setInviteError(null); fetchMemoriais(); }}
        memorial={sharingMemorial}
      />
      {/* onGenerate é chamado só no Concluir (handleCloseAndReset), que também chama onClose */}

      {false && sharingMemorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                Compartilhar
              </h3>
              <button
                onClick={() => {
                  setSharingMemorial(null);
                  setManualInviteLink(null);
                  setInviteError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">
                Envie os links de preenchimento do Memorial de <strong className="text-slate-900">{sharingMemorial.nome_homenageado}</strong>.
              </p>

              {/* Botão: Enviar Só as Perguntas */}
              <button
                onClick={async () => {
                  try {
                    const session = await supabase.auth.getSession();
                    const jwt = session.data.session?.access_token;

                    const inviteRes = await fetch('/api/invites/create', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwt}`
                      },
                      body: JSON.stringify({
                        memorial_id: sharingMemorial.id,
                        destinatario_nome: sharingMemorial.nome_responsavel || 'Familiar',
                        destinatario_tel: sharingMemorial.whatsapp_responsavel || '000000000',
                        perguntas_ids: [] // Will fetch all on backend
                      })
                    });
                    
                    const inviteData = await inviteRes.json();
                    
                    if (!inviteRes.ok || !inviteData.invite?.token) {
                       throw new Error(inviteData.error || 'Falha ao gerar o link do convite');
                    }
                    
                    const url = `${window.location.origin}/invite/${inviteData.invite.token}`;
                    const msg = `Olá! Segue o link para responder as perguntas sobre a história de ${sharingMemorial.nome_homenageado}:\n\n🔗 ${url}`;
                    openWhatsApp(sharingMemorial.whatsapp_responsavel, msg);
                    
                    // Se ainda é rascunho, muda o status para mostrar que já foi enviado
                    await supabase.from('memoriais').update({ status_memorial: 'aguardando' }).eq('id', sharingMemorial.id);
                    fetchMemoriais();
                    setSharingMemorial(null);
                    setManualInviteLink(null);
                  } catch (err) {
                    console.error(err);
                    alert("Ocorreu um erro ao gerar o convite: " + err);
                  }
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-200 transition-colors shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">Link das Perguntas</h4>
                  <p className="text-xs text-slate-500">Abre o WhatsApp com uma mensagem convidando a responder a entrevista.</p>
                </div>
              </button>

              {/* Botão: Enviar Só as Fotos */}
              <button
                onClick={async () => {
                  try {
                    const session = await supabase.auth.getSession();
                    const jwt = session.data.session?.access_token;

                    const inviteRes = await fetch('/api/invites/create', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwt}`
                      },
                      body: JSON.stringify({
                        memorial_id: sharingMemorial.id,
                        destinatario_nome: sharingMemorial.nome_responsavel || 'Familiar',
                        destinatario_tel: sharingMemorial.whatsapp_responsavel || '000000000',
                        perguntas_ids: []
                      })
                    });
                    
                    const inviteData = await inviteRes.json();
                    
                    if (!inviteRes.ok || !inviteData.invite?.token) {
                       throw new Error(inviteData.error || 'Falha ao gerar o link do convite');
                    }
                    
                    const url = `${window.location.origin}/invite/${inviteData.invite.token}`;
                    const msg = `Olá! Segue o link para você nos enviar as fotos e as lembranças de ${sharingMemorial.nome_homenageado}. (No momento o link permite preencher a biografia, as fotos podem ser enviadas direto neste WhatsApp):\n\n🔗 ${url}`;
                    openWhatsApp(sharingMemorial.whatsapp_responsavel, msg);

                    await supabase.from('memoriais').update({ status_memorial: 'aguardando' }).eq('id', sharingMemorial.id);
                    fetchMemoriais();

                    setSharingMemorial(null);
                    setManualInviteLink(null);
                  } catch (err) {
                     console.error(err);
                     alert("Ocorreu um erro ao gerar o convite: " + err);
                  }
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">Link para Fotos</h4>
                  <p className="text-xs text-slate-500">Solicita envio de imagens (Abre o WhatsApp).</p>
                </div>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-medium text-slate-400">ou Copiar manualmente</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {inviteError ? (
                <div className="w-full p-3 bg-red-50 text-red-600 rounded-xl font-medium text-sm border border-red-200">
                  <span className="font-bold">Erro:</span> {inviteError}
                </div>
              ) : !manualInviteLink ? (
                <div className="w-full p-3 bg-slate-50 text-slate-500 rounded-xl font-medium text-sm flex justify-center items-center gap-2 border border-slate-200">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  Gerando link...
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={manualInviteLink}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-600 outline-none"
                    />
                    <button
                      onClick={async () => {
                        copyToClipboard(manualInviteLink);
                          await supabase.from('memoriais').update({ status_memorial: 'aguardando' }).eq('id', sharingMemorial.id);
                          fetchMemoriais();
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 text-center">Link gerado e pronto para uso!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}{/* end legacy sharing modal */}

      {/* Modal - QR Code */}
      <Saas_QrCodeModal 
        isOpen={qrModalData.isOpen} 
        onClose={() => setQrModalData({ isOpen: false, id: '', name: '' })} 
        memorialId={qrModalData.id} 
        memorialName={qrModalData.name} 
      />

      {/* Modal - Transferência / Handover */}
      <Saas_HandoverModal 
        isOpen={handoverModalData.isOpen} 
        onClose={() => setHandoverModalData({ isOpen: false, id: '', name: '' })} 
        memorialId={handoverModalData.id} 
        memorialName={handoverModalData.name} 
      />

      {/* Modal - Respostas Parciais */}
      <Saas_RespostasParciaisModal
        isOpen={respostasModalData.isOpen}
        onClose={() => setRespostasModalData({ isOpen: false, memorial: null })}
        memorial={respostasModalData.memorial}
      />

      {/* Modal - Foto de Perfil */}
      {photoModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Foto de Perfil do Memorial</h3>
              <button 
                onClick={() => setPhotoModalData({ isOpen: false, id: '', fotoUrl: '', isUploading: false, error: '' })} 
                disabled={photoModalData.isUploading}
                className="text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {photoModalData.error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {photoModalData.error}
                </div>
              )}

              <div className="flex flex-col items-center gap-6">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-sm bg-slate-100 flex items-center justify-center group">
                  {photoModalData.fotoUrl ? (
                    <img src={photoModalData.fotoUrl} alt="Foto de Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  )}
                  {photoModalData.isUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="w-full space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Link da Foto (URL opcional)
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={photoModalData.fotoUrl}
                        onChange={(e) => setPhotoModalData(prev => ({ ...prev, fotoUrl: e.target.value }))}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        disabled={photoModalData.isUploading}
                      />
                      <button
                        onClick={() => handleUpdateFotoUrl(photoModalData.fotoUrl)}
                        disabled={photoModalData.isUploading || !photoModalData.fotoUrl}
                        className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-slate-500">Ou envie do dispositivo</span>
                    </div>
                  </div>

                  <div>
                    <input
                      type="file"
                      id="photo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={photoModalData.isUploading}
                    />
                    <label 
                      htmlFor="photo-upload"
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer ${photoModalData.isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {photoModalData.isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                      Escolher arquivo para enviar
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SaasFastPlanModal 
        isOpen={fastPlanModal.isOpen} 
        onClose={() => setFastPlanModal({ ...fastPlanModal, isOpen: false })} 
        memorialId={fastPlanModal.memorialId} 
        currentPlan={fastPlanModal.currentPlan} 
        editsUsed={fastPlanModal.editsUsed} 
        walletBalance={walletBalance || 0}
        hasBio={fastPlanModal.hasBio} 
        onPlanChanged={(newPlan, newBalance) => { 
          fetchMemoriais(); 
          if (typeof newBalance === 'number') {
             setWalletBalance(newBalance);
          } else {
             refreshWallet();
          }
        }} 
      />

      <SaasResetMemorialModal
        isOpen={resetModalData.isOpen}
        onClose={() => setResetModalData({ isOpen: false, memorial: null })}
        memorial={resetModalData.memorial}
        walletBalance={walletBalance || 0}
        onResetCompleted={(newBalance) => {
          fetchMemoriais();
          if (typeof newBalance === 'number') {
            setWalletBalance(newBalance);
          } else {
            refreshWallet();
          }
          showToast("Memorial reiniciado com sucesso! Respostas limpas e biografia arquivada.");
        }}
      />

      <SaasToggleBioStatusModal
        isOpen={toggleBioModalData.isOpen}
        onClose={() => setToggleBioModalData({ isOpen: false, memorial: null })}
        memorial={toggleBioModalData.memorial}
        onStatusToggled={() => {
          fetchMemoriais();
          showToast("Status da biografia atualizado com sucesso!");
        }}
      />

      {/* Modal - Galeria */}
      {galleryModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          {/* ... existing gallery modal ... */}
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Galeria de Fotos</h3>
                <p className="text-sm text-slate-500">
                  {galleryModalData.images.length}/10 fotos permitidas
                </p>
              </div>
              <button 
                onClick={() => setGalleryModalData({ isOpen: false, id: '', images: [], isUploading: false, error: '' })} 
                disabled={galleryModalData.isUploading}
                className="text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {galleryModalData.error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {galleryModalData.error}
                </div>
              )}

              {galleryModalData.images.length === 0 && !galleryModalData.isUploading ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-medium text-slate-900 mb-1">Nenhuma foto adicionada</h4>
                  <p className="text-xs text-slate-500">Adicione fotos para enriquecer o memorial (máx. 10).</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {galleryModalData.images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      <img src={img.url} alt="Foto da Galeria" className="w-full h-full object-cover rounded-xl shadow-sm border border-slate-200" />
                      <button 
                        onClick={() => removeGalleryImage(img.id, img.url)}
                        disabled={galleryModalData.isUploading}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm hover:bg-red-50 disabled:opacity-50"
                        title="Remover foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {galleryModalData.isUploading && (
                    <div className="aspect-square flex flex-col items-center justify-center border-2 border-slate-100 bg-slate-50 rounded-xl">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <span className="text-xs font-medium text-slate-500">Enviando...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <input
                type="file"
                id="gallery-upload"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryUpload}
                disabled={galleryModalData.isUploading || galleryModalData.images.length >= 10}
              />
              <label 
                htmlFor="gallery-upload"
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer 
                  ${(galleryModalData.isUploading || galleryModalData.images.length >= 10) ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {galleryModalData.images.length >= 10 ? (
                  <>Limite de 10 fotos atingido</>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Adicionar fotos (Máximo 10)
                  </>
                )}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SUPORTE INTELIGENTE FLOATING BUTTON E MODAL */}
      <button
        onClick={() => {
          if (!supportSessionId) {
            setSupportSessionId(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
          }
          setSupportModalData(prev => ({ ...prev, isOpen: true }));
        }}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition transform hover:scale-105 z-40 flex items-center gap-2 font-medium"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Suporte IA</span>
      </button>

      {supportModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:w-[450px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col h-[80vh] sm:h-[600px] animate-in slide-in-from-bottom-4">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white rounded-t-2xl sm:rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold">Suporte do Sistema</h3>
              </div>
              <button 
                onClick={() => setSupportModalData(prev => ({ ...prev, isOpen: false }))}
                className="text-indigo-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 flex flex-col gap-4">
              <div className="bg-indigo-100 text-indigo-900 p-4 rounded-xl rounded-tl-sm text-sm border border-indigo-200 shadow-sm leading-relaxed whitespace-pre-wrap font-medium">
                 Olá! Sou o Assistente de Suporte conectado ao Catálogo Vivo do sistema. O que você gostaria de saber sobre nossas regras ou rotas?
              </div>
              
              {supportModalData.response && (
                <div className="bg-white p-4 rounded-xl rounded-tr-sm text-sm border border-slate-200 shadow-sm leading-relaxed whitespace-pre-wrap ml-6">
                   {supportModalData.response}
                </div>
              )}
              {supportModalData.error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl rounded-tr-sm text-sm border border-red-200 shadow-sm flex items-start gap-2 ml-6">
                   <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                   {supportModalData.error}
                </div>
              )}
              {supportModalData.isLoading && (
                 <div className="flex items-center gap-2 text-slate-400 text-sm italic ml-6">
                   <Loader2 className="w-4 h-4 animate-spin" /> Consultando a documentação oficial...
                 </div>
              )}
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Pergunte sobre como o sistema funciona..."
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={supportModalData.question}
                onChange={(e) => setSupportModalData(prev => ({ ...prev, question: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !supportModalData.isLoading) {
                    const askSupport = async () => {
                      if (!supportModalData.question.trim()) return;
                      setSupportModalData(prev => ({ ...prev, isLoading: true, response: '', error: '' }));
                      try {
                        const { data: authData } = await supabase.auth.getSession();
                        const res = await fetch('/api/suporte/chat', {
                           method: 'POST',
                           headers: {
                             'Content-Type': 'application/json',
                             ...(authData.session ? { 'Authorization': `Bearer ${authData.session.access_token}` } : {})
                           },
                           body: JSON.stringify({ pergunta: supportModalData.question, sessionId: supportSessionId })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro no chat do suporte');
                        setSupportModalData(prev => ({ ...prev, response: data.resposta, isLoading: false }));
                      } catch (err: any) {
                        setSupportModalData(prev => ({ ...prev, error: err.message, isLoading: false }));
                      }
                    };
                    askSupport();
                  }
                }}
              />
              <button 
                disabled={supportModalData.isLoading || !supportModalData.question.trim()}
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
                onClick={async () => {
                  if (!supportModalData.question.trim()) return;
                  setSupportModalData(prev => ({ ...prev, isLoading: true, response: '', error: '' }));
                  try {
                    const { data: authData } = await supabase.auth.getSession();
                    const res = await fetch('/api/suporte/chat', {
                       method: 'POST',
                       headers: {
                         'Content-Type': 'application/json',
                         ...(authData.session ? { 'Authorization': `Bearer ${authData.session.access_token}` } : {})
                       },
                       body: JSON.stringify({ pergunta: supportModalData.question, sessionId: supportSessionId })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erro no chat do suporte');
                    setSupportModalData(prev => ({ ...prev, response: data.resposta, isLoading: false }));
                  } catch (err: any) {
                    setSupportModalData(prev => ({ ...prev, error: err.message, isLoading: false }));
                  }
                }}
              >
                {supportModalData.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
