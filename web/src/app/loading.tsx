import { LoaderCircle } from "lucide-react";
import { STROKE } from "@/components/ui/icons";
import { T } from "@/lib/i18n";

/**
 * The fallback while a page is still being prepared. Deliberately quiet: no layout promise, so
 * full-viewport map pages and long story pages both start from the same calm neutral state.
 * A CSS spin keeps the motion runtime out of the initial bundle.
 */
export default function Loading() {
  return (
    <div className="grid flex-1 place-items-center px-4 py-24" role="status" aria-live="polite">
      <span className="flex items-center gap-2 text-sm text-ink-2">
        <LoaderCircle size={16} strokeWidth={STROKE} className="animate-spin text-accent" aria-hidden />
        <T en="Loading…" bn="লোড হচ্ছে…" />
      </span>
    </div>
  );
}
