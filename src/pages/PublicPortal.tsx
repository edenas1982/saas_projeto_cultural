import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search } from 'lucide-react';
import { MemorialCard } from '../components/MemorialCard';

interface MemorialPublico {
  id: string;
  nome_homenageado: string;
  data_nascimento?: string;
  data_falecimento?: string;
  foto_url?: string;
  frase_destaque?: string;
}

export default function PublicPortal() {
  const [memoriais, setMemoriais] = useState<MemorialPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchMemoriais(debouncedSearch);
    
    // Set meta tags for SEO
    document.title = 'Ecos de Memória - Portal';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Portal público de memoriais. Encontre e preste homenagens.');
    }
  }, [debouncedSearch]);

  const fetchMemoriais = async (searchTerm: string) => {
    try {
      setLoading(true);
      // Extrai um possível ano da busca para enviar separadamente, 
      // ou envia tudo como search_term e usa o RPC que construimos.
      // Aqui, se o usuário digitar apenas "2023", tentamos passar isso pra function.
      let term = searchTerm.trim();
      let year = '';
      
      const yearMatch = term.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
         year = yearMatch[1];
         // Opcional: remover o ano do term, mas podemos deixar lá.
      }

      // IMPORTANTE: Devemos chamar a function `search_public_memorials` do RPC da Etapa 1
      const { data, error } = await supabase.rpc('search_public_memorials', {
        search_term: term,
        filter_year: year,
        page_limit: 10,
        page_offset: 0
      });

      if (error) {
        // Se a function do RPC não existir (caso o sql ainda não tenha rodado), faremos fallback para o front-end query
        console.warn('RPC não encontrado ou falhou, usando SELECT como fallback.', error);
        fallbackFetch(term);
        return;
      }
      
      setMemoriais(data || []);
    } catch (error) {
      console.error('Erro ao buscar memoriais públicos:', error);
      fallbackFetch(searchTerm);
    } finally {
      setLoading(false);
    }
  };

  // Fallback caso a function RPC ainda não tenha sido criada no Supabase
  const fallbackFetch = async (term: string) => {
    try {
      let query = supabase
        .from('memoriais')
        .select('id, nome_homenageado, data_nascimento, data_falecimento, foto_url, frase_destaque')
        .eq('publico', true)
        .eq('confirmado_pelo_usuario', true)
        .or('origem_sistema.is.null,origem_sistema.eq.projeto_cultural')
        .order('created_at', { ascending: false });

      if (term) {
         // Query com ILIKE não é 100% otimizada sem pg_trgm, mas quebra o galho.
         query = query.or(`nome_homenageado.ilike.%${term}%,data_falecimento.ilike.%${term}%`);
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;
      setMemoriais(data || []);
    } catch (err) {
      console.error('Erro no fallback:', err);
      setMemoriais([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-sans text-[#4A3F35]">
      {/* Header Minimalista */}
      <header className="bg-white border-b border-[#E8E4DB] px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-xs">
        <div className="font-serif text-xl font-bold tracking-tight text-[#2D241E]">
          Ecos de Memória
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-[#2D241E] mb-6 tracking-tight leading-tight">
          Onde o amor <br className="md:hidden" />encontra a permanência
        </h1>
        <p className="text-[#8C8077] text-lg max-w-2xl mx-auto mb-10">
          Encontre e preserve a história daqueles que deixaram saudades. 
          Busque por nome, cidade ou ano.
        </p>
        
        {/* Search Bar */}
        <div className="max-w-xl mx-auto relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8C8077] group-focus-within:text-[#2D241E] transition-colors" />
           <input 
             type="text" 
             value={search}
             onChange={e => setSearch(e.target.value)}
             placeholder="Buscar memoriais..." 
             className="w-full bg-white border border-[#E8E4DB] rounded-full py-4 pl-12 pr-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D0C8B8] focus:border-transparent transition-all placeholder:text-[#B5AAA0] text-[#2D241E]"
           />
        </div>
      </div>

      {/* Results Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl h-[400px] border border-[#E8E4DB]"></div>
            ))}
          </div>
        ) : memoriais.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {memoriais.map(memorial => (
              <MemorialCard key={memorial.id} memorial={memorial} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#E8E4DB]">
             <p className="text-[#8C8077] text-lg font-serif">
               {search ? 'Nenhum memorial encontrado com essa busca.' : 'Nenhum memorial público disponível no momento.'}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
