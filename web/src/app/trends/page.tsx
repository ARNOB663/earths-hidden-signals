import type { Metadata } from "next";
import { Suspense } from "react";
import TrendExplorer from "@/components/trends/TrendExplorer";
import { TrendsScope } from "@/components/trends/TrendsScope";
import type { WorldCounts } from "@/components/trends/WorldExplorer";
import { readCrosscheck, readData, readManifest, readTrendZones } from "@/lib/data";

export const metadata: Metadata = { title: "Climate trends · Earth's Hidden Signals" };

export default async function TrendsPage() {
  const [manifest, zones, crosscheck, world] = await Promise.all([
    readManifest(),
    readTrendZones(),
    readCrosscheck(),
    readData<WorldCounts>("global", "summary.json"),
  ]);
  return (
    <div className="h-[calc(100svh-4rem)] lg:h-[calc(100dvh-4rem)]">
      {/* Both views read the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <TrendsScope counts={{ temperature: world.temperature, rainfall: world.rainfall, wetSeason: world.wetSeason }}>
          <TrendExplorer manifest={manifest} zones={zones} crosscheck={crosscheck} />
        </TrendsScope>
      </Suspense>
    </div>
  );
}
