"use client";

// A few animated icons, and nothing more: each one only moves while it says something about the
// page (loading, a warning, a finished copy). With reduced motion on they render as plain icons.

import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ICON, STROKE, type IconSize } from "./icons";

/** True when the viewer asked the device to reduce motion. */
function useReducedMotionPref(): boolean {
  return useReducedMotion() ?? false;
}

/** A looping rotation that reads as "working". */
export function Spinner({ size = "md", className = "" }: { size?: IconSize | number; className?: string }) {
  const reduced = useReducedMotionPref();
  const px = typeof size === "number" ? size : ICON[size];
  if (reduced) return <LoaderCircle size={px} strokeWidth={STROKE} className={className} aria-hidden />;
  return (
    <motion.span
      className={`inline-flex ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      <LoaderCircle size={px} strokeWidth={STROKE} />
    </motion.span>
  );
}

/** A gentle pulse for a warning, so it draws the eye without blinking hard. */
export function AlertPulse({ size = "md", className = "" }: { size?: IconSize | number; className?: string }) {
  const reduced = useReducedMotionPref();
  const px = typeof size === "number" ? size : ICON[size];
  if (reduced) return <TriangleAlert size={px} strokeWidth={STROKE} className={className} aria-hidden />;
  return (
    <motion.span
      className={`inline-flex ${className}`}
      animate={{ opacity: [1, 0.62, 1] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <TriangleAlert size={px} strokeWidth={STROKE} />
    </motion.span>
  );
}

/** The tick that pops in when something finished, such as a copied link. */
export function SuccessCheck({ size = "md", className = "" }: { size?: IconSize | number; className?: string }) {
  const reduced = useReducedMotionPref();
  const px = typeof size === "number" ? size : ICON[size];
  if (reduced) return <CircleCheck size={px} strokeWidth={STROKE} className={className} aria-hidden />;
  return (
    <motion.span
      className={`inline-flex ${className}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      aria-hidden
    >
      <CircleCheck size={px} strokeWidth={STROKE} />
    </motion.span>
  );
}
