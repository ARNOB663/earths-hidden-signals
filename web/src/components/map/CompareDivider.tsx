"use client";

import { ArrowsHorizontal } from "@phosphor-icons/react";
import { useRef } from "react";

/** Draggable vertical divider for comparing two dates on the map (left = then, right = now). */
export function CompareDivider({
  split,
  onChange,
  leftLabel,
  rightLabel,
}: {
  split: number;
  onChange: (split: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(0.95, Math.max(0.05, v));

  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = ref.current!.getBoundingClientRect();
    onChange(clamp((e.clientX - rect.left) / rect.width));
  };

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[550]">
      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-card shadow-soft" style={{ left: `${split * 100}%` }} />
      <div className="absolute top-16 flex -translate-x-full items-center pr-3 lg:top-auto lg:bottom-24" style={{ left: `${split * 100}%` }}>
        <span className="whitespace-nowrap rounded-full bg-card px-3 py-1 text-sm font-medium text-ink shadow-soft">{leftLabel}</span>
      </div>
      <div className="absolute top-16 flex items-center pl-3 lg:top-auto lg:bottom-24" style={{ left: `${split * 100}%` }}>
        <span className="whitespace-nowrap rounded-full bg-card px-3 py-1 text-sm font-medium text-ink shadow-soft">{rightLabel}</span>
      </div>
      <button
        type="button"
        role="slider"
        aria-label="Move the divider between the two years"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={Math.round(split * 100)}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={onPointerMove}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(clamp(split - 0.03));
          if (e.key === "ArrowRight") onChange(clamp(split + 0.03));
        }}
        className="pointer-events-auto absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-accent-strong text-accent-ink shadow-soft transition-transform active:scale-95"
        style={{ left: `${split * 100}%` }}
      >
        <ArrowsHorizontal size={20} weight="bold" />
      </button>
    </div>
  );
}
