"use client";

import React from 'react';
import { PushUpState } from '@/lib/workout/pushup-detector';

interface WorkoutStatusProps {
  appState: string;
  pushupState: PushUpState;
  feedbackKey: string;
  statusText: string;
}

export function WorkoutStatus({
  appState,
  pushupState,
  feedbackKey,
  statusText,
}: WorkoutStatusProps) {
  // Determine color theme & icon based on feedback key / state
  let dotColor = "bg-zinc-400";
  let textColor = "text-zinc-200";
  let borderClass = "border-zinc-800/80 bg-zinc-900/80";
  let icon: React.ReactNode = <span className="w-2 h-2 rounded-full bg-zinc-400" />;

  if (appState !== "WORKOUT") {
    if (appState === "PAUSED") {
      dotColor = "bg-amber-400";
      textColor = "text-amber-300";
      borderClass = "border-amber-500/30 bg-amber-950/40";
      icon = <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
    } else {
      dotColor = "bg-zinc-400";
      textColor = "text-zinc-300";
      borderClass = "border-zinc-800/80 bg-zinc-900/80";
      icon = <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />;
    }
  } else if (feedbackKey === "GOOD_FORM" || feedbackKey === "UP") {
    dotColor = "bg-emerald-400";
    textColor = "text-emerald-300";
    borderClass = "border-emerald-500/30 bg-emerald-950/40";
    icon = <span className="text-xs font-bold leading-none">✓</span>;
  } else if (feedbackKey === "GO_LOWER") {
    dotColor = "bg-amber-400";
    textColor = "text-amber-300";
    borderClass = "border-amber-500/30 bg-amber-950/40";
    icon = <span className="text-xs font-bold leading-none">↓</span>;
  } else if (feedbackKey === "BODY_STRAIGHT" || feedbackKey === "IMPROVE_POSITION" || feedbackKey === "HIPS_TOO_HIGH" || feedbackKey === "HIPS_TOO_LOW") {
    dotColor = "bg-amber-400";
    textColor = "text-amber-300";
    borderClass = "border-amber-500/30 bg-amber-950/40";
    icon = <span className="w-2 h-2 rounded-full bg-amber-400" />;
  } else if (feedbackKey === "REP_NOT_COUNTED" || feedbackKey === "TOO_FAST") {
    dotColor = "bg-red-400";
    textColor = "text-red-300";
    borderClass = "border-red-500/30 bg-red-950/40";
    icon = <span className="text-xs font-bold leading-none">✕</span>;
  } else if (pushupState === PushUpState.DOWN) {
    dotColor = "bg-amber-400";
    textColor = "text-amber-300";
    borderClass = "border-amber-500/30 bg-amber-950/40";
    icon = <span className="w-2 h-2 rounded-full bg-amber-400" />;
  } else if (pushupState === PushUpState.READY) {
    dotColor = "bg-emerald-400";
    textColor = "text-emerald-300";
    borderClass = "border-emerald-500/30 bg-emerald-950/40";
    icon = <span className="w-2 h-2 rounded-full bg-emerald-400" />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md shadow-lg transition-all select-none ${borderClass} ${textColor}`}
    >
      {icon}
      <span>{statusText}</span>
    </div>
  );
}
