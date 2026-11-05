import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SignalEvidence } from "@/components/signal/observation";
import { SignalLevelHistory } from "@/components/signal/History";
import { SampleNotice } from "@/components/signal/SampleNotice";
import { ShareCard } from "@/components/signal/ShareCard";
import { T } from "@/lib/i18n";
import { loadModel } from "@/lib/signals/model";

export const revalidate = 86400;
export const dynamicParams = false;

export async function generateStaticParams() {
  const model = await loadModel();
  return model.rows.map((row) => ({ id: row.id }));
}

export async function generateMetadata({ params }: PageProps<"/signal/[id]">): Promise<Metadata> {
  const { id } = await params;
  const model = await loadModel();
  const row = model.rows.find((candidate) => candidate.id === id);
  if (!row) return { title: "Signal · Earth's Hidden Signals" };
  return {
    title: `${row.name}, ${row.countryName} · Signal · Earth's Hidden Signals`,
    description: `Observed rain, Watch Level, Data Trust Grade and historical flood frequency for ${row.name}. Observational screening, not a forecast or an official warning.`,
  };
}

export default async function SignalDetailPage({ params }: PageProps<"/signal/[id]">) {
  const { id } = await params;
  const model = await loadModel();
  const row = model.rows.find((candidate) => candidate.id === id);
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-3">
        <Link href="/signal" className="inline-flex items-center gap-1 underline decoration-line underline-offset-2 hover:text-ink">
          <ArrowLeft size={13} aria-hidden />
          <T en="All Signals" bn="সব সংকেত" />
        </Link>
        <span aria-hidden> / </span>
        <span>{row.countryName}</span>
      </nav>

      <header className="mt-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{row.name}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {row.countryName} · {row.level === "ADM1" ? <T en="First-level area" bn="প্রথম স্তরের এলাকা" /> : <T en="Second-level area" bn="দ্বিতীয় স্তরের এলাকা" />} ·{" "}
          {row.tileLabel} · <span className="tabular-nums">{row.centre[0].toFixed(2)}, {row.centre[1].toFixed(2)}</span>
        </p>
        <p className="mt-1 text-xs text-ink-3">
          {row.sample ? (
            <T
              en="Observational screening on sample rain values. Not a forecast and not an official warning."
              bn="নমুনা বৃষ্টির মানে পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়, সরকারি সতর্কবার্তাও নয়।"
            />
          ) : (
            <T
              en="Observational screening from satellite rain. Not a forecast and not an official warning."
              bn="স্যাটেলাইট বৃষ্টি থেকে পর্যবেক্ষণভিত্তিক স্ক্রিনিং। পূর্বাভাস নয়, সরকারি সতর্কবার্তাও নয়।"
            />
          )}
        </p>
      </header>

      {row.sample && (
        <div className="mt-3">
          <SampleNotice where={`for ${row.name}`} />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <SignalEvidence row={row} />
      </div>

      <SignalLevelHistory row={row} />

      <section aria-labelledby="act" className="mt-6 rounded-2xl border border-line bg-card p-4">
        <h2 id="act" className="text-base font-semibold text-ink">
          <T en="What to do" bn="কী করবেন" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="Check the official warning for your area and know your nearest flood shelter and a raised route out. Rainfall in this data is an input to preparedness, never a warning."
            bn="আপনার এলাকার সরকারি সতর্কবার্তা দেখুন এবং নিকটতম বন্যা-আশ্রয়কেন্দ্র ও উঁচু পথ জেনে রাখুন। এই তথ্যের বৃষ্টি প্রস্তুতির একটি উপাদান, সতর্কবার্তা নয়।"
          />
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={model.brief.official.wmo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm text-ink-2 hover:text-ink"
          >
            <T en="Official warnings (WMO SWIC)" bn="সরকারি সতর্কবার্তা (WMO SWIC)" />
            <ExternalLink size={13} aria-hidden />
          </a>
          <Link
            href="/act"
            className="inline-flex min-h-10 items-center rounded-full bg-accent-strong px-4 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            <T en="Preparedness guidance" bn="প্রস্তুতির নির্দেশনা" />
          </Link>
        </div>
      </section>

      <ShareCard row={row} />
    </main>
  );
}
