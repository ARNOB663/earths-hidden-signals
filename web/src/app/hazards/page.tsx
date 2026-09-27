import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Suspense } from "react";
import HazardExplorer from "@/components/hazards/HazardExplorer";
import type { HazardZone } from "@/lib/hazards";
import type { Manifest } from "@/lib/trends";

export const metadata: Metadata = { title: "Hazard Signals · Earth's Hidden Signals" };

// Produced offline by analysis/build_hazards.py and shipped as static JSON.
async function readData<T>(...parts: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", ...parts), "utf-8")) as T;
}

export default async function HazardsPage() {
  const [{ zones }, manifest] = await Promise.all([
    readData<{ zones: HazardZone[] }>("hazards", "zones.json"),
    readData<Manifest>("trends", "manifest.json"),
  ]);
  return (
    <div className="lg:h-[calc(100dvh-3.5rem)]">
      {/* HazardExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <HazardExplorer zones={zones} manifest={manifest} />
      </Suspense>
    </div>
  );
}
