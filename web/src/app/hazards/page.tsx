import type { Metadata } from "next";
import { Suspense } from "react";
import HazardExplorer from "@/components/hazards/HazardExplorer";
import { HazardsScope } from "@/components/hazards/HazardsScope";
import type { Hotspots } from "@/components/hazards/WorldHazards";
import type { RiskRow } from "@/components/hazards/FutureBlock";
import { readData, readHazardZones, readManifest, readOutlook } from "@/lib/data";

export const metadata: Metadata = { title: "Disaster risk · Earth's Hidden Signals" };

export default async function HazardsPage() {
  const [zones, manifest, outlook, risk, hotspots] = await Promise.all([
    readHazardZones(),
    readManifest(),
    readOutlook(),
    readData<{ regions: RiskRow[] }>("risk", "model.json"),
    readData<Hotspots>("global", "hotspots.json"),
  ]);
  return (
    <div className="h-[calc(100svh-4rem)] lg:h-[calc(100dvh-4rem)]">
      {/* HazardExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <HazardsScope data={hotspots}>
          <HazardExplorer zones={zones} manifest={manifest} outlook={outlook} risk={risk.regions} />
        </HazardsScope>
      </Suspense>
    </div>
  );
}
