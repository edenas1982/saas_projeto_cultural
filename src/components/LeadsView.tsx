import { useState } from 'react';
import { useData } from '../hooks/useData';
import { Plus, Phone, Upload, X } from 'lucide-react';
import { Lead } from '../types';

export function LeadsView({ data }: { data: ReturnType<typeof useData> }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {showForm && (
        <LeadForm 
          onSubmit={async (lead) => {
            await data.addLead(lead);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-4 pt-2">
        {data.leads.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">Nenhum lead cadastrado.</p>
          </div>
        ) : (
          data.leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} data={data} />
          ))
        )}
      </div>
    </div>
  );
}

function LeadForm({ onSubmit, onCancel }: { onSubmit: (lead: Omit<Lead, 'id' | 'created_at'>) => void, onCancel: () => void }) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tipo, setTipo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !whatsapp.trim()) return;
    
    onSubmit({
      nome,
      whatsapp,
      tipo_negocio: tipo || 'Geral',
      status: 'novo',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Lead</label>
        <input 
          required 
          value={nome}
          onChange={e => setNome(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
          placeholder="Ex: João Silva" 
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
        <input 
          required 
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          type="tel"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
          placeholder="Ex: 11999999999" 
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Negócio / Tag</label>
        <input 
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
          placeholder="Ex: Clínica, Padaria, E-commerce..." 
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancelar
        </button>
        <button type="submit" className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          Salvar
        </button>
      </div>
    </form>
  );
}

const statusColors = {
  novo: 'bg-blue-50 text-blue-700 border-blue-200',
  contato: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  proposta: 'bg-purple-50 text-purple-700 border-purple-200',
  fechado: 'bg-green-50 text-green-700 border-green-200'
};

const statusLabels = {
  novo: 'Novo',
  contato: 'Em Contato',
  proposta: 'Proposta Enviada',
  fechado: 'Fechado'
};

function LeadCard({ lead, data }: { lead: Lead, data: ReturnType<typeof useData> }) {
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-gray-900">{lead.nome}</h4>
          <p className="text-xs text-gray-500">{lead.tipo_negocio} • {lead.whatsapp}</p>
        </div>
        <button 
          onClick={() => setIsUpdating(!isUpdating)}
          className={`px-2 py-1 text-xs font-medium rounded-md border ${statusColors[lead.status]}`}
        >
          {statusLabels[lead.status]}
        </button>
      </div>

      {isUpdating && (
        <div className="flex flex-wrap gap-2 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
          {(['novo', 'contato', 'proposta', 'fechado'] as const).map(status => (
             <button
                key={status}
                onClick={() => {
                  data.updateLeadStatus(lead.id, status);
                  setIsUpdating(false);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border ${statusColors[status]} ${lead.status === status ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
             >
                {statusLabels[status]}
             </button>
          ))}
        </div>
      )}

      {!isUpdating && (
        <div className="flex gap-2">
          <a 
            href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}?text=Olá ${lead.nome},`}
            target="_blank"
            rel="noreferrer"
            onClick={() => data.logContato(lead.id)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <Phone size={16} className="text-[#25D366]" /> Mensagem
          </a>
        </div>
      )}
    </div>
  );
}
