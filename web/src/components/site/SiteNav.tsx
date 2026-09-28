"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/findings", label: "Findings" },
  { href: "/explore", label: "Map Explorer" },
  { href: "/trends", label: "Trend Analysis" },
  { href: "/hazards", label: "Hazard Signals" },
  { href: "/methods", label: "Methods" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-white/10 bg-[#0b0f14] px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.6)]" />
        <span className="text-sm font-semibold tracking-tight text-white">Earth&apos;s Hidden Signals</span>
      </Link>
      <nav className="-mb-px flex h-full gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors ${
                active ? "border-sky-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
