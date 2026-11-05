// Presentational pieces shared by /signal, /gap, /replay and /accuracy. Every level carries an
// icon, a word and a colour, so colour is never the only cue; nothing here says "safe".

import { ArrowDown, ArrowUp, CircleAlert, CircleQuestionMark, Gauge, MapPin, Minus, ShieldCheck, TriangleAlert } from "lucide-react";
import { T } from "@/lib/i18n";
import type { WatchLevel } from "@/lib/signals/level";

export const WATCH_ICON: Record<WatchLevel, typeof CircleAlert> = {
  none: Minus,
  elevated: ArrowUp,
  high: TriangleAlert,
  unknown: CircleQuestionMark,
};

export const WATCH_FILL: Record<WatchLevel, string> = {
  none: "#8a9a8a",
  elevated: "#a16207",
  high: "#b42318",
  unknown: "#9ca3af",
};

export const COVERAGE_ICON = {
  live: Gauge,
  seasonal: MapPin,
  "cant-tell": CircleQuestionMark,
} as const;

export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "watch" | "alert" | "good" | "muted";
  children: React.ReactNode;
  className?: string;
}) {
  const cls =
    tone === "alert"
      ? "bg-alert-soft text-alert"
      : tone === "watch"
        ? "bg-watch-soft text-watch"
        : tone === "good"
          ? "bg-accent-soft text-accent-strong"
          : tone === "muted"
            ? "bg-sunken text-ink-3"
            : "bg-sunken text-ink-2";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls} ${className}`}>{children}</span>;
}

export function CoverageBadge({ state }: { state: "live" | "seasonal" | "cant-tell" }) {
  const Icon = COVERAGE_ICON[state];
  const tone = state === "live" ? "good" : state === "seasonal" ? "neutral" : "muted";
  return (
    <Pill tone={tone}>
      <Icon size={13} aria-hidden />
      <T
        en={state === "live" ? "Live Signal" : state === "seasonal" ? "Seasonal Context Only" : "Can’t Tell Here"}
        bn={state === "live" ? "সরাসরি সংকেত" : state === "seasonal" ? "কেবল মৌসুমি প্রেক্ষাপট" : "এখানে বলা সম্ভব নয়"}
      />
    </Pill>
  );
}

export function WatchBadge({ level, compact = false }: { level: WatchLevel; compact?: boolean }) {
  const Icon = WATCH_ICON[level];
  const tone = level === "high" ? "alert" : level === "elevated" ? "watch" : "neutral";
  return (
    <Pill tone={tone}>
      <Icon size={13} aria-hidden />
      {compact ? (
        <T
          en={level === "high" ? "High" : level === "elevated" ? "Elevated" : level === "none" ? "Not elevated" : "Can’t tell"}
          bn={level === "high" ? "উচ্চ" : level === "elevated" ? "বর্ধিত" : level === "none" ? "উচ্চতর নয়" : "বলা যায় না"}
        />
      ) : (
        <T
          en={level === "high" ? "Watch Level: High" : level === "elevated" ? "Watch Level: Elevated" : level === "none" ? "Watch Level: Not elevated" : "Watch Level: Can’t tell"}
          bn={level === "high" ? "সতর্কতার মাত্রা: উচ্চ" : level === "elevated" ? "সতর্কতার মাত্রা: বর্ধিত" : level === "none" ? "সতর্কতার মাত্রা: উচ্চতর নয়" : "সতর্কতার মাত্রা: বলা যায় না"}
        />
      )}
    </Pill>
  );
}

export function TrustBadge({ grade }: { grade: "high" | "medium" | "low" }) {
  const Icon = grade === "high" ? ShieldCheck : grade === "medium" ? Minus : ArrowDown;
  return (
    <Pill tone={grade === "high" ? "good" : grade === "medium" ? "neutral" : "muted"}>
      <Icon size={13} aria-hidden />
      <T
        en={`Data Trust: ${grade === "high" ? "High" : grade === "medium" ? "Medium" : "Low"}`}
        bn={`তথ্য-ভরসা: ${grade === "high" ? "উচ্চ" : grade === "medium" ? "মাঝারি" : "নিম্ন"}`}
      />
    </Pill>
  );
}

export function Stat({
  label,
  labelBn,
  value,
  hint,
  hintBn,
}: {
  label: string;
  labelBn: string;
  value: React.ReactNode;
  hint?: string;
  hintBn?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2">
      <dt className="text-xs text-ink-3">
        <T en={label} bn={labelBn} />
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</dd>
      {hint && (
        <dd className="mt-0.5 text-[11px] leading-snug text-ink-3">
          <T en={hint} bn={hintBn ?? hint} />
        </dd>
      )}
    </div>
  );
}

export function pct(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? "–" : `${(value * 100).toFixed(digits)}%`;
}
