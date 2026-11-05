// One source for icon size and stroke weight. Every icon on the site comes from lucide and is
// drawn through GIcon (or with the ICON sizes), so no two icons disagree about weight.

import { type LucideIcon } from "lucide-react";

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
