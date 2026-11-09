"use client";

// World / South Asia switch for Disaster risk. World (global hotspots) is the default; links that
// ask for a South Asian hazard or region (?hazard=, ?zone=) open the detailed South Asia view.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MapLoading } from "@/components/map/MapLoading";
import { T } from "@/lib/i18n";
import type { Hotspots } from "./WorldHazards";

const WorldHazards = dynamic(() => import("./WorldHazards"), { ssr: false, loading: () => <MapLoading /> });

export function HazardsScope({ data, children }: { data: Hotspots; children: React.ReactNode }) {
  const params = useSearchParams();
  const detailed = params.get("scope") === "south-asia" || ["hazard", "zone"].some((k) => params.has(k));
  const [scope, setScope] = useState<"world" | "south-asia">(detailed ? "south-asia" : "world");

  const choose = (s: "world" | "south-asia") => {
    setScope(s);
    window.history.replaceState(null, "", s === "world" ? "?scope=world" : "?scope=south-asia");
  };

  return (
    <div className="relative h-full">
      <div className="absolute left-1/2 top-3 z-[700] flex -translate-x-1/2 rounded-full bg-card p-1 text-sm shadow-soft">
        {(
          [
            ["world", "World", "বিশ্ব"],
            ["south-asia", "South Asia", "দক্ষিণ এশিয়া"],
          ] as const
        ).map(([id, en, bn]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            onClick={() => choose(id)}
            className={`rounded-full px-4 py-1.5 transition-colors ${scope === id ? "bg-accent-strong font-medium text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            <T en={en} bn={bn} />
          </button>
        ))}
      </div>
      {scope === "world" ? <WorldHazards data={data} onZoomSouthAsia={() => choose("south-asia")} /> : children}
    </div>
  );
}
