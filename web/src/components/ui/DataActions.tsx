"use client";

import { ChevronDown, Download, Table } from "lucide-react";
import { useId, useState } from "react";
import { GIcon } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { T, useT } from "@/lib/i18n";
import { CONTROL } from "./index";

const BUTTON = `inline-flex ${CONTROL.button} items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 ${CONTROL.transition} ${CONTROL.focusRing} hover:bg-sunken hover:text-ink`;

/** "Download the data" and "Show the data as a table" under a chart, as full-size buttons. */
export function DataActions({ onDownload, children }: { onDownload?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  const t = useT();
  const download = () => {
    onDownload?.();
    toast.success(t("Download started", "ডাউনলোড শুরু হয়েছে"), t("The file is in your downloads folder.", "ফাইলটি আপনার ডাউনলোড ফোল্ডারে আছে।"));
  };
  return (
    <div className="mt-2">
      <div className="-ml-3 flex flex-wrap items-center gap-1">
        {onDownload && (
          <button type="button" onClick={download} className={BUTTON}>
            <GIcon icon={Download} className="text-accent" />
            <T en="Download the data (CSV)" bn="তথ্য ডাউনলোড (CSV)" />
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={tableId} className={BUTTON}>
          <GIcon icon={Table} className="text-accent" />
          {open ? <T en="Hide the table" bn="টেবিল লুকান" /> : <T en="Show as a table" bn="টেবিল আকারে দেখুন" />}
          <GIcon icon={ChevronDown} size="sm" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div id={tableId} className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line text-sm">
          {children}
        </div>
      )}
    </div>
  );
}
