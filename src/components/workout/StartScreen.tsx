"use client";

import React from 'react';
import { Language, TranslationDictionary } from '@/lib/i18n/translations';
import { WorkoutValidationMode } from '@/lib/workout/pushup-form-validator';

interface StartScreenProps {
  t: TranslationDictionary;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  validationMode: WorkoutValidationMode;
  onToggleValidationMode: () => void;
  isModelReady: boolean;
  isLoadingModel: boolean;
  onStart: () => void;
  isVoiceUnavailable?: boolean;
}

export function StartScreen({
  t,
  lang,
  onLanguageChange,
  voiceEnabled,
  onToggleVoice,
  validationMode,
  onToggleValidationMode,
  isModelReady,
  isLoadingModel,
  onStart,
  isVoiceUnavailable = false,
}: StartScreenProps) {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-between min-h-[90dvh] p-6 sm:p-8 text-center select-none">
      {/* Top Header Bar */}
      <div className="w-full flex justify-between items-center">
        <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {t.appName}
        </span>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded-full p-0.5 border border-zinc-800">
            <button
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                lang === 'en' ? 'bg-zinc-200 text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => onLanguageChange('km')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                lang === 'km' ? 'bg-zinc-200 text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ខ្មែរ
            </button>
          </div>
        </div>
      </div>

      {/* Main Hero Content */}
      <div className="flex flex-col items-center my-auto max-w-sm">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3">
          {t.appName}
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg mb-8 leading-relaxed">
          {t.appDescription}
        </p>

        {isLoadingModel ? (
          <div className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-zinc-300 font-medium rounded-full border border-zinc-800">
            <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
            <span className="text-sm">{t.loadingModel}</span>
          </div>
        ) : !isModelReady ? (
          <div className="px-6 py-3 bg-red-950/40 text-red-400 font-medium rounded-full border border-red-900/50 text-sm">
            {t.failedToLoadModel}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            <button
              onClick={onStart}
              className="w-full py-4 min-h-[56px] bg-white hover:bg-zinc-200 text-black font-bold rounded-full text-lg shadow-lg hover:shadow-white/10 active:scale-[0.98] transition-all touch-manipulation cursor-pointer"
            >
              {t.startCamera}
            </button>

            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={onToggleVoice}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-medium hover:border-zinc-700 hover:text-white transition-colors"
              >
                <span>{voiceEnabled ? "🔊" : "🔇"}</span>
                <span>{voiceEnabled ? t.voiceOn : t.voiceOff}</span>
              </button>

              <button
                onClick={onToggleValidationMode}
                className="px-4 py-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-medium hover:border-zinc-700 hover:text-white transition-colors"
              >
                {validationMode === "strict" ? `⚡ ${t.modeStrict}` : `🛡️ ${t.modeStandard}`}
              </button>
            </div>

            {isVoiceUnavailable && voiceEnabled && (
              <span className="text-xs text-amber-500 mt-1">
                Khmer voice unavailable / ឧបករណ៍នេះមិនមានសំឡេងខ្មែរទេ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Privacy Note */}
      <div className="w-full max-w-xs text-center">
        <p className="text-xs text-zinc-400 leading-normal">
          {t.privacyMessage}
        </p>
      </div>
    </div>
  );
}
