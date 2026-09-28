import type { Metadata } from "next";
import { Suspense } from "react";
import TrendExplorer from "@/components/trends/TrendExplorer";
import { readManifest, readTrendZones } from "@/lib/data";

export const metadata: Metadata = { title: "Trend Analysis · Earth's Hidden Signals" };

export default async function TrendsPage() {
  const [manifest, zones] = await Promise.all([readManifest(), readTrendZones()]);
  return (
    <div className="lg:h-[calc(100dvh-4rem)]">
      {/* TrendExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <TrendExplorer manifest={manifest} zones={zones} />
      </Suspense>
    </div>
  );
}
