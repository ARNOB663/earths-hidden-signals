"use client";

import { CaretDown, DownloadSimple, Table } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { T } from "@/lib/i18n";

const BUTTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink";

/** "Download the data" and "Show the data as a table" under a chart, as full-size buttons. */
export function DataActions({ onDownload, children }: { onDownload?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  return (
    <div className="mt-2">
      <div className="-ml-3 flex flex-wrap items-center gap-1">
        {onDownload && (
          <button type="button" onClick={onDownload} className={BUTTON}>
            <DownloadSimple size={16} className="text-accent" />
            <T en="Download the data (CSV)" bn="তথ্য ডাউনলোড (CSV)" />
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={tableId} className={BUTTON}>
          <Table size={16} className="text-accent" />
          {open ? <T en="Hide the table" bn="টেবিল লুকান" /> : <T en="Show as a table" bn="টেবিল আকারে দেখুন" />}
          <CaretDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
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
