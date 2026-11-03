"use client";

// The world map on /signals: one rounded rectangle per enabled tile, coloured by its strongest
// cell, plus a tap anywhere to open the place page. Deliberately no basemap request, so the page
// works offline and its weight stays small; the text list below carries the same information.

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useT } from "@/lib/i18n";
import type { SignalsConfig, Status } from "@/lib/signals/types";
import { STATUS_WORD } from "./parts";

const FILL: Record<Status, string> = {
  green: "var(--good)",
  yellow: "var(--watch)",
  red: "var(--alert)",
  grey: "var(--ink-3)",
};

const W = 720;
const H = 360;
// Frame the covered longitudes loosely rather than the whole globe: three tiles next to each
// other are unreadable if they occupy 30 degrees of a 360-degree map.
const VIEW = { west: -90, east: 140, north: 62, south: -45 };
const project = (lat: number, lon: number): [number, number] => [
  ((lon - VIEW.west) / (VIEW.east - VIEW.west)) * W,
  ((VIEW.north - lat) / (VIEW.north - VIEW.south)) * H,
];

export function SignalsMap({
  config,
  tileStatus,
}: {
  config: SignalsConfig;
  tileStatus: Record<string, Status>;
}) {
  const router = useRouter();
  const t = useT();
  const ref = useRef<SVGSVGElement>(null);

  function tap(event: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * W;
    const y = ((event.clientY - box.top) / box.height) * H;
    const lon = VIEW.west + (x / W) * (VIEW.east - VIEW.west);
    const lat = VIEW.north - (y / H) * (VIEW.north - VIEW.south);
    router.push(`/signals/place?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`);
  }

  return (
    <figure className="m-0">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t(
          "World map of the covered areas. The list below has the same information.",
          "আচ্ছাদিত এলাকার বিশ্ব মানচিত্র। নিচের তালিকায় একই তথ্য আছে।",
        )}
        onClick={tap}
        className="h-auto w-full cursor-crosshair rounded-xl border border-line bg-sunken"
      >
        <rect x={0} y={0} width={W} height={H} fill="var(--sunken)" />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`lat-${i}`} x1={0} x2={W} y1={(i * H) / 6} y2={(i * H) / 6} stroke="var(--line)" strokeWidth={0.6} />
        ))}
        {config.enabledTiles.map((tile) => {
          const [x1, y1] = project(tile.north, tile.west);
          const [x2, y2] = project(tile.south, tile.east);
          const status = tileStatus[tile.id] ?? "grey";
          // Labels sit just outside each box's bottom-right corner and are clamped to the viewBox:
          // two boxes that share a latitude (the Indus plain and the Western Himalaya both touch
          // 30N) then never stack their labels on the same row.
          const labelX = Math.min(x2 + 4, W - 2);
          const labelY = Math.min(y2 + 12, H - 3);
          const statusWord = STATUS_WORD[status];
          return (
            <g key={tile.id}>
              <rect
                x={x1}
                y={y1}
                width={x2 - x1}
                height={y2 - y1}
                fill={FILL[status]}
                fillOpacity={0.55}
                stroke={FILL[status]}
                strokeWidth={1.5}
                rx={3}
              >
                <title>{`${tile.label}: ${t(statusWord.en, statusWord.bn)}`}</title>
              </rect>
              <text x={labelX} y={labelY} textAnchor="start" fontSize={11} fill="var(--ink)" aria-hidden>
                {tile.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {(["green", "yellow", "red", "grey"] as Status[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: FILL[status], opacity: 0.6 }} />
            {t(STATUS_WORD[status].en, STATUS_WORD[status].bn)}
          </span>
        ))}
      </figcaption>
      <p className="mt-1 text-xs text-ink-3">{t("Tap the map to open a place.", "একটি জায়গা খুলতে মানচিত্রে চাপ দিন।")}</p>
    </figure>
  );
}
