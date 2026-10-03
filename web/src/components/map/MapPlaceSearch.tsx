"use client";

import { MagnifyingGlass, MapPin, X } from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { COUNTRY_BN } from "@/lib/names";
import type { MapPlace } from "@/lib/mapPlaces";

/** The existing local-name search pattern, extended to countries and research regions. */
export function MapPlaceSearch({ places, selected, onSelect }: { places: MapPlace[]; selected: MapPlace | null; onSelect: (place: MapPlace | null) => void }) {
  const t = useT();
  const id = useId();
  const [query, setQuery] = useState(selected ? t(selected.name, COUNTRY_BN[selected.name] ?? selected.name) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter(p => p.id !== "study-area" && `${p.name} ${COUNTRY_BN[p.name] ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.type === "country") - Number(a.type === "country"))
      .slice(0, 8);
  }, [places, query]);
  const select = (place: MapPlace) => { setOpen(false); onSelect(place); };
  const menuOpen = open && (!selected || query !== t(selected.name, COUNTRY_BN[selected.name] ?? selected.name));
  return (
    <div className="absolute right-3 top-3 z-[700] w-[calc(100%-1.5rem)] sm:w-80 lg:right-4 lg:top-4"
      onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="relative rounded-xl border border-line bg-card/95 shadow-soft backdrop-blur-sm">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-ink-3" size={18} aria-hidden />
        <input type="search" role="combobox" aria-autocomplete="list" aria-expanded={menuOpen} aria-controls={id}
          aria-activedescendant={menuOpen && results[active] ? `${id}-${results[active].id}` : undefined}
          aria-label={t("Search a country or region", "দেশ বা অঞ্চল খুঁজুন")}
          placeholder={t("Search a country or region…", "দেশ বা অঞ্চল খুঁজুন…")}
          value={query} onFocus={() => setOpen(true)} onClick={e => { if (selected) e.currentTarget.select(); }}
          onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault(); setOpen(true);
              setActive(a => Math.max(0, Math.min(results.length - 1, a + (e.key === "ArrowDown" ? 1 : -1))));
            } else if (e.key === "Enter" && results[active] && menuOpen) { e.preventDefault(); select(results[active]); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          className="h-11 w-full rounded-xl bg-transparent pl-10 pr-11 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-accent" />
        {(selected || query) && <button type="button" aria-label={t("Clear place selection", "নির্বাচিত স্থান মুছুন")}
          onClick={() => { setQuery(""); setOpen(false); onSelect(null); }} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-sunken"><X size={16} /></button>}
      </div>
      {menuOpen && <ul id={id} role="listbox" aria-label={t("Places", "স্থান")}
        className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-soft">
        {results.length ? results.map((place, i) => <li key={place.id} role="none">
          <button type="button" id={`${id}-${place.id}`} role="option" aria-selected={i === active}
            onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => select(place)}
            className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm ${i === active ? "bg-sunken" : "hover:bg-sunken"}`}>
            <MapPin size={17} className="mt-0.5 shrink-0 text-accent" /><span><span className="block font-medium text-ink">{t(place.name, COUNTRY_BN[place.name] ?? place.name)}</span>
              <span className="text-xs text-ink-3">{place.type === "country" ? t("Country · South Asia", "দেশ · দক্ষিণ এশিয়া") : t("Research region · South Asia", "গবেষণা অঞ্চল · দক্ষিণ এশিয়া")}</span></span>
          </button></li>) : <li className="px-4 py-3 text-sm text-ink-3">{t("No match. Try a South Asian country or research region.", "মিল নেই। দক্ষিণ এশিয়ার দেশ বা গবেষণা অঞ্চল চেষ্টা করুন।")}</li>}
      </ul>}
    </div>
  );
}
