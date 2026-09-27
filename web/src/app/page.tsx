import Link from "next/link";

const QUESTIONS = [
  { q: "What", a: "is changing: heat, rainfall, greenness, forest cover" },
  { q: "Where", a: "across South Asia, from the Indus to the Bay of Bengal" },
  { q: "How much", a: "rate of change per year and per decade" },
  { q: "Significant?", a: "tested statistically, not eyeballed" },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">
        NASA Space Apps 2026 · Be An Earth System Trend Detective
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
        Earth&apos;s hidden signals, decoded before disaster.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
        One warming planet, different responses: heavier monsoon rain in some places, drier forests in others. We
        use NASA satellite and model data to show what is changing across South Asia, and whether it is real.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/explore"
          className="rounded-md bg-sky-500 px-4 py-2.5 text-sm font-medium text-[#04121d] hover:bg-sky-400"
        >
          Open the Map Explorer
        </Link>
        <Link
          href="/methods"
          className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
        >
          How we test trends
        </Link>
      </div>

      <div className="mt-16 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {QUESTIONS.map(({ q, a }) => (
          <div key={q} className="bg-[#0e141b] p-5">
            <div className="text-lg font-semibold text-white">{q}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
