// Small shared building blocks. None of them use hooks, so they work on server and client pages.

import { CaretDown } from "@phosphor-icons/react/ssr";
import { T } from "@/lib/i18n";
import { sureness } from "@/lib/plain";
import { formatSigned, trendLegendTokens, type VariableId } from "@/lib/trends";

/** "How sure are we?" in words, with a 3-dot meter. */
export function Sureness({ p, className = "" }: { p: number; className?: string }) {
  const s = sureness(p);
  const tone = s.level === 1 ? "bg-sunken text-ink-2" : "bg-accent-soft text-ink";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${tone} ${className}`}>
      <Dots level={s.level} />
      <T en={s.label} bn={s.bn} />
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
  decreaseWord: React.ReactNode;
  increaseWord: React.ReactNode;
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
          {!compact && (
            <span className={`${extra} text-ink-3`}>
              {formatSigned(-limit, decimals)} <T en="or less" bn="বা কম" />
            </span>
          )}
        </span>
        <span className="text-center">
          <T en="No change" bn="পরিবর্তন নেই" />
        </span>
        <span className="text-right">
          {increaseWord}
          {!compact && (
            <span className={`${extra} text-ink-3`}>
              {formatSigned(limit, decimals)} <T en="or more" bn="বা বেশি" />
            </span>
          )}
        </span>
      </div>
      {!compact && (
        <p className={`mt-2 items-center gap-2 text-xs text-ink-3 ${mobileCompact ? "hidden sm:flex" : "flex"}`}>
          <span className="inline-flex gap-0.5">
            <span className="h-3 w-4 rounded-sm bg-[var(--warm-3)]" />
            <span className="h-3 w-4 rounded-sm bg-[var(--warm-3)] opacity-30" />
          </span>
          <T en="Solid = clear change · faded = no clear change" bn="গাঢ় = স্পষ্ট পরিবর্তন · হালকা = স্পষ্ট পরিবর্তন নেই" />
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
  options: { id: T; label: React.ReactNode; icon?: React.ReactNode }[];
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
export function Numbers({
  children,
  title = <T en="Show the numbers" bn="সংখ্যাগুলো দেখুন" />,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
        {title}
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-ink-3">
          <span className="group-open:hidden">
            <T en="Open" bn="খুলুন" />
          </span>
          <span className="hidden group-open:inline">
            <T en="Close" bn="বন্ধ" />
          </span>
          <CaretDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right tabular-nums text-ink">{value}</dd>
    </div>
  );
}
