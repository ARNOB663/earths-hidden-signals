// A compact conclusion + status + alert strip, prepended to existing pages (country dashboards,
// home). It links to the full /location report and never restates numbers the pipeline did not write.

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { HAZARD_LABEL } from "@/lib/intelligence/conclude";
import type { InternalAlert, Location } from "@/lib/intelligence/types";
import { LevelBadge, SeverityBadge } from "./parts";

export function IntelligenceStrip({ loc, alerts, asOf }: { loc: Location; alerts: InternalAlert[]; asOf: string }) {
  const c = loc.conclusion;
  const active = alerts.filter((a) => a.locationId === loc.alertsFrom && a.status === "active");
  return (
    <section aria-label="Latest screening" className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          <T en="Latest screening" bn="সর্বশেষ স্ক্রিনিং" />
        </span>
        <LevelBadge level={c.level} />
        <span className="text-xs text-ink-3">
          <T
            en={`observed through ${c.observedThrough ?? "—"} · assessed ${asOf}`}
            bn={`${bnNum(c.observedThrough ?? "—")} পর্যন্ত পর্যবেক্ষণ · মূল্যায়ন ${bnNum(asOf)}`}
          />
        </span>
      </div>
      <p className="mt-2 text-lg font-medium leading-snug text-ink">
        <T en={c.headline.en} bn={c.headline.bn} />
      </p>
      {active.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {active.map((a) => (
            <li key={a.id} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm text-ink-2">
              <SeverityBadge severity={a.severity} />
              <T en={HAZARD_LABEL[a.hazard].en} bn={HAZARD_LABEL[a.hazard].bn} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">
        <T
          en="Screening from climate observations; not a forecast or an official warning."
          bn="জলবায়ু পর্যবেক্ষণ থেকে স্ক্রিনিং; পূর্বাভাস বা আনুষ্ঠানিক সতর্কতা নয়।"
        />
      </p>
      <Link href={`/location/${loc.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        <T en="Full screening report" bn="পূর্ণ স্ক্রিনিং প্রতিবেদন" />
        <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}
