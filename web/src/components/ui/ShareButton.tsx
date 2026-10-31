"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { GIcon } from "@/components/ui/icons";
import { SuccessCheck } from "@/components/ui/motion-icons";
import { toast } from "@/components/ui/toast";
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
      toast.success(t("Link copied", "লিংক কপি হয়েছে"), t("It opens this exact view.", "এটি ঠিক এই দৃশ্যটিই খুলবে।"));
    } catch {
      // Dismissing the share sheet is not a failure; only a blocked clipboard is.
      if (!navigator.share) toast.error(t("Could not copy the link", "লিংক কপি করা যায়নি"), t("Your browser blocked the clipboard.", "আপনার ব্রাউজার ক্লিপবোর্ড আটকে দিয়েছে।"));
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
        {copied ? <SuccessCheck size={17} className="text-good" /> : <GIcon icon={Share2} size="md" />}
        {variant === "label" && <T en="Share" bn="শেয়ার" />}
      </button>
    </span>
  );
}
