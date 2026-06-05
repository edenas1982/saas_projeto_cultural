import { useState, useRef, useEffect } from 'react';
import {
  X,
  Link as LinkIcon,
  User,
  Phone,
  Calendar,
  UploadCloud,
  Image as ImageIcon,
  DollarSign,
  Loader2,
  Trash2,
  Images,
  CheckCircle2,
  Copy,
  MessageCircle,
  UserPlus,
  ChevronDown,
  Users,
  Settings2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatName } from '../../lib/utils';
import imageCompression from 'browser-image-compression';
import { SaasFastPlanModal } from './SaasFastPlanModal';

interface NewLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: any) => void;
  memorial?: any;
  initialTab?: 'info' | 'main-photo' | 'gallery';
  onRequestPlanChange?: () => void;
  shareMode?: boolean; // Modo reenvio: só mostra contatos e gera links, sem editar memorial
}

type Tab = 'info' | 'main-photo' | 'gallery';

interface Contato {
  nome: string;
  whatsapp: string;
}

interface GeneratedInvite {
  id: string;
  nome: string;
  whatsapp: string;
  token: string;
  link: string;
  qtd_perguntas: number;
}

const TOTAL_PERGUNTAS = 20;

export function Saas_NewLinkModal({ isOpen, onClose, onGenerate, memorial, initialTab, onRequestPlanChange, shareMode = false }: NewLinkModalProps) {
  const { user, walletBalance, setWalletBalance } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [viewState, setViewState] = useState<'form' | 'success'>('form');
  const [generatedInvites, setGeneratedInvites] = useState<GeneratedInvite[]>([]);
  const [generatedMemorialId, setGeneratedMemorialId] = useState<string | null>(null);

  const [isFastPlanOpen, setIsFastPlanOpen] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const [formData, setFormData] = useState({
    nomeFalecido: '',
    dataNasc: '',
    dataFalec: '',
    valorVenda: '',
    permitirMensagens: true,
    autoAprovarMensagens: true,
    planoGeracao: 'basico'
  });

  const [contatos, setContatos] = useState<Contato[]>([
    { nome: '', whatsapp: '' }
  ]);

  const [mainPhoto, setMainPhoto] = useState<{file: File, preview: string} | null>(null);
  const [gallery, setGallery] = useState<{file: File, preview: string}[]>([]);

  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && memorial) {
      setFormData({
        nomeFalecido: memorial.nome_homenageado || '',
        dataNasc: memorial.data_nascimento || '',
        dataFalec: memorial.data_falecimento || '',
        valorVenda: memorial.valor_venda?.toString() || '',
        permitirMensagens: memorial.permitir_mensagens ?? true,
        autoAprovarMensagens: memorial.auto_aprovar_mensagens ?? true,
        planoGeracao: memorial.plano_geracao || 'basico'
      });
      if (memorial.foto_url) {
        setMainPhoto({ file: null as any, preview: memorial.foto_url });
      } else {
        setMainPhoto(null);
      }
      setContatos([{ nome: memorial.nome_responsavel || '', whatsapp: memorial.whatsapp_responsavel || '' }]);

      const fetchGaleria = async () => {
        const { data } = await supabase.from('midias').select('*').eq('memorial_id', memorial.id).eq('tipo_midia', 'foto').order('ordem', { ascending: true });
        if (data) {
          setGallery(data.map((m: any) => ({ file: null as any, preview: m.url, id: m.id })));
        }
      };
      fetchGaleria();

      const fetchExistingInvites = async () => {
        if (shareMode) {
          setIsLoadingInvites(true);
        }
        try {
          const { data } = await supabase
            .from('question_invites')
            .select('*')
            .eq('memorial_id', memorial.id)
            .in('status', ['pendente', 'enviado', 'acessado', 'concluido']);
          
          if (data && data.length > 0) {
            // Deduplica os convites pelo WhatsApp (destinatario_tel), priorizando o mais recente
            const sortedData = [...data].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            const uniqueInvitesMap = new Map<string, any>();
            
            for (const inv of sortedData) {
              const telNormalized = (inv.destinatario_tel || '').trim();
              if (telNormalized && !uniqueInvitesMap.has(telNormalized)) {
                uniqueInvitesMap.set(telNormalized, inv);
              } else if (!telNormalized) {
                // Caso não tenha tel (fallback para nome para evitar colisões vazias)
                const nomeKey = `name-${(inv.destinatario_nome || '').trim()}`;
                if (!uniqueInvitesMap.has(nomeKey)) {
                  uniqueInvitesMap.set(nomeKey, inv);
                }
              }
            }
            
            const uniqueInvites = Array.from(uniqueInvitesMap.values());
            
            const invitesList: GeneratedInvite[] = uniqueInvites.map((inv: any) => ({
              id: inv.id,
              nome: inv.destinatario_nome,
              whatsapp: inv.destinatario_tel,
              token: inv.token,
              link: `${window.location.origin}/invite/${inv.token}`,
              qtd_perguntas: inv.perguntas_ids?.length || 0
            }));
            
            setGeneratedInvites(invitesList);
            setGeneratedMemorialId(memorial.id);

            // Sincroniza a lista de contatos do formulário com os contatos reais dos convites existentes
            const existingContatos = uniqueInvites.map((inv: any) => ({
              nome: inv.destinatario_nome || '',
              whatsapp: inv.destinatario_tel || ''
            }));
            setContatos(existingContatos);
            
            if (shareMode) {
              setViewState('success');
              return;
            }
          }
          setViewState('form');
        } catch (err) {
          console.error('Erro ao buscar convites existentes:', err);
          setViewState('form');
        } finally {
          setIsLoadingInvites(false);
        }
      };
      fetchExistingInvites();
      
      setActiveTab(initialTab || 'info');
    } else if (isOpen) {
      setFormData({ nomeFalecido: '', dataNasc: '', dataFalec: '', valorVenda: '', permitirMensagens: true, autoAprovarMensagens: true, planoGeracao: 'basico' });
      setContatos([{ nome: '', whatsapp: '' }]);
      setMainPhoto(null);
      setGallery([]);
      setViewState('form');
      setGeneratedInvites([]);
      setGeneratedMemorialId(null);
      setShowAdvanced(false);
      setIsLoadingInvites(false);
      setActiveTab(initialTab || 'info');
    }
  }, [isOpen, memorial, initialTab, shareMode]);

  if (!isOpen) return null;

  const getQtdPerguntasParaContato = (index: number): number => {
    const n = contatos.length;
    const base = Math.floor(TOTAL_PERGUNTAS / n);
    const remainder = TOTAL_PERGUNTAS % n;
    return base + (index < remainder ? 1 : 0);
  };

  const handleContatoChange = (index: number, field: keyof Contato, value: string) => {
    const newContatos = [...contatos];
    newContatos[index][field] = value;
    setContatos(newContatos);
  };

  const adcionarContato = () => {
    if (contatos.length < 4) {
      setContatos([...contatos, { nome: '', whatsapp: '' }]);
    }
  };

  const removerContato = (index: number) => {
    if (contatos.length > 1) {
      const newContatos = contatos.filter((_, i) => i !== index);
      setContatos(newContatos);
    }
  };

  const handleMainPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setMainPhoto({ file, preview });
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newImages = files.slice(0, 10 - gallery.length).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setGallery([...gallery, ...newImages]);
    }
  };

  const removeGalleryImage = async (index: number) => {
    const item = gallery[index];
    if ((item as any).id) {
      await supabase.from('midias').delete().eq('id', (item as any).id);
    }
    const newGallery = [...gallery];
    URL.revokeObjectURL(newGallery[index].preview);
    newGallery.splice(index, 1);
    setGallery(newGallery);
  };

  const updateMemorialStatusAguardando = async () => {
    if (generatedMemorialId) {
      try {
        await supabase
          .from('memoriais')
          .update({ status_memorial: 'aguardando' })
          .eq('id', generatedMemorialId);

        onGenerate({ id: generatedMemorialId });
      } catch (err) {
        console.error('Erro ao atualizar status:', err);
      }
    }
  };

  const copyToClipboard = async (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    await updateMemorialStatusAguardando();
  };

  const sendWhatsApp = async (nome: string, whatsapp: string, link: string) => {
    const text = encodeURIComponent(`Olá ${nome}, estou criando o memorial de ${formatName(formData.nomeFalecido)} e dividimos as perguntas sobre a vida dele(a) com a família. Por favor, acesse seu link seguro para responder à sua parte: ${link}`);
    window.open(`https://wa.me/${whatsapp.replace(/\D/g,'')}?text=${text}`, '_blank');
    await updateMemorialStatusAguardando();
  };

  const sendAllWhatsApp = async () => {
    for (let i = 0; i < generatedInvites.length; i++) {
      const invite = generatedInvites[i];
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 600));
      const text = encodeURIComponent(`Olá ${invite.nome}, estou criando o memorial de ${formatName(formData.nomeFalecido)} e dividimos as perguntas sobre a vida dele(a) com a família. Por favor, acesse seu link seguro para responder à sua parte: ${invite.link}`);
      window.open(`https://wa.me/${invite.whatsapp.replace(/\D/g,'')}?text=${text}`, '_blank');
    }
    await updateMemorialStatusAguardando();
  };

  const handleCloseAndReset = () => {
    if (shareMode && onGenerate) onGenerate({});
    setViewState('form');
    setActiveTab('info');
    setShowAdvanced(false);
    setFormData({ nomeFalecido: '', dataNasc: '', dataFalec: '', valorVenda: '', permitirMensagens: true, autoAprovarMensagens: true, planoGeracao: 'basico' });
    setContatos([{ nome: '', whatsapp: '' }]);
    setMainPhoto(null);
    setGallery([]);
    setGeneratedInvites([]);
    setGeneratedMemorialId(null);
    onClose();
  };

  const uploadFile = async (file: File, path: string) => {
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/') && !file.type.includes('gif')) {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true, alwaysKeepResolution: true };
          fileToUpload = await imageCompression(file, options);
        } catch (compressionErr) {
          console.warn('Compression failed, falling back to original file', compressionErr);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('memoriais')
        .upload(path, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('memoriais').getPublicUrl(path);
      return publicUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  };

  const handleSubmitShareMode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !memorial) return;

    const validContatos = contatos.filter(c => c.nome.trim() !== '' && c.whatsapp.trim() !== '');
    if (validContatos.length === 0) {
      setErrorMsg('Preencha os dados de ao menos um Familiar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Deletar convites antigos ativos antes de gerar novos para limpar e recalcular o rateio
      await supabase
        .from('question_invites')
        .delete()
        .eq('memorial_id', memorial.id)
        .in('status', ['pendente', 'enviado', 'acessado']);

      // 1. Buscar todas as perguntas ordenadas
      const { data: allQuestions } = await supabase.from('perguntas').select('id').order('ordem');
      
      // 2. Buscar perguntas já respondidas para este memorial
      const { data: respostasRealizadas } = await supabase
        .from('respostas')
        .select('pergunta_id')
        .eq('memorial_id', memorial.id);
      const respondidasIds = respostasRealizadas ? respostasRealizadas.map((r: any) => r.pergunta_id) : [];

      // 3. Buscar perguntas já atribuídas em convites pendentes/enviados/acessados
      const { data: convitesAtivos } = await supabase
        .from('question_invites')
        .select('perguntas_ids')
        .eq('memorial_id', memorial.id)
        .in('status', ['pendente', 'enviado', 'acessado']);
        
      let atribuidasIds: string[] = [];
      if (convitesAtivos) {
        convitesAtivos.forEach((c: any) => {
          if (c.perguntas_ids && Array.isArray(c.perguntas_ids)) {
            atribuidasIds.push(...c.perguntas_ids);
          }
        });
      }

      // 4. Rateio Inteligente: filtrar apenas perguntas "ativas"
      let activeQuestions = (allQuestions || []).filter(q => !respondidasIds.includes(q.id) && !atribuidasIds.includes(q.id));

      // Fallback 1: se não houver perguntas livres (não atribuídas), usar as que apenas não foram respondidas
      if (activeQuestions.length === 0) {
        activeQuestions = (allQuestions || []).filter(q => !respondidasIds.includes(q.id));
      }

      // Fallback 2: se todas estiverem respondidas, usar todas do banco
      if (activeQuestions.length === 0) {
        activeQuestions = allQuestions || [];
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const newGeneratedInvites: GeneratedInvite[] = [];

      if (activeQuestions.length > 0 && token) {
        const total = activeQuestions.length;
        const numPeople = validContatos.length;
        const base = Math.floor(total / numPeople);
        const remainder = total % numPeople;
        let start = 0;

        for (let i = 0; i < numPeople; i++) {
          const countForThis = base + (i < remainder ? 1 : 0);
          const assignedIds = activeQuestions.slice(start, start + countForThis).map(q => q.id);
          start += countForThis;

          if (assignedIds.length > 0) {
            const res = await fetch('/api/invites/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                memorial_id: memorial.id,
                destinatario_nome: validContatos[i].nome,
                destinatario_tel: validContatos[i].whatsapp,
                perguntas_ids: assignedIds
              })
            });
            const json = await res.json();
            if (res.ok && json.invite) {
              newGeneratedInvites.push({
                id: json.invite.id,
                nome: validContatos[i].nome,
                whatsapp: validContatos[i].whatsapp,
                token: json.invite.token,
                link: `${window.location.origin}/invite/${json.invite.token}`,
                qtd_perguntas: countForThis
              });
            }
          }
        }
      }

      await supabase.from('memoriais').update({ status_memorial: 'aguardando' }).eq('id', memorial.id);
      setGeneratedMemorialId(memorial.id);
      setGeneratedInvites(newGeneratedInvites);
      setViewState('success');
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao gerar links. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validContatos = contatos.filter(c => c.nome.trim() !== '' && c.whatsapp.trim() !== '');
    if (validContatos.length === 0) {
      setErrorMsg('Preencha os dados de ao menos um Familiar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const nomeFormatado = formatName(formData.nomeFalecido);
      let newFotoUrl = memorial?.foto_url || '';

      if (mainPhoto?.file) {
        if (memorial?.foto_url) {
          const oldPath = memorial.foto_url.split('/memoriais/')[1];
          if (oldPath) {
            await supabase.storage.from('memoriais').remove([oldPath]);
          }
        }

        const fileExt = mainPhoto.file.name.split('.').pop();
        const filePath = `fotos_principal/${user.id}/${Date.now()}.${fileExt}`;
        newFotoUrl = await uploadFile(mainPhoto.file, filePath);
      }

      let memorialData;

      if (memorial) {
        const isPlanChanged = formData.planoGeracao !== memorial.plano_geracao;
        const updateData: any = {
          nome_homenageado: nomeFormatado,
          data_nascimento: formData.dataNasc || null,
          data_falecimento: formData.dataFalec || null,
          foto_url: newFotoUrl || null,
          permitir_mensagens: formData.permitirMensagens,
          auto_aprovar_mensagens: formData.autoAprovarMensagens,
          nome_responsavel: validContatos[0].nome,
          whatsapp_responsavel: validContatos[0].whatsapp,
          valor_venda: formData.valorVenda ? parseFloat(formData.valorVenda) : null
        };

        if (!isPlanChanged) {
          updateData.plano_geracao = formData.planoGeracao;
        }

        const { data, error: updateError } = await supabase
          .from('memoriais')
          .update(updateData)
          .eq('id', memorial.id)
          .select()
          .single();
        if (updateError) throw updateError;
        memorialData = data;

        if (isPlanChanged) {
          const { data: authData } = await supabase.auth.getSession();
          const session = authData.session;
          const changeRes = await fetch('/api/memorial/change-plan', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
             },
             body: JSON.stringify({ memorial_id: memorial.id, new_plan: formData.planoGeracao })
          });
          const changeResult = await changeRes.json();
          if (!changeRes.ok) {
             throw new Error(changeResult.error || 'Erro ao alterar plano. Edições básicas foram salvas.');
          }
        }
      } else {
        const { data: authData } = await supabase.auth.getSession();
        const session = authData.session;

        const createRes = await fetch('/api/memorial/create', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
           },
           body: JSON.stringify({
             nome_homenageado: nomeFormatado,
             data_nascimento: formData.dataNasc || null,
             data_falecimento: formData.dataFalec || null,
             foto_url: newFotoUrl || null,
             permitir_mensagens: formData.permitirMensagens,
             auto_aprovar_mensagens: formData.autoAprovarMensagens,
             origem_sistema: 'saas',
             nome_responsavel: validContatos[0].nome,
             whatsapp_responsavel: validContatos[0].whatsapp,
             valor_venda: formData.valorVenda ? parseFloat(formData.valorVenda) : null,
             plano_geracao: formData.planoGeracao
           })
        });
        const createResult = await createRes.json();
        if (!createRes.ok) {
           throw new Error(createResult.error || 'Erro ao criar memorial. Verifique o saldo e tente novamente.');
        }

        memorialData = createResult.memorial;
        if (createResult.new_wallet_balance !== undefined) {
          setWalletBalance(createResult.new_wallet_balance);
        }
      }

      setGeneratedMemorialId(memorialData.id);

      if (gallery.length > 0 && memorialData.id) {
        for (let i = 0; i < gallery.length; i++) {
          const fileObj = gallery[i];
          if (fileObj.file) {
            const fileExt = fileObj.file.name.split('.').pop();
            const filePath = `galeria/${memorialData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const publicUrl = await uploadFile(fileObj.file, filePath);

            await supabase.from('midias').insert({
              memorial_id: memorialData.id,
              tipo_midia: 'foto',
              url: publicUrl,
              descricao: '',
              ordem: i + 1,
              aprovado: true
            });
          }
        }
      }

      if (memorial) {
        onGenerate(memorialData);
        handleCloseAndReset();
        return;
      }

      const { data: allQuestions } = await supabase.from('perguntas').select('id').order('ordem');

      const newGeneratedInvites: GeneratedInvite[] = [];
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (allQuestions && allQuestions.length > 0 && token) {
         const total = allQuestions.length;
         const numPeople = validContatos.length;
         const base = Math.floor(total / numPeople);
         const remainder = total % numPeople;

         let start = 0;
         for (let i = 0; i < numPeople; i++) {
           const countForThis = base + (i < remainder ? 1 : 0);
           const assignedIds = allQuestions.slice(start, start + countForThis).map(q => q.id);
           start += countForThis;

           if (assignedIds.length > 0) {
              const res = await fetch('/api/invites/create', {
                 method: 'POST',
                 headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                 },
                 body: JSON.stringify({
                    memorial_id: memorialData.id,
                    destinatario_nome: validContatos[i].nome,
                    destinatario_tel: validContatos[i].whatsapp,
                    perguntas_ids: assignedIds
                 })
              });
              const json = await res.json();
              if (res.ok && json.invite) {
                 newGeneratedInvites.push({
                    id: json.invite.id,
                    nome: validContatos[i].nome,
                    whatsapp: validContatos[i].whatsapp,
                    token: json.invite.token,
                    link: `${window.location.origin}/invite/${json.invite.token}`,
                    qtd_perguntas: countForThis
                 });
              }
           }
         }
      }

      setGeneratedInvites(newGeneratedInvites);
      setGeneratedMemorialId(memorialData.id);

      if (onGenerate) {
         onGenerate({ linkGerado: null });
      }

      setViewState('success');
    } catch (error: any) {
      console.error("Erro ao gerar memorial:", error);
      setErrorMsg(error.message || 'Erro ao gerar memorial. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <LinkIcon className="w-4 h-4 text-indigo-600" />
            </div>
            {shareMode ? 'Enviar Link de Entrevista' : memorial ? 'Editar Memorial' : 'Novo Memorial'}
          </h2>
          <button
            onClick={handleCloseAndReset}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CARREGAMENTO OU VIEW DE SUCESSO/FORM */}
        {isLoadingInvites ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Carregando convites existentes...</p>
          </div>
        ) : viewState === 'success' ? (
          <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {shareMode ? 'Links de entrevista prontos' : 'Memorial criado com sucesso'}
                </h3>
                <p className="text-xs text-slate-500">
                  {shareMode ? 'Envie os links abaixo para os contatos familiares responderem' : 'Envie os links abaixo para cada familiar responder'}
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {generatedInvites.map((invite, idx) => (
                <div key={invite.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                        {invite.nome.trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{invite.nome}</p>
                        <p className="text-xs text-slate-400">{invite.whatsapp}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {invite.qtd_perguntas} perguntas
                    </span>
                  </div>

                  <div className="px-4 py-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(invite.id, invite.link)}
                      className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-all py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      {copiedId === invite.id
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Copiado!</>
                        : <><Copy className="w-3.5 h-3.5" /> Copiar link</>
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => sendWhatsApp(invite.nome, invite.whatsapp, invite.link)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enviar WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              {shareMode && (
                <button
                  type="button"
                  onClick={() => setViewState('form')}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  Editar Contatos / Reenviar
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseAndReset}
                className={`text-white text-sm font-semibold py-3 rounded-xl transition-colors ${
                  shareMode ? 'flex-1 bg-slate-900 hover:bg-slate-800' : 'w-full bg-slate-900 hover:bg-slate-800'
                }`}
              >
                Concluir
              </button>
            </div>
          </div>

        ) : shareMode ? (
          /* SHARE MODE — só contatos e geração de links */
          <form onSubmit={handleSubmitShareMode} className="p-6 space-y-5">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-700">{memorial?.nome_homenageado}</p>
                <p className="text-xs text-indigo-500">As perguntas serão divididas entre os familiares abaixo</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Quem responde as perguntas</p>
                {contatos.length > 1 && (
                  <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {TOTAL_PERGUNTAS} perguntas divididas
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {contatos.map((contato, index) => (
                  <div key={index} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-indigo-600 tracking-wide uppercase">
                        {index === 0 ? 'Responsável principal' : `Familiar ${index + 1}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {getQtdPerguntasParaContato(index)} perguntas
                        </span>
                        {index > 0 && (
                          <button type="button" onClick={() => removerContato(index)}
                            className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <input type="text" required placeholder={index === 0 ? 'Nome do familiar' : 'Nome'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none bg-white"
                        value={contato.nome} onChange={(e) => handleContatoChange(index, 'nome', e.target.value)} />
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input type="tel" required placeholder="WhatsApp"
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none bg-white"
                          value={contato.whatsapp} onChange={(e) => handleContatoChange(index, 'whatsapp', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {contatos.length < 4 && (
                <button type="button" onClick={adcionarContato}
                  className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  Adicionar familiar
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
              {errorMsg && (
                <p className="text-xs text-rose-500 font-medium text-center bg-rose-50 rounded-lg py-2 px-3">{errorMsg}</p>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={handleCloseAndReset} disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[180px]">
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando links...</>
                    : <><LinkIcon className="w-4 h-4" /> Gerar e enviar links</>
                  }
                </button>
              </div>
            </div>
          </form>

        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 bg-slate-50">
              {([
                { key: 'info', label: 'Informações' },
                { key: 'main-photo', label: 'Foto Principal', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                { key: 'gallery', label: 'Galeria', icon: <Images className="w-3.5 h-3.5" /> },
              ] as { key: Tab; label: string; icon?: React.ReactNode }[]).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* TAB: INFORMAÇÕES */}
              {activeTab === 'info' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-2">

                  {/* Bloco 1 — Homenageado */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Homenageado</p>

                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Nome completo"
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-slate-50 focus:bg-white"
                        value={formData.nomeFalecido}
                        onChange={(e) => setFormData({...formData, nomeFalecido: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="date"
                          className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-slate-50 focus:bg-white"
                          value={formData.dataNasc}
                          onChange={(e) => setFormData({...formData, dataNasc: e.target.value})}
                        />
                        <span className="absolute -top-2 left-2.5 text-[9px] font-semibold text-slate-400 bg-white px-1">NASCIMENTO</span>
                      </div>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="date"
                          className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-slate-50 focus:bg-white"
                          value={formData.dataFalec}
                          onChange={(e) => setFormData({...formData, dataFalec: e.target.value})}
                        />
                        <span className="absolute -top-2 left-2.5 text-[9px] font-semibold text-slate-400 bg-white px-1">FALECIMENTO</span>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow appearance-none bg-slate-50 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                          value={formData.planoGeracao}
                          disabled={!!memorial}
                          onChange={(e) => setFormData({...formData, planoGeracao: e.target.value})}
                        >
                          <option value="basico">Plano Básico</option>
                          <option value="premium">Plano Premium</option>
                          <option value="enterprise">Plano Enterprise</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                        <span className="absolute -top-2 left-2.5 text-[9px] font-semibold text-slate-400 bg-white px-1">PLANO</span>
                      </div>
                      {!!memorial && (
                        <button
                          type="button"
                          onClick={() => setIsFastPlanOpen(true)}
                          className="px-3 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors whitespace-nowrap"
                        >
                          Trocar Plano
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bloco 2 — Familiares (só na criação) */}
                  {!memorial && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Quem responde as perguntas</p>
                        </div>
                        {contatos.length > 1 && (
                          <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {TOTAL_PERGUNTAS} perguntas divididas
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {contatos.map((contato, index) => (
                          <div
                            key={index}
                            className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
                          >
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                              <span className="text-[10px] font-bold text-indigo-600 tracking-wide uppercase">
                                {index === 0 ? 'Responsável principal' : `Familiar ${index + 1}`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                  {getQtdPerguntasParaContato(index)} perguntas
                                </span>
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => removerContato(index)}
                                    className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 p-3">
                              <input
                                type="text"
                                required={!memorial}
                                placeholder={index === 0 ? 'Nome do familiar' : 'Nome'}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-white"
                                value={contato.nome}
                                onChange={(e) => handleContatoChange(index, 'nome', e.target.value)}
                              />
                              <div className="relative">
                                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                <input
                                  type="tel"
                                  required={!memorial}
                                  placeholder="WhatsApp"
                                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-white"
                                  value={contato.whatsapp}
                                  onChange={(e) => handleContatoChange(index, 'whatsapp', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {contatos.length < 4 && (
                        <button
                          type="button"
                          onClick={adcionarContato}
                          className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Adicionar familiar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Bloco 3 — Configurações avançadas (colapsável) */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-slate-500">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Configurações avançadas</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                    </button>

                    {showAdvanced && (
                      <div className="px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-slate-100">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permitirMensagens}
                            onChange={(e) => setFormData({...formData, permitirMensagens: e.target.checked})}
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0"
                          />
                          <div>
                            <span className="text-sm font-semibold text-slate-700">Permitir mensagens de visitantes</span>
                            <p className="text-xs text-slate-400 mt-0.5">Exibe a seção de condolências na página pública.</p>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 cursor-pointer ${!formData.permitirMensagens ? 'opacity-40 pointer-events-none' : ''}`}>
                          <input
                            type="checkbox"
                            checked={formData.autoAprovarMensagens}
                            onChange={(e) => setFormData({...formData, autoAprovarMensagens: e.target.checked})}
                            disabled={!formData.permitirMensagens}
                            className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0"
                          />
                          <div>
                            <span className="text-sm font-semibold text-slate-700">Liberar mensagens automaticamente</span>
                            <p className="text-xs text-slate-400 mt-0.5">Se desativado, mensagens passam por moderação.</p>
                          </div>
                        </label>

                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Valor da venda (seu controle interno)</label>
                          <div className="relative">
                            <DollarSign className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0,00"
                              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow bg-slate-50 focus:bg-white font-medium"
                              value={formData.valorVenda}
                              onChange={(e) => setFormData({...formData, valorVenda: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: FOTO PRINCIPAL */}
              {activeTab === 'main-photo' && (
                <div className="min-h-[250px] flex flex-col justify-center items-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors animate-in fade-in">
                  <input
                    type="file"
                    ref={mainPhotoRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleMainPhotoChange}
                  />
                  {mainPhoto ? (
                    <div className="relative group">
                      <img src={mainPhoto.preview} alt="Foto Principal" className="w-36 h-36 object-cover rounded-full shadow-lg border-4 border-white" />
                      <button
                        type="button"
                        onClick={() => setMainPhoto(null)}
                        className="absolute -top-1 -right-1 bg-rose-500 text-white p-1.5 rounded-full shadow hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm text-indigo-400">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">Foto do homenageado</p>
                      <p className="text-xs text-slate-400 mb-4 max-w-[220px] mx-auto">Opcional. O familiar também pode enviar pelo link.</p>
                      <button
                        type="button"
                        onClick={() => mainPhotoRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Selecionar imagem
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: GALERIA */}
              {activeTab === 'gallery' && (
                <div className="min-h-[250px] animate-in fade-in">
                  <input
                    type="file"
                    ref={galleryRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryChange}
                  />
                  {gallery.length === 0 ? (
                    <div className="h-full min-h-[250px] flex flex-col justify-center items-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors">
                      <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm text-indigo-400">
                        <Images className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">Galeria de memórias</p>
                      <p className="text-xs text-slate-400 mb-4 max-w-[220px] mx-auto text-center">Até 10 fotos. A família também pode enviar as delas.</p>
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Selecionar imagens
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">{gallery.length}/10 fotos</span>
                        {gallery.length < 10 && (
                          <button
                            type="button"
                            onClick={() => galleryRef.current?.click()}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            Adicionar mais
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {gallery.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square">
                            <img src={img.preview} alt={`Galeria ${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-slate-200" />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(idx)}
                              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-1 rounded-full shadow hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                {errorMsg && (
                  <p className="text-xs text-rose-500 font-medium text-center bg-rose-50 rounded-lg py-2 px-3">
                    {errorMsg}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseAndReset}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-w-[200px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        {memorial ? 'Salvar alterações' : 'Gerar memorial'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>

      {memorial && (
        <SaasFastPlanModal
          isOpen={isFastPlanOpen}
          onClose={() => setIsFastPlanOpen(false)}
          memorialId={memorial.id}
          currentPlan={memorial.plano_geracao || 'basico'}
          editsUsed={memorial.edits_used || 0}
          walletBalance={walletBalance}
          hasBio={!!(memorial.narrativas && memorial.narrativas.length > 0 && memorial.narrativas[0].conteudo_completo)}
          suppressNavigation={true}
          onPlanChanged={(newPlan, newBalance) => {
            setFormData({...formData, planoGeracao: newPlan});
            memorial.plano_geracao = newPlan;
            if (typeof newBalance === 'number') {
              setWalletBalance(newBalance);
            }
          }}
        />
      )}
    </div>
  );
}
