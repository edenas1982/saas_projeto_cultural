import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function SobreStartup() {
  const smoothScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    const targetId = e.currentTarget.getAttribute('href')?.slice(1);
    const targetElement = document.getElementById(targetId || '');
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
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
        <div className="hidden md:flex items-center gap-6">
          <ul className="flex gap-6">
            <li><Link to="/#para-quem-e" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Para quem é</Link></li>
            <li><Link to="/#beneficios" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Benefícios</Link></li>
            <li><Link to="/tecnologia" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Tecnologia</Link></li>
            <li><Link to="/sobre" className="text-[13px] text-[#ede9e3] transition-colors">Quem somos</Link></li>
          </ul>
        </div>
      </nav>

      <main>
        
        {/* HERO */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3db87a]/5 rounded-full blur-[120px] pointer-events-none"></div>

          <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] text-[#ede9e3]/40 hover:text-[#ede9e3] transition-colors mb-8 relative z-10">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>

          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5 relative z-10">
            A essência do formato
          </div>
          <h1 className="text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.03em] max-w-[680px] mb-5 relative z-10">
            Tecnologia criada para preservar histórias humanas.
          </h1>
          <p className="text-[15px] text-[#ede9e3]/55 leading-[1.8] max-w-[540px] mb-9 relative z-10">
            O Eco de Memórias foi fundado para evitar que processos emocionais dependam de métodos improvisados. Estruturamos uma infraestrutura SaaS de memorialização.
          </p>
        </section>

        {/* ORIGEM E PROBLEMA */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">A Origem do Produto</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
              Identificação do vazio.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
              Nasceu de uma verificação simples: empresas funerárias careciam de sistemas limpos e automatizados para escalar memoriais, enquanto famílias organizavam memórias isoladamente por falta de ferramentas.
            </p>

            <div className="grid md:grid-cols-2 gap-3 max-w-5xl">
              <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[16px]">
                  👨‍👩‍👧‍👦
                </div>
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Famílias sem suporte digital</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                  A logística da preservação da memória exige concentração e esforço no período do luto que a maioria não tem capacidade de realizar sem roteiros ou apoio da tecnologia.
                </p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                <div className="w-8 h-8 rounded-md bg-[#3db87a]/10 flex items-center justify-center mb-4 text-[16px]">
                  🏢
                </div>
                <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Funerárias improvisando processos</h3>
                <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                  Gastar tempo manual organizando mídia é financeiramente insustentável na operação funerária em alto volume. Nossa infraestrutura terceiriza todo o trabalho. 
                </p>
              </div>
            </div>
        </section>

        {/* METODOLOGIA */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Metodologia Assistida</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
            Lógica por trás da homenagem.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
            As homenagens geradas superam templates frios através de processos estruturados.
          </p>

          <div className="max-w-2xl mt-10 flex flex-col gap-0 border-t border-white/10">
            {[
              { num: '01', title: 'Aferição Estruturada', desc: 'Sistemas roteirizados extraem a vida através de metadados simples: infância, amores, legado, do que ria e por quem viveu.' },
              { num: '02', title: 'Transformador Sensível (Sonnet & Gemini Pro)', desc: 'O motor lê nuances textuais em frações de segundo e entrega narrativas com coesão estética e tons empáticos adequados.' },
              { num: '03', title: 'Edge Voice Storage', desc: 'Redes neurais convertem os parágrafos aprovados em áudio estúdio permanente injetando na CDN e gerando um QR Code isolado.' },
            ].map((step, i, arr) => (
              <div key={i} className={`flex gap-5 items-start py-6 ${i !== arr.length - 1 ? 'border-b border-white/10' : ''}`}>
                <div className="text-[12px] font-medium text-[#3db87a] min-w-[28px] pt-[3px] font-mono">{step.num}</div>
                <div>
                  <h4 className="text-[14px] font-medium text-[#ede9e3] mb-1.5">{step.title}</h4>
                  <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* VISÃO */}
        <section className="px-6 md:px-10 py-24 md:py-32 border-b border-white/10 bg-[#060706] text-center">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-7">O Futuro</div>
          <h2 className="text-[clamp(24px,3.5vw,40px)] font-medium leading-[1.2] tracking-[-0.02em] max-w-[640px] mx-auto text-[#ede9e3]">
            Estamos reduzindo o caos logístico do luto conectando IA e estabilidade Cloud.<br/> A plataforma B2B das memórias.
          </h2>
        </section>

      </main>
    </div>
  );
}
