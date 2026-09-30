"use client";

import { Question, X } from "@phosphor-icons/react";
import { useState, useSyncExternalStore } from "react";
import { T, useT } from "@/lib/i18n";

// Remembers (per browser) that someone has seen a page's guide. Storage can be blocked,
// so every access is guarded; without it the guide simply shows again next visit.
const key = (id: string) => `guide-seen:${id}`;
function readSeen(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(key(id), "1");
  } catch {
    // ignore
  }
}
const noopSubscribe = () => () => {};

/** A short "how to use this page" card shown on first visit, with a button to reopen it. */
export function QuickGuide({
  id,
  title,
  steps,
  cardClassName,
  buttonClassName,
}: {
  id: string;
  title: React.ReactNode;
  steps: React.ReactNode[];
  /** Where the card sits on large screens (lg: position classes). On phones it spans the map's width. */
  cardClassName: string;
  /** Where the reopen button sits. */
  buttonClassName: string;
}) {
  const seen = useSyncExternalStore(
    noopSubscribe,
    () => readSeen(id),
    () => true, // never render the guide on the server
  );
  const [state, setState] = useState<"auto" | "open" | "closed">("auto");
  const t = useT();
  const open = state === "open" || (state === "auto" && !seen);

  const close = () => {
    markSeen(id);
    setState("closed");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setState("open")}
        className={`z-[700] flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-sm text-ink-2 shadow-soft transition-colors hover:text-ink ${buttonClassName}`}
      >
        <Question size={16} className="text-accent" />
        <T en="How to use this page" bn="এই পাতা কীভাবে ব্যবহার করবেন" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("How to use this page", "এই পাতা কীভাবে ব্যবহার করবেন")}
          className={`absolute inset-x-3 top-3 z-[800] rounded-2xl border border-line bg-card p-5 shadow-soft lg:inset-x-auto lg:w-[340px] ${cardClassName}`}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("Close guide", "নির্দেশিকা বন্ধ করুন")}
              className="-m-2.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
          <ol className="mt-3 space-y-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={close}
            className="mt-4 w-full rounded-full bg-accent-strong py-2.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
          >
            <T en="Got it" bn="বুঝেছি" />
          </button>
        </div>
      )}
    </>
  );
}
