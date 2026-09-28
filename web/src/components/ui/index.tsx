// Small shared building blocks. None of them use hooks, so they work on server and client pages.

import { sureness } from "@/lib/plain";
import { formatSigned, trendLegendTokens, type VariableId } from "@/lib/trends";

/** "How sure are we?" in words, with a 3-dot meter. */
export function Sureness({ p, className = "" }: { p: number; className?: string }) {
  const s = sureness(p);
  const tone = s.level === 1 ? "bg-sunken text-ink-2" : "bg-accent-soft text-ink";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${tone} ${className}`}>
      <Dots level={s.level} />
      {s.label}
    </span>
  );
}

export function Dots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3].map((d) => (
        <span key={d} className={`h-2 w-2 rounded-full ${d <= level ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}

/** Nine colour steps from "decrease" to "increase", with plain labels. */
export function TrendLegend({
  variable,
  limit,
  decimals,
  decreaseWord,
  increaseWord,
  compact = false,
  mobileCompact = false,
}: {
  variable: VariableId;
  limit: number;
  decimals: number;
  decreaseWord: string;
  increaseWord: string;
  compact?: boolean;
  /** Hide the extra lines on small screens (used where the key floats over a map). */
  mobileCompact?: boolean;
}) {
  const extra = mobileCompact ? "hidden sm:block" : "block";
  const tokens = trendLegendTokens(variable);
  return (
    <div>
      <div className="flex gap-0.5 overflow-hidden rounded-md">
        {tokens.map((t) => (
          <span key={t} className="h-3.5 flex-1" style={{ background: `var(${t})` }} />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-xs text-ink-2">
        <span>
          {decreaseWord}
          {!compact && <span className={`${extra} text-ink-3`}>{formatSigned(-limit, decimals)} or less</span>}
        </span>
        <span className="text-center">No change</span>
        <span className="text-right">
          {increaseWord}
          {!compact && <span className={`${extra} text-ink-3`}>{formatSigned(limit, decimals)} or more</span>}
        </span>
      </div>
      {!compact && (
        <p className={`mt-2 items-center gap-2 text-xs text-ink-3 ${mobileCompact ? "hidden sm:flex" : "flex"}`}>
          <span className="inline-flex gap-0.5">
            <span className="h-3 w-4 rounded-sm bg-[var(--warm-3)]" />
            <span className="h-3 w-4 rounded-sm bg-[var(--warm-3)] opacity-30" />
          </span>
          Solid = clear change · faded = no clear change
        </p>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all active:scale-[0.98] ${
            value === o.id ? "bg-card font-medium text-ink shadow-soft" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Show the numbers": technical details, closed by default. */
export function Numbers({ children, title = "Show the numbers" }: { children: React.ReactNode; title?: string }) {
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink-2 hover:text-ink">
        {title}
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right tabular-nums text-ink">{value}</dd>
    </div>
  );
}
