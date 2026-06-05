import { X, Pencil, SlidersHorizontal, RefreshCw, FileText } from 'lucide-react';

interface IntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: 'adjust' | 'regenerate' | 'manual-edit') => void;
  nome_homenageado: string;
  foto_url?: string;
}

export function IntentModal({ isOpen, onClose, onSelectAction, nome_homenageado, foto_url }: IntentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5c5042]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] flex flex-col border border-[#E8E4DB] animate-in zoom-in-95 duration-200">
        
        {/* Header Section */}
        <div className="p-6 pb-4 border-b border-[#E8E4DB] relative shrink-0">
          
          {/* Identity Header */}
          <div className="flex z-10 items-center justify-start gap-3 w-full bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mb-4">
            {foto_url ? (
              <img 
                src={foto_url} 
                alt="Homenageado" 
                className="w-12 h-12 rounded-full object-cover border border-stone-200"
                
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-lg border border-stone-200">
                {nome_homenageado ? nome_homenageado.charAt(0) : ''}
              </div>
            )}
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Homenageado</span>
              <h2 className="text-base font-bold text-stone-800 leading-tight truncate max-w-[200px] md:max-w-xs">
                {nome_homenageado}
              </h2>
            </div>
          </div>

          <h2 className="text-xl font-bold text-[#4A3F35] leading-tight pr-10">
            O que você gostaria de fazer com a biografia?
          </h2>
          <p className="text-sm font-medium text-[#6B5D50] mt-1">
            Escolha como quer continuar.
          </p>
          <button 
             onClick={onClose} 
             className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Card 1 */}
          <button 
            onClick={() => onSelectAction('adjust')}
            className="w-full bg-white text-left p-4 rounded-xl border border-[#E8E4DB] hover:border-[#D0C7B8] hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#8C7A6B] flex items-start gap-4 group"
          >
            <div className="bg-[#F4F1EC] p-3 rounded-lg text-[#6B5D50] group-hover:bg-[#E8E4DB] group-hover:text-[#4A3F35] transition-colors shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A3F35] mb-1">Quero ajustar algo com IA</h3>
              <p className="text-sm text-[#6B5D50] leading-relaxed">
                Diga o que quer mudar e a IA faz apenas esse ajuste na biografia.
              </p>
            </div>
          </button>

          {/* Card 2 */}
          <button 
            onClick={() => onSelectAction('regenerate')}
            className="w-full bg-white text-left p-4 rounded-xl border border-[#E8E4DB] hover:border-[#D0C7B8] hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#8C7A6B] flex items-start gap-4 group"
          >
            <div className="bg-[#F4F1EC] p-3 rounded-lg text-[#6B5D50] group-hover:bg-[#E8E4DB] group-hover:text-[#4A3F35] transition-colors shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A3F35] mb-1">Quero gerar uma versão completamente nova</h3>
              <p className="text-sm text-[#6B5D50] leading-relaxed">
                Começa uma nova geração do zero usando as mesmas respostas do formulário.
              </p>
            </div>
          </button>

          {/* Card 3 - Edit Manual */}
          <button 
            onClick={() => onSelectAction('manual-edit')}
            className="w-full bg-white text-left p-4 rounded-xl border border-[#E8E4DB] hover:border-[#D0C7B8] hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#8C7A6B] flex items-start gap-4 group"
          >
            <div className="bg-[#F4F1EC] p-3 rounded-lg text-[#6B5D50] group-hover:bg-[#E8E4DB] group-hover:text-[#4A3F35] transition-colors shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#4A3F35] mb-1">Quero editar o texto manualmente</h3>
              <p className="text-sm text-[#6B5D50] leading-relaxed">
                Reescreva ou ajuste o texto por conta própria sem envolver a Inteligência Artificial.
              </p>
            </div>
          </button>

        </div>

      </div>
    </div>
  );
}

