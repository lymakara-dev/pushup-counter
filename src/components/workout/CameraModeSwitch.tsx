"use client";

import React from 'react';
import { CameraViewMode } from '@/lib/workout/pushup-detector';

interface CameraModeSwitchProps {
  currentMode: CameraViewMode;
  onModeChange: (mode: CameraViewMode) => void;
  frontLabel?: string;
  sideLabel?: string;
}

export function CameraModeSwitch({
  currentMode,
  onModeChange,
  frontLabel = "Front View",
  sideLabel = "Side View",
}: CameraModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Camera view mode"
      className="flex p-1 bg-zinc-900/90 rounded-full border border-zinc-800/80 backdrop-blur-md w-full max-w-[280px] select-none"
    >
      <button
        onClick={() => onModeChange("front")}
        aria-pressed={currentMode === "front"}
        className={`flex-1 min-h-[44px] py-2 px-3 text-xs sm:text-sm font-semibold rounded-full transition-all touch-manipulation cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          currentMode === "front"
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {frontLabel}
      </button>
      <button
        onClick={() => onModeChange("side")}
        aria-pressed={currentMode === "side"}
        className={`flex-1 min-h-[44px] py-2 px-3 text-xs sm:text-sm font-semibold rounded-full transition-all touch-manipulation cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          currentMode === "side"
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {sideLabel}
      </button>
    </div>
  );
}
