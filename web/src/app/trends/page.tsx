import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Suspense } from "react";
import TrendExplorer from "@/components/trends/TrendExplorer";
import type { Manifest, Zone } from "@/lib/trends";

export const metadata: Metadata = { title: "Trend Analysis · Earth's Hidden Signals" };

// Results are produced offline by analysis/build.py and shipped as static JSON.
async function readTrendFile<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "public", "data", "trends", name);
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

export default async function TrendsPage() {
  const [manifest, { zones }] = await Promise.all([
    readTrendFile<Manifest>("manifest.json"),
    readTrendFile<{ zones: Zone[] }>("zones.json"),
  ]);
  return (
    <div className="lg:h-[calc(100dvh-3.5rem)]">
      {/* TrendExplorer reads the URL's search params, which needs a Suspense boundary on a static page. */}
      <Suspense>
        <TrendExplorer manifest={manifest} zones={zones} />
      </Suspense>
    </div>
  );
}
