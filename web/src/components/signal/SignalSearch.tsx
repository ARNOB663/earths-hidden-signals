"use client";

// Home-page entry into the Signal: type a country or district and open its page. It searches the
// same committed rows /signal lists, so it can never offer a place that has no record. Matching is
// on the names the data carries, in either language.

import { ArrowRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { T, useLang } from "@/lib/i18n";
import type { SignalRow } from "@/lib/signals/model";

const MAX_RESULTS = 6;

export function SignalSearch({ rows }: { rows: SignalRow[] }) {
  const router = useRouter();
  const lang = useLang();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return rows
      .filter((row) =>
        `${row.name} ${row.countryName} ${row.countryBn} ${row.id}`.toLocaleLowerCase().includes(needle),
      )
      .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(needle)) - Number(a.name.toLocaleLowerCase().startsWith(needle)))
      .slice(0, MAX_RESULTS);
  }, [query, rows]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/signal/${id}`);
  };

  const name = (row: SignalRow) => `${row.name}, ${lang === "bn" ? row.countryBn : row.countryName}`;

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (results[active]) go(results[active].id);
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-card px-2 shadow-soft focus-within:border-ink-3"
      >
        <span className="grid h-10 w-9 shrink-0 place-items-center text-ink-3">
          <Search size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(results.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={lang === "bn" ? "দেশ, রাজ্য বা জেলা লিখুন" : "Type a country, state or district"}
          className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label={lang === "bn" ? "মুছুন" : "Clear"}
            className="grid h-9 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </form>

      {open && query.trim() && (
        <ul
          id={listId}
          role="listbox"
          aria-label={lang === "bn" ? "মিলে যাওয়া স্থান" : "Matching locations"}
          className="absolute left-0 right-0 top-full z-[var(--z-menu)] mt-2 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-soft"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-2">
              <T
                en="No covered location matches. Only South Asia has rain readings; the Gap page explains why."
                bn="কোনো আচ্ছাদিত স্থান মেলেনি। কেবল দক্ষিণ এশিয়ায় বৃষ্টির পাঠ আছে; কেন, তা ‘ফাঁক’ পাতাটি ব্যাখ্যা করে।"
              />
            </li>
          ) : (
            results.map((row, index) => (
              <li key={row.id}>
                <button
                  id={`${listId}-${row.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(row.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${index === active ? "bg-sunken" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{name(row)}</span>
                  <span className="shrink-0 text-xs text-ink-3">{row.level}</span>
                  <ArrowRight size={14} aria-hidden className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
