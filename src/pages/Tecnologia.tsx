import { Link } from 'react-router-dom';
import { ArrowLeft, Database, Shield, Cpu, Code2, Server, Waves, Check } from 'lucide-react';

export default function Tecnologia() {
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
            <li><Link to="/tecnologia" className="text-[13px] text-[#ede9e3] transition-colors">Tecnologia</Link></li>
            <li><Link to="/sobre" className="text-[13px] text-[#ede9e3]/45 hover:text-[#ede9e3] transition-colors">Quem somos</Link></li>
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
          
          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5 relative z-10">Engenharia & Stack</div>
          <h1 className="text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.03em] max-w-[680px] mb-5 relative z-10">
            Infraestrutura construída para escalabilidade, segurança e contingência.
          </h1>
          <p className="text-[15px] text-[#ede9e3]/55 leading-[1.8] max-w-[540px] mb-9 relative z-10">
            Não criamos atalhos técnicos para o longo prazo. O Eco de Memórias adota uma arquitetura de software moderna, focada no nível enterprise, com isolamento absoluto de dados transacionais B2B. A fundação de um sistema projetado para nunca sair do ar.
          </p>
        </section>

        {/* DISTRIBUIÇÃO E EDGE */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Distribuição & Edge</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
              Entrega Instantânea nos cemitérios.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
              Sabemos que a conexão em locais abertos e remotos pode ser instável. O portal público dos memoriais e seus assets de áudio são entregues via CDN (Content Delivery Network).
            </p>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-5xl">
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                 <div className="w-8 h-8 rounded-md bg-[#3db87a]/10 flex items-center justify-center mb-4 text-[#3db87a]">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Sem Aplicativos</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   A leitura QR Code leva o visitante diretamente à PWA responsiva Edge Vercel. Não há barreira de download. Em menos de 2 segundos a biografia é carregada na tela.
                 </p>
               </div>
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                 <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[#ede9e3]/40">
                   <Server className="w-4 h-4" />
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Geração Estática sob Demanda</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   Quando a IA finaliza os memoriais, os portais públicos mantêm os dados em cache persistente. O Supabase Database nunca sofre stress térmico com visitantes do portal. 
                 </p>
               </div>
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                 <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[#ede9e3]/40">
                   <Code2 className="w-4 h-4" />
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Layout Inteligente</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   Frontend otimizado baseado em Vite + React 18 que renderiza condicionalmente as timelines históricas, moderando carga pesada de mídia progressivamente.
                 </p>
               </div>
            </div>
        </section>

        {/* INTELIGÊNCIA ARTIFICIAL */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0c0e0d]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Sistema Generativo</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
              Cérebro Dual: Redundância híbrida de Inteligência Artificial.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
              Sistemas dependentes de uma única API enfrentam gargalos logísticos. Implementamos um fall-back robusto arquitetado para estabilidade absoluta nas requisições.
            </p>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-5xl">
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                 <div className="w-8 h-8 rounded-md bg-[#3db87a]/10 flex items-center justify-center mb-4 text-[#3db87a]">
                   <Cpu className="w-4 h-4" />
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Claude Sonnet 3.5 (Core Central)</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   Modelo padrão focado estritamente na coesão moral e tons textuais empáticos. Lê os parâmetros de preenchimento da família e devolve conteúdo final no limite de palavras exigido.
                 </p>
               </div>
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#ffbd2e]/50 to-transparent"></div>
                 <div className="w-8 h-8 rounded-md bg-[#ffbd2e]/10 flex items-center justify-center mb-4 text-[#ffbd2e]">
                   <Server className="w-4 h-4" />
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Gemini Pro API (Fallback Nativo)</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   Acionado de forma programática pelo backend Node caso o modelo primário rejeite a inferência por limitações de cota ou rede. Garante 99.9% de uptime para a empresa emitente.
                 </p>
               </div>
               <div className="bg-[#111410] border border-white/10 rounded-xl p-6">
                 <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[#ede9e3]/40">
                   <Waves className="w-4 h-4" />
                 </div>
                 <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Google Cloud TTS Studio</h3>
                 <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6]">
                   Processador assíncrono que consome a biografia finalizada e sintetiza narrativas hiper-realistas. Os buffers gerados são cacheados permanentemente no Storage seguro.
                 </p>
               </div>
            </div>
            
            {/* Diagrama de Backend Seguro */}
            <div className="mt-10 bg-[#111410] border border-white/10 rounded-xl overflow-hidden max-w-5xl">
               <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/10 bg-[#0e1110]">
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ff5f57]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-[6px] h-[6px] rounded-full bg-[#28c840]"></div>
                  <div className="text-[11px] text-[#ede9e3]/30 ml-1">arquitetura-backend.ts</div>
                </div>
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-center text-center relative">
                   {/* Linha de conexão do diagrama mobile (hidden on desktop) */}
                   <div className="absolute top-[20%] left-1/2 w-0.5 h-[60%] bg-[#3db87a]/20 md:hidden z-0"></div>
                   
                   <div className="relative z-10 bg-[#0c0e0d] p-4 rounded-xl border border-white/5 w-full md:w-auto shadow-xl">
                     <div className="text-[10px] font-medium tracking-widest text-[#ede9e3]/40 mb-3 uppercase">Painel da Empresa</div>
                     <div className="border border-white/10 bg-white/5 px-4 py-2 rounded-md text-[13px] flex items-center gap-2 justify-center">
                       <Check className="w-3.5 h-3.5 text-[#3db87a]" /> React Client (Vite)
                     </div>
                   </div>
                   
                   <div className="h-px w-10 bg-white/10 hidden md:block relative z-10 flex-shrink-0">
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-[#3db87a] rotate-45 transform translate-x-1/2"></div>
                   </div>
                   
                   <div className="flex flex-col gap-2 relative z-10 w-full md:w-auto bg-[#0c0e0d] p-4 rounded-xl border border-[#3db87a]/20 shadow-[0_0_30px_rgba(61,184,122,0.05)]">
                     <div className="text-[10px] font-medium tracking-widest text-[#3db87a] mb-2 uppercase">Servidor Express Restrito</div>
                     <div className="flex flex-col gap-2 relative">
                       <div className="border border-[#3db87a]/20 bg-[#3db87a]/5 px-4 py-2 rounded-md text-[12px] border-dashed text-[#3db87a] font-mono">1. Validação JWT Supabase</div>
                       <div className="border border-[#3db87a]/20 bg-[#3db87a]/5 px-4 py-2 rounded-md text-[12px] border-dashed text-[#3db87a] font-mono">2. Injeção de Secret Keys (Env)</div>
                       <div className="border border-[#3db87a]/20 bg-[#3db87a]/5 px-4 py-2 rounded-md text-[12px] border-dashed text-[#3db87a] font-mono">3. Fallback Engine Load Balancer</div>
                     </div>
                   </div>
                   
                   <div className="h-px w-10 bg-white/10 hidden md:block relative z-10 flex-shrink-0">
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t border-r border-white/30 rotate-45 transform translate-x-1/2"></div>
                   </div>
                   
                   <div className="flex flex-col gap-2 relative z-10 w-full md:w-auto bg-[#0c0e0d] p-4 rounded-xl border border-white/5">
                     <div className="text-[10px] font-medium tracking-widest text-[#ede9e3]/40 mb-3 uppercase">Providers Nativos</div>
                     <div className="border border-white/10 bg-white/5 px-4 py-2 rounded-md text-[13px] flex items-center justify-center gap-2 text-white/70">
                       <Cpu className="w-3.5 h-3.5" /> Anthropic / Google
                     </div>
                   </div>
                </div>
                <div className="px-6 py-4 bg-[#091409] border-t border-[#3db87a]/10 text-[12px] text-[#3db87a] flex items-center justify-center gap-2 font-medium">
                  <Shield className="w-3.5 h-3.5" /> Chaves de Inteligência Artificial jamais são expostas no front-end.
                </div>
            </div>
        </section>

        {/* DADOS E SEGURANÇA */}
        <section className="px-6 md:px-10 py-16 md:py-20 border-b border-white/10 bg-[#0a0c0b]">
           <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3db87a] mb-3.5">Privacidade B2B</div>
            <h2 className="text-[clamp(20px,2.8vw,32px)] font-medium tracking-[-0.025em] leading-[1.2] max-w-[540px] mb-3.5">
              Blindagem de Dados em Nível de DB.
            </h2>
            <p className="text-[14px] text-[#ede9e3]/50 leading-[1.75] max-w-[480px] mb-11">
              Concorrentes costumam separar inquilinos apenas na interface. Nós isolamos registros por meio de diretivas do motor PostgreSQL, garantindo matemática blindada nas consultas.
            </p>

            <div className="grid lg:grid-cols-2 gap-3 max-w-5xl">
              <div className="bg-[#111410] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
                 <div>
                   <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[#ede9e3]/40">
                     <Database className="w-4 h-4" />
                   </div>
                   <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">PostgreSQL (Supabase Cloud)</h3>
                   <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-6">
                     Banco de dados relacional operando exclusivamente no schema <code>public</code>. Escalabilidade real, transações ACID garantidas e triggers de otimização de leitura. O motor não quebra sob o peso de acessos simultâneos de feriados.
                   </p>
                 </div>
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 text-[12px] text-[#ede9e3]/60"><Check className="w-3.5 h-3.5 text-[#3db87a]" /> Autenticação Go-True (Supabase Auth)</div>
                   <div className="flex items-center gap-2 text-[12px] text-[#ede9e3]/60"><Check className="w-3.5 h-3.5 text-[#3db87a]" /> Storage com Buckets Públicos (Áudio/Mídia)</div>
                   <div className="flex items-center gap-2 text-[12px] text-[#ede9e3]/60"><Check className="w-3.5 h-3.5 text-[#3db87a]" /> Triggers e Functions RPC pré-compiladas</div>
                 </div>
              </div>

              <div className="bg-[#111410] border border-white/10 rounded-xl p-6 flex flex-col justify-between overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Shield className="w-32 h-32" />
                 </div>
                 <div className="relative z-10">
                   <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center mb-4 text-[#ede9e3]/40">
                     <Shield className="w-4 h-4" />
                   </div>
                   <h3 className="text-[14px] font-medium text-[#ede9e3] mb-2">Row Level Security (RLS) Nativo</h3>
                   <p className="text-[13px] text-[#ede9e3]/45 leading-[1.6] mb-6">
                     A fundação multi-tenant exige que cada empresa funerária observe e interaja unicamente com dados gerados por seu Token UUID (User ID). Este bloqueio é injetado diretamente na tabela.
                   </p>
                 </div>
                 <div className="bg-[#0c0e0d] border border-white/5 p-4 rounded-xl overflow-x-auto text-[11px] text-[#3db87a]/80 font-mono shadow-inner relative z-10 mt-auto">
                   <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                     <span className="w-2 h-2 rounded-full bg-[#ff5f57]"></span>
                     <span className="text-white/40">postgres-policy.sql</span>
                   </div>
                   <span className="text-[#ede9e3]/30">-- Política Transacional Corporativa</span><br/>
                   <span className="text-[#c792ea]">CREATE POLICY</span> <span className="text-[#a3e4d7]">"Isolamento B2B - Insert/Select"</span><br/>
                   <span className="text-[#c792ea]">ON</span> public.memoriais<br/>
                   <span className="text-[#c792ea]">FOR ALL USING</span> (auth.uid() = user_id);
                 </div>
              </div>
            </div>
        </section>

      </main>
    </div>
  );
}
