"use client";

// Fades a block in as it scrolls into view, so the story arrives one idea at a time.
// Content is always in the page (server-rendered) and visible without JavaScript or when the
// viewer prefers reduced motion.

import { useEffect, useRef, useState } from "react";

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: no animation
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${
        state === "static" ? "" : `transition duration-700 ease-out ${state === "hidden" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"}`
      }`}
    >
      {children}
    </div>
  );
}
