import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Send, ChevronRight } from 'lucide-react';

export default function Acompanhar() {
  const [formData, setFormData] = useState({
    nome: '',
    empresa: '',
    segmento: '',
    email: '',
    whatsapp: '',
    receberNovidades: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/interesse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Falha ao registrar interesse. Tente novamente.');
      }

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: target.checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0e0d] text-[#ede9e3] font-sans selection:bg-[#3db87a] selection:text-[#051a0e]">
      
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 bg-[#0c0e0d] sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-medium tracking-tight hover:text-white transition-colors">
          <div className="w-[7px] h-[7px] rounded-full bg-[#3db87a]"></div>
          Eco de Memórias
        </Link>
        <div className="flex items-center gap-6">
          <ul className="hidden md:flex gap-6">
            <li><Link to="/#para-quem-e" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Para quem é</Link></li>
            <li><Link to="/#beneficios" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Benefícios</Link></li>
            <li><Link to="/tecnologia" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Tecnologia</Link></li>
            <li><Link to="/sobre" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Quem somos</Link></li>
          </ul>
          <Link to="/" className="hidden md:flex text-[12px] font-medium bg-white/5 border border-white/10 px-4 py-2 rounded-md hover:bg-white/10 transition-colors">
            Voltar para homepage
          </Link>
        </div>
      </nav>

      <main className="pb-24">
        
        {/* HERO */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3db87a]/5 rounded-full blur-[120px] pointer-events-none"></div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] text-[#ede9e3]/40 hover:text-[#ede9e3] transition-colors mb-8 relative z-10 md:hidden">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>

          <div className="inline-flex items-center gap-2 bg-[#3db87a]/10 border border-[#3db87a]/25 rounded-full px-3 py-1 text-[11px] font-medium text-[#3db87a] tracking-wider uppercase mb-7 relative z-10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3db87a] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#3db87a]"></span>
            </span>
            Em desenvolvimento ativo
          </div>
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#ede9e3]/40 mb-3.5 relative z-10">
            Eco de Memórias
          </div>
          <h1 className="text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.03em] max-w-[680px] mb-5 relative z-10">
            Estamos construindo uma <strong className="text-[#3db87a] font-medium">nova infraestrutura digital</strong> para memorialização.
          </h1>
          <p className="text-[15px] text-[#ede9e3]/55 leading-[1.8] max-w-[540px] relative z-10">
            O Eco de Memórias ainda está em desenvolvimento. Estamos compartilhando a evolução da plataforma com empresas e pessoas interessadas em acompanhar essa construção.
          </p>
        </section>

        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:grid lg:grid-cols-5 gap-12 lg:gap-16 items-start pt-16 md:pt-20">
          
          {/* INFORMAÇÕES - ESQUERDA (2 colunas) */}
          <div className="lg:col-span-2 mb-16 lg:mb-0">
            <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">O que será compartilhado</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] mb-3.5">
              Acompanhamentos reais sobre a evolução da plataforma.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] mb-10">
              Evoluiremos de forma transparente. Quem nos acompanha receberá de perto demonstrações e novidades antes de todos.
            </p>

            <div className="flex flex-col gap-4">
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5 group hover:border-[#3db87a]/30 transition-colors">
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-1.5">Evolução da plataforma</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">Novas funcionalidades, melhorias contínuas e progresso da infraestrutura técnica.</p>
              </div>
              
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5 group hover:border-[#3db87a]/30 transition-colors">
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-1.5">Demonstrações futuras</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">Vídeos práticos, testes interativos e experiências reais conforme forem sendo liberados.</p>
              </div>
              
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5 group hover:border-[#3db87a]/30 transition-colors">
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-1.5">Primeiros pilotos</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">Atualizações sobre testes iniciais com as primeiras empresas parceiras aprovadas.</p>
              </div>
              
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5 group hover:border-[#3db87a]/30 transition-colors">
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-1.5">Bastidores da construção</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">Decisões técnicas de arquitetura, lições aprendidas e evolução geral da startup.</p>
              </div>
            </div>
          </div>

          {/* FORMULÁRIO - DIREITA (3 colunas) */}
          <div className="lg:col-span-3">
            <div className="bg-[#111410] border border-[#3db87a]/20 rounded-xl overflow-hidden p-6 md:p-10 relative">
              
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#3db87a]/5 rounded-full blur-[80px] pointer-events-none"></div>

              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center h-full min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-16 h-16 rounded-full bg-[#3db87a]/10 flex items-center justify-center mb-6">
                    <Check className="w-8 h-8 text-[#3db87a]" />
                  </div>
                  <h3 className="text-[20px] font-medium text-[#ede9e3] mb-3">
                    Tudo certo.
                  </h3>
                  <p className="text-[14px] text-[#ede9e3]/50 leading-[1.7] max-w-[320px]">
                    Conforme o Eco de Memórias evoluir, compartilharemos novidades e demonstrações da plataforma com você. Obrigado por acompanhar.
                  </p>
                  <Link to="/" className="mt-8 text-[13px] text-[#3db87a] hover:text-[#3db87a]/80 font-medium flex items-center gap-1.5 transition-colors">
                    Voltar para o início <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mb-8 relative z-10">
                    <h3 className="text-[22px] font-medium text-[#ede9e3] mb-2">Acompanhar o projeto</h3>
                    <p className="text-[13px] text-[#ede9e3]/50 leading-[1.6] max-w-[380px]">
                      Conforme o Eco de Memórias evoluir, compartilharemos novidades, demonstrações e avanços da plataforma.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-3 rounded-md mb-6 relative z-10">
                      {errorMsg}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-[#ede9e3]/70">Nome <span className="text-[#3db87a]">*</span></label>
                        <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-[#ede9e3] focus:outline-none focus:border-[#3db87a]/50 placeholder-white/20 transition-colors" placeholder="Nome completo" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-[#ede9e3]/70">Empresa <span className="text-[#ede9e3]/30">(opcional)</span></label>
                        <input type="text" name="empresa" value={formData.empresa} onChange={handleChange} className="w-full bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-[#ede9e3] focus:outline-none focus:border-[#3db87a]/50 placeholder-white/20 transition-colors" placeholder="Nome da empresa" />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-[#ede9e3]/70">Email <span className="text-[#3db87a]">*</span></label>
                        <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-[#ede9e3] focus:outline-none focus:border-[#3db87a]/50 placeholder-white/20 transition-colors" placeholder="seu@email.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-[#ede9e3]/70">WhatsApp <span className="text-[#ede9e3]/30">(opcional)</span></label>
                        <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="w-full bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-[#ede9e3] focus:outline-none focus:border-[#3db87a]/50 placeholder-white/20 transition-colors" placeholder="(00) 00000-0000" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#ede9e3]/70">Segmento de atuação <span className="text-[#3db87a]">*</span></label>
                      <select required name="segmento" value={formData.segmento} onChange={handleChange} className="w-full bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-[#ede9e3] focus:outline-none focus:border-[#3db87a]/50 transition-colors appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ede9e3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right .5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}>
                        <option value="">Selecione seu segmento...</option>
                        <option value="Funerária">Funerária</option>
                        <option value="Plano Funerário">Plano Funerário</option>
                        <option value="Memorial/Cemitério">Memorial / Cemitério</option>
                        <option value="Tecnologia">Tecnologia / Startup</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center pt-0.5">
                          <input 
                            type="checkbox" 
                            name="receberNovidades" 
                            checked={formData.receberNovidades} 
                            onChange={handleChange} 
                            className="peer appearance-none w-5 h-5 border border-white/20 rounded-md bg-[#0c0e0d] checked:bg-[#3db87a] checked:border-[#3db87a] focus:outline-none focus:ring-2 focus:ring-[#3db87a]/30 transition-colors cursor-pointer"
                          />
                          <Check className="w-3.5 h-3.5 text-[#051a0e] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                        <span className="text-[13px] text-[#ede9e3]/60 group-hover:text-[#ede9e3] transition-colors leading-[1.6]">
                          Quero receber o acesso antecipado ao projeto e novidades exclusivas em primeira mão
                        </span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <button type="submit" disabled={isSubmitting || !formData.receberNovidades} className="w-full bg-[#3db87a] text-[#051a0e] text-[14px] font-medium px-4 py-3.5 rounded-md hover:bg-[#3db87a]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-[#051a0e]/20 border-t-[#051a0e] animate-spin"></div>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Acompanhar novidades
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
