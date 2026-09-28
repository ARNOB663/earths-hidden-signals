// Client-side CSV downloads for the charts (no server needed: the data is already in the page).

export const CITATION =
  "Earth's Hidden Signals (NASA Space Apps 2026), https://earths-hidden-signals.vercel.app. " +
  "Temperature: NASA GISTEMP v4 (GISTEMP Team, NASA GISS). Rainfall: GPCP v2.3 (Adler et al. 2018). " +
  "Events: NASA FIRMS, NASA Global Landslide Catalog, GDACS.";

const cell = (v: string | number | null) => {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][], note?: string) {
  const lines = [
    ...(note ? [`# ${note}`] : []),
    `# Source: ${CITATION}`,
    header.map(cell).join(","),
    ...rows.map((r) => r.map(cell).join(",")),
  ];
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lowercase, dash-separated, safe for a file name. */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
