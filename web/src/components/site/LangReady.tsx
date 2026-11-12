"use client";

import { useEffect } from "react";

/** Reveals a Bangla page once React has rendered it in Bangla (two frames after hydration). */
export function LangReady() {
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("lang-pending")));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
