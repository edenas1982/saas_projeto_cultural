import { useData } from '../hooks/useData';
import { Phone, Clock, AlertCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export function FollowUpView({ data }: { data: ReturnType<typeof useData> }) {
  const agora = new Date();
  
  // Leads que precisam de follow-up:
  // - Estão em 'contato' ou 'proposta' E
  // - O último contato foi há mais de 2 dias.
  // - OU não tem data de último contato
  const leadsFollowUp = data.leads.filter(lead => {
    if (lead.status === 'novo' || lead.status === 'fechado') return false;
    if (!lead.ultimo_contato) return true;
    
    const dias = differenceInDays(agora, new Date(lead.ultimo_contato));
    return dias >= 2;
  }).sort((a, b) => {
    if (!a.ultimo_contato) return -1;
    if (!b.ultimo_contato) return 1;
    return new Date(a.ultimo_contato).getTime() - new Date(b.ultimo_contato).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Follow-up</h2>
      </div>
      
      <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-sm border border-yellow-200 flex items-start gap-3">
        <AlertCircle size={20} className="shrink-0 mt-0.5" />
        <p>Leads em negociação sem contato há mais de 2 dias aparecem aqui. Não perca o timing da venda!</p>
      </div>

      <div className="space-y-4">
        {leadsFollowUp.length === 0 ? (
          <div className="p-8 bg-white rounded-xl text-center border border-dashed border-gray-300">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock size={24} />
            </div>
            <p className="text-gray-900 font-medium">Follow-ups em dia!</p>
            <p className="text-gray-500 text-sm mt-1">Nenhum lead esfriando no momento.</p>
          </div>
        ) : (
          leadsFollowUp.map(lead => {
            const dias = lead.ultimo_contato ? differenceInDays(agora, new Date(lead.ultimo_contato)) : 'Muitos';
            
            return (
              <div key={lead.id} className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{lead.nome}</h4>
                    <p className="text-xs text-orange-600 font-medium mt-1 inline-flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-full">
                      <Clock size={12} /> {dias === 'Muitos' ? 'Sem contato recente' : `${dias} dias sem contato`}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md uppercase">
                    {lead.status}
                  </span>
                </div>
                
                <div className="flex gap-2 mt-1">
                  <a 
                    href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}?text=Olá ${lead.nome}, como estão as coisas por aí?`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => data.logContato(lead.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors"
                  >
                    <Phone size={16} /> Retomar Conversa
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
