import Link from "next/link";

export function ComingSoon({ title, intro, items }: { title: string; intro: string; items: string[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">In progress</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 leading-relaxed text-slate-400">{intro}</p>
      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            {item}
          </li>
        ))}
      </ul>
      <Link href="/explore" className="mt-8 inline-block text-sm text-sky-400 hover:underline">
        Open the Map Explorer →
      </Link>
    </div>
  );
}
