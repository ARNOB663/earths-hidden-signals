"use client";

// The home page's small map of where hot-and-dry months became more common; the data file is fetched
// here so the page itself stays light.

import { useEffect, useState } from "react";
import { HotDryMap, type Compound } from "@/components/trends/SignalsTogether";
import { T } from "@/lib/i18n";

export function HotDryMini() {
  const [data, setData] = useState<Compound | null>(null);
  useEffect(() => {
    fetch("/data/global/compound.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);
  return (
    <div>
      {data ? <HotDryMap data={data} /> : <div className="aspect-[720/260] w-full animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" />}
      <p className="mt-2 text-xs text-ink-3">
        <T en="Red: more hot-and-dry months than in 1981–1995 · Blue: fewer" bn="লাল: ১৯৮১–১৯৯৫-এর চেয়ে বেশি গরম-ও-শুষ্ক মাস · নীল: কম" />
      </p>
    </div>
  );
}
