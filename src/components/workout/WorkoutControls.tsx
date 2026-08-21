"use client";

import React from 'react';

interface WorkoutControlsProps {
  onReset: () => void;
  onStop: () => void;
  resetLabel?: string;
  stopLabel?: string;
}

export function WorkoutControls({
  onReset,
  onStop,
  resetLabel = "Reset",
  stopLabel = "Stop Camera",
}: WorkoutControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 w-full max-w-[280px] select-none">
      {/* Reset Button */}
      <button
        onClick={onReset}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs sm:text-sm font-semibold hover:bg-zinc-800 hover:text-white transition-colors active:scale-95 touch-manipulation cursor-pointer"
        aria-label={resetLabel}
        title={resetLabel}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span>{resetLabel}</span>
      </button>

      {/* Stop Camera Button */}
      <button
        onClick={onStop}
        className="flex-1 py-2.5 px-5 rounded-full bg-zinc-900/80 border border-zinc-800 hover:border-red-900/60 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 text-xs sm:text-sm font-semibold transition-colors active:scale-95 touch-manipulation cursor-pointer"
      >
        {stopLabel}
      </button>
    </div>
  );
}
