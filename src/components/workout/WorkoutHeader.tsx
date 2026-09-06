"use client";

import React from 'react';
import { Language } from '@/lib/i18n/translations';
import { WorkoutValidationMode } from '@/lib/workout/pushup-form-validator';

interface WorkoutHeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  validationMode: WorkoutValidationMode;
  onToggleValidationMode: () => void;
  isVoiceUnavailable?: boolean;
  showDebug?: boolean;
  onToggleDebug?: () => void;
  disableVoiceLabel?: string;
  enableVoiceLabel?: string;
  strictLabel?: string;
  standardLabel?: string;
}

export function WorkoutHeader({
  lang,
  onLanguageChange,
  voiceEnabled,
  onToggleVoice,
  validationMode,
  onToggleValidationMode,
  isVoiceUnavailable = false,
  showDebug = false,
  onToggleDebug,
  disableVoiceLabel = "Disable Voice",
  enableVoiceLabel = "Enable Voice",
  strictLabel = "Strict",
  standardLabel = "Standard",
}: WorkoutHeaderProps) {
  return (
    <header className="w-full flex-none px-4 py-3 sm:px-6 flex justify-between items-center z-20 bg-transparent">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          PushUp
        </span>
        {process.env.NODE_ENV !== 'production' && onToggleDebug && (
          <button
            onClick={onToggleDebug}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              showDebug
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
            title="Toggle developer debug overlay"
          >
            DEBUG
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Strict / Standard Mode */}
        <button
          onClick={onToggleValidationMode}
          className="px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full bg-zinc-900/80 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          title="Toggle workout validation mode"
          aria-label={`Validation mode: ${validationMode === "strict" ? strictLabel : standardLabel}`}
        >
          {validationMode === "strict" ? `⚡ ${strictLabel}` : `🛡️ ${standardLabel}`}
        </button>

        {/* Language Switch */}
        <div className="flex bg-zinc-900/80 rounded-full p-0.5 border border-zinc-800" role="group" aria-label="Language selection">
          <button
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1 min-w-[44px] min-h-[44px] text-xs font-semibold rounded-full transition-colors flex items-center justify-center cursor-pointer ${
              lang === 'en'
                ? 'bg-zinc-200 text-black shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-pressed={lang === 'en'}
            aria-label="English"
          >
            EN
          </button>
          <button
            onClick={() => onLanguageChange('km')}
            className={`px-3 py-1 min-w-[44px] min-h-[44px] text-xs font-semibold rounded-full transition-colors flex items-center justify-center cursor-pointer ${
              lang === 'km'
                ? 'bg-zinc-200 text-black shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-pressed={lang === 'km'}
            aria-label="Khmer"
          >
            ខ្មែរ
          </button>
        </div>

        {/* Voice Toggle */}
        <button
          onClick={onToggleVoice}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
            voiceEnabled
              ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-700'
              : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-600 hover:text-zinc-400'
          }`}
          aria-label={voiceEnabled ? disableVoiceLabel : enableVoiceLabel}
          title={voiceEnabled ? disableVoiceLabel : enableVoiceLabel}
          aria-pressed={voiceEnabled}
        >
          <span className="text-base leading-none">
            {voiceEnabled ? "🔊" : "🔇"}
          </span>
        </button>
      </div>
    </header>
  );
}
