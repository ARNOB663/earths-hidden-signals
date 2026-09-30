"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

export type SheetSnap = "peek" | "half" | "full";

const DESKTOP = "(min-width: 1024px)";
const ORDER: SheetSnap[] = ["peek", "half", "full"];

interface Props {
  id?: string;
  label: string;
  /** Classes for the panel on large screens (lg:…), where it floats beside the map. */
  className: string;
  /** Classes for the scrolling body (spacing between sections, padding). */
  bodyClassName: string;
  /** Phone only: always-visible summary under the handle. */
  peek: React.ReactNode;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** When this changes (and the panel is open), the body scrolls to the element with id `scrollTargetId`. */
  scrollKey?: string | number;
  scrollTargetId?: string;
  children: React.ReactNode;
}

/**
 * On phones the map fills the screen and this panel slides up over it: drag or tap the handle to move
 * between a short summary ("peek"), half the screen and the full screen. On large screens it is the
 * page's ordinary floating side panel. The peek height is published as --sheet-peek on the parent, so
 * map keys and controls can sit just above the panel.
 */
export function MapSheet({ id, label, className, bodyClassName, peek, snap, onSnapChange, scrollKey, scrollTargetId, children }: Props) {
  const sheetRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Record<SheetSnap, number> | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
  const t = useT();

  // Measure the three heights from the space available and the summary's own height.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const parent = sheet?.parentElement;
    const head = headRef.current;
    if (!sheet || !parent || !head) return;
    const measure = () => {
      const H = parent.clientHeight;
      const p = Math.min(head.offsetHeight, H - 40);
      setDims({ peek: p, half: Math.max(p + 120, Math.round(H * 0.52)), full: H - 12 });
      parent.style.setProperty("--sheet-peek", `${p}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  // Bring the answer into view when the selection changes while the panel is open.
  useEffect(() => {
    if (scrollKey === undefined || !scrollTargetId || snap === "peek" || window.matchMedia(DESKTOP).matches) return;
    const body = bodyRef.current;
    const target = document.getElementById(scrollTargetId);
    if (body && target && body.contains(target)) {
      body.scrollTo({ top: target.offsetTop - body.offsetTop - 12, behavior: "smooth" });
    }
    // Only when the key changes; the snap is read as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const step = useCallback(
    (dir: 1 | -1) => onSnapChange(ORDER[Math.min(2, Math.max(0, ORDER.indexOf(snap) + dir))]),
    [snap, onSnapChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dims || window.matchMedia(DESKTOP).matches) return;
    // Buttons and fields inside the summary keep working normally.
    if ((e.target as HTMLElement).closest("button:not([data-handle]), a, input, select, label")) return;
    drag.current = { y: e.clientY, h: dims[snap], t: performance.now(), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !dims) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    if (d.moved) setDragH(Math.min(dims.full, Math.max(dims.peek, d.h - dy)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !dims) return;
    if (!d.moved) {
      // A tap on the summary opens the panel halfway, or closes it back to the summary.
      onSnapChange(snap === "peek" ? "half" : "peek");
      return;
    }
    const h = Math.min(dims.full, Math.max(dims.peek, d.h - (e.clientY - d.y)));
    const velocity = (d.y - e.clientY) / Math.max(1, performance.now() - d.t); // px per ms, up is positive
    let next: SheetSnap;
    if (Math.abs(velocity) > 0.6) {
      // A quick flick moves one step in its direction from wherever the drag ended.
      const above = ORDER.filter((s) => dims[s] > h);
      const below = ORDER.filter((s) => dims[s] < h);
      next = velocity > 0 ? (above[0] ?? "full") : (below[below.length - 1] ?? "peek");
    } else {
      next = ORDER.reduce((best, s) => (Math.abs(dims[s] - h) < Math.abs(dims[best] - h) ? s : best), snap);
    }
    setDragH(null);
    onSnapChange(next);
  };

  const height = dragH ?? (dims ? dims[snap] : null);

  return (
    <aside
      ref={sheetRef}
      id={id}
      aria-label={label}
      style={height !== null ? ({ "--sheet-h": `${height}px` } as React.CSSProperties) : undefined}
      className={`max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[900] max-lg:flex max-lg:h-[var(--sheet-h,9rem)] max-lg:flex-col max-lg:rounded-t-3xl max-lg:border-t max-lg:border-line max-lg:bg-card max-lg:shadow-[0_-10px_30px_rgb(0_0_0/0.14)] ${
        dragH === null ? "max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out" : ""
      } ${className}`}
    >
      <div
        ref={headRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragH(null);
        }}
        className="shrink-0 touch-none select-none px-5 pb-3 lg:hidden"
      >
        <button
          type="button"
          data-handle
          // Pointer taps are handled by the summary area above; this click is for keyboard users (detail 0).
          onClick={(e) => {
            if (e.detail !== 0) return;
            if (snap === "full") onSnapChange("peek");
            else step(1);
          }}
          aria-expanded={snap !== "peek"}
          aria-controls={id}
          aria-label={snap === "full" ? t("Show the map", "মানচিত্র দেখুন") : t("Show more", "আরও দেখুন")}
          className="-mb-1 flex h-10 w-full items-center justify-center"
        >
          <span className="h-1.5 w-11 rounded-full bg-line" />
        </button>
        {peek}
      </div>
      <div
        ref={bodyRef}
        className={`max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:border-t max-lg:border-line max-lg:pb-[max(1.5rem,env(safe-area-inset-bottom))] ${bodyClassName}`}
      >
        {children}
      </div>
    </aside>
  );
}
