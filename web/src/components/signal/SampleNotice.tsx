// The one honesty banner used wherever sample readings are shown. It is rendered only when the
// row or page it sits beside actually carries a sample reading, so it can never claim a real
// observation is a sample and can never let a sample pass as current. The wording names what is
// fixed, what is real, and where the reading came from.
//
// `scope` picks what the banner may promise about the real datasets: `local` (the default) when the
// real coverage and backtest figures are on the same page; `elsewhere` when they are only on other
// pages, so the banner never points at something "below" that is not there.
import { FlaskConical } from "lucide-react";
import { T } from "@/lib/i18n";

export function SampleNotice({
  where,
  compact = false,
  scope = "local",
}: {
  /** Reads as "the rain values <where>", e.g. "for Dhaka" or "in this example card". */
  where: string;
  compact?: boolean;
  scope?: "local" | "elsewhere";
}) {
  const real =
    scope === "local"
      ? {
          en: "The Watch Level, coverage counts, historical sample sizes and the Accuracy backtest below are computed from real datasets.",
          bn: "সতর্কতার মাত্রা, আচ্ছাদনের সংখ্যা, ঐতিহাসিক নমুনার আকার এবং নিচের নির্ভুলতা-ব্যাকটেস্ট বাস্তব তথ্যসেট থেকে গণনা করা।",
        }
      : {
          en: "Coverage counts, historical case sizes and the Accuracy backtest on /accuracy come from real datasets.",
          bn: "আচ্ছাদনের সংখ্যা, ঐতিহাসিক নমুনার আকার এবং /accuracy-এর ব্যাকটেস্ট বাস্তব তথ্যসেট থেকে।",
        };
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-xl border border-watch bg-watch-soft text-watch ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}
    >
      <FlaskConical size={15} aria-hidden className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">
        <strong className="font-semibold">
          <T en="SAMPLE READING — not a live observation." bn="নমুনা পাঠ — বাস্তব পর্যবেক্ষণ নয়।" />
        </strong>{" "}
        <T
          en={`The rain values ${where} are fixed sample numbers on a fixed clock date, not a real NASA IMERG measurement. ${real.en}`}
          bn={`${where}এ বৃষ্টির মানগুলো স্থির নমুনা সংখ্যা, একটি নির্দিষ্ট তারিখের, বাস্তব নাসা IMERG পরিমাপ নয়। ${real.bn}`}
        />
      </span>
    </p>
  );
}
