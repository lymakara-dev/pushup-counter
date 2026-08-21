"use client";

import React, { useEffect, useState } from 'react';

interface RepCounterProps {
  count: number;
  label?: string;
  isActive?: boolean;
}

export function RepCounter({ count, label = "Push-ups", isActive = true }: RepCounterProps) {
  const [isBumping, setIsBumping] = useState(false);

  useEffect(() => {
    if (count > 0) {
      setIsBumping(true);
      const timer = setTimeout(() => setIsBumping(false), 240);
      return () => clearTimeout(timer);
    }
  }, [count]);

  return (
    <div className="flex flex-col items-center justify-center select-none pointer-events-none">
      <div
        className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-none font-black tabular-nums tracking-tight transition-transform ${
          isBumping ? 'animate-rep-bump text-white' : isActive ? 'text-white' : 'text-white/40'
        }`}
      >
        {count}
      </div>
      <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-zinc-400 mt-1.5 drop-shadow-sm">
        {label}
      </span>
    </div>
  );
}
