"use client";

// Signals together: where unusual heat and drought now come at once (a world map of the change), and a
// month-by-month look at the year before some well-known disasters. Everything is from NASA's monthly
// temperature (GISTEMP) and rain (GPCP) records; a pattern in the record, never a forecast.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bnNum } from "@/lib/bn";
import { T, useLang } from "@/lib/i18n";
import { cssVar, useTheme } from "@/lib/theme";

type Month = { m: string; t: number; tr: number; r: number | null; rr: number; hot: boolean; dry: boolean; wet: boolean; hotDry: boolean; wetOnWet: boolean };
type Event = { id: string; name: string; nameBn: string; type: string; month: string; lat: number; lon: number; months: Month[] };
export type Compound = { early: [number, number]; late: [number, number]; totals: { hotDry: [number, number]; wetOnWet: [number, number] }; cells: number[][] };

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
const LONG_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LONG_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const DRY = "#c98a2c";
const DRY_LIGHT = "#ecd3a5";

export function HotDryMap({ data }: { data: Compound }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bn = useLang() === "bn";
  const theme = useTheme();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = (c.width = 720);
    const H = (c.height = 260);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const x = (lon: number) => ((lon + 180) / 360) * W;
    const y = (lat: number) => ((75 - lat) / 130) * H;
    const steps = ["--cool-2", "--mid", "--warm-1", "--warm-2", "--warm-3", "--warm-4"].map(cssVar);
    for (const cell of data.cells) {
      const d = cell[3] - cell[2];
      const k = d <= -2 ? 0 : d < 1 ? 1 : d < 4 ? 2 : d < 8 ? 3 : d < 13 ? 4 : 5;
      ctx.fillStyle = steps[k];
      ctx.fillRect(x(cell[1] - 1), y(cell[0] + 1), (2 / 360) * W + 0.5, (2 / 130) * H + 0.5);
    }
  }, [data, theme]);
  return <canvas ref={ref} role="img" aria-label={bn ? "বিশ্ব মানচিত্র: ১৯৮১–১৯৯৫-এর চেয়ে কোথায় গরম-ও-শুষ্ক মাস এখন বেশি আসে (লাল)।" : "World map: where hot and dry months now come more often (red) than in 1981-1995."} className="h-auto w-full" />;
}

function Timeline({ e, bn }: { e: Event; bn: boolean }) {
  const label = (m: string) => {
    const k = Number(m.slice(5, 7)) - 1;
    return bn ? MONTHS_BN[k] : MONTHS_EN[k];
  };
  const long = (m: string) => {
    const k = Number(m.slice(5, 7)) - 1;
    return bn ? `${LONG_BN[k]} ${bnNum(m.slice(0, 4))}` : `${LONG_EN[k]} ${m.slice(0, 4)}`;
  };
  const tColor = (r: number) => (r > 0.9 ? cssVar("--warm-3") : r >= 0.75 ? cssVar("--warm-1") : r <= 0.1 ? cssVar("--cool-3") : r <= 0.25 ? cssVar("--cool-1") : cssVar("--mid"));
  const rColor = (r: number) => (r > 0.9 ? cssVar("--cool-3") : r >= 0.75 ? cssVar("--cool-1") : r <= 0.1 ? DRY : r <= 0.25 ? DRY_LIGHT : cssVar("--mid"));
  const months = e.months;
  const last = months[months.length - 1];
  const before = months.slice(0, -1);
  const first = before.find((m) => m.hot || m.dry || m.wet);
  const ahead = first ? months.length - 1 - months.indexOf(first) : 0;
  const firstWhat = first ? (first.hot ? ["heat", "গরম"] : first.dry ? ["dryness", "শুষ্কতা"] : ["heavy rain", "ভারী বৃষ্টি"]) : null;
  const combos = months.filter((m) => m.hotDry || m.wetOnWet);
  const eventUnusual = last.hot || last.dry || last.wet;

  return (
    <div className="mt-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-24 sm:w-28" />
              {months.map((m, i) => (
                <th key={m.m} scope="col" className={`font-normal ${i === months.length - 1 ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {label(m.m)}
                  {(i === 0 || m.m.endsWith("-01")) && <span className="block text-[10px] text-ink-3">{bn ? bnNum(m.m.slice(0, 4)) : m.m.slice(0, 4)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="pr-2 text-left font-normal text-ink-2">
                <T en="Temperature" bn="তাপমাত্রা" />
              </th>
              {months.map((m) => (
                <td key={m.m} title={`${m.m}: ${m.t > 0 ? "+" : ""}${m.t} °C`} className="h-9 rounded-md" style={{ background: tColor(m.tr) }} />
              ))}
            </tr>
            <tr>
              <th scope="row" className="pr-2 text-left font-normal text-ink-2">
                <T en="Rain" bn="বৃষ্টি" />
              </th>
              {months.map((m) => (
                <td key={m.m} title={m.r === null ? m.m : `${m.m}: ${m.r > 0 ? "+" : ""}${m.r}%`} className="h-9 rounded-md" style={{ background: rColor(m.rr) }} />
              ))}
            </tr>
            <tr>
              <th scope="row" className="pr-2 text-left font-normal text-ink-2">
                <T en="Together" bn="একসাথে" />
              </th>
              {months.map((m) => (
                <td key={m.m} className="text-center text-[10px] font-semibold leading-tight">
                  {m.hotDry && <span className="block rounded bg-[color-mix(in_srgb,var(--warm-3)_18%,transparent)] px-0.5 text-[var(--warm-4)]">{bn ? "গরম+শুষ্ক" : "hot+dry"}</span>}
                  {m.wetOnWet && <span className="block rounded bg-[color-mix(in_srgb,var(--cool-3)_18%,transparent)] px-0.5 text-[var(--cool-4)]">{bn ? "ভেজা+ভেজা" : "wet+wet"}</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--warm-3)]" /><T en="hottest 10%" bn="সবচেয়ে গরম ১০%" /></span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[var(--cool-3)]" /><T en="wettest 10% (rain) or coldest 10%" bn="সবচেয়ে ভেজা ১০% (বৃষ্টি) বা সবচেয়ে ঠান্ডা ১০%" /></span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: DRY }} /><T en="driest 10%" bn="সবচেয়ে শুষ্ক ১০%" /></span>
        <span><T en="for that calendar month, 1981–2025" bn="সেই মাসের হিসাবে, ১৯৮১–২০২৫" /></span>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-ink">
        <li>
          {first && firstWhat ? (
            <T
              en={`First unusual signal: ${firstWhat[0]} in ${long(first.m)}, ${ahead} month${ahead === 1 ? "" : "s"} before.`}
              bn={`প্রথম অস্বাভাবিক সংকেত: ${long(first.m)}-এ ${firstWhat[1]}, ${bnNum(ahead)} মাস আগে।`}
            />
          ) : (
            <T en="No unusual month in the year before." bn="আগের বছরে কোনো অস্বাভাবিক মাস নেই।" />
          )}
        </li>
        {(
          [
            ["hot", "Unusual heat", "অস্বাভাবিক গরম"],
            ["dry", "Unusual dryness", "অস্বাভাবিক শুষ্কতা"],
            ["wet", "Unusual rain", "অস্বাভাবিক বৃষ্টি"],
          ] as const
        ).map(([key, en, bnl]) => {
          const list = before.filter((m) => m[key]);
          if (!list.length) return null;
          return (
            <li key={key}>
              <T en={`${en}: ${list.map((m) => long(m.m)).join(", ")}.`} bn={`${bnl}: ${list.map((m) => long(m.m)).join(", ")}।`} />
            </li>
          );
        })}
        <li>
          {combos.length ? (
            <T
              en={`Signals together: ${combos.map((m) => `${m.hotDry ? "hot and dry" : "very wet on wet ground"} in ${long(m.m)}`).join("; ")}.`}
              bn={`একসাথে সংকেত: ${combos.map((m) => `${long(m.m)}-এ ${m.hotDry ? "গরম ও শুষ্ক" : "ভেজা মাটিতে খুব বেশি বৃষ্টি"}`).join("; ")}।`}
            />
          ) : (
            <T en="No two unusual signals at once in these months." bn="এই মাসগুলোতে দুটি অস্বাভাবিক সংকেত একসাথে আসেনি।" />
          )}
        </li>
        <li>
          {eventUnusual ? (
            <T
              en={`In ${long(last.m)} itself: ${[last.hot && "among the hottest 10%", last.wet && `rain ${last.r !== null && last.r > 0 ? "+" : ""}${last.r ?? ""}% of normal, among the wettest 10%`, last.dry && "among the driest 10%"].filter(Boolean).join(", ")}.`}
              bn={`${long(last.m)}-এ: ${[last.hot && "সবচেয়ে গরম ১০%-এর মধ্যে", last.wet && `বৃষ্টি স্বাভাবিকের ${last.r !== null && last.r > 0 ? "+" : ""}${bnNum(String(last.r ?? ""))}%, সবচেয়ে ভেজা ১০%-এর মধ্যে`, last.dry && "সবচেয়ে শুষ্ক ১০%-এর মধ্যে"].filter(Boolean).join(", ")}।`}
            />
          ) : (
            <T
              en={`In ${long(last.m)} itself the monthly record shows nothing unusual: the damage came from a few days of extreme weather that a monthly average over 200 km smooths away.`}
              bn={`${long(last.m)}-এ মাসিক রেকর্ডে অস্বাভাবিক কিছু নেই: ক্ষতি এসেছে কয়েক দিনের চরম আবহাওয়া থেকে, যা ২০০ কিমি জুড়ে মাসিক গড়ে মিলিয়ে যায়।`}
            />
          )}
        </li>
      </ul>
      <p className="mt-3 text-sm">
        <Link href={`/your-place?lat=${e.lat}&lon=${e.lon}&name=${encodeURIComponent(bn ? e.nameBn : e.name)}`} className="font-medium text-accent hover:underline">
          <T en="Open the full report for this place" bn="এই জায়গার পূর্ণ রিপোর্ট দেখুন" />
        </Link>
      </p>
    </div>
  );
}

export default function SignalsTogether() {
  const bn = useLang() === "bn";
  const [compound, setCompound] = useState<Compound | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState("pakistan-floods-2022");

  useEffect(() => {
    Promise.all([fetch("/data/global/compound.json").then((r) => r.json()), fetch("/data/global/compound-events.json").then((r) => r.json())])
      .then(([c, e]) => {
        setCompound(c);
        setEvents(e.events);
      })
      .catch(() => setFailed(true));
  }, []);

  const event = useMemo(() => events?.find((e) => e.id === pick) ?? null, [events, pick]);
  const ratio = compound ? compound.totals.hotDry[1] / Math.max(1, compound.totals.hotDry[0]) : 0;

  return (
    <div className="h-full overflow-y-auto bg-page">
      <div className="mx-auto w-full max-w-[1000px] px-4 pb-24 pt-20 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          <T en="Signals together" bn="একসাথে একাধিক সংকেত" />
        </h1>
        <p className="mt-3 max-w-[65ch] text-ink-2">
          <T
            en="Disasters often follow more than one unusual signal at once. Here we look for months when NASA's records show heat and drought together, or heavy rain on already wet ground."
            bn="দুর্যোগ প্রায়ই একসাথে একাধিক অস্বাভাবিক সংকেতের পরে আসে। এখানে আমরা খুঁজি সেই মাসগুলো, যখন নাসার রেকর্ডে গরম আর খরা একসাথে, বা ভেজা মাটিতে ভারী বৃষ্টি দেখা যায়।"
          />
        </p>

        {failed && (
          <p role="alert" className="mt-6 text-ink">
            <T en="The data didn't load. Check your connection and reload the page." bn="তথ্য লোড হয়নি। ইন্টারনেট সংযোগ দেখে পাতাটি আবার লোড করুন।" />
          </p>
        )}

        {compound && (
          <section className="mt-8 rounded-3xl bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">
              <T en="Hot and dry at once" bn="একসাথে গরম ও শুষ্ক" />
            </h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--warm-4)]">
              <T en={`${ratio.toFixed(1)}× more common`} bn={`${bnNum(ratio.toFixed(1))} গুণ বেশি`} />
            </p>
            <p className="mt-1 text-ink-2">
              <T
                en={`Months both among the hottest 10% and the driest 10% for their time of year, over Earth's land: ${compound.totals.hotDry[0].toLocaleString("en-US")} in ${compound.early[0]}–${compound.early[1]}, ${compound.totals.hotDry[1].toLocaleString("en-US")} in ${compound.late[0]}–${compound.late[1]}.`}
                bn={`বছরের সেই সময়ের সবচেয়ে গরম ১০% আর সবচেয়ে শুষ্ক ১০%—দুটোই, পৃথিবীর স্থলভাগে: ${bnNum(compound.early[0])}–${bnNum(compound.early[1])} সালে ${bnNum(compound.totals.hotDry[0].toLocaleString("en-US"))}টি মাস, ${bnNum(compound.late[0])}–${bnNum(compound.late[1])} সালে ${bnNum(compound.totals.hotDry[1].toLocaleString("en-US"))}টি।`}
              />
            </p>
            <div className="mt-4">
              <HotDryMap data={compound} />
            </div>
            <p className="mt-2 text-xs text-ink-3">
              <T en="Red: more hot-and-dry months than in 1981–1995. Blue: fewer." bn="লাল: ১৯৮১–১৯৯৫-এর চেয়ে বেশি গরম-ও-শুষ্ক মাস। নীল: কম।" />
            </p>
          </section>
        )}

        {events && (
          <section className="mt-6 rounded-3xl bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">
              <T en="The year before a disaster" bn="দুর্যোগের আগের বছর" />
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              <T en="Pick an event to see what NASA's monthly records showed there in the 12 months before." bn="একটি ঘটনা বেছে নিন: আগের ১২ মাসে সেখানে নাসার মাসিক রেকর্ড কী দেখিয়েছিল।" />
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={pick === e.id}
                  onClick={() => setPick(e.id)}
                  className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${pick === e.id ? "border-transparent bg-accent-strong text-accent-ink" : "border-line text-ink-2 hover:text-ink"}`}
                >
                  {bn ? e.nameBn : e.name} <span className="opacity-70">{bn ? bnNum(e.month.slice(0, 4)) : e.month.slice(0, 4)}</span>
                </button>
              ))}
            </div>
            {event && <Timeline key={event.id} e={event} bn={bn} />}
            <p className="mt-5 rounded-2xl bg-sunken px-4 py-3 text-xs text-ink-2">
              <T
                en="These are monthly averages over about 200 km, so they show the background, not the trigger: cyclones form over the ocean, and floods often come from a few days of rain. Our AI test found that monthly weather alone cannot tell disaster years from ordinary ones, so read this as what happened, not as a warning system."
                bn="এগুলো প্রায় ২০০ কিমি জুড়ে মাসিক গড়, তাই এগুলো পটভূমি দেখায়, সরাসরি কারণ নয়: ঘূর্ণিঝড় সাগরে তৈরি হয়, আর বন্যা প্রায়ই কয়েক দিনের বৃষ্টি থেকে আসে। আমাদের এআই পরীক্ষা দেখিয়েছে, শুধু মাসিক আবহাওয়া দিয়ে দুর্যোগের বছর আলাদা করা যায় না; তাই এটিকে কী ঘটেছিল তা হিসেবে পড়ুন, সতর্কব্যবস্থা হিসেবে নয়।"
              />
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
