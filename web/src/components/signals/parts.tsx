// Presentational pieces for the Signals pages. Icon + word for every status, so colour is never
// the only cue. All text is inline EN/বাং.

import { CircleAlert, CircleCheck, MinusCircle, TriangleAlert } from "lucide-react";
import { T } from "@/lib/i18n";
import type { Confidence, Status } from "@/lib/signals/types";

export const STATUS_WORD: Record<Status, { en: string; bn: string; cls: string; Icon: typeof CircleAlert }> = {
  green: { en: "Green", bn: "সবুজ", cls: "text-good", Icon: CircleCheck },
  yellow: { en: "Yellow", bn: "হলুদ", cls: "text-watch", Icon: TriangleAlert },
  red: { en: "Red · provisional", bn: "লাল · প্রাথমিক", cls: "text-alert", Icon: CircleAlert },
  grey: { en: "Grey", bn: "ধূসর", cls: "text-ink-3", Icon: MinusCircle },
};

export const CONFIDENCE_WORD: Record<Confidence, { en: string; bn: string }> = {
  low: { en: "Low confidence", bn: "কম নিশ্চয়তা" },
  medium: { en: "Medium confidence", bn: "মাঝারি নিশ্চয়তা" },
  high: { en: "High confidence", bn: "উচ্চ নিশ্চয়তা" },
};

export function StatusBadge({ status, large = false }: { status: Status; large?: boolean }) {
  const word = STATUS_WORD[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${status === "red" ? "bg-alert-soft" : status === "yellow" ? "bg-watch-soft" : status === "green" ? "bg-accent-soft" : "bg-sunken"} px-3 py-1 ${large ? "text-base" : "text-sm"} font-medium ${word.cls}`}
    >
      <word.Icon size={large ? 20 : 16} aria-hidden />
      <T en={word.en} bn={word.bn} />
    </span>
  );
}

export function SampleBanner({ clock }: { clock: string }) {
  return (
    <div className="w-full bg-watch-soft px-4 py-2 text-center text-sm font-semibold text-watch" role="status">
      <T en="SAMPLE DATA" bn="নমুনা তথ্য" />
      <span className="ml-2 font-normal text-ink-2">
        <T en="Not real measurements. Fixed clock" bn="প্রকৃত পরিমাপ নয়। নির্দিষ্ট সময়" />{" "}
        <time dateTime={clock}>{clock.slice(0, 10)}</time>
      </span>
    </div>
  );
}

/** Source, measurement time, live age, official link and the standing disclaimer. */
export function DataProvenance({
  source,
  measurementTime,
  ageLabel,
  ageStale,
  wmoUrl,
  disclaimer,
}: {
  source: string;
  measurementTime: string;
  ageLabel: string;
  ageStale: boolean;
  wmoUrl: string;
  disclaimer: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 text-sm text-ink-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-3">
          <T en="Source" bn="উৎস" />
        </dt>
        <dd>{source}</dd>
        <dt className="text-ink-3">
          <T en="Measured" bn="পরিমাপ" />
        </dt>
        <dd>
          <time dateTime={measurementTime}>{measurementTime.slice(0, 16).replace("T", " ")} UTC</time>
        </dd>
        <dt className="text-ink-3">
          <T en="Age" bn="বয়স" />
        </dt>
        <dd className={ageStale ? "font-medium text-ink-3" : ""}>{ageLabel}</dd>
      </dl>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={wmoUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-line underline-offset-2 hover:text-ink"
        >
          <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
        </a>
        <span className="text-ink-3">
          <T en={disclaimer} bn="এটি পূর্বাভাস বা সরকারি সতর্কবার্তা নয়।" />
        </span>
      </p>
    </div>
  );
}
