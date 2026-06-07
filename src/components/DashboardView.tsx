import { useData } from '../hooks/useData';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {  Target, Phone, CheckCircle2, Circle } from 'lucide-react';
import { Lead, Tarefa } from '../types';

export function DashboardView({ data }: { data: ReturnType<typeof useData> }) {
  const perfisNovos = data.leads.filter(l => l.status === 'novo');
  const tarefasHoje = data.tarefas.filter(t => !t.concluida); // Simplificado para mostrar pendentes
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resumo do Dia</h2>
          <p className="text-gray-500 text-sm">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2">
            <Target size={20} />
          </div>
          <span className="text-3xl font-bold text-gray-900">{perfisNovos.length}</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Leads Novos</span>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 size={20} />
          </div>
          <span className="text-3xl font-bold text-gray-900">{tarefasHoje.length}</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Tarefas Pend.</span>
        </div>
      </div>

      {/* Priority Action: Leads Novos */}
      {perfisNovos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 px-1">Prioridade: Novos Leads</h3>
          <div className="space-y-3">
            {perfisNovos.slice(0, 3).map(lead => (
              <div key={lead.id} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{lead.nome}</h4>
                    <p className="text-xs text-gray-500">{lead.tipo_negocio}</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md">Novo</span>
                </div>
                <div className="flex gap-2">
                  <a 
                    href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}?text=Olá ${lead.nome}, viemos através do Sistema Comercial.`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      data.logContato(lead.id);
                      data.updateLeadStatus(lead.id, 'contato');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors"
                  >
                    <Phone size={16} /> Chamar no Whats
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Action: Tarefas */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 px-1">Suas Tarefas</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {tarefasHoje.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">Nenhuma tarefa pendente!</div>
          ) : (
            tarefasHoje.slice(0, 5).map(tarefa => (
              <button 
                key={tarefa.id} 
                className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => data.toggleTarefa(tarefa.id, !tarefa.concluida)}
              >
                <div className="mt-0.5 text-gray-400">
                   <Circle size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{tarefa.titulo}</p>
                  {tarefa.lead_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Lead: {data.leads.find(l => l.id === tarefa.lead_id)?.nome || 'Desconhecido'}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
