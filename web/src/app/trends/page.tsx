import type { Metadata } from "next";
import { Suspense } from "react";
import TrendExplorer from "@/components/trends/TrendExplorer";
import { readCrosscheck, readManifest, readTrendZones } from "@/lib/data";

export const metadata: Metadata = { title: "Climate trends · Earth's Hidden Signals" };

export default async function TrendsPage() {
  const [manifest, zones, crosscheck] = await Promise.all([readManifest(), readTrendZones(), readCrosscheck()]);
  return (
    <div className="h-[calc(100svh-4rem)] lg:h-[calc(100dvh-4rem)]">
      {/* TrendExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <TrendExplorer manifest={manifest} zones={zones} crosscheck={crosscheck} />
      </Suspense>
    </div>
  );
}
