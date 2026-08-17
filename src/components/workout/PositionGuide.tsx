import React from 'react';
import { AppState } from './PushUpApp';

interface PositionGuideProps {
  appState: AppState;
  positionMessage: string;
  bodyAreaText?: string;
}

export function PositionGuide({ appState, positionMessage, bodyAreaText = "Body Area" }: PositionGuideProps) {
  if (appState !== "POSITIONING" && appState !== "READY" && appState !== "PAUSED") return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center p-safe">
      <div className="bg-black/80 px-6 py-3 rounded-full text-white font-bold text-lg md:text-xl backdrop-blur-md mb-8 shadow-2xl border border-white/20 transition-all text-center mx-4">
        {positionMessage}
      </div>
      
      {/* Body Area Guide Box - Responsive Dimensions */}
      <div className="w-[85%] sm:w-[70%] md:w-[60%] h-[60%] md:h-[70%] border-4 border-dashed border-white/30 rounded-3xl relative transition-all duration-300">
        <div className="absolute top-[-4px] left-[-4px] w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-[1.25rem]"></div>
        <div className="absolute top-[-4px] right-[-4px] w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-[1.25rem]"></div>
        <div className="absolute bottom-[-4px] left-[-4px] w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-[1.25rem]"></div>
        <div className="absolute bottom-[-4px] right-[-4px] w-12 h-12 border-b-4 border-r-4 border-white rounded-br-[1.25rem]"></div>
        <div className="absolute inset-0 flex items-center justify-center">
           <span className="text-white/20 font-black text-2xl md:text-4xl tracking-widest uppercase">{bodyAreaText}</span>
        </div>
      </div>
    </div>
  );
}

export function PositionStatus({ appState, positionMessage }: PositionGuideProps) {
  if (appState !== "WORKOUT" || !positionMessage) return null;

  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none flex justify-center px-4" style={{ top: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="bg-amber-500/90 text-black px-4 py-2 rounded-full font-bold text-sm md:text-base shadow-lg backdrop-blur-sm animate-pulse border border-amber-400 text-center max-w-[90%] truncate">
        ⚠️ {positionMessage}
      </div>
    </div>
  );
}
