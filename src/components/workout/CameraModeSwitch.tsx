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
    <div className="flex p-1 bg-zinc-900/90 rounded-full border border-zinc-800/80 backdrop-blur-md w-full max-w-[280px] select-none">
      <button
        onClick={() => onModeChange("front")}
        className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-full transition-all touch-manipulation cursor-pointer ${
          currentMode === "front"
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {frontLabel}
      </button>
      <button
        onClick={() => onModeChange("side")}
        className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-full transition-all touch-manipulation cursor-pointer ${
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
