"use client";

import { ArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { T, useT } from "@/lib/i18n";

/**
 * The finding shortcuts, pinned under the site header while the story scrolls.
 * The chip for the finding on screen is highlighted, and a "Top" button appears once past the intro.
 */
export function StoryNav({ items }: { items: { id: string; en: string; bn: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [pastIntro, setPastIntro] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    // A finding counts as "on screen" when it crosses the upper-middle band of the window.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    const onScroll = () => {
      const first = sections[0];
      setPastIntro(!!first && first.getBoundingClientRect().top < window.innerHeight * 0.4);
      if (first && first.getBoundingClientRect().top > window.innerHeight * 0.4) setActive(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items]);

  // On narrow screens the chips scroll sideways; bring the active one into view if it is off to a side
  // (scrolling only the chip row, never the page).
  useEffect(() => {
    const nav = navRef.current;
    const chip = active ? nav?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (!nav || !chip) return;
    const box = nav.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.left < box.left) nav.scrollBy({ left: c.left - box.left - 16, behavior: "smooth" });
    else if (c.right > box.right) nav.scrollBy({ left: c.right - box.right + 16, behavior: "smooth" });
  }, [active]);

  return (
    <div className="sticky top-16 z-[900] -mx-4 mt-8 bg-page/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div ref={navRef} className="no-scrollbar -my-1 flex gap-2 overflow-x-auto py-1">
        <nav aria-label={t("Findings", "ফলাফলগুলো")} className="flex shrink-0 gap-2">
          {items.map((item) => (
            <a
              key={item.id}
              data-id={item.id}
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm transition-colors ${
                active === item.id ? "bg-accent-strong font-medium text-accent-ink" : "bg-card text-ink-2 shadow-soft hover:text-ink"
              }`}
            >
              <T en={item.en} bn={item.bn} />
            </a>
          ))}
        </nav>
        {pastIntro && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm text-ink-2 transition-colors hover:bg-card hover:text-ink"
          >
            <ArrowUp size={16} />
            <T en="Top" bn="উপরে" />
          </button>
        )}
      </div>
    </div>
  );
}
