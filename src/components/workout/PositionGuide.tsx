"use client";

import React from 'react';
import { AppState } from './PushUpApp';

interface PositionGuideProps {
  appState: AppState;
  positionMessage: string;
  bodyAreaText?: string;
}

export function PositionGuide({ appState, positionMessage }: PositionGuideProps) {
  if (appState !== "POSITIONING" && appState !== "READY" && appState !== "PAUSED") return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-between p-6 sm:p-8 select-none">
      {/* Top Floating Prompt */}
      <div
        role="status"
        aria-live="polite"
        className="mt-14 sm:mt-16 px-5 py-2 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-white font-semibold text-sm sm:text-base backdrop-blur-md shadow-xl text-center max-w-[85%] truncate"
      >
        {positionMessage}
      </div>

      {/* Subtle Viewfinder Framing Box */}
      <div className="w-[85%] sm:w-[75%] h-[60%] sm:h-[65%] rounded-2xl relative transition-all duration-300 border border-white/10">
        {/* Modern Minimal Corner Accents */}
        <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
        <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
        <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
      </div>

      <div className="h-10" />
    </div>
  );
}

export function PositionStatus({ appState, positionMessage }: PositionGuideProps) {
  if (appState !== "WORKOUT" || !positionMessage) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none flex justify-center px-4"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-500/90 text-black px-4 py-1.5 rounded-full font-semibold text-xs sm:text-sm shadow-lg backdrop-blur-sm border border-amber-400/80 text-center max-w-[85%] truncate select-none"
      >
        {positionMessage}
      </div>
    </div>
  );
}
