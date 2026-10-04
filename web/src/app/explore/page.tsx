import type { Metadata } from "next";
import { Suspense } from "react";
import MapExplorer from "@/components/map/MapExplorer";
import { getGibsCatalog } from "@/lib/gibs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MapPlaceData } from "@/lib/mapPlaces";

export const metadata: Metadata = { title: "Satellite map · Earth's Hidden Signals" };

// Re-read NASA's layer catalog once a day so newly published months appear on the slider.
export const revalidate = 86400;

export default async function ExplorePage() {
  const [catalog, placeData] = await Promise.all([
    getGibsCatalog(),
    readFile(path.join(process.cwd(), "public/data/maps/place-signals.json"), "utf-8").then((text) => JSON.parse(text) as MapPlaceData),
  ]);
  return (
    <div className="h-[calc(100svh-4rem)] lg:h-[calc(100dvh-4rem)]">
      {/* MapExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <MapExplorer catalog={catalog} placeData={placeData} />
      </Suspense>
    </div>
  );
}
