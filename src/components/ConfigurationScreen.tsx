import { AlertCircle, Database } from 'lucide-react';

export function ConfigurationScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Database size={32} />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Configure o Banco de Dados</h1>
        <p className="text-gray-500 mb-6 font-medium">O Sistema Comercial requer o Supabase para funcionar corretamente.</p>
        
        <div className="text-left space-y-4 mb-8">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-gray-500" />
              Passo a passo:
            </h3>
            <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
              <li>Crie um projeto no <strong>Supabase</strong> (supabase.com)</li>
              <li>Acesse <strong>Project Settings</strong> &gt; <strong>API</strong></li>
              <li>Copie a <strong>URL</strong> e a <strong>anon public key</strong></li>
              <li>Configure-as no painel <strong>Secrets / Variables</strong> ou no seu <strong>.env</strong> local:
                <ul className="list-disc pl-4 mt-2 font-mono text-xs text-gray-800 space-y-1">
                  <li>VITE_SUPABASE_URL</li>
                  <li>VITE_SUPABASE_ANON_KEY</li>
                </ul>
              </li>
            </ol>
          </div>
          
          <div className="text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl p-4">
            <p className="font-semibold mb-1">Tabelas necessárias:</p>
            <p className="mb-2">Execute o seguinte SQL no Database &gt; SQL Editor do Supabase:</p>
            <pre className="overflow-x-auto text-xs whitespace-pre bg-yellow-100/50 p-2 rounded">
{`create table leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  whatsapp text not null,
  tipo_negocio text not null,
  status text not null check (status in ('novo', 'contato', 'proposta', 'fechado')),
  ultimo_contato timestamp with time zone
);

create table tarefas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  titulo text not null,
  concluida boolean default false,
  lead_id uuid references leads(id) on delete set null,
  data_vencimento timestamp with time zone
);`}
            </pre>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          Após configurar as variáveis de ambiente, recarregue a página.
        </p>
      </div>
    </div>
  );
}
