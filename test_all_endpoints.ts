import dotenv from 'dotenv';
dotenv.config();

const token = 'MOCK_TOKEN';

const endpoints = [
  { path: '/api/interesse', method: 'POST', body: {} },
  { path: '/api/invites/create', method: 'POST', body: {} },
  { path: '/api/invites/memorial/123', method: 'GET' },
  { path: '/api/invites/123/status', method: 'PUT', body: { status: 'sent' } },
  { path: '/api/public/invite/123', method: 'GET' },
  { path: '/api/public/invite/123/respostas', method: 'POST', body: { respostas: [] } },
  { path: '/api/narrativas/generate', method: 'POST', body: { memorial_id: '123' } },
  { path: '/api/narrativas/adjust', method: 'POST', body: { memorial_id: '123', narrativa_id: '456', instrucao: 'ajustar' } },
  { path: '/api/narrativas/audio', method: 'POST', body: { narrativa_id: '123' } },
  { path: '/api/narrativas/manual_edit', method: 'POST', body: { narrativa_id: '123', conteudo: 'test' } },
  { path: '/api/qrcodes/memorial/123', method: 'GET' },
  { path: '/api/memoriais/accept-transfer', method: 'POST', body: {} },
  { path: '/api/qrcodes/create', method: 'POST', body: {} }
];

async function run() {
  console.log("Checking all endpoints...");
  for (const ep of endpoints) {
    try {
      const url = `http://localhost:3000${ep.path}`;
      const options: RequestInit = {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      };
      if (ep.body) {
        options.body = JSON.stringify(ep.body);
      }
      
      const res = await fetch(url, options);
      const text = await res.text();
      const isHtml = text.trim().startsWith('<');
      console.log(`[${ep.method}] ${ep.path} -> Status: ${res.status}, Type: ${res.headers.get('content-type')}, IsHTML: ${isHtml}`);
      if (isHtml) {
         console.log("HTML Sample:", text.slice(0, 150));
      }
    } catch (e: any) {
      console.error(`Error querying ${ep.path}:`, e.message);
    }
  }
}

run();
