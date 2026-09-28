import type { Metadata } from "next";
import { Suspense } from "react";
import MapExplorer from "@/components/map/MapExplorer";
import { getGibsCatalog } from "@/lib/gibs";

export const metadata: Metadata = { title: "Map Explorer · Earth's Hidden Signals" };

// Re-read NASA's layer catalog once a day so newly published months appear on the slider.
export const revalidate = 86400;

export default async function ExplorePage() {
  const catalog = await getGibsCatalog();
  return (
    <div className="lg:h-[calc(100dvh-4rem)]">
      {/* MapExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <MapExplorer catalog={catalog} />
      </Suspense>
    </div>
  );
}
