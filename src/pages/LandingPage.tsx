import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Users, ClipboardList, MonitorOff, Rocket, Check, Leaf, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { session } = useAuth();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0c0e0d] text-[#ede9e3] font-sans selection:bg-[#3db87a] selection:text-[#051a0e]">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 bg-[#0c0e0d] sticky top-0 z-50">
        <div className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
          <div className="w-[7px] h-[7px] rounded-full bg-[#3db87a]"></div>
          Eco de Memórias
        </div>
        <div className="hidden md:flex items-center gap-6">
          <ul className="flex gap-6">
            <li><a href="#para-quem-e" onClick={(e) => { e.preventDefault(); document.getElementById('para-quem-e')?.scrollIntoView({ behavior: 'smooth' }) }} className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Para quem é</a></li>
            <li><a href="#beneficios" onClick={(e) => { e.preventDefault(); document.getElementById('beneficios')?.scrollIntoView({ behavior: 'smooth' }) }} className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Benefícios</a></li>
            <li><Link to="/tecnologia" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Tecnologia</Link></li>
            <li><Link to="/sobre" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Quem somos</Link></li>
            <li><Link to="/startup" className="text-[13px] text-[#3db87a] hover:text-[#3db87a]/80 font-medium transition-colors">Área Startup</Link></li>
          </ul>
          {session ? (
            <Link to="/painel" className="text-[12px] font-medium bg-[#3db87a] text-[#051a0e] px-4 py-2 rounded-md hover:bg-[#3db87a]/90 transition-colors">Meu Painel</Link>
          ) : (
             <Link to="/login" className="text-[12px] font-medium bg-[#3db87a] text-[#051a0e] px-4 py-2 rounded-md hover:bg-[#3db87a]/90 transition-colors">Acessar Plataforma</Link>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* HERO */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10">
          <div className="inline-flex items-center gap-2 bg-[#3db87a]/10 border border-[#3db87a]/25 rounded-full px-3 py-1 text-[11px] font-medium text-[#3db87a] tracking-wider uppercase mb-7">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3db87a] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#3db87a]"></span>
            </span>
            SaaS B2B · Em desenvolvimento ativo
          </div>
          <h1 className="text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.03em] max-w-[680px] mb-5">
            Memórias que vivem para sempre com <strong className="text-[#3db87a] font-medium">inteligência artificial</strong>.
          </h1>
          <p className="text-[15px] text-[#ede9e3]/55 leading-[1.8] max-w-[540px] mb-9">
            Plataforma SaaS de memorialização digital com IA generativa, áudio inteligente e QR Codes interativos.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-14">
            <Link to="/saas/login" className="bg-[#3db87a] text-[#051a0e] text-[13px] font-medium px-5 py-3 rounded-md flex items-center justify-center hover:bg-[#3db87a]/90 transition-colors w-full sm:w-auto">
              Acessar Funerária B2B
            </Link>
            <Link to="/login" className="bg-white/10 text-[#ede9e3] text-[13px] font-medium px-5 py-3 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors w-full sm:w-auto">
              Criar memorial
            </Link>
            <Link to="/para-empresas" className="text-[13px] text-[#ede9e3] flex items-center justify-center border border-white/20 px-5 py-3 rounded-md hover:bg-white/5 transition-colors w-full sm:w-auto">
              Para empresas
            </Link>
          </div>
          
          <div className="mb-10">
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#ede9e3]/30 mb-4 font-medium">Tecnologia escalável certificada</div>
            <div className="flex flex-wrap items-center gap-6 md:gap-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
              {/* Badges textuais simples ou place-holders simulando logos */}
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-white"><span className="text-[#ea4335]">G</span> Google Cloud</div>
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-white"><span className="text-[#1a73e8]">✧</span> Gemini</div>
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-white"><span className="text-[#d8a87b]">⬡</span> Claude / Anthropic</div>
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-white"><span className="text-[#3db87a]">⚡</span> Supabase</div>
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-white"><span className="text-white">▲</span> Vercel</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            <div className="bg-[#0c0e0d] p-4 md:p-5">
              <div className="text-[13px] font-medium text-[#ede9e3] mb-1">SaaS <em className="text-[#3db87a] not-italic">B2B</em></div>
              <div className="text-[11px] text-[#ede9e3]/35 leading-tight">Modelo de negócio</div>
            </div>
            <div className="bg-[#0c0e0d] p-4 md:p-5">
              <div className="text-[13px] font-medium text-[#ede9e3] mb-1"><em className="text-[#3db87a] not-italic">IA</em> generativa</div>
              <div className="text-[11px] text-[#ede9e3]/35 leading-tight">Claude Sonnet · Google TTS</div>
            </div>
            <div className="bg-[#0c0e0d] p-4 md:p-5">
              <div className="text-[13px] font-medium text-[#ede9e3] mb-1">Setor <em className="text-[#3db87a] not-italic">real</em></div>
              <div className="text-[11px] text-[#ede9e3]/35 leading-tight">Funerárias · Planos funerários</div>
            </div>
            <div className="bg-[#0c0e0d] p-4 md:p-5">
              <div className="text-[13px] font-medium text-[#ede9e3] mb-1"><em className="text-[#3db87a] not-italic">Cloud</em> nativo</div>
              <div className="text-[11px] text-[#ede9e3]/35 leading-tight">Supabase · Vercel · GitHub</div>
            </div>
          </div>
        </section>

        {/* PROBLEMA */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">O problema</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
            O setor funerário ainda improvisa o momento mais difícil.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
            Sem ferramentas especializadas, famílias organizam memórias no luto e funerárias operam com processos manuais. Não existe hoje uma solução SaaS vertical para esse mercado.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-4xl">
            <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-3 text-[#ede9e3]/30">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-medium text-[#ede9e3] mb-1.5">Famílias sem suporte</h3>
              <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">
                Organizar fotos, histórias e informações num momento de luto sem ferramenta adequada.
              </p>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-3 text-[#ede9e3]/30">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-medium text-[#ede9e3] mb-1.5">Processos manuais</h3>
              <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">
                Formulários físicos, ligações e improvisos para montar cada homenagem individualmente.
              </p>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-3 text-[#ede9e3]/30">
                <MonitorOff className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-medium text-[#ede9e3] mb-1.5">Zero tecnologia especializada</h3>
              <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">
                Nenhuma plataforma SaaS construída especificamente para memorialização no setor funerário.
              </p>
            </div>
            <div className="bg-[#091409] border border-[#3db87a]/20 rounded-xl p-5">
              <div className="w-8 h-8 rounded-md bg-[#3db87a]/10 flex items-center justify-center mb-3 text-[#3db87a]">
                <Rocket className="w-4 h-4" />
              </div>
              <h3 className="text-[13px] font-medium text-[#3db87a] mb-1.5">A oportunidade</h3>
              <p className="text-[12px] text-[#3db87a]/60 leading-[1.6]">
                Mercado amplo, sem solução vertical dedicada — pronto para infraestrutura SaaS moderna.
              </p>
            </div>
          </div>
        </section>

        {/* PARA QUEM É */}
        <section id="para-quem-e" className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Para quem é</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[580px] mb-3.5">
            Construído para empresas que lidam com memória, homenagem e assistência familiar.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[540px] mb-11">
            O Eco de Memórias nasce como uma infraestrutura digital especializada para empresas do setor funerário que desejam oferecer uma experiência memorial mais organizada, moderna e humanizada.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-4xl">
            <div className="bg-[#111410] border border-white/10 rounded-xl p-6 group hover:border-white/20 transition-colors">
              <div className="w-8 h-8 rounded bg-[#0c0e0d] border border-white/5 flex items-center justify-center mb-4">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#3db87a] opacity-80 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Funerárias</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-5">
                Modernize a experiência de homenagem oferecida às famílias com memorialização digital assistida por IA.
              </p>
              <div className="mt-auto">
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase bg-white/5 text-[#ede9e3]/40 px-2.5 py-1 rounded-sm">
                  Experiência memorial moderna
                </span>
              </div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-xl p-6 group hover:border-white/20 transition-colors">
              <div className="w-8 h-8 rounded bg-[#0c0e0d] border border-white/5 flex items-center justify-center mb-4">
                <div className="w-3 h-3 border border-[#3db87a] rotate-45 opacity-80 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Planos funerários</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-5">
                Adicione uma nova camada de valor e diferenciação ao relacionamento com famílias atendidas.
              </p>
              <div className="mt-auto">
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase bg-white/5 text-[#ede9e3]/40 px-2.5 py-1 rounded-sm">
                  Valor agregado ao serviço
                </span>
              </div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-xl p-6 group hover:border-white/20 transition-colors">
              <div className="w-8 h-8 rounded bg-[#0c0e0d] border border-white/5 flex items-center justify-center mb-4">
                <div className="w-3 h-3 rounded-full border border-[#3db87a] opacity-80 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Cemitérios memoriais</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-5">
                Conecte espaços físicos e memoriais digitais através de QR Codes permanentes.
              </p>
              <div className="mt-auto">
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase bg-white/5 text-[#ede9e3]/40 px-2.5 py-1 rounded-sm">
                  Integração físico-digital
                </span>
              </div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-xl p-6 group hover:border-white/20 transition-colors">
              <div className="w-8 h-8 rounded bg-[#0c0e0d] border border-white/5 flex items-center justify-center mb-4">
                <div className="w-2.5 h-2.5 bg-[#3db87a] opacity-80 group-hover:opacity-100 transition-opacity rotate-45"></div>
              </div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Assistência familiar</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-5">
                Estruture processos de homenagem e preservação de histórias de forma organizada e acessível.
              </p>
              <div className="mt-auto">
                <span className="text-[10px] font-medium tracking-[0.06em] uppercase bg-white/5 text-[#ede9e3]/40 px-2.5 py-1 rounded-sm">
                  Organização memorial
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section id="beneficios" className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Benefícios</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
            O que a plataforma agrega para sua empresa.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-12">
            O Eco de Memórias transforma processos improvisados em uma experiência memorial estruturada, moderna e escalável.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-8 max-w-5xl">
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">
                Diferenciação competitiva
              </h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Ofereça uma experiência memorial digital moderna e humanizada para famílias.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Organização operacional</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Substitua processos manuais e improvisados por um fluxo estruturado.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Memorialização assistida por IA</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Transforme relatos familiares em narrativas respeitosas através de inteligência artificial.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Valor percebido</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Adicione inovação e percepção premium aos serviços funerários.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Experiência permanente</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Conecte homenagens físicas e digitais através de memoriais acessíveis por QR Code.
              </p>
            </div>
            <div className="border-t border-white/10 pt-5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3db87a] mb-4"></div>
              <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Infraestrutura escalável</h3>
              <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                Arquitetura SaaS preparada para múltiplas empresas e evolução contínua.
              </p>
            </div>
          </div>
        </section>

        {/* FLUXO */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Como funciona</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
            Do cadastro ao memorial digital em minutos.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
            O fluxo operacional transforma um processo manual e emocional numa experiência estruturada, automatizada e escalável.
          </p>
          
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden">
              {[
                { n: '01', title: 'Funerária cria o memorial', desc: 'Cadastra o falecido e inicia o processo digital na plataforma.', tag: 'Painel da funerária', active: true },
                { n: '02', title: 'Família responde perguntas guiadas', desc: 'Recebe link e responde perguntas estruturadas sobre história e memórias.', tag: 'Experiência familiar' },
                { n: '03', title: 'IA estrutura a narrativa', desc: 'Claude Sonnet gera biografia emocional e coerente, revisável pela funerária.', tag: 'Claude Sonnet · IA generativa' },
                { n: '04', title: 'Sistema gera áudio + QR Code', desc: 'Google TTS converte narrativa em áudio. QR Code conecta físico e digital.', tag: 'Google TTS · Supabase Storage' },
                { n: '05', title: 'Memorial permanente compartilhado', desc: 'Acessível via link e QR Code. Legado digital organizado e permanente.', tag: 'Memorial permanente' },
              ].map((step, i) => (
                <div key={i} className={`flex gap-4 items-start p-4 md:p-5 border-b border-white/10 last:border-0 transition-colors cursor-pointer ${step.active ? 'bg-[#091a10] border-l-2 border-l-[#3db87a]' : 'bg-[#0c0e0d] hover:bg-[#111410] border-l-2 border-l-transparent'}`}>
                  <div className="text-[11px] font-medium text-[#3db87a] min-w-[24px] pt-1">{step.n}</div>
                  <div>
                    <h4 className="text-[13px] font-medium mb-1">{step.title}</h4>
                    <p className="text-[12px] text-[#ede9e3]/40 leading-[1.55]">{step.desc}</p>
                    <span className="inline-block mt-2 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#3db87a]/10 text-[#3db87a] px-2 py-0.5 rounded-sm">
                      {step.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* SCREEN MOCKUP */}
             <div className="bg-[#111410] border border-white/10 rounded-xl overflow-hidden hidden md:block">
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-[#0e1110]">
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]"></div>
                  <div className="text-[11px] text-[#ede9e3]/30 ml-1">painel da funerária · memorial em criação</div>
                </div>
                <div className="p-3.5">
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2 mb-2">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-1">Falecido</div>
                    <div className="text-[12px] text-[#ede9e3]/70">Maria Aparecida Ferreira, 78 anos</div>
                  </div>
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2 mb-2">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-1">Respostas</div>
                    <div className="text-[12px] text-[#ede9e3]/70">12 de 12 · 3 fotos enviadas</div>
                  </div>
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2 mb-2">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-1">Geração de narrativa</div>
                    <div className="text-[12px] text-[#3db87a] flex items-center gap-2">
                      <div className="w-[60px] h-0.5 bg-[#3db87a]/15 rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-[-100%] w-full h-full bg-[#3db87a] animate-[sl_1.2s_ease-in-out_infinite]"></div>
                        <style>{`@keyframes sl{to{left:100%}}`}</style>
                      </div>
                      IA processando memórias...
                    </div>
                  </div>
                  <div className="bg-[#081508] border border-[#3db87a]/15 rounded-md px-3 py-2.5 mb-2">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#3db87a] mb-1.5">Biografia gerada · Claude Sonnet</div>
                    <div className="text-[11px] text-[#ede9e3]/55 leading-[1.6]">
                      "Maria Aparecida dedicou 40 anos ao magistério, formando gerações que guardam com carinho sua voz firme e sorriso generoso. Nascida em Passo Fundo..."
                    </div>
                  </div>
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 mt-2 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#3db87a] flex items-center justify-center shrink-0">
                       <Play className="w-3 h-3 fill-current text-[#051a0e] ml-0.5" />
                    </div>
                    <div className="flex-1 flex items-center gap-[2px] h-5">
                       {[8,14,18,10,16,12,20,8,14,18,10,6].map((h, i) => (
                         <div key={i} className="w-0.5 rounded-[1px] bg-[#3db87a]" style={{height: `${h}px`}}></div>
                       ))}
                    </div>
                    <div className="text-[10px] text-[#ede9e3]/30">2:34</div>
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* SCREENS */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">O produto</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
              Interfaces reais da plataforma.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
              Dashboard de gestão, coleta guiada de memórias, geração por IA e entrega via QR Code — tudo em uma plataforma integrada.
            </p>
            
            <div className="grid lg:grid-cols-2 gap-3 max-w-5xl">
               {/* Screen 1 */}
               <div className="bg-[#111410] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-[#0e1110]">
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]"></div>
                  <div className="text-[11px] text-[#ede9e3]/30 ml-1">dashboard · visão geral</div>
                </div>
                <div className="p-3.5">
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                       <div className="text-[16px] font-medium tracking-[-0.02em]">24</div>
                       <div className="text-[9px] text-[#ede9e3]/35">Memoriais ativos</div>
                    </div>
                    <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                       <div className="text-[16px] font-medium tracking-[-0.02em]"><em className="not-italic text-[#3db87a]">18</em></div>
                       <div className="text-[9px] text-[#ede9e3]/35">Publicados</div>
                    </div>
                    <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                       <div className="text-[16px] font-medium tracking-[-0.02em]">6</div>
                       <div className="text-[9px] text-[#ede9e3]/35">Em criação</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                      <span className="text-[11px] text-[#ede9e3]/60">José Carlos Lima</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#3db87a]/10 text-[#3db87a]">Publicado</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                      <span className="text-[11px] text-[#ede9e3]/60">Ana Paula Ramos</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#dbb43c]/10 text-[#dbb43c]">Processando IA</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#0c0e0d] border border-white/10 rounded-md px-2.5 py-2">
                      <span className="text-[11px] text-[#ede9e3]/60">Roberto Machado</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 text-[#ede9e3]/40">Aguardando família</span>
                    </div>
                  </div>
                </div>
               </div>

               {/* Screen 2 */}
               <div className="bg-[#111410] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-[#0e1110]">
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]"></div>
                  <div className="text-[11px] text-[#ede9e3]/30 ml-1">coleta guiada · família</div>
                </div>
                <div className="p-3.5 flex flex-col gap-1.5">
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-0.5">Pergunta 3 de 12</div>
                    <div className="text-[11px] text-[#ede9e3]/60">Qual era a maior paixão dela na vida?</div>
                    <div className="text-[11px] text-[#3db87a] mt-1 italic">Ensinar. Ela dizia que cada aluno era um legado.</div>
                  </div>
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-0.5">Pergunta 4 de 12</div>
                    <div className="text-[11px] text-[#ede9e3]/60">Como ela começou sua carreira?</div>
                    <div className="text-[11px] text-[#3db87a] mt-1 italic">Respondendo...</div>
                  </div>
                  <div className="bg-[#0c0e0d] border border-white/10 rounded-md px-3 py-2.5 opacity-40">
                    <div className="text-[9px] uppercase tracking-[0.08em] text-[#ede9e3]/30 mb-0.5">Pergunta 5 de 12</div>
                    <div className="text-[11px] text-[#ede9e3]/60">Qual memória a família mais guarda?</div>
                  </div>
                </div>
               </div>
            </div>
        </section>

        {/* TECH */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10">
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Stack tecnológico</div>
          <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
            Infraestrutura moderna construída para escalar.
          </h2>
          <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-10">
            Tecnologias reais organizadas por camada — sem buzzwords, sem atalhos.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-[#091409] border border-[#3db87a]/20 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#3db87a] mb-1.5">IA · Linguagem</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Claude Sonnet</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">Geração de narrativas</div>
            </div>
            <div className="bg-[#091409] border border-[#3db87a]/20 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#3db87a] mb-1.5">IA · Áudio</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Google TTS</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">Texto para voz</div>
            </div>
            <div className="bg-[#091409] border border-[#3db87a]/20 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#3db87a] mb-1.5">IA · Fallback</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Gemini</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">Redundância planejada</div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#ede9e3]/30 mb-1.5">Frontend</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">React 18 + Vite</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">Interface do produto</div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#ede9e3]/30 mb-1.5">Backend</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Express.js</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">API e lógica de negócio</div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#ede9e3]/30 mb-1.5">Dados · Auth</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Supabase</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">PostgreSQL + roles</div>
            </div>
            <div className="bg-[#111410] border border-white/10 rounded-lg p-3.5">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#ede9e3]/30 mb-1.5">Deploy · CI/CD</div>
              <div className="text-[13px] font-medium text-[#ede9e3]">Vercel + GitHub</div>
              <div className="text-[11px] text-[#ede9e3]/35 mt-0.5">Publicação e workflow</div>
            </div>
          </div>
        </section>

        {/* BUILDING */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">O que estamos construindo</div>
           <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
             Startup viva, evoluindo a cada sprint.
           </h2>
           <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
             Honestidade sobre o estágio atual — e clareza sobre onde estamos indo.
           </p>

           <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-w-5xl">
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#3db87a]/10 text-[#3db87a] px-2 py-0.5 rounded-sm mb-3">
                  <Check className="w-3 h-3" /> Concluído
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">Coleta guiada de memórias</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Fluxo de perguntas estruturadas para famílias, com upload de fotos e histórias.</p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#3db87a]/10 text-[#3db87a] px-2 py-0.5 rounded-sm mb-3">
                  <Check className="w-3 h-3" /> Concluído
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">Geração de narrativa por IA</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Integração Claude Sonnet para biografias emocionais humanizadas e revisáveis.</p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#3db87a]/10 text-[#3db87a] px-2 py-0.5 rounded-sm mb-3">
                  <Check className="w-3 h-3" /> Concluído
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">Áudio narrado</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Google TTS convertendo narrativas em áudio digital de alta qualidade.</p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#dbb43c]/10 text-[#dbb43c] px-2 py-0.5 rounded-sm mb-3">
                  Em desenvolvimento
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">Painel da funerária</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Dashboard completo de gestão de memoriais, clientes e status de produção.</p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-[#dbb43c]/10 text-[#dbb43c] px-2 py-0.5 rounded-sm mb-3">
                  Em desenvolvimento
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">QR Code físico-digital</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Geração e entrega de QR Code para integração com lápides e impressos.</p>
              </div>
              <div className="bg-[#111410] border border-white/10 rounded-xl p-5">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-[0.06em] uppercase bg-white/5 text-[#ede9e3]/35 px-2 py-0.5 rounded-sm mb-3">
                  Planejado
                </span>
                <h3 className="text-[13px] font-medium mb-1.5">Multi-funerária SaaS</h3>
                <p className="text-[12px] text-[#ede9e3]/40 leading-[1.6]">Arquitetura multi-tenant para escalar a múltiplas funerárias com isolamento de dados.</p>
              </div>
           </div>
        </section>

        {/* VISION */}
        <section className="px-6 py-24 md:py-32 bg-[#080a09] text-center">
           <div className="inline-flex items-center gap-1.5 text-[10px] text-[#ede9e3]/30 uppercase tracking-[0.1em] mb-5">
             <Leaf className="w-3 h-3" /> Visão de longo prazo
           </div>
           <h2 className="text-[clamp(24px,3.5vw,40px)] font-medium tracking-[-0.03em] leading-[1.2] max-w-[520px] mx-auto mb-5">
             Preservar histórias humanas é um problema <em className="not-italic text-[#3db87a]">tecnológico</em> ainda por resolver.
           </h2>
           <p className="text-[14px] text-[#ede9e3]/45 max-w-[400px] mx-auto mb-9 leading-[1.8]">
             Estamos construindo a infraestrutura que o setor funerário nunca teve. Memórias que antes se perdiam agora se tornam legados permanentes.
           </p>
           <Link to="/para-empresas" className="inline-flex bg-[#3db87a] text-[#051a0e] text-[13px] font-medium px-6 py-3 rounded-md hover:bg-[#3db87a]/90 transition-colors">
             Conhecer planos empresariais
           </Link>
        </section>

      </main>

      {/* MODAL DE VÍDEO MANIFESTO */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setIsVideoModalOpen(false)}>
          <div className="bg-[#0c0e0d] border border-white/10 rounded-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-[15px] font-medium text-[#ede9e3] flex items-center gap-2">
                <Play className="w-4 h-4 text-[#3db87a]" /> 
                A infraestrutura da memória
              </h2>
              <button onClick={() => setIsVideoModalOpen(false)} className="text-[#ede9e3]/50 hover:text-[#ede9e3] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="aspect-video bg-[#050605] relative flex items-center justify-center flex-col gap-4 border-b border-white/5">
              {/* placeholder para video real */}
              <div className="w-16 h-16 rounded-full bg-[#3db87a]/10 flex items-center justify-center mb-2">
                <Play className="w-6 h-6 text-[#3db87a] translate-x-0.5" />
              </div>
              <div className="text-center px-6">
                <div className="text-[14px] font-medium text-[#ede9e3] mb-1.5">Manifesto da Plataforma</div>
                <div className="text-[12px] text-[#ede9e3]/40 max-w-sm mx-auto leading-relaxed">
                  [ Aqui entrará o vídeo oficial apresentando o problema do setor funerário e o fluxo tecnológico da solução SaaS em 90 segundos. ]
                </div>
              </div>
            </div>

            <div className="p-5 md:px-8 md:py-6 bg-[#0c0e0d]">
               <div className="grid sm:grid-cols-3 gap-6">
                 <div>
                   <div className="text-[10px] uppercase tracking-[0.1em] text-[#3db87a] mb-2">01. O Problema</div>
                   <div className="text-[12px] text-[#ede9e3]/60 leading-[1.6]">Famílias desamparadas no luto e processos manuais improvisados nas empresas.</div>
                 </div>
                 <div>
                   <div className="text-[10px] uppercase tracking-[0.1em] text-[#3db87a] mb-2">02. A Operação</div>
                   <div className="text-[12px] text-[#ede9e3]/60 leading-[1.6]">Coleta digital guiada, estruturação narrativa via Claude Sonnet e áudio neural.</div>
                 </div>
                 <div>
                   <div className="text-[10px] uppercase tracking-[0.1em] text-[#3db87a] mb-2">03. O Resultado</div>
                   <div className="text-[12px] text-[#ede9e3]/60 leading-[1.6]">Memoriais acessíveis via QR Code, escaláveis em modelo B2B para funerárias.</div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
