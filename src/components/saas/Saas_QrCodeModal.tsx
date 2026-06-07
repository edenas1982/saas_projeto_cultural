import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Printer, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Saas_QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  memorialId: string;
  memorialName: string;
}

export function Saas_QrCodeModal({ isOpen, onClose, memorialId, memorialName }: Saas_QrCodeModalProps) {
  const [qrcodes, setQrcodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && memorialId) {
      fetchAndAutoGenerateQRCodes();
    }
  }, [isOpen, memorialId]);

  const fetchAndAutoGenerateQRCodes = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token;
      
      const res = await fetch(`/api/qrcodes/memorial/${memorialId}`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Resposta inválida do servidor (HTML). Código: ${res.status}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let list = data.qrcodes || [];
      setQrcodes(list);

      // Verificação de auto-geração caso falte algum dos dois tipos fundamentais
      const hasVelorio = list.some((q: any) => q.tipo === 'velorio');
      const hasLapide = list.some((q: any) => q.tipo === 'lapide');

      if (!hasVelorio || !hasLapide) {
        setIsGenerating(true);
        if (!hasVelorio) {
          await createQRCode('velorio', jwt);
        }
        if (!hasLapide) {
          await createQRCode('lapide', jwt);
        }

        // Busca atualizada após criação automática
        const refreshRes = await fetch(`/api/qrcodes/memorial/${memorialId}`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.qrcodes) {
          setQrcodes(refreshData.qrcodes);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao carregar ou gerar os QR Codes');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const createQRCode = async (tipo: 'velorio' | 'lapide', jwt: string) => {
    try {
      const res = await fetch('/api/qrcodes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ memorial_id: memorialId, tipo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na geração');
    } catch (e) {
      console.error(`Erro na geração silenciosa do QR tipo ${tipo}:`, e);
    }
  };

  const handlePrint = (qr: any) => {
    const canvas = document.getElementById(`canvas-${qr.id}`) as HTMLCanvasElement;
    if (!canvas) return;

    const qrImage = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelTitle = qr.tipo === 'velorio' ? 'LIVRO DE CONDOLÊNCIAS DIGITAL' : 'MEMORIAL DE HOMENAGENS';
    const instructions = qr.tipo === 'velorio'
      ? 'Aponte a câmera do seu celular para o QR Code acima para deixar sua palavra de conforto e condolências à família.'
      : 'Aponte a câmera do seu celular para acessar a biografia completa, timeline de fotos e homenagens.';

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${memorialName}</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 95vh;
              margin: 0;
              background-color: #fff;
              color: #1e293b;
              text-align: center;
            }
            .border-wrap {
              border: 3px double #cbd5e1;
              padding: 40px;
              border-radius: 20px;
              max-width: 450px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo {
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.1em;
              color: #4f46e5;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            .homenageado {
              font-size: 32px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 8px 0;
            }
            .role-label {
              font-size: 13px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 30px;
            }
            .qr-image {
              width: 260px;
              height: 260px;
              padding: 10px;
              border: 1px solid #f1f5f9;
              border-radius: 12px;
              margin-bottom: 30px;
            }
            .desc {
              font-size: 12px;
              color: #475569;
              line-height: 1.6;
              max-width: 320px;
            }
            @media print {
              body {
                min-height: auto;
              }
              .border-wrap {
                border: none;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="border-wrap">
            <div class="logo">Ecos de Memória</div>
            <h1 class="homenageado">${memorialName}</h1>
            <div class="role-label">${labelTitle}</div>
            <img src="${qrImage}" class="qr-image" />
            <p class="desc"><strong>${instructions}</strong></p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenTimeline = (qr: any) => {
    const isVelorio = qr.tipo === 'velorio';
    const url = isVelorio
      ? `${window.location.origin}/saas/m/${memorialId}/condolencias`
      : `${window.location.origin}/m/${memorialId}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Gerenciamento de QR Codes</h3>
            <p className="text-xs text-slate-500 mt-0.5">Memorial de {memorialName}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-1 hover:bg-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {errorMsg && (
             <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-center gap-2 mb-4">
               <AlertCircle className="w-4 h-4 shrink-0" />
               {errorMsg}
             </div>
          )}

          {isLoading || isGenerating ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">
                {isGenerating ? 'Configurando QR Codes pela primeira vez...' : 'Buscando dados...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {qrcodes.map(qr => {
                const isVelorio = qr.tipo === 'velorio';
                const label = isVelorio ? 'Livro de Condolências' : 'Código da Lápide';
                const sub = isVelorio ? 'Expira em 7 dias' : 'Permanente / Vitalício';
                const qrOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                  ? 'http://192.168.0.136:3000'
                  : window.location.origin;
                const qrValue = `${qrOrigin}/qr/${qr.codigo}`;

                return (
                  <div 
                    key={qr.id} 
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-between text-center shadow-sm relative group hover:border-slate-300 transition-colors"
                  >
                    <div className="mb-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 border ${
                        isVelorio 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {label}
                      </span>
                      <p className="text-xs text-slate-400 font-medium">{sub}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-4 inline-block">
                      <QRCodeCanvas 
                        id={`canvas-${qr.id}`}
                        value={qrValue} 
                        size={170}
                        level={"H"}
                        includeMargin={true}
                      />
                    </div>

                    <div className="w-full space-y-2 mt-2">
                      <button 
                        onClick={() => handlePrint(qr)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir
                      </button>
                      <button 
                        onClick={() => handleOpenTimeline(qr)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl shadow-sm transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {isVelorio ? 'Abrir Livro de Condolências' : 'Abrir Timeline'}
                      </button>
                    </div>

                    <div className="absolute top-3 right-3 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                      {qr.total_scans || 0} scans
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
