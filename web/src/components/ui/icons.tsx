// One source for icon size and stroke weight. Every icon on the site comes from lucide and is
// drawn through GIcon (or with the ICON sizes), so no two icons disagree about weight.

import {
  CloudRain,
  Droplet,
  Droplets,
  Flame,
  Leaf,
  Mountain,
  Sprout,
  Sun,
  Thermometer,
  TreePine,
  WavesHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { HazardId } from "@/lib/hazards";
import type { VariableId } from "@/lib/trends";

export const ICON = { sm: 14, md: 16, lg: 20, xl: 22 } as const;
export type IconSize = keyof typeof ICON;

/** Shared stroke weight; lucide's default of 2 reads too heavy at small sizes. */
export const STROKE = 1.75;

/**
 * An icon at a shared size and weight. Icons here are always decorative: each one sits next to
 * visible text or inside a control that carries its own accessible name.
 */
export function GIcon({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  size?: IconSize | number;
  className?: string;
}) {
  return (
    <Icon
      size={typeof size === "number" ? size : ICON[size]}
      strokeWidth={STROKE}
      className={className}
      aria-hidden
    />
  );
}

/** The trend grids this project builds, keyed by variable; the country map legend reads these. */
export const TREND_ICONS: Record<VariableId, LucideIcon> = {
  temperature: Thermometer,
  rainfall: Droplets,
  "hot-months": Sun,
  "heavy-rain": CloudRain,
  "wettest-day": Droplet,
  "dry-spell": Sprout,
};

/** The NASA GIBS and forest-loss layers in the map catalog. */
export const LAYER_ICONS: Record<string, LucideIcon> = {
  "lst-day": Sun,
  "air-temp": Thermometer,
  precip: Droplets,
  "soil-moisture": Droplet,
  ndvi: Leaf,
  "forest-loss": TreePine,
};

/** The four hazards, shared by the story, the home page and the hazard map. Each has one glyph. */
export const HAZARD_ICONS: Record<HazardId, LucideIcon> = {
  wildfire: Flame,
  landslide: Mountain,
  flood: CloudRain,
  cyclone: WavesHorizontal,
};
