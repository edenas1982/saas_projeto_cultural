import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function ProjetoCultural() {
  return (
    <div className="min-h-screen bg-[#FDF9F1] flex flex-col font-sans selection:bg-[#B5AAA0] selection:text-white">
      {/* Header Simples */}
      <header className="border-b border-[#E8E4DB] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar ao Início</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Institucional */}
      <main className="flex-1 py-20 pb-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-[#E8E4DB] mb-6 shadow-sm">
              <BookOpen className="w-8 h-8 text-[#8C8077]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-[#111827] font-medium tracking-tight mb-6">
              Apoio Cultural e Institucional
            </h1>
            <p className="text-lg text-[#8C8077] leading-relaxed max-w-2xl mx-auto">
              O projeto Ecos de Memória é uma iniciativa de preservação cultural
              fomentada pela Política Nacional Aldir Blanc de Fomento à Cultura e tem orgulho de 
              contar com o apoio das seguintes entidades públicas.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#E8E4DB] p-10 md:p-16 shadow-sm">
            {/* Logos */}
            <div className="flex flex-col gap-16 items-center justify-center">
              
              {/* Realização Block */}
              <div className="flex flex-col items-center gap-8 w-full border-b border-[#E8E4DB] pb-16">
                <span className="text-xs tracking-[0.2em] uppercase text-[#8C8077] font-bold">Realização</span>
                <div className="flex flex-wrap items-center justify-center gap-12 lg:gap-20">
                  <img 
                    src="/logos/aldir-blank.webp" 
                    alt="Política Nacional Aldir Blanc" 
                    className="h-24 md:h-32 object-contain hover:scale-105 transition-transform duration-300"
                    title="Política Nacional Aldir Blanc"
                  />
                  <img 
                    src="/logos/minc-brasil.webp" 
                    alt="Ministério da Cultura - Governo do Brasil" 
                    className="h-24 md:h-32 object-contain hover:scale-105 transition-transform duration-300"
                    title="Ministério da Cultura - Governo do Brasil"
                  />
                  <img 
                    src="/logos/snc.webp" 
                    alt="Sistema Nacional de Cultura" 
                    className="h-20 md:h-28 object-contain hover:scale-105 transition-transform duration-300"
                    title="Sistema Nacional de Cultura"
                  />
                </div>
              </div>

              {/* Apoio Block */}
              <div className="flex flex-col items-center gap-8 w-full">
                <span className="text-xs tracking-[0.2em] uppercase text-[#8C8077] font-bold">Apoio Municipal</span>
                <div className="flex flex-wrap items-center justify-center gap-12 lg:gap-20">
                  <img 
                    src="/logos/prefeitura.webp" 
                    alt="Prefeitura Municipal de Santo Augusto" 
                    className="h-32 md:h-40 object-contain hover:scale-105 transition-transform duration-300"
                    title="Prefeitura Municipal de Santo Augusto"
                  />
                  <img 
                    src="/logos/secute.webp" 
                    alt="Secretaria Municipal de Cultura, Turismo e Esporte" 
                    className="h-24 md:h-32 object-contain hover:scale-105 transition-transform duration-300"
                    title="Secretaria Municipal de Cultura, Turismo e Esporte"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Footer Simples */}
      <footer className="bg-[#0B1120] text-gray-400 py-8 text-sm">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} Ecos de Memória. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
