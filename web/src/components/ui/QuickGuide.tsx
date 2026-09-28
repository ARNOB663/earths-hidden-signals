"use client";

import { Question, X } from "@phosphor-icons/react";
import { useState, useSyncExternalStore } from "react";

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
  title: string;
  steps: string[];
  /** Where the card sits (absolute position classes). */
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
        How to use this page
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={`z-[800] w-[min(340px,calc(100%-2rem))] rounded-2xl border border-line bg-card p-5 shadow-soft ${cardClassName}`}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-ink">{title}</h2>
            <button type="button" onClick={close} aria-label="Close guide" className="-m-1 rounded-full p-1 text-ink-3 hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <ol className="mt-3 space-y-2.5">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed text-ink-2">
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
            className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hover active:scale-[0.98]"
          >
            Got it
          </button>
        </div>
      )}
    </>
  );
}
