"use client";

// SMS-style preparedness messages built from one real Signal row. Each message is short enough to
// send by text, and each keeps the observation date, the level and the "not an official warning"
// line, so a forwarded message cannot be read as an instruction to evacuate. Nothing is sent: the
// buttons copy the text to the clipboard or open the viewer's own messaging app.

import { Check, Copy, MessageSquare } from "lucide-react";
import { useState } from "react";
import { T, useT } from "@/lib/i18n";
import type { SignalRow } from "@/lib/signals/model";

const NOTICE = "Observational screening, not an official warning.";

export function ActionMessages({ row }: { row: SignalRow }) {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);
  const level =
    row.watch === "high" ? "high watch" : row.watch === "elevated" ? "elevated watch" : row.watch === "none" ? "no elevated watch" : "can't tell";
  const observed = row.sample
    ? "a fixed sample date (not a live observation)"
    : row.observed?.slice(0, 10) ?? "no current reading";
  const ratio = row.ratio === null ? null : `${row.ratio.toFixed(1)}× the usual rain for the date`;

  // Only the messages this row's own state can honestly support. A "raised watch" message is
  // emitted only when the row is actually at an elevated or high level; a stale or unmeasurable row
  // gets a data-gap message instead, so a shared text can never claim a watch that is not there.
  const raised = !row.sample && (row.watch === "elevated" || row.watch === "high");
  const messages: { key: string; label: { en: string; bn: string }; text: string }[] = [
    ...(raised
      ? [
          {
            key: "alert",
            label: { en: "Raised watch", bn: "সতর্কতা বাড়লে" },
            text: `${row.name}, ${row.countryName}: rain is ${ratio ?? "above normal"} (${level}). Earth's Hidden Signals, observed ${observed}. ${NOTICE} Follow your national met service.`,
          },
        ]
      : []),
    {
      key: "prepare",
      label: { en: "Prepare now", bn: "এখনই প্রস্তুতি" },
      // Deliberately asserts no judgement about the reading — it is preparedness, not a claim.
      text: `${row.name}, ${row.countryName}: rain recorded in our data on ${observed}. Whatever the level, know your nearest flood shelter and a raised road out. ${NOTICE}`,
    },
    row.watch === "none"
      ? {
          key: "quiet",
          label: { en: "Nothing unusual", bn: "অস্বাভাবিক কিছু নেই" },
          text: `${row.name}, ${row.countryName}: no unusual signal in our rain data on ${observed}. This is not an all-clear — ${NOTICE}`,
        }
      : {
          key: "gap",
          label: { en: "Data gap", bn: "তথ্যের ফাঁক" },
          text: `${row.name}, ${row.countryName}: we cannot judge today here — the rain reading is missing or too old. A gap is not quiet. ${NOTICE}`,
        },
  ];

  const copy = async (message: { key: string; text: string }) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(message.key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt(t("Copy this message", "এই বার্তা কপি করুন"), message.text);
    }
  };

  return (
    <div className="mt-4">
      <ul className="grid gap-2 sm:grid-cols-3">
        {messages.map((message) => (
          <li key={message.key} className="flex flex-col rounded-2xl border border-line bg-card p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
              <MessageSquare size={13} aria-hidden />
              <T en={message.label.en} bn={message.label.bn} />
            </p>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-2">{message.text}</p>
            <button
              type="button"
              onClick={() => copy(message)}
              className="mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-xs text-ink hover:bg-sunken"
            >
              {copied === message.key ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied === message.key ? t("Copied", "কপি হয়েছে") : t("Copy", "কপি")}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="Nothing is sent by this site. The buttons copy the text so you can paste it into your own messaging app."
          bn="এই সাইট কিছুই পাঠায় না। বোতামগুলো লেখাটি কপি করে, যাতে আপনি নিজের মেসেজিং অ্যাপে পেস্ট করতে পারেন।"
        />
      </p>
    </div>
  );
}
