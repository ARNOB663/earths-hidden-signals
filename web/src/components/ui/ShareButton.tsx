"use client";

import { Check, ShareNetwork } from "@phosphor-icons/react";
import { useState } from "react";
import { T, useT } from "@/lib/i18n";

/**
 * Shares the current view. Pages keep what's on screen in the link (layer, dates, place, map position),
 * so the link opens the same view. Phones get the system share sheet; elsewhere the link is copied.
 */
export function ShareButton({ variant = "icon", className = "" }: { variant?: "icon" | "label"; className?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // The person closed the share sheet, or the browser blocked the clipboard: nothing to do.
    }
  };

  const label = t("Share this view", "এই দৃশ্য শেয়ার করুন");
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={share}
        title={label}
        aria-label={variant === "icon" ? label : undefined}
        className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink ${
          variant === "icon" ? "min-w-10" : "px-3"
        }`}
      >
        {copied ? <Check size={17} className="text-good" /> : <ShareNetwork size={17} />}
        {variant === "label" && <T en="Share" bn="শেয়ার" />}
      </button>
      <span
        role="status"
        className={`pointer-events-none absolute right-0 top-full z-[1000] mt-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-page shadow-soft transition-opacity ${
          copied ? "opacity-100" : "opacity-0"
        }`}
      >
        {copied && <T en="Link copied" bn="লিংক কপি হয়েছে" />}
      </span>
    </span>
  );
}
