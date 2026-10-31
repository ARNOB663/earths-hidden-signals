"use client";

import dynamic from "next/dynamic";
import { MapLoading } from "@/components/map/MapLoading";
import type { Country } from "@/lib/countries";
import type { CountryMapData } from "./CountryMap";

const CountryMap = dynamic(() => import("./CountryMap"), {
  ssr: false,
  // Same height as the map, so the page does not jump when it arrives.
  loading: () => (
    <div className="h-[min(70svh,560px)] w-full">
      <MapLoading />
    </div>
  ),
});

/**
 * Leaflet needs the browser, so the map is loaded on the client only. Country geometry and
 * the gridded results are serialisable JSON, so they pass through unchanged.
 */
export function CountryMapClient({ country, data, dates }: { country: Country; data: CountryMapData; dates: string[] }) {
  return <CountryMap country={country} data={data} catalog={[{ dates }]} />;
}
