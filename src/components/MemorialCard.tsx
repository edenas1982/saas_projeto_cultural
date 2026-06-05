import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

interface MemorialCardProps {
  id: string;
  nome_homenageado: string;
  data_nascimento?: string;
  data_falecimento?: string;
  foto_url?: string;
  frase_destaque?: string;
}

export function MemorialCard({ memorial }: { memorial: MemorialCardProps }) {
  const getAno = (dataString?: string) => {
    if (!dataString) return '';
    return dataString.split('-')[0];
  };

  return (
    <Link 
      to={`/m/${memorial.id}`} 
      className="group bg-white rounded-2xl overflow-hidden border border-[#E8E4DB] hover:shadow-md transition-all hover:-translate-y-1 block"
    >
      <div className="aspect-[4/3] bg-[#E8E4DB] relative overflow-hidden">
        {memorial.foto_url ? (
          <img 
            src={memorial.foto_url} 
            alt={`Foto de ${memorial.nome_homenageado}`} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#B5AAA0] font-serif italic text-sm">
            Nenhuma foto adicionada
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-12">
            <h2 className="text-white font-serif text-xl font-medium tracking-wide drop-shadow-sm line-clamp-1">
              {memorial.nome_homenageado}
            </h2>
        </div>
      </div>
      
      <div className="p-6">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#B5AAA0] mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{getAno(memorial.data_nascimento)} - {getAno(memorial.data_falecimento)}</span>
            </div>
          </div>
          {memorial.frase_destaque ? (
            <p className="text-[#8C8077] font-serif text-sm italic line-clamp-2 leading-relaxed">
              "{memorial.frase_destaque}"
            </p>
          ) : (
            <p className="text-[#B5AAA0] text-sm line-clamp-2 leading-relaxed">
              Um memorial dedicado à sua história e legado.
            </p>
          )}
      </div>
    </Link>
  );
}
