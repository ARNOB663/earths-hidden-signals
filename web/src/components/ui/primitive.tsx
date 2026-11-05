// Small presentational primitives shared by more than one page. No hooks, so they work on server
// and client pages alike.
import { T } from "@/lib/i18n";

/** The small uppercase label above a section heading. One size and tracking on every page. */
export function Eyebrow({ en, bn }: { en: string; bn: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
      <T en={en} bn={bn} />
    </p>
  );
}
