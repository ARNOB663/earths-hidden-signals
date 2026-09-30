import type { Metadata } from "next";
import { Suspense } from "react";
import HazardExplorer from "@/components/hazards/HazardExplorer";
import { readHazardZones, readManifest } from "@/lib/data";

export const metadata: Metadata = { title: "Disaster risk · Earth's Hidden Signals" };

export default async function HazardsPage() {
  const [zones, manifest] = await Promise.all([readHazardZones(), readManifest()]);
  return (
    <div className="h-[calc(100svh-4rem)] lg:h-[calc(100dvh-4rem)]">
      {/* HazardExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <HazardExplorer zones={zones} manifest={manifest} />
      </Suspense>
    </div>
  );
}
