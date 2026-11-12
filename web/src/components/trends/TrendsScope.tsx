"use client";

// World / South Asia switch for the Climate trends page. World is the default; any link that asks
// for a South Asian variable, region or place (?var=, ?zone=, ?lat=) opens the detailed view.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MapLoading } from "@/components/map/MapLoading";
import { T } from "@/lib/i18n";
import { TrendsStart } from "./TrendsStart";
import type { MeasureId, WorldCounts } from "./WorldExplorer";

const WorldExplorer = dynamic(() => import("./WorldExplorer"), { ssr: false, loading: () => <MapLoading /> });
const SignalsTogether = dynamic(() => import("./SignalsTogether"), { ssr: false, loading: () => <MapLoading /> });

type Scope = "world" | "south-asia" | "together";

export function TrendsScope({ counts, children }: { counts: WorldCounts; children: React.ReactNode }) {
  const params = useSearchParams();
  const detailed = params.get("scope") === "south-asia" || ["var", "zone", "lat", "season"].some((k) => params.has(k));
  const [scope, setScope] = useState<Scope>(params.get("scope") === "together" ? "together" : detailed ? "south-asia" : "world");
  const [measure, setMeasure] = useState<MeasureId>("temperature");

  const choose = (s: Scope) => {
    setScope(s);
    window.history.replaceState(null, "", `?scope=${s}`);
  };

  return (
    <div className="relative h-full">
      {scope === "world" && (
        <h1 className="sr-only">
          <T en="Climate trends around the world" bn="বিশ্বজুড়ে জলবায়ুর প্রবণতা" />
        </h1>
      )}
      <div className="absolute left-1/2 top-3 z-[700] flex -translate-x-1/2 rounded-full bg-card p-1 text-sm shadow-soft">
        {(
          [
            ["world", "World", "বিশ্ব"],
            ["south-asia", "South Asia", "দক্ষিণ এশিয়া"],
            ["together", "Signals together", "একসাথে সংকেত"],
          ] as const
        ).map(([id, en, bn]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            onClick={() => choose(id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors sm:px-4 ${scope === id ? "bg-accent-strong font-medium text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            <T en={en} bn={bn} />
          </button>
        ))}
      </div>
      {scope === "together" ? <SignalsTogether /> : scope === "world" ? <WorldExplorer key={measure} initial={measure} counts={counts} onZoomSouthAsia={() => choose("south-asia")} /> : children}
      {scope === "world" && !detailed && <TrendsStart onWorld={setMeasure} />}
    </div>
  );
}
