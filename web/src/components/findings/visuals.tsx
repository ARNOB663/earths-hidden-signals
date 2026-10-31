// Picture-first building blocks for the story page. Every number comes from the same analysis
// outputs the rest of the page uses. None of these use hooks, so they render on the server.

import {
  ArrowDown,
  ArrowRight,
  Binoculars,
  ChartLineUp,
  CloudRain,
  Fire,
  Mountains,
  Planet,
  Thermometer,
  Warning,
  Waves,
} from "@phosphor-icons/react/ssr";
import { bnNum } from "@/lib/bn";
import { T } from "@/lib/i18n";
import { senIntercept, trendToken } from "@/lib/trends";
import type { RegionBar } from "./parts";

const tx = (en: React.ReactNode, bn: React.ReactNode) => <T en={en} bn={bn} />;

/* ---------- Small shared pieces ---------- */

/** A white card used for one small picture plus its caption. */
function Tile({
  title,
  children,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-card p-4 shadow-soft ${className}`}>
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** One little square per map square, coloured by what happened there. */
function Waffle({
  groups,
  columns,
}: {
  groups: { count: number; color: string; label: string }[];
  columns: number;
}) {
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="img"
      aria-label={groups.map((g) => `${g.count} ${g.label}`).join(", ")}
    >
      {groups.flatMap((g, gi) =>
        Array.from({ length: g.count }, (_, i) => (
          <span
            key={`${gi}-${i}`}
            className="aspect-square rounded-[2px]"
            style={{ background: g.color }}
          />
        )),
      )}
    </div>
  );
}

function LegendDot({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={{ background: color }}
        aria-hidden
      />
      {children}
    </span>
  );
}

/** The yearly temperature line with its long-term trend dashed on top. */
function TrendMini({
  series,
  slopePerDecade,
  className = "h-14",
}: {
  series: number[];
  slopePerDecade: number;
  className?: string;
}) {
  const W = 200;
  const H = 56;
  const slopeYear = slopePerDecade / 10;
  const icpt = senIntercept(series, slopeYear);
  const trend = series.map((_, i) => icpt + slopeYear * i);
  const lo = Math.min(...series, ...trend);
  const hi = Math.max(...series, ...trend);
  const pts = (vals: number[]) =>
    vals
      .map(
        (v, i) =>
          `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`,
      )
      .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pts(series)}
        fill="none"
        stroke="var(--ink-3)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts(trend)}
        fill="none"
        stroke="var(--warm-3)"
        strokeWidth={2.4}
        strokeDasharray="6 5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* =====================================================================
 * Top of the page: what the project is for, and how the five findings fit together
 * ===================================================================== */

export interface GoalProps {
  first: number;
  last: number;
  nYears: number;
  nZones: number;
  nLinked: number;
  nWatch: number;
  series: number[];
  slopePerDecade: number;
}

export function GoalBanner({
  first,
  last,
  nYears,
  nZones,
  nLinked,
  nWatch,
  series,
  slopePerDecade,
}: GoalProps) {
  const steps = [
    {
      Icon: Planet,
      title: tx("Satellites measure", "স্যাটেলাইট মাপে"),
      big: tx(`${nYears} years`, `${bnNum(nYears)} বছর`),
      text: tx(
        `of NASA heat and rain records across South Asia, since ${first}.`,
        `${bnNum(first)} সাল থেকে দক্ষিণ এশিয়ার তাপমাত্রা ও বৃষ্টির নাসা-রেকর্ড।`,
      ),
      visual: (
        <div className="flex gap-1.5" aria-hidden>
          {[Thermometer, CloudRain].map((I, i) => (
            <span
              key={i}
              className="grid h-9 w-9 place-items-center rounded-full bg-sunken text-ink-2"
            >
              <I size={18} weight="duotone" />
            </span>
          ))}
        </div>
      ),
    },
    {
      Icon: ChartLineUp,
      title: tx("We check what is real", "আমরা যাচাই করি কোনটা সত্যি"),
      big: tx("Trend or luck?", "প্রবণতা, না কাকতালীয়?"),
      text: tx(
        "Statistics separate a real long-term change from the normal ups and downs.",
        "পরিসংখ্যান স্বাভাবিক ওঠানামা থেকে সত্যিকারের দীর্ঘমেয়াদি পরিবর্তনকে আলাদা করে।",
      ),
      visual: <TrendMini series={series} slopePerDecade={slopePerDecade} />,
    },
    {
      Icon: Warning,
      title: tx("We link it to disasters", "আমরা দুর্যোগের সাথে মেলাই"),
      big: tx(
        `${nLinked} of ${nZones}`,
        `${bnNum(nZones)}টির মধ্যে ${bnNum(nLinked)}টি`,
      ),
      text: tx(
        "regions where the worst disaster years match the weather of that season.",
        "অঞ্চলে সবচেয়ে খারাপ দুর্যোগের বছরগুলো সেই মৌসুমের আবহাওয়ার সাথে মেলে।",
      ),
      visual: (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: nZones }, (_, i) => (
            <span
              key={i}
              className={`h-3 flex-1 rounded-full ${i < nLinked ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      ),
    },
    {
      Icon: Binoculars,
      title: tx(
        `So we show where to prepare in ${last}`,
        `তাই দেখাই ${bnNum(last)} সালে কোথায় প্রস্তুতি দরকার`,
      ),
      big: tx(
        `${nWatch} region${nWatch === 1 ? "" : "s"}`,
        `${bnNum(nWatch)}টি অঞ্চল`,
      ),
      text: tx(
        "look like past disaster years. A reason to get ready, not a forecast.",
        "আগের দুর্যোগের বছরের মতো দেখাচ্ছে। প্রস্তুতির কারণ, পূর্বাভাস নয়।",
      ),
      visual: (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-watch-soft px-2.5 py-1 text-xs font-medium text-watch">
          <Warning size={14} weight="fill" aria-hidden />
          {tx("Watch", "নজর দিন")}
        </span>
      ),
      accent: true,
    },
  ];

  return (
    <section aria-labelledby="goal" className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        {tx("What this project is for", "এই প্রকল্প কীসের জন্য")}
      </p>
      <h2
        id="goal"
        className="mt-2 max-w-3xl text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-3xl"
      >
        {tx(
          `${nYears} years of NASA data show how South Asia's climate is changing, and which places should get ready for floods, landslides and fires.`,
          `নাসার ${bnNum(nYears)} বছরের তথ্য দেখায় দক্ষিণ এশিয়ার জলবায়ু কীভাবে বদলাচ্ছে, আর কোন জায়গাগুলোকে বন্যা, ভূমিধস ও আগুনের জন্য প্রস্তুত থাকতে হবে।`,
        )}
      </h2>
      <p className="panel-card mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium text-ink">
        {tx("Preparedness, not prediction.", "প্রস্তুতি, পূর্বাভাস নয়।")}
      </p>

      <ol className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {steps.map(({ Icon, title, big, text, visual, accent }, i) => (
          <li
            key={i}
            className={`panel-card relative flex flex-col rounded-2xl p-5 ${accent ? "ring-2 ring-accent/40" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon size={18} weight="duotone" aria-hidden />
              </span>
              <span className="text-xs font-medium text-ink-3">
                {tx(`Step ${i + 1}`, `ধাপ ${bnNum(i + 1)}`)}
              </span>
            </div>
            <div className="mt-3 font-semibold leading-snug text-ink">
              {title}
            </div>
            <div className="mt-3 min-h-9">{visual}</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              {big}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{text}</p>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-[18px] top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-ink xl:grid"
              >
                <ArrowRight size={14} weight="bold" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface MapProps {
  last: number;
  warmed: string;
  series: number[];
  slopePerDecade: number;
  springBars: RegionBar[];
  springRate: string;
  wettest: { name: string; nameBn: string; value: number };
  driest: { name: string; nameBn: string; value: number };
  wetPct: string;
  dryPct: string;
  nLinked: number;
  nZones: number;
  eventColors: { fire: string; landslide: string; flood: string };
  tracks: { color: string; latest: number; highEvent: number }[];
  nWatch: number;
}

/** The five findings as one row of small pictures, grouped into "what is changing" and "what it means for disasters". */
export function FindingsMap(p: MapProps) {
  const maxSpring = Math.max(
    ...p.springBars.map((b) => Math.abs(b.value)),
    0.01,
  );
  const springSorted = [...p.springBars].sort((a, b) => b.value - a.value);
  const rainScale = Math.max(
    Math.abs(p.wettest.value),
    Math.abs(p.driest.value),
    1,
  );

  const cards = [
    {
      id: "warming",
      Icon: Thermometer,
      label: tx("Getting warmer, everywhere", "সবখানে গরম বাড়ছে"),
      big: tx(`${p.warmed} °C`, `${bnNum(p.warmed)} °সে`),
      note: tx("since 1981", "১৯৮১ সালের পর থেকে"),
      visual: <TrendMini series={p.series} slopePerDecade={p.slopePerDecade} />,
    },
    {
      id: "spring",
      Icon: Thermometer,
      label: tx("Spring heats fastest", "বসন্তে গরম বাড়ছে সবচেয়ে দ্রুত"),
      big: tx(`${p.springRate} °C`, `${bnNum(p.springRate)} °সে`),
      note: tx("every 10 years, March–May", "প্রতি ১০ বছরে, মার্চ–মে"),
      visual: (
        <div className="flex h-14 items-end gap-1" aria-hidden>
          {springSorted.map((b) => (
            <span
              key={b.name}
              className="flex-1 rounded-t-md"
              style={{
                height: `${Math.max(8, (Math.abs(b.value) / maxSpring) * 100)}%`,
                background: `var(${trendToken(b.value, 0.5, "temperature")})`,
                opacity: b.significant ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      ),
    },
    {
      id: "rain",
      Icon: CloudRain,
      label: tx("Rain is moving, not vanishing", "বৃষ্টি জায়গা বদলাচ্ছে"),
      big: tx(
        `${p.wetPct}% / ${p.dryPct}%`,
        `${bnNum(p.wetPct)}% / ${bnNum(p.dryPct)}%`,
      ),
      note: tx(
        "every 10 years: wetter vs drier",
        "প্রতি ১০ বছরে: বেশি বনাম কম",
      ),
      visual: (
        <div className="grid h-14 grid-cols-2 items-center gap-0.5" aria-hidden>
          <div className="flex justify-end">
            <span
              className="h-5 rounded-l-md"
              style={{
                width: `${(Math.abs(p.driest.value) / rainScale) * 100}%`,
                background: `var(${trendToken(p.driest.value, 15, "rainfall")})`,
              }}
            />
          </div>
          <div className="flex border-l border-line">
            <span
              className="h-5 rounded-r-md"
              style={{
                width: `${(Math.abs(p.wettest.value) / rainScale) * 100}%`,
                background: `var(${trendToken(p.wettest.value, 15, "rainfall")})`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: "disasters",
      Icon: Fire,
      label: tx("Disasters follow the weather", "দুর্যোগ আবহাওয়ার পথ ধরে"),
      big: tx(
        `${p.nLinked} of ${p.nZones}`,
        `${bnNum(p.nZones)}টির মধ্যে ${bnNum(p.nLinked)}টি`,
      ),
      note: tx("regions match the weather", "অঞ্চলে আবহাওয়ার সাথে মেলে"),
      visual: (
        <div className="flex h-14 flex-col justify-center gap-1.5" aria-hidden>
          {[
            { From: Thermometer, To: Fire, color: p.eventColors.fire },
            { From: CloudRain, To: Mountains, color: p.eventColors.landslide },
            { From: CloudRain, To: Waves, color: p.eventColors.flood },
          ].map(({ From, To, color }, i) => (
            <div key={i} className="flex items-center gap-1.5 text-ink-3">
              <From size={13} weight="duotone" />
              <ArrowRight size={11} />
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-white"
                style={{ background: color }}
              >
                <To size={10} weight="fill" />
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "watch",
      Icon: Binoculars,
      label: tx(
        `Where to prepare in ${p.last}`,
        `${bnNum(p.last)} সালে কোথায় প্রস্তুতি`,
      ),
      big: tx(
        `${p.nWatch} region${p.nWatch === 1 ? "" : "s"}`,
        `${bnNum(p.nWatch)}টি অঞ্চল`,
      ),
      note: tx("look like past disaster years", "আগের দুর্যোগের বছরের মতো"),
      visual: (
        <div className="flex h-14 flex-col justify-center gap-2.5" aria-hidden>
          {p.tracks.map((t, i) => (
            <div key={i} className="relative h-2 rounded-full bg-sunken">
              <span
                className="absolute -top-0.5 h-3 w-0.5 rounded bg-ink-3"
                style={{ left: `${t.highEvent}%` }}
              />
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: `${t.latest}%`, background: t.color }}
              />
            </div>
          ))}
        </div>
      ),
    },
  ];

  const band = (cols: string, label: React.ReactNode) => (
    <div className={`hidden xl:block ${cols}`}>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
        <span>{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );

  return (
    <section aria-labelledby="glance" className="mt-14">
      <h2
        id="glance"
        className="text-2xl font-semibold tracking-tight text-ink"
      >
        {tx("The whole story at a glance", "পুরো গল্প এক নজরে")}
      </h2>
      <p className="mt-2 max-w-2xl text-ink-2">
        {tx(
          "One warming world, but different changes in different places, and that is what shapes the risk of disasters. Tap a card to jump to that finding.",
          "পৃথিবী একটাই এবং তা গরম হচ্ছে, কিন্তু জায়গাভেদে পরিবর্তন আলাদা, আর তা-ই দুর্যোগের ঝুঁকি গড়ে। যেকোনো কার্ডে ট্যাপ করে সেই ফলাফলে যান।",
        )}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:gap-6">
        {band("xl:col-span-3", tx("What is changing", "কী বদলাচ্ছে"))}
        {band(
          "xl:col-span-2",
          tx("What it means for disasters", "দুর্যোগের জন্য এর মানে"),
        )}
        {cards.map(({ id, Icon, label, big, note, visual }, i) => (
          <a
            key={id}
            href={`#${id}`}
            className="group relative flex flex-col rounded-2xl bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
                {tx(i + 1, bnNum(i + 1))}
              </span>
              <Icon
                size={18}
                weight="duotone"
                className="text-accent"
                aria-hidden
              />
            </div>
            <div className="mt-3 min-h-10 text-sm font-semibold leading-snug text-ink">
              {label}
            </div>
            <div className="mt-3">{visual}</div>
            <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-ink">
              {big}
            </div>
            <div className="text-xs leading-snug text-ink-3">{note}</div>
            {i < cards.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-[18px] top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-accent-soft text-accent xl:grid"
              >
                <ArrowRight size={14} weight="bold" />
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}

/* =====================================================================
 * Inside each finding: one picture that makes the point before the paragraph does
 * ===================================================================== */

/** Finding 1: every square warmed, and very hot months went from rare to common. */
export function WarmingGlance({
  cells,
  hotThen,
  hotNow,
  thenLabel,
  nowLabel,
}: {
  cells: number;
  hotThen: number;
  hotNow: number;
  thenLabel: React.ReactNode;
  nowLabel: React.ReactNode;
}) {
  const rows = [
    { label: thenLabel, n: Math.round(hotThen) },
    { label: nowLabel, n: Math.round(hotNow) },
  ];
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Tile
        title={tx(
          "Every square on the map got warmer",
          "মানচিত্রের প্রতিটি বর্গ গরম হয়েছে",
        )}
      >
        <Waffle
          groups={[
            { count: cells, color: "var(--warm-3)", label: "squares warmer" },
          ]}
          columns={18}
        />
        <p className="mt-2 text-xs text-ink-3">
          {tx(
            `${cells} of ${cells} squares warmer, none cooler.`,
            `${bnNum(cells)}টির মধ্যে ${bnNum(cells)}টি বর্গ গরম, একটিও ঠান্ডা নয়।`,
          )}
        </p>
      </Tile>
      <Tile title={tx("Very hot months in a year", "বছরে খুব গরম মাস")}>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between text-xs text-ink-3">
                <span>{r.label}</span>
                <span className="font-medium text-ink">
                  {tx(`${r.n} of 12`, `১২-এর মধ্যে ${bnNum(r.n)}`)}
                </span>
              </div>
              <div className="mt-1 flex gap-1" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-3.5 flex-1 rounded-full ${i < r.n ? "bg-(--warm-3)" : "bg-line"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {tx(
            "A very hot month is more than 1 °C above normal.",
            "খুব গরম মাস মানে স্বাভাবিকের চেয়ে ১ °সে-র বেশি।",
          )}
        </p>
      </Tile>
    </div>
  );
}

/** Finding 2: where "spring" sits in the year, and mountains vs. sea. */
export function SpringGlance({
  fast,
  slow,
  times,
}: {
  fast: { name: string; nameBn: string; value: number };
  slow: { name: string; nameBn: string; value: number };
  times: number;
}) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const tone = (m: number) =>
    m >= 3 && m <= 5
      ? "var(--warm-3)"
      : m >= 6 && m <= 9
        ? "var(--cool-2)"
        : "var(--line)";
  const max = Math.max(fast.value, slow.value, 0.01);
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Tile title={tx("When is “spring” here?", "এখানে “বসন্ত” কখন?")}>
        <div className="grid grid-cols-12 gap-0.5" aria-hidden>
          {months.map((m) => (
            <span
              key={m}
              className="h-5 first:rounded-l-md last:rounded-r-md"
              style={{ background: tone(m) }}
            />
          ))}
        </div>
        <div className="mt-1 grid grid-cols-12 text-[11px] leading-tight text-ink-3">
          <span className="col-span-1 text-left">{tx("Jan", "জানু")}</span>
          <span className="col-span-3 col-start-3 text-center font-medium text-ink">
            {tx("Mar–May", "মার্চ–মে")}
          </span>
          <span className="col-span-4 col-start-6 text-center font-medium text-ink">
            {tx("Jun–Sep", "জুন–সেপ্টে")}
          </span>
          <span className="col-span-1 col-start-12 text-right">
            {tx("Dec", "ডিসে")}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-xs text-ink-2">
          <div>
            <LegendDot color="var(--warm-3)">
              {tx(
                "Hot, dry weeks before the rains: warming fastest",
                "বৃষ্টির আগের গরম, শুকনো সপ্তাহ: উষ্ণতা বাড়ছে সবচেয়ে দ্রুত",
              )}
            </LegendDot>
          </div>
          <div>
            <LegendDot color="var(--cool-2)">
              {tx("Monsoon rains", "বর্ষার বৃষ্টি")}
            </LegendDot>
          </div>
        </div>
      </Tile>
      <Tile
        title={tx(
          "Fastest vs. slowest place, in spring",
          "বসন্তে সবচেয়ে দ্রুত বনাম সবচেয়ে ধীর অঞ্চল",
        )}
      >
        <div className="space-y-3 text-xs">
          {[
            { r: fast, color: "var(--warm-3)" },
            { r: slow, color: "var(--warm-1)" },
          ].map(({ r, color }) => (
            <div key={r.name}>
              <div className="flex justify-between gap-2 text-ink-2">
                <span>{tx(r.name, r.nameBn)}</span>
                <span className="shrink-0 font-medium tabular-nums text-ink">
                  {tx(
                    `+${r.value.toFixed(2)} °C`,
                    `+${bnNum(r.value.toFixed(2))} °সে`,
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-sunken">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${(r.value / max) * 100}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          {tx(
            `Every 10 years. The fastest place warms about ${times}× faster.`,
            `প্রতি ১০ বছরে। সবচেয়ে দ্রুত অঞ্চলটি প্রায় ${bnNum(times)} গুণ দ্রুত গরম হচ্ছে।`,
          )}
        </p>
      </Tile>
    </div>
  );
}

/** Finding 3: of all the rain map squares, some got wetter, some drier, most no clear change. */
export function RainGlance({
  wetter,
  drier,
  total,
  regionSlope,
}: {
  wetter: number;
  drier: number;
  total: number;
  regionSlope: string;
}) {
  const none = total - wetter - drier;
  return (
    <div className="mt-6">
      <Tile
        title={tx(
          "Monsoon rain, square by square",
          "বর্ষার বৃষ্টি, বর্গ ধরে ধরে",
        )}
      >
        <Waffle
          columns={20}
          groups={[
            { count: wetter, color: "var(--cool-3)", label: "squares wetter" },
            { count: drier, color: "var(--warm-3)", label: "squares drier" },
            {
              count: none,
              color: "var(--mid)",
              label: "squares with no clear change",
            },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <LegendDot color="var(--cool-3)">
            {tx(`${wetter} wetter`, `${bnNum(wetter)}টি বেশি বৃষ্টি`)}
          </LegendDot>
          <LegendDot color="var(--warm-3)">
            {tx(`${drier} drier`, `${bnNum(drier)}টি কম বৃষ্টি`)}
          </LegendDot>
          <LegendDot color="var(--mid)">
            {tx(
              `${none} no clear change`,
              `${bnNum(none)}টিতে স্পষ্ট পরিবর্তন নেই`,
            )}
          </LegendDot>
        </div>
        <p className="mt-3 rounded-xl bg-sunken px-3 py-2 text-xs leading-relaxed text-ink-2">
          {tx(
            <>
              <strong className="font-semibold text-ink">
                Whole region added up: {regionSlope} mm every 10 years
              </strong>
              , no clear change. The total stays about the same, but where the
              rain falls moves.
            </>,
            <>
              <strong className="font-semibold text-ink">
                পুরো অঞ্চল যোগ করলে: প্রতি ১০ বছরে {bnNum(regionSlope)} মিমি
              </strong>
              , স্পষ্ট পরিবর্তন নেই। মোট প্রায় একই থাকে, কিন্তু বৃষ্টি কোথায়
              পড়ে তা সরে যায়।
            </>,
          )}
        </p>
      </Tile>
    </div>
  );
}

type Place = { name: string; nameBn: string };

/** Finding 4: which weather goes with which disaster, and one place where it does not. */
export function DisasterGlance({
  fires,
  slides,
  floods,
  delta,
  colors,
}: {
  fires: Place;
  slides: Place;
  floods: Place;
  delta: Place;
  colors: { fire: string; landslide: string; flood: string };
}) {
  const rows = [
    {
      From: Thermometer,
      to: Fire,
      color: colors.fire,
      cause: tx("Hot spring", "গরম বসন্ত"),
      effect: tx("More forest fires", "বনে আগুন বেশি"),
      place: fires,
      linked: true,
    },
    {
      From: CloudRain,
      to: Mountains,
      color: colors.landslide,
      cause: tx("Rainy monsoon", "বৃষ্টিবহুল বর্ষা"),
      effect: tx("More landslides", "ভূমিধস বেশি"),
      place: slides,
      linked: true,
    },
    {
      From: CloudRain,
      to: Waves,
      color: colors.flood,
      cause: tx("Rainy monsoon", "বৃষ্টিবহুল বর্ষা"),
      effect: tx("More floods", "বন্যা বেশি"),
      place: floods,
      linked: true,
    },
    {
      From: CloudRain,
      to: Waves,
      color: colors.flood,
      cause: tx("Its own rain", "নিজের বৃষ্টি"),
      effect: tx(
        "Floods come from upstream rivers",
        "বন্যা আসে উজানের নদী থেকে",
      ),
      place: delta,
      linked: false,
    },
  ];
  return (
    <div className="mt-6 rounded-2xl bg-card p-4 shadow-soft">
      <div className="text-sm font-medium text-ink">
        {tx(
          "Which weather goes with which disaster?",
          "কোন আবহাওয়ার সাথে কোন দুর্যোগ?",
        )}
      </div>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <li
            key={i}
            className={
              r.linked ? "" : "border-t border-dashed border-line pt-3"
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
                  <r.From size={16} weight="duotone" aria-hidden />
                </span>
                <span className="leading-snug">{r.cause}</span>
              </span>
              {r.linked ? (
                <ArrowRight
                  size={16}
                  weight="bold"
                  className="text-ink-3"
                  aria-hidden
                />
              ) : (
                <span
                  className="grid h-6 w-6 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-3"
                  aria-hidden
                >
                  ≠
                </span>
              )}
              <span className="flex items-center gap-2 font-medium text-ink">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${r.linked ? "" : "opacity-40"}`}
                  style={{ background: r.color }}
                >
                  <r.to size={16} weight="fill" aria-hidden />
                </span>
                <span className="leading-snug">{r.effect}</span>
              </span>
            </div>
            <div className="mt-1 pl-10 text-xs text-ink-3">
              {tx(r.place.name, r.place.nameBn)} ·{" "}
              {r.linked
                ? tx("linked in the records", "রেকর্ডে যোগসূত্র আছে")
                : tx(
                    "no link with its own weather",
                    "নিজের আবহাওয়ার সাথে যোগসূত্র নেই",
                  )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Our take": one warming world on the left, three different local effects on the right. */
export function OneWorldDiagram({
  warmed,
  driest,
  wettest,
  fires,
  dryPct,
  wetPct,
}: {
  warmed: string;
  driest: Place;
  wettest: Place;
  fires: Place;
  dryPct: string;
  wetPct: string;
}) {
  const branches = [
    {
      Icon: Fire,
      color: "var(--ev-fire)",
      head: tx("Fiercer fire seasons", "আরও ভয়াবহ আগুনের মৌসুম"),
      sub: tx(`Hot springs, ${fires.name}`, `গরম বসন্ত, ${fires.nameBn}`),
    },
    {
      Icon: CloudRain,
      color: "var(--cool-3)",
      head: tx(`Heavier rain: ${wetPct}%`, `ভারী বৃষ্টি: ${bnNum(wetPct)}%`),
      sub: tx(
        `Every 10 years, ${wettest.name}`,
        `প্রতি ১০ বছরে, ${wettest.nameBn}`,
      ),
    },
    {
      Icon: CloudRain,
      color: "var(--warm-3)",
      head: tx(`Drying out: ${dryPct}%`, `শুষ্ক হচ্ছে: ${bnNum(dryPct)}%`),
      sub: tx(
        `Every 10 years, ${driest.name}`,
        `প্রতি ১০ বছরে, ${driest.nameBn}`,
      ),
    },
  ];
  return (
    <div className="mt-6 grid items-center gap-3 md:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)]">
      <div className="panel-card rounded-2xl p-4 text-center">
        <Thermometer
          size={22}
          weight="duotone"
          className="mx-auto text-(--warm-3)"
          aria-hidden
        />
        <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-ink">
          {tx(`${warmed} °C`, `${bnNum(warmed)} °সে`)}
        </div>
        <div className="text-sm font-medium text-ink">
          {tx("One warming world", "একটাই গরম হচ্ছে পৃথিবী")}
        </div>
      </div>
      <span className="grid place-items-center text-accent" aria-hidden>
        <ArrowRight size={22} weight="bold" className="hidden md:block" />
        <ArrowDown size={22} weight="bold" className="md:hidden" />
      </span>
      <ul className="space-y-2">
        {branches.map((b, i) => (
          <li
            key={i}
            className="panel-card flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
              style={{ background: b.color }}
            >
              <b.Icon size={18} weight="fill" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                {b.head}
              </span>
              <span className="block text-xs text-ink-3">{b.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
