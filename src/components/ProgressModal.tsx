import { X, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface ProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPanel: () => void;
  onGenerate: () => void;
  state: 1 | 2; // 1 = Início de Jornada, 2 = Pronto para Gerar
  lastAnswer: string;
  mandatoryFilled: number;
  totalMandatory: number;
  optionalFilled: number;
  totalOptional: number;
}

export function ProgressModal({
  isOpen,
  onClose,
  onPanel,
  onGenerate,
  state,
  lastAnswer,
  mandatoryFilled,
  totalMandatory,
  optionalFilled,
  totalOptional
}: ProgressModalProps) {
  const [animStep, setAnimStep] = useState(0);
  const [progressMandatory, setProgressMandatory] = useState(0);
  const [progressOptional, setProgressOptional] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAnimStep(0);
      setProgressMandatory(0);
      setProgressOptional(0);
      
      const savedPreference = localStorage.getItem('hideMemorialProgressModal') === 'true';
      setDontShowAgain(savedPreference);

      const intervals: number[] = [];
      const totalSteps = 7;
      
      for (let i = 0; i < totalSteps; i++) {
        intervals.push(window.setTimeout(() => {
          setAnimStep(i + 1);
        }, i * 400));
      }

      // Progress bar animation starts at step 3
      window.setTimeout(() => {
        setProgressMandatory(mandatoryFilled);
        setProgressOptional(optionalFilled);
      }, 2 * 400);

      return () => {
        intervals.forEach(clearTimeout);
      };
    }
  }, [isOpen, mandatoryFilled, optionalFilled]);

  if (!isOpen) return null;

  const handleDontShowAgain = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    localStorage.setItem('hideMemorialProgressModal', checked.toString());
  };

  const totalFilled = mandatoryFilled + optionalFilled;
  
  let title = '';
  let badgeText = '';
  let badgeColor = '';
  let emotionalMark = '';
  let guidanceText = '';

  if (totalFilled === 0) {
    title = 'Quando você começar a responder, suas memórias serão guardadas aqui com segurança.';
    badgeText = 'Narrativa Mínima em construção';
    badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
    guidanceText = `Faltam apenas ${totalMandatory - mandatoryFilled} perguntas obrigatórias com asterisco para poder gerar a biografia. Cada memória que você adicionar vai enriquecer a história. Volte quando estiver pronto, tudo que você escreveu está guardado com segurança.`;
  } else if (state === 1) {
    title = 'As primeiras memórias foram guardadas com segurança.';
    badgeText = 'Narrativa Mínima em construção';
    badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
    guidanceText = `Faltam apenas ${totalMandatory - mandatoryFilled} perguntas obrigatórias com asterisco para poder gerar a biografia. Cada memória que você adicionar vai enriquecer a história. Volte quando estiver pronto, tudo que você escreveu está guardado com segurança.`;
  } else {
    title = 'Você já tem o essencial para contar esta história.';
    badgeText = 'Narrativa Média pronta para geração com possibilidade de enriquecer';
    badgeColor = 'bg-green-100 text-green-800 border-green-200';
    guidanceText = `Você já pode gerar a biografia agora. Se quiser enriquecê-la ainda mais faltam ${totalOptional - optionalFilled} perguntas opcionais que vão dar mais profundidade à narrativa.`;
  }

  if (totalFilled <= 5) {
    emotionalMark = 'As primeiras sementes foram plantadas.';
  } else if (totalFilled <= 11) {
    emotionalMark = 'A história está ganhando forma.';
  } else if (totalFilled <= 16) {
    emotionalMark = 'A base da narrativa está construída.';
  } else if (totalFilled <= 19) {
    emotionalMark = 'A história está quase completa.';
  } else {
    emotionalMark = 'História completa e pronta.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5c5042]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-[#E8E4DB] animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header Section (Step 1) */}
        <div className={`transition-opacity duration-500 ease-in-out p-6 pb-4 border-b border-[#E8E4DB] relative ${animStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-xl font-bold text-[#4A3F35] leading-tight pr-10">
            {title}
          </h2>
          {animStep > 0 && animStep < 7 ? (
            <div className="absolute top-6 right-6 text-[#8C7A6B]">
               <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <button 
               onClick={onClose} 
               className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto hide-scrollbar">
          {/* Checkpoint (Step 2) */}
          <div className={`transition-opacity duration-500 ease-in-out ${animStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            {totalFilled === 0 ? (
               <div className="bg-white p-4 rounded-xl border border-[#E8E4DB] shadow-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#8C7A6B] rounded-l-xl"></div>
                <p className="text-sm text-[#4A3F35] italic leading-relaxed text-center">Nenhuma memória registrada ainda. Comece quando estiver pronto.</p>
              </div>
            ) : lastAnswer ? (
              <div className="bg-white p-4 rounded-xl border border-[#E8E4DB] shadow-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#8C7A6B] rounded-l-xl"></div>
                <p className="text-xs text-[#8C7A6B] mb-1.5 font-medium uppercase tracking-wider">a memória mais recente que você nos confiou foi</p>
                <p className="text-sm text-[#4A3F35] italic leading-relaxed">"{lastAnswer.length > 150 ? lastAnswer.substring(0, 150) + '...' : lastAnswer}"</p>
              </div>
            ) : null}
          </div>

          {/* Dual Progress Bar (Step 3) */}
          <div className={`space-y-2.5 transition-opacity duration-500 ease-in-out ${animStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="relative h-4 w-full bg-[#E8E4DB] rounded-full overflow-hidden">
               <div 
                 className="absolute top-0 left-0 h-full bg-[#A89F91] transition-all duration-700 ease-out" 
                 style={{ width: `${((progressMandatory + progressOptional) / (totalMandatory + totalOptional)) * 100}%` }}
               />
               <div 
                 className="absolute top-0 left-0 h-full bg-[#6B5D50] transition-all duration-700 ease-out z-10" 
                 style={{ width: `${(progressMandatory / (totalMandatory + totalOptional)) * 100}%` }}
               />
            </div>
            <div className="flex justify-between text-xs font-medium">
               <span className="text-[#6B5D50]">perguntas obrigatórias com asterisco {mandatoryFilled} de {totalMandatory}</span>
               <span className="text-[#8C7A6B]">perguntas opcionais {optionalFilled} de {totalOptional}</span>
            </div>
          </div>

          {/* Badge & Emotional Mark (Step 4 & 5) */}
          <div className="flex flex-col gap-3 items-start">
            <div className={`transition-opacity duration-500 ease-in-out ${animStep >= 4 ? 'opacity-100' : 'opacity-0'}`}>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                {badgeText}
              </span>
            </div>
            <div className={`transition-opacity duration-500 ease-in-out ${animStep >= 5 ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-sm font-medium text-[#6B5D50]">
                {emotionalMark}
              </p>
            </div>
          </div>

          {/* Guidance Message (Step 6) */}
          <div className={`transition-opacity duration-500 ease-in-out ${animStep >= 6 ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-sm text-[#6B5D50] leading-relaxed">
              {guidanceText}
            </p>
          </div>
        </div>

        {/* Actions (Step 7) */}
        <div className={`transition-opacity duration-500 ease-in-out p-6 bg-[#F4F1EC] border-t border-[#E8E4DB] flex flex-col gap-3 rounded-b-2xl ${animStep >= 7 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            {state === 1 ? (
               <>
                 <button 
                   onClick={onClose}
                   className="w-full sm:w-auto flex-1 bg-[#4A3F35] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#3A3129] transition-colors"
                 >
                   Continuar Respondendo
                 </button>
                 <button 
                   onClick={onPanel}
                   className="w-full sm:w-auto flex-1 bg-white text-[#4A3F35] border border-[#D0C7B8] px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                 >
                   Salvar e Sair
                 </button>
               </>
            ) : (
               <div className="flex flex-col w-full gap-3">
                 <button 
                   onClick={onGenerate}
                   className="w-full bg-[#4A3F35] text-white px-4 py-3 rounded-lg font-medium hover:bg-[#3A3129] transition-colors shadow-sm"
                 >
                   Gerar Biografia Agora
                 </button>
                 <div className="flex flex-col sm:flex-row gap-3">
                   <button 
                     onClick={onClose}
                     className="w-full sm:w-1/2 bg-[#C7BAA8] text-[#4A3F35] border border-[#B3A694] px-4 py-2.5 rounded-lg font-medium hover:bg-[#BDB09F] transition-colors"
                   >
                     Continuar Enriquecendo
                   </button>
                   <button 
                     onClick={onPanel}
                     className="w-full sm:w-1/2 bg-white text-[#4A3F35] border border-[#D0C7B8] px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                   >
                     Salvar e Sair
                   </button>
                 </div>
               </div>
            )}
          </div>
          
          <label className="flex items-center gap-2 mt-2 cursor-pointer group">
             <input 
               type="checkbox" 
               checked={dontShowAgain}
               onChange={handleDontShowAgain}
               className="rounded border-[#D0C7B8] text-[#4A3F35] focus:ring-[#4A3F35] cursor-pointer"
             />
             <span className="text-xs text-[#6B5D50] group-hover:text-[#4A3F35] transition-colors">
               Não mostrar este resumo nas próximas vezes
             </span>
          </label>
        </div>

      </div>
    </div>
  );
}

