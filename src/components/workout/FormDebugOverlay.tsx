"use client";

import React from 'react';
import { CameraViewMode, PushUpResult } from '@/lib/workout/pushup-detector';

interface FormDebugOverlayProps {
  cameraMode: CameraViewMode;
  result: PushUpResult | null;
}

export function FormDebugOverlay({ cameraMode, result }: FormDebugOverlayProps) {
  if (process.env.NODE_ENV === 'production' || !result) return null;

  return (
    <div className="absolute top-16 left-4 z-40 p-3 rounded-xl bg-black/90 backdrop-blur-md border border-zinc-800 text-mono text-xs text-white max-w-[260px] shadow-2xl pointer-events-none select-none">
      <div className="font-bold text-emerald-400 border-b border-zinc-800 pb-1 mb-1.5 flex justify-between">
        <span>FORM DEBUG</span>
        <span className="text-zinc-500 uppercase">{cameraMode}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <span className="text-zinc-500">State:</span>
        <span className="font-semibold text-white">{result.state}</span>

        {cameraMode === "front" ? (
          <>
            <span className="text-zinc-500">Left Elbow:</span>
            <span>{Math.round(result.metrics?.leftElbowAngle || 0)}°</span>
            <span className="text-zinc-500">Right Elbow:</span>
            <span>{Math.round(result.metrics?.rightElbowAngle || 0)}°</span>
          </>
        ) : (
          <>
            <span className="text-zinc-500">Elbow:</span>
            <span>{Math.round(result.metrics?.elbowAngle || 0)}°</span>
            <span className="text-zinc-500">Alignment:</span>
            <span>{Math.round(result.metrics?.bodyAlignmentAngle || 180)}°</span>
          </>
        )}

        <span className="text-zinc-500">ROM:</span>
        <span>{(result.metrics?.romScore || 0).toFixed(2)}</span>

        <span className="text-zinc-500">Visibility:</span>
        <span>{Math.round((result.metrics?.visibility || 0) * 100)}%</span>

        <span className="text-zinc-500">Form Score:</span>
        <span className="font-bold text-amber-400">{result.formScore}/100</span>

        <span className="text-zinc-500">Bottom Valid:</span>
        <span className={result.metrics?.bottomValid ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {result.metrics?.bottomValid ? "YES" : "NO"}
        </span>

        <span className="text-zinc-500">Top Valid:</span>
        <span className={result.metrics?.topValid ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {result.metrics?.topValid ? "YES" : "NO"}
        </span>
      </div>

      {result.reasons && result.reasons.length > 0 && (
        <div className="mt-1.5 pt-1 border-t border-zinc-800 text-[10px] text-red-400 truncate">
          {result.reasons[0]}
        </div>
      )}
    </div>
  );
}
