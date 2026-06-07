import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Camera, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useParams } from 'react-router-dom';

// Cliente público (anon) — sem service_role key no frontend
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LIMITES_PLANO: Record<string, { perfil: number; galeria: number }> = {
  basico:     { perfil: 1, galeria: 5  },
  premium:    { perfil: 1, galeria: 10 },
  enterprise: { perfil: 1, galeria: 15 },
};

interface MemorialData {
  id: string;
  nome_homenageado: string;
  data_nascimento?: string;
  data_falecimento?: string;
  foto_url?: string;
  plano_geracao?: string;
  organization_id?: string;
}

interface FotoGaleria {
  id: string;
  url: string;
  ordem: number;
}

export default function PublicFotoLink() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memorial, setMemorial] = useState<MemorialData | null>(null);
  const [fotosGaleria, setFotosGaleria] = useState<FotoGaleria[]>([]);
  const [invite, setInvite] = useState<any>(null);

  const [uploadingPerfil, setUploadingPerfil] = useState(false);
  const [uploadingGaleria, setUploadingGaleria] = useState(false);
  const [avisoGaleria, setAvisoGaleria] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const perfilInputRef = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);

  // Carrega os dados do link ao montar
  useEffect(() => {
    if (!token) return;
    carregarDados();
  }, [token]);

  const carregarDados = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/fotos/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Link inválido ou expirado.');
        return;
      }

      setMemorial(data.memorial);
      setFotosGaleria(data.fotosGaleria || []);
      setInvite(data.invite);
    } catch {
      setError('Não foi possível carregar os dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const plano = (memorial?.plano_geracao || 'basico') as 'basico' | 'premium' | 'enterprise';
  const limites = LIMITES_PLANO[plano] || LIMITES_PLANO.basico;
  const vagasGaleria = limites.galeria - fotosGaleria.length;

  const formatarAno = (data?: string) => {
    if (!data) return '?';
    return new Date(data).getFullYear();
  };

  // Upload de foto de perfil
  const handlePerfilChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !memorial) return;

    setUploadingPerfil(true);
    setSuccessMsg(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `fotos_principal/${memorial.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('memoriais')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('memoriais').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Registra no backend
      const res = await fetch(`/api/public/fotos/${token}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'perfil', url: publicUrl }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao salvar foto de perfil');
      }

      // Notifica a funerária
      await fetch(`/api/public/fotos/${token}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      });

      setMemorial(prev => prev ? { ...prev, foto_url: publicUrl } : prev);
      setSuccessMsg('Foto de perfil enviada com sucesso! ✓');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar a foto de perfil.');
    } finally {
      setUploadingPerfil(false);
      if (perfilInputRef.current) perfilInputRef.current.value = '';
    }
  };

  // Upload de fotos da galeria
  const handleGaleriaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!memorial || vagasGaleria <= 0) return;

    let arquivos = Array.from(e.target.files || []);
    if (arquivos.length === 0) return;

    setAvisoGaleria(null);
    setSuccessMsg(null);

    // Fatiamento se exceder o limite
    if (arquivos.length > vagasGaleria) {
      const ignorados = arquivos.length - vagasGaleria;
      arquivos = arquivos.slice(0, vagasGaleria);
      setAvisoGaleria(
        `Você selecionou ${arquivos.length + ignorados} fotos, mas seu plano permite mais ${vagasGaleria}. As primeiras ${vagasGaleria} foram aceitas — as demais foram ignoradas.`
      );
    }

    setUploadingGaleria(true);
    try {
      const novasUrls: string[] = [];

      for (const file of arquivos) {
        const ext = file.name.split('.').pop();
        const rand = Math.random().toString(36).substring(2, 8);
        const path = `galeria/${memorial.id}/${Date.now()}_${rand}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('memoriais')
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('memoriais').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        // Registra no backend
        const res = await fetch(`/api/public/fotos/${token}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'galeria', url: publicUrl }),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Limite do plano atingido');
        }

        novasUrls.push(publicUrl);
      }

      // Notifica a funerária
      await fetch(`/api/public/fotos/${token}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: novasUrls.length }),
      });

      // Atualiza lista local
      setFotosGaleria(prev => [
        ...prev,
        ...novasUrls.map((url, i) => ({ id: `new-${i}`, url, ordem: prev.length + i + 1 }))
      ]);

      setSuccessMsg(`${novasUrls.length} foto(s) enviada(s) com sucesso! ✓`);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar fotos da galeria.');
    } finally {
      setUploadingGaleria(false);
      if (galeriaInputRef.current) galeriaInputRef.current.value = '';
    }
  };

  // ─── TELA DE CARREGAMENTO ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-4">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap');`}</style>
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p style={{ fontFamily: 'Inter, sans-serif' }} className="text-stone-500 text-sm">Carregando...</p>
      </div>
    );
  }

  // ─── TELA DE ERRO ───
  if (error && !memorial) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-4 p-6">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap');`}</style>
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-stone-400" />
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif' }} className="text-xl font-semibold text-stone-800 text-center">Link Indisponível</h1>
        <p style={{ fontFamily: 'Inter, sans-serif' }} className="text-stone-500 text-sm text-center max-w-xs">{error}</p>
      </div>
    );
  }

  const vagasRestantes = vagasGaleria;
  const galeriaAtingida = vagasRestantes <= 0;

  // ─── TELA PRINCIPAL ───
  return (
    <div className="min-h-screen bg-[#FDFBF7]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');`}</style>

      {/* Cabeçalho afetivo */}
      <div className="pt-10 pb-6 px-6 text-center border-b border-stone-100">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-3">Eco de Memórias</p>
        <p style={{ fontFamily: 'Inter, sans-serif' }} className="text-sm text-stone-500 mb-1">Fotos de</p>
        <h1 style={{ fontFamily: 'Playfair Display, serif' }} className="text-3xl font-semibold text-stone-800 leading-tight">
          {memorial?.nome_homenageado}
        </h1>
        <p className="text-stone-400 text-sm mt-2">
          ★ {formatarAno(memorial?.data_nascimento)} &nbsp;†&nbsp; {formatarAno(memorial?.data_falecimento)}
        </p>
      </div>

      {/* Conteúdo */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Mensagens de feedback */}
        {successMsg && (
          <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 text-sm">
            <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {avisoGaleria && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
            ⚠️ {avisoGaleria}
          </div>
        )}

        {/* Card: Foto de Perfil */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-100/50">
          <h2 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-600" />
            Foto de Perfil
          </h2>

          {memorial?.foto_url ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-stone-100 shadow-sm">
                <img src={memorial.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-stone-400 text-center">Foto enviada ✓ — Você pode substituí-la a qualquer momento</p>
              <label className="cursor-pointer text-xs font-medium text-teal-700 hover:text-teal-800 underline underline-offset-2 transition-colors">
                Substituir foto
                <input ref={perfilInputRef} type="file" accept="image/*" className="hidden" onChange={handlePerfilChange} disabled={uploadingPerfil} />
              </label>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <div className={`border-2 border-dashed border-stone-300 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-stone-50 hover:bg-stone-100 transition-colors ${uploadingPerfil ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingPerfil ? (
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                ) : (
                  <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
                    <Plus className="w-6 h-6 text-teal-600" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-stone-700">{uploadingPerfil ? 'Enviando...' : 'Adicionar foto principal'}</p>
                  <p className="text-xs text-stone-400 mt-1">Toque para selecionar do seu celular</p>
                </div>
              </div>
              <input ref={perfilInputRef} type="file" accept="image/*" className="hidden" onChange={handlePerfilChange} disabled={uploadingPerfil} />
            </label>
          )}
        </div>

        {/* Card: Galeria */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-stone-100/50">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-teal-600" />
              Galeria de Fotos
            </h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-stone-500">
              Plano {plano.charAt(0).toUpperCase() + plano.slice(1)} — até {limites.galeria} fotos
            </p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${galeriaAtingida ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
              {fotosGaleria.length} enviadas · {galeriaAtingida ? 'limite atingido' : `${vagasRestantes} disponíveis`}
            </span>
          </div>

          {/* Grid de fotos */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {fotosGaleria.map((foto) => (
              <div key={foto.id} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                <img src={foto.url} alt={`Foto ${foto.ordem}`} className="w-full h-full object-cover" />
              </div>
            ))}

            {/* Slots vazios até o limite */}
            {!galeriaAtingida && Array.from({ length: Math.min(vagasRestantes, 3 - (fotosGaleria.length % 3 || 3)) }).map((_, i) => (
              <div key={`slot-${i}`} className="aspect-square rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 flex items-center justify-center">
                <Plus className="w-5 h-5 text-stone-300" />
              </div>
            ))}
          </div>

          {/* Botão de adicionar fotos */}
          {galeriaAtingida ? (
            <div className="text-center py-3 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-500">
              Limite de fotos atingido para o seu plano.
            </div>
          ) : (
            <label className={`cursor-pointer block ${uploadingGaleria ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors font-medium text-sm shadow-sm active:scale-95">
                {uploadingGaleria ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Enviando fotos...</>
                ) : (
                  <><Camera className="w-4 h-4" />Adicionar mais fotos</>
                )}
              </div>
              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGaleriaChange}
                disabled={uploadingGaleria || galeriaAtingida}
              />
            </label>
          )}
        </div>

        {/* Rodapé */}
        <div className="text-center pb-8">
          <p className="text-xs text-stone-400 leading-relaxed">
            Suas fotos serão recebidas pelo agente funerário responsável.<br />
            Este link expira em 30 dias.
          </p>
        </div>
      </div>
    </div>
  );
}
