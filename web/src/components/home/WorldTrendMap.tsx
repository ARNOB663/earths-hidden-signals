"use client";

// A small world map of trend cells for the front page story: one coloured square per land cell
// (equirectangular, 55S-75N), colour = direction and speed of change, faded = not a clear change.
// Drawn on a canvas from /data/global/*.json, so the page HTML stays light.

import { useEffect, useRef } from "react";
import { cssVar, useTheme } from "@/lib/theme";

type Cell = [number, number, number, number]; // lat, lon, slope per decade, clear (0/1)

const STEPS_UP = ["--warm-1", "--warm-2", "--warm-3", "--warm-4"];
const STEPS_DOWN = ["--cool-1", "--cool-2", "--cool-3", "--cool-4"];

export function WorldTrendMap({
  file,
  limit,
  increaseIsRed,
  label,
}: {
  /** "future": projected rainy-season change (global/future.json, middle-road path). */
  file: "temperature" | "wet-season" | "future";
  limit: number;
  increaseIsRed: boolean;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/global/${file}.json`)
      .then((r) => r.json())
      .then((raw: { cell: number; cells?: Cell[]; scenarios?: Record<string, { cells: Cell[] }> }) => {
        const data = { cell: raw.cell, cells: raw.cells ?? raw.scenarios?.ssp245?.cells ?? [] };
        const canvas = ref.current;
        if (cancelled || !canvas) return;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        const x = (lon: number) => ((lon + 180) / 360) * W;
        const y = (lat: number) => ((75 - lat) / 130) * H;
        const d = data.cell;
        const mid = cssVar("--mid");
        for (const [lat, lon, slope, clear] of data.cells) {
          if (slope === null) continue; // too dry for a rainy-season change
          const t = Math.min(1, Math.abs(slope) / limit);
          const step = Math.min(3, Math.floor(t * 4));
          const warm = slope > 0 === increaseIsRed;
          ctx.fillStyle = Math.abs(slope) < limit * 0.05 ? mid : cssVar((warm ? STEPS_UP : STEPS_DOWN)[step]);
          ctx.globalAlpha = clear ? 1 : 0.28;
          ctx.fillRect(x(lon - d / 2), y(lat + d / 2), (d / 360) * W + 0.5, (d / 130) * H + 0.5);
        }
        ctx.globalAlpha = 1;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file, limit, increaseIsRed, theme]);

  return <canvas ref={ref} role="img" aria-label={label} className="block aspect-[360/130] w-full" />;
}
