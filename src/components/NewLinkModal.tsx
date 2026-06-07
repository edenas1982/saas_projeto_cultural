import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Link as LinkIcon, 
  User, 
  Calendar, 
  UploadCloud, 
  Image as ImageIcon,
  Loader2,
  Trash2,
  Images
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatName } from '../lib/utils';
import imageCompression from 'browser-image-compression';

interface NewLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: any) => void;
  memorial?: any;
  initialTab?: 'info' | 'main-photo' | 'gallery';
}

type Tab = 'info' | 'main-photo' | 'gallery';

export function NewLinkModal({ isOpen, onClose, onGenerate, memorial, initialTab }: NewLinkModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [generatedMemorialId, setGeneratedMemorialId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nomeFalecido: '',
    dataNasc: '',
    dataFalec: '',
    permitirMensagens: true,
    autoAprovarMensagens: true
  });
  
  // Upload States
  const [mainPhoto, setMainPhoto] = useState<{file: File, preview: string} | null>(null);
  const [gallery, setGallery] = useState<{file: File, preview: string}[]>([]);

  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && memorial) {
      setFormData({
        nomeFalecido: memorial.nome_homenageado || '',
        dataNasc: memorial.data_nascimento || '',
        dataFalec: memorial.data_falecimento || '',
        permitirMensagens: memorial.permitir_mensagens ?? true,
        autoAprovarMensagens: memorial.auto_aprovar_mensagens ?? true
      });
      if (memorial.foto_url) {
        setMainPhoto({ file: null as any, preview: memorial.foto_url });
      } else {
        setMainPhoto(null);
      }
      
      const fetchGaleria = async () => {
        const { data } = await supabase.from('midias').select('*').eq('memorial_id', memorial.id).eq('tipo_midia', 'foto').order('ordem', { ascending: true });
        if (data) {
          setGallery(data.map((m: any) => ({ file: null as any, preview: m.url, id: m.id })));
        }
      };
      fetchGaleria();
      setActiveTab(initialTab || 'info');
    } else if (isOpen) {
      setFormData({ nomeFalecido: '', dataNasc: '', dataFalec: '', permitirMensagens: true, autoAprovarMensagens: true });
      setMainPhoto(null);
      setGallery([]);
      setActiveTab(initialTab || 'info');
    }
  }, [isOpen, memorial, initialTab]);

  if (!isOpen) return null;

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

  const handleCloseAndReset = () => {
    setActiveTab('info');
    setFormData({ nomeFalecido: '', dataNasc: '', dataFalec: '', permitirMensagens: true, autoAprovarMensagens: true });
    setMainPhoto(null);
    setGallery([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
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
        const { data, error: updateError } = await supabase
          .from('memoriais')
          .update({
            nome_homenageado: nomeFormatado,
            data_nascimento: formData.dataNasc || null,
            data_falecimento: formData.dataFalec || null,
            foto_url: newFotoUrl || null,
            permitir_mensagens: formData.permitirMensagens,
            auto_aprovar_mensagens: formData.autoAprovarMensagens
          })
          .eq('id', memorial.id)
          .select()
          .single();
        if (updateError) throw updateError;
        memorialData = data;
      } else {
        const { data, error: insertError } = await supabase
          .from('memoriais')
          .insert([{
            user_id: user.id,
            nome_homenageado: nomeFormatado,
            data_nascimento: formData.dataNasc || null,
            data_falecimento: formData.dataFalec || null,
            status: 'rascunho',
            foto_url: newFotoUrl || null,
            permitir_mensagens: formData.permitirMensagens,
            auto_aprovar_mensagens: formData.autoAprovarMensagens,
            origem_sistema: 'projeto_cultural'
          }])
          .select()
          .single();
        if (insertError) throw insertError;
        memorialData = data;
      }
      
      setGeneratedMemorialId(memorialData.id);

      // 2. Upload da Galeria
      if (gallery.length > 0 && memorialData.id) {
        const uploadPromises = gallery.map(async (fileObj, i) => {
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
        });
        await Promise.all(uploadPromises);
      }

      onGenerate(memorialData);
      handleCloseAndReset();
      
    } catch (error: any) {
      console.error("Erro ao salvar memorial:", error);
      setErrorMsg(error.message || 'Erro ao salvar memorial. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-indigo-600" />
            {memorial ? 'Editar Memorial' : 'Novo Memorial'}
          </h2>
          <button 
            onClick={handleCloseAndReset}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-6">
              <button 
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Informações
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('main-photo')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'main-photo' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Foto Principal
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('gallery')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'gallery' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Images className="w-4 h-4" />
                Galeria
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* TAB 1: INFO */}
              {activeTab === 'info' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome do Falecido(a) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Ex: João Carlos Gomes"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow"
                        value={formData.nomeFalecido}
                        onChange={(e) => setFormData({...formData, nomeFalecido: e.target.value})}
                      />
                      <User className="w-5 h-5 text-slate-400 absolute left-3 top-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nascimento (Opcional)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow"
                          value={formData.dataNasc}
                          onChange={(e) => setFormData({...formData, dataNasc: e.target.value})}
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Falecimento (Opcional)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-shadow"
                          value={formData.dataFalec}
                          onChange={(e) => setFormData({...formData, dataFalec: e.target.value})}
                        />
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase">Configurações de Mensagens</h4>
                    
                    <div className="space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={formData.permitirMensagens}
                            onChange={(e) => setFormData({...formData, permitirMensagens: e.target.checked})}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-slate-800">
                            Permitir que visitantes deixem mensagens
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Se desativado, a seção de mensagens não será exibida na página do memorial público.
                          </p>
                        </div>
                      </label>

                      <label className={`flex items-start gap-3 cursor-pointer group ${!formData.permitirMensagens ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={formData.autoAprovarMensagens}
                            onChange={(e) => setFormData({...formData, autoAprovarMensagens: e.target.checked})}
                            disabled={!formData.permitirMensagens}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-slate-800">
                            Liberar mensagens automaticamente
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Se desativado, você precisará aprovar as mensagens recebidas através do painel.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MAIN PHOTO */}
              {activeTab === 'main-photo' && (
                <div className="min-h-[250px] flex flex-col justify-center items-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-right-2">
                  <input 
                    type="file" 
                    ref={mainPhotoRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleMainPhotoChange}
                  />
                  
                  {mainPhoto ? (
                    <div className="relative group">
                      <img src={mainPhoto.preview} alt="Foto Principal" className="w-40 h-40 object-cover rounded-full shadow-md border-4 border-white" />
                      <button 
                        type="button"
                        onClick={() => setMainPhoto(null)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-2 rounded-full shadow-sm hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-indigo-500">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-800 mb-1">Capa do Memorial</h3>
                      <p className="text-xs text-slate-500 mb-4 max-w-[250px] mx-auto">
                        Você pode escolher uma foto principal agora, ou enviar o link para o familiar fazer isso depois.
                      </p>
                      <button
                        type="button"
                        onClick={() => mainPhotoRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Selecionar Imagem
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GALLERY */}
              {activeTab === 'gallery' && (
                <div className="min-h-[250px] animate-in fade-in slide-in-from-right-2">
                  <input 
                    type="file" 
                    ref={galleryRef} 
                    className="hidden" 
                    accept="image/*"
                    multiple
                    onChange={handleGalleryChange}
                  />

                  {gallery.length === 0 ? (
                    <div className="h-full min-h-[250px] flex flex-col justify-center items-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm text-indigo-500">
                        <Images className="w-8 h-8" />
                      </div>
                      <h3 className="text-sm font-medium text-slate-800 mb-1">Galeria de Memórias</h3>
                      <p className="text-xs text-slate-500 mb-4 max-w-[250px] mx-auto text-center">
                        Adicione até 10 fotos. A família também poderá enviar suas próprias fotos pelo link.
                      </p>
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Selecionar Imagens
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium">Fotos selecionadas: {gallery.length}/10</span>
                        {gallery.length < 10 && (
                          <button
                            type="button"
                            onClick={() => galleryRef.current?.click()}
                            className="text-sm text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
                          >
                            <UploadCloud className="w-4 h-4" />
                            Adicionar mais
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {gallery.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square">
                            <img src={img.preview} alt={`Galeria ${idx+1}`} className="w-full h-full object-cover rounded-xl shadow-sm border border-slate-200" />
                            <button 
                              type="button"
                              onClick={() => removeGalleryImage(idx)}
                              className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-sm hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                {errorMsg && (
                  <div className="text-rose-500 text-sm font-medium text-center">
                    {errorMsg}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseAndReset}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed min-w-[220px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        {memorial ? 'Salvar Alterações' : 'Salvar Memorial'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
      </div>
    </div>
  );
}
