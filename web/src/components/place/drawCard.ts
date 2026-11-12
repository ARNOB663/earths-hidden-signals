// Draws a shareable 1080×1350 image of a place report (stripes + key facts) and downloads it as PNG.
// Uses the light theme's palette on purpose, so a shared card looks the same everywhere.

import { bnNum } from "@/lib/bn";
import { signed, stripeKey, type Place, type Report } from "./placeData";

const COLORS = {
  page: "#f6f5f2",
  ink: "#1b1b19",
  ink2: "#4f4e4a",
  ink3: "#6b6964",
  accent: "#1f66c1",
  steps: ["#184f95", "#3987e5", "#86b6ef", "#cfe0f7", "#e4e2dc", "#f6cfcb", "#ee9690", "#e34948", "#a8201f"],
};

function stripeColor(v: number, mean: number, span: number) {
  const k = Math.round(((v - mean) / span) * 4) + 4;
  return COLORS.steps[Math.min(8, Math.max(0, k))];
}

/** Writes text wrapped to `width`, returns the y after the last line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > width && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = w;
    } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

export function downloadCard({
  place,
  report,
  stripes,
  future,
  bn,
}: {
  place: Place;
  report: Report;
  stripes: number[] | null;
  future: [number, number];
  bn: boolean;
}) {
  const W = 1080;
  const H = 1350;
  const P = 80;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const f = (size: number, weight = 400) => `${weight} ${size}px ${font}`;
  const n = (s: string) => (bn ? bnNum(s) : s);
  const deg = bn ? "°সে" : "°C";

  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.accent;
  ctx.font = f(30, 600);
  ctx.fillText("Earth's Hidden Signals", P, P + 20);

  ctx.fillStyle = COLORS.ink;
  ctx.font = f(104, 700);
  ctx.fillText(place.name || (bn ? "এই জায়গা" : "This place"), P, 250, W - 2 * P);
  ctx.fillStyle = COLORS.ink3;
  ctx.font = f(30);
  ctx.fillText(`${place.detail ? `${place.detail}  ` : ""}${n(place.lat.toFixed(2))}°, ${n(place.lon.toFixed(2))}°`, P, 300);

  // The place's own warming stripes.
  const sy = 340;
  const sh = 290;
  if (stripes && stripes.length) {
    const mean = stripes.reduce((a, b) => a + b, 0) / stripes.length;
    const span = Math.max(...stripes.map((v) => Math.abs(v - mean))) || 1;
    const sw = (W - 2 * P) / stripes.length;
    stripes.forEach((v, i) => {
      ctx.fillStyle = stripeColor(v, mean, span);
      ctx.fillRect(P + i * sw, sy, Math.ceil(sw) + 0.5, sh);
    });
  }
  ctx.fillStyle = COLORS.ink3;
  ctx.font = f(26);
  ctx.fillText(n("1981"), P, sy + sh + 40);
  const right = n("2025");
  ctx.fillText(right, W - P - ctx.measureText(right).width, sy + sh + 40);
  const mid = bn ? "প্রতিটি দাগ এখানকার এক বছরের তাপমাত্রা" : "Each stripe is one year of temperature here";
  ctx.fillText(mid, (W - ctx.measureText(mid).width) / 2, sy + sh + 40);
  if (stripes && stripes.length) {
    const k = stripeKey(stripes);
    const key = bn
      ? `সবচেয়ে ঠান্ডা ${n(String(k.coolYear))}: ${n(signed(k.cool, 1))} ${deg}  ·  সবচেয়ে গরম ${n(String(k.warmYear))}: ${n(signed(k.warm, 1))} ${deg}  (১৯৫১–১৯৮০-এর তুলনায়)`
      : `Coolest ${k.coolYear}: ${signed(k.cool, 1)} ${deg}  ·  Warmest ${k.warmYear}: ${signed(k.warm, 1)} ${deg}  (vs 1951–1980)`;
    ctx.fillStyle = COLORS.ink2;
    let size = 26;
    ctx.font = f(size);
    while (ctx.measureText(key).width > W - 2 * P && size > 18) ctx.font = f(--size); // Bangla runs longer
    ctx.fillText(key, (W - ctx.measureText(key).width) / 2, sy + sh + 82);
  }

  // Two columns of facts.
  const col = (x: number, y: number, head: string, big: string, line: string) => {
    ctx.fillStyle = COLORS.ink2;
    ctx.font = f(32, 600);
    ctx.fillText(head, x, y);
    ctx.fillStyle = COLORS.ink;
    ctx.font = f(84, 700);
    ctx.fillText(big, x, y + 100);
    ctx.fillStyle = COLORS.ink2;
    ctx.font = f(30);
    return wrap(ctx, line, x, y + 150, (W - 3 * P) / 2, 40);
  };
  const y0 = 790;
  if (report.temp) {
    col(
      P,
      y0,
      bn ? "১৯৮১ থেকে" : "Since 1981",
      `${n(signed(report.temp[2] * 4.4, 1))} ${deg}`,
      report.temp[3] ? (bn ? "বেশি গরম, স্পষ্ট পরিবর্তন" : "warmer, a clear change") : bn ? "এখনো স্পষ্ট নয়" : "not yet a clear change",
    );
  }
  if (report.fut) {
    const hot = report.fut[5] >= 0.95 ? (bn ? "প্রায় প্রতি বছর" : "almost every year") : bn ? `১০ বছরে ${bnNum(Math.max(1, Math.round(report.fut[5] * 10)))} বার` : `${Math.max(1, Math.round(report.fut[5] * 10))} years in 10`;
    col(
      P + (W - P) / 2,
      y0,
      bn ? `${bnNum(future[0])}–${bnNum(future[1])} সালের মধ্যে` : `By ${future[0]}–${future[1]}`,
      `${n(signed(report.fut[4], 1))} ${deg}`,
      bn ? `আরও গরম; আজকের সবচেয়ে গরম বছর আসবে ${hot}` : `warmer again; today's hottest year in ten would come ${hot}`,
    );
  }

  // Disasters nearby and the source line.
  ctx.fillStyle = COLORS.ink;
  ctx.font = f(30, 600);
  const ev = report.ev;
  const nearby = bn
    ? `৩০০ কিমির মধ্যে, ২০০০ থেকে: ${bnNum(ev[0])} বন্যা সতর্কতা, ${bnNum(ev[1])} ঘূর্ণিঝড়, ${bnNum(ev[3])} ভূমিধস`
    : `Within 300 km since 2000: ${ev[0]} flood alerts, ${ev[1]} cyclones, ${ev[3]} landslides`;
  wrap(ctx, nearby, P, 1160, W - 2 * P, 40);
  ctx.fillStyle = COLORS.ink3;
  ctx.font = f(24);
  ctx.fillText(bn ? "নাসার তথ্য · পূর্বাভাস নয়" : "NASA data · a trend, not a forecast", P, H - P);
  const url = "earths-hidden-signals.vercel.app/your-place";
  ctx.fillText(url, W - P - ctx.measureText(url).width, H - P);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `climate-${(place.name || "place").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
