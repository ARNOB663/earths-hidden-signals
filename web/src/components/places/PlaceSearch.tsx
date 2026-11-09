"use client";

import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { COUNTRY_BN, PLACE_BN } from "@/lib/names";
import { PLACES } from "@/lib/places";

/** Type a city name, pick it, and go to its place report. */
export function PlaceSearch({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const t = useT();
  const placeholder = t("Search a city, e.g. Dhaka or Kathmandu", "শহর খুঁজুন, যেমন ঢাকা বা কাঠমান্ডু");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Match English or Bangla names, so "ঢাকা" finds Dhaka too.
    return PLACES.filter((p) => `${p.name} ${p.country} ${PLACE_BN[p.id] ?? ""} ${COUNTRY_BN[p.country] ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [query]);

  const go = (id: string) => {
    setOpen(false);
    router.push(`/places/${id}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <MagnifyingGlass
        size={large ? 20 : 18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
        aria-label={t("Search for a city", "শহর খুঁজুন")}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full rounded-full border border-line bg-card pl-11 pr-4 text-ink shadow-soft placeholder:text-ink-3 ${
          large ? "py-3.5 text-base" : "py-2.5 text-sm"
        }`}
      />
      {open && query.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[1100] mt-2 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-soft"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-3">{t("No match. Try a larger city nearby.", "মিল পাওয়া যায়নি। কাছাকাছি বড় কোনো শহর চেষ্টা করুন।")}</li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(p.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${i === active ? "bg-sunken text-ink" : "text-ink-2"}`}
              >
                <MapPin size={16} className="shrink-0 text-accent" />
                <span className="font-medium text-ink">{t(p.name, PLACE_BN[p.id] ?? p.name)}</span>
                <span className="text-ink-3">{t(p.country, COUNTRY_BN[p.country] ?? p.country)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
