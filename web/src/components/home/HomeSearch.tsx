"use client";

import { useT, T } from "@/lib/i18n";

/** The home page's town search: hands the name to /your-place?q=…, in either language. */
export function HomeSearch() {
  const t = useT();
  return (
    <form action="/your-place" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
      <label htmlFor="home-place" className="sr-only">
        <T en="Town or city" bn="শহর বা এলাকা" />
      </label>
      <input
        id="home-place"
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={t("Any town on Earth, e.g. Nairobi…", "পৃথিবীর যেকোনো শহর, যেমন সিলেট…")}
        className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <button type="submit" className="min-h-12 shrink-0 rounded-full bg-accent-strong px-6 font-medium text-accent-ink transition-colors hover:bg-accent-hover">
        <T en="Find your place" bn="আপনার জায়গা খুঁজুন" />
      </button>
    </form>
  );
}
