"use client";

// The one wrapper around sonner. Toasts are reserved for real outcomes (a copy failed, a search
// matched nothing, NASA could not be reached); routine navigation and toggles stay silent.

import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { toast as sonner } from "sonner";
import { STROKE } from "./icons";

const icon = (Icon: typeof CircleCheck, className: string) => (
  <Icon size={18} strokeWidth={STROKE} className={className} aria-hidden />
);

const opts = (description?: string) => ({ description, icon: undefined });

// Keys are written by hand (one per warning), so this set stays small for the whole session.
const announced = new Set<string>();

export const toast = {
  success: (msg: string, description?: string) =>
    sonner.success(msg, { ...opts(description), duration: 4000, icon: icon(CircleCheck, "text-good") }),
  error: (msg: string, description?: string) =>
    sonner.error(msg, { ...opts(description), duration: 6000, icon: icon(CircleX, "text-warm-3") }),
  warning: (msg: string, description?: string) =>
    sonner.warning(msg, { ...opts(description), duration: 6000, icon: icon(TriangleAlert, "text-watch") }),
  info: (msg: string, description?: string) =>
    sonner.info(msg, { ...opts(description), duration: 4000, icon: icon(Info, "text-accent") }),
  /** A warning that shows at most once per key in a session, however often its effect re-runs. */
  warningOnce: (key: string, msg: string, description?: string) => {
    if (announced.has(key)) return;
    announced.add(key);
    toast.warning(msg, description);
  },
};
