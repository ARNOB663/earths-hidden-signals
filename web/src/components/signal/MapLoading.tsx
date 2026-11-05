"use client";

import { Spinner } from "@/components/ui/motion-icons";
import { T } from "@/lib/i18n";

/** Placeholder while a map's code and first tiles load: a softly pulsing surface with a label. */
export function MapLoading() {
  return (
    <div role="status" className="relative grid h-full place-items-center overflow-hidden bg-sunken">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_45%_55%,var(--line)_0%,transparent_60%)]"
      />
      <span className="relative flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-ink-2 shadow-soft">
        <Spinner size="md" className="text-accent" />
        <T en="Loading map…" bn="মানচিত্র লোড হচ্ছে…" />
      </span>
    </div>
  );
}
