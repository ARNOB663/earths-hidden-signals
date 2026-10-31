"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { T, useT } from "@/lib/i18n";
import type { Country } from "@/lib/countries";

interface Props {
  countries: Pick<Country, "slug" | "name" | "nameBn" | "flag">[];
  /** Wide field for the mobile menu; compact pill otherwise. */
  large?: boolean;
}

/**
 * Navbar country search: type a country name (English or Bangla), pick from the
 * suggestions, and open /country/{slug}. Unmatched text goes to the country index
 * with the query, which explains what is covered.
 */
export function CountrySearch({ countries, large = false }: Props) {
  const router = useRouter();
  const t = useT();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Phones: pin the list to the viewport under the header instead of the narrow search pill.
  const [mobile, setMobile] = useState(false);
  const [menuTop, setMenuTop] = useState<number | undefined>(undefined);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries
      .filter((c) => `${c.name} ${c.nameBn} ${c.slug}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [query, countries]);

  // Keep the mobile anchor under the field, measuring whenever the list is shown or resized.
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const sync = () => {
      setMobile(mq.matches);
      const form = inputRef.current?.closest("form");
      if (form) setMenuTop(Math.round(form.getBoundingClientRect().bottom + 8));
    };
    sync();
    // The navbar's own transition settles a frame later; re-measure then.
    const raf = requestAnimationFrame(sync);
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
    };
  }, [open, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const close = () => {
    setOpen(false);
    setExpanded(false);
    setQuery("");
  };

  const go = (slug: string) => {
    close();
    router.push(`/country/${slug}`);
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (results.length > 0) return go(results[0].slug);
    close();
    router.push(`/countries?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className={`relative ${large ? "w-full" : "shrink-0"}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={
          large
            ? "country-search flex items-center gap-2 rounded-xl border border-line bg-card px-3"
            : `country-search flex items-center rounded-full border bg-card transition-all ${
                expanded ? "w-44 border-ink-3 xl:w-56" : "w-10 border-transparent hover:border-line"
              }`
        }
      >
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setOpen(true);
            inputRef.current?.focus();
          }}
          aria-label={t("Search countries", "দেশ খুঁজুন")}
          className={large ? "grid h-10 w-8 shrink-0 place-items-center text-ink-3" : "grid h-10 w-10 shrink-0 place-items-center text-ink-2 hover:text-ink"}
        >
          <MagnifyingGlass size={large ? 20 : 18} />
        </button>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("Search countries", "দেশ খুঁজুন")}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].slug}` : undefined}
          placeholder={t("Search a country", "দেশ খুঁজুন")}
          value={query}
          onFocus={() => {
            setOpen(true);
            if (!large) setExpanded(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && open && results[active]) {
              e.preventDefault();
              go(results[active].slug);
            } else if (e.key === "Escape") {
              close();
            }
          }}
          className={`country-search-input min-w-0 flex-1 bg-transparent py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none ${expanded || large ? "" : "w-0 opacity-0"}`}
        />
        {expanded && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={t("Clear", "মুছুন")}
            className="grid h-8 w-7 shrink-0 place-items-center text-ink-3 hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {open && (expanded || large) && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("Countries", "দেশ")}
          className={`country-search-menu absolute top-full z-[1200] mt-2 overflow-hidden rounded-xl py-1 ${
            large ? "left-0 right-0" : "right-0 w-64"
          }`}
          // The collapsed pill is only 40px wide, so on phones the list is placed with fixed
          // positioning against the viewport instead of running off the left edge.
          style={
            mobile
              ? { position: "fixed", top: menuTop, right: 16, left: 16, width: "auto" }
              : undefined
          }
        >
          {results.length === 0 ? (
            <li className="country-search-empty px-4 py-3 text-sm">
              <T en="No country by that name." bn="এই নামে কোনো দেশ নেই।" />{" "}
              <Link href={`/countries?q=${encodeURIComponent(query)}`} className="text-accent hover:underline" onClick={close}>
                <T en="See the country list" bn="দেশের তালিকা দেখুন" />
              </Link>
            </li>
          ) : (
            results.map((c, i) => (
              <li key={c.slug}>
                <Link
                  id={`${listId}-${c.slug}`}
                  role="option"
                  aria-selected={i === active}
                  href={`/country/${c.slug}`}
                  onClick={close}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`country-search-option flex items-center gap-3 px-3 py-2 text-sm ${
                    i === active ? "is-active" : ""
                  }`}
                >
                  {c.flag ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://flagcdn.com/w40/${c.flag}.png`}
                      alt=""
                      width={22}
                      height={16}
                      className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-black/15"
                    />
                  ) : (
                    <span className="h-4 w-[22px] rounded-sm bg-line" aria-hidden />
                  )}
                  <T en={c.name} bn={c.nameBn} />
                </Link>
              </li>
            ))
          )}
          <li className="country-search-footer">
            <Link href="/countries" onClick={close} className="block px-3 py-2 text-xs">
              <T en="All countries →" bn="সব দেশ →" />
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
