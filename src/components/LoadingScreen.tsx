import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  isGenerating: boolean;
  isComplete?: boolean;
  onComplete?: () => void;
  statusMessage?: string;
}

const MESSAGES = [
  "Coletando suas memórias...",
  "Organizando as lembranças por gavetas...",
  "Identificando os traços mais marcantes...",
  "Construindo a narrativa...",
  "Finalizando a biografia..."
];

export function LoadingScreen({ isGenerating, isComplete, onComplete, statusMessage }: LoadingScreenProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const onCompleteRef = React.useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isGenerating && !isComplete) {
      setProgress(0);
      setCurrentMessageIndex(0);
      return;
    }
    
    // Progress bar advances from 0 to 90% over ~15 seconds
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 1.5; // (1000ms / 15000ms) * 90 ≈ 6 per second. So 1.5 per 250ms interval.
      });
    }, 250);

    // Messages change every 3 seconds
    const messageInterval = setInterval(() => {
      setOpacity(0); // triggering fade out
      setTimeout(() => {
        setCurrentMessageIndex((prev) => {
          if (isComplete && prev >= MESSAGES.length - 1) return prev;
          return prev < MESSAGES.length - 1 ? prev + 1 : prev;
        });
        setOpacity(1); // triggering fade in
      }, 500);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [isGenerating, isComplete]);

  useEffect(() => {
    if (isComplete) {
      setProgress(100);
      setCurrentMessageIndex(MESSAGES.length - 1);
      
      const timer = setTimeout(() => {
        if (onCompleteRef.current) onCompleteRef.current();
      }, 1500); // 1.5 seconds at 100% before firing onComplete to show the user it actually finished
      
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!isGenerating && !isComplete && progress === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50">
      <div className="max-w-md w-full px-8 flex flex-col items-center">
        
        {/* Spinner */}
        <Loader2 className="w-12 h-12 text-stone-800 animate-spin mb-8" />
        
        {/* Texts */}
        <div className="h-16 flex items-center justify-center text-center">
          <p 
             className="text-2xl font-serif text-stone-800 transition-opacity duration-500 ease-in-out"
             style={{ opacity }}
          >
            {statusMessage || MESSAGES[currentMessageIndex]}
          </p>
        </div>
        
        {/* Progress Bar Container */}
        <div className="w-full mt-10 bg-stone-200 rounded-full h-1.5 overflow-hidden">
          {/* Progress Bar Fill */}
          <div 
             className="bg-stone-800 h-1.5 rounded-full transition-all duration-300 ease-out" 
             style={{ width: `${progress}%` }} 
          />
        </div>
        
        <p className="mt-4 text-sm font-medium text-stone-500 font-serif">
          Por favor, aguarde. Este processo pode levar alguns instantes.
        </p>

      </div>
    </div>
  );
}
