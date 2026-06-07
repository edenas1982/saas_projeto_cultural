import { useState } from 'react';
import { useData } from '../hooks/useData';
import { Plus, CheckCircle2, Circle, X } from 'lucide-react';

export function TarefasView({ data }: { data: ReturnType<typeof useData> }) {
  const [showForm, setShowForm] = useState(false);
  const tarefasPendentes = data.tarefas.filter(t => !t.concluida);
  const tarefasConcluidas = data.tarefas.filter(t => t.concluida);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Tarefas</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {showForm && (
        <TarefaForm 
          leads={data.leads}
          onSubmit={async (tarefa) => {
            await data.addTarefa(tarefa);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2 px-1">Pendentes</h3>
        {tarefasPendentes.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">Nenhuma tarefa pendente!</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            {tarefasPendentes.map(tarefa => (
              <button 
                key={tarefa.id} 
                className="w-full flex items-start gap-3 p-4 hover:bg-blue-50 transition-colors text-left"
                onClick={() => data.toggleTarefa(tarefa.id, true)}
              >
                <div className="mt-0.5 text-gray-400">
                   <Circle size={22} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{tarefa.titulo}</p>
                  {tarefa.lead_id && (
                    <p className="text-xs text-blue-600 mt-1 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded-full">
                      {data.leads.find(l => l.id === tarefa.lead_id)?.nome}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {tarefasConcluidas.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Concluídas</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50 opacity-70">
            {tarefasConcluidas.map(tarefa => (
              <button 
                key={tarefa.id} 
                className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => data.toggleTarefa(tarefa.id, false)}
              >
                <div className="mt-0.5 text-blue-500">
                   <CheckCircle2 size={22} />
                </div>
                <div>
                  <p className="font-medium text-gray-500 line-through">{tarefa.titulo}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TarefaForm({ leads, onSubmit, onCancel }: { leads: any[], onSubmit: (t: any) => void, onCancel: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [leadId, setLeadId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    onSubmit({ titulo, lead_id: leadId || null });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">O que precisa ser feito?</label>
        <input 
          required 
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
          placeholder="Ex: Ligar para confirmar proposta" 
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Vincular a um Lead (Opcional)</label>
        <select 
          value={leadId}
          onChange={e => setLeadId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="">Nenhum lead</option>
          {leads.map(l => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancelar
        </button>
        <button type="submit" className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          Criar Tarefa
        </button>
      </div>
    </form>
  );
}
