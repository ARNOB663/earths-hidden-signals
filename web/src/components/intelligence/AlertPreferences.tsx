"use client";

// Per-location, per-hazard "follow" choices saved in this browser only, plus a calendar reminder
// and an email draft. There are no background notifications and nothing is sent to a server.

import { BellRing, CalendarPlus, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { T, useT } from "@/lib/i18n";
import { HAZARD_LABEL } from "@/lib/intelligence/conclude";
import { reminderIcs, reminderMailto } from "@/lib/intelligence/guidance";
import type { HazardKey } from "@/lib/intelligence/types";

const KEY = "ehs-alert-prefs";

type Prefs = Record<string, HazardKey[]>;

function load(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

function save(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
}

export function AlertPreferences({
  locationId,
  locationName,
  hazards,
  asOf,
}: {
  locationId: string;
  locationName: string;
  hazards: HazardKey[];
  asOf: string;
}) {
  const t = useT();
  const [chosen, setChosen] = useState<HazardKey[]>([]);
  const [url, setUrl] = useState(`/location/${locationId}`);

  useEffect(() => {
    // Read the saved choice after hydration (the page itself is pre-rendered).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosen(load()[locationId] ?? []);
    setUrl(window.location.href);
  }, [locationId]);

  function toggle(h: HazardKey) {
    const next = chosen.includes(h) ? chosen.filter((x) => x !== h) : [...chosen, h];
    setChosen(next);
    const all = load();
    if (next.length) all[locationId] = next;
    else delete all[locationId];
    save(all);
  }

  function downloadIcs() {
    const blob = new Blob([reminderIcs({ locationName, url, asOf, hazards: chosen })], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${locationId}-reminder.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <BellRing size={16} aria-hidden className="text-accent" />
        <T en="Follow this location" bn="এই স্থান অনুসরণ করুন" />
      </p>
      <p className="mt-1 text-sm text-ink-3">
        <T
          en="Saved on this device only. There are no background notifications; use the calendar reminder or the email draft to come back."
          bn="শুধু এই ডিভাইসে সংরক্ষিত। কোনো স্বয়ংক্রিয় বিজ্ঞপ্তি নেই; ফিরে আসতে ক্যালেন্ডার রিমাইন্ডার বা ইমেইল খসড়া ব্যবহার করুন।"
        />
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">{t("Hazards to follow", "অনুসরণের দুর্যোগ")}</legend>
        <div className="flex flex-wrap gap-2">
          {hazards.map((h) => {
            const on = chosen.includes(h);
            return (
              <button
                key={h}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(h)}
                className={`min-h-10 rounded-full border px-3 text-sm transition-colors ${
                  on ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-2 hover:text-ink"
                }`}
              >
                <T en={HAZARD_LABEL[h].en} bn={HAZARD_LABEL[h].bn} />
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-ink hover:bg-sunken"
        >
          <CalendarPlus size={15} aria-hidden />
          <T en="Calendar reminder (.ics)" bn="ক্যালেন্ডার রিমাইন্ডার (.ics)" />
        </button>
        <a
          href={reminderMailto({ locationName, url, hazards: chosen })}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-ink hover:bg-sunken"
        >
          <Mail size={15} aria-hidden />
          <T en="Email myself a reminder" bn="নিজেকে ইমেইল করুন" />
        </a>
      </div>
    </div>
  );
}
