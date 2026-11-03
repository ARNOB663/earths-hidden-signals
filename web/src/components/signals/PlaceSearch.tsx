"use client";

// Submit-only place search with Open-Meteo (CC-BY 4.0). No autocomplete: typing does nothing
// until the user submits, and only then is one request made.

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n";

interface Result {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

export function PlaceSearch() {
  const router = useRouter();
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (query.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", query);
      url.searchParams.set("count", "6");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("bad status");
      const payload = (await response.json()) as { results?: Result[] };
      setResults(payload.results ?? []);
    } catch {
      setError(t("Search is unavailable right now. Tap the map instead.", "অনুসন্ধান এখন পাওয়া যাচ্ছে না। মানচিত্রে চাপ দিন।"));
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex gap-2" role="search">
        <label htmlFor="place-search" className="sr-only">
          {t("Search for a place", "একটি জায়গা খুঁজুন")}
        </label>
        <input
          id="place-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("Search a place name", "জায়গার নাম লিখুন")}
          className="min-h-11 flex-1 rounded-full border border-line bg-card px-4 text-sm text-ink placeholder:text-ink-3"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-accent-strong px-4 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          <Search size={16} aria-hidden />
          {busy ? t("Searching", "খোঁজা হচ্ছে") : t("Search", "খুঁজুন")}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-ink-2">{error}</p>}
      {results && results.length === 0 && (
        <p className="mt-2 text-sm text-ink-3">{t("No match. Tap the map instead.", "মিল নেই। মানচিত্রে চাপ দিন।")}</p>
      )}
      {results && results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
          {results.map((result) => (
            <li key={`${result.name}-${result.latitude}-${result.longitude}`}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/signals/place?lat=${result.latitude.toFixed(3)}&lon=${result.longitude.toFixed(3)}`,
                  )
                }
                className="min-h-11 w-full px-4 py-2 text-left text-sm text-ink hover:bg-sunken"
              >
                {result.name}
                <span className="text-ink-3">
                  {result.admin1 ? `, ${result.admin1}` : ""}
                  {result.country ? `, ${result.country}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-3">
        {t("Place search by Open-Meteo (CC-BY 4.0)", "স্থান অনুসন্ধান Open-Meteo (CC-BY 4.0)")}
      </p>
    </div>
  );
}
