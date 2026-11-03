// Server-only (Node fs via readPlaces): import from server components only.
// Which places /watch can open: a place with history in our own data (a Before record, or a Now
// reading). The full places.json is large, so only this list is shipped to the browser.

import { readPlaces } from "@/lib/signals/data";

export interface WatchPlace {
  id: string;
  name: string;
  country: string;
  countryName: string;
  level: "ADM1" | "ADM2";
  centre: [number, number];
  tileLabel: string;
  trust: string;
  nowState: "measured" | "no-data";
}

/** The narrow shape the country list needs to decide which rows open a real place. */
export type CoveredLink = Pick<WatchPlace, "id" | "trust" | "nowState">;

export async function loadWatchPlaces(): Promise<WatchPlace[]> {
  const { areas } = await readPlaces();
  return areas
    .filter((area) => area.now.state === "measured" || area.trust.state !== "no-data")
    .map((area) => ({
      id: area.id,
      name: area.name,
      country: area.country,
      countryName: area.countryName,
      level: area.level,
      centre: area.centre,
      tileLabel: area.tileLabel,
      trust: area.trust.state,
      nowState: area.now.state,
    }));
}
