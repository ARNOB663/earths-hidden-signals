"use client";

import React from "react";

/**
 * Decorative SVG overlay for the homepage hero section.
 * Visible only on large screens (lg:block) to keep mobile layout lightweight.
 * The SVG contains a faint scanning line that animates vertically and a pulsing
 * point in the center. All animations respect `prefers-reduced-motion`.
 */
export default function HeroOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden lg:block"
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
    >
      {/* Scan line */}
      <rect
        className="scan-line"
        x="0"
        width="200"
        height="2"
        fill="rgba(255,255,255,0.3)"
      />
      {/* Central pulsing point */}
      <circle
        className="pulse-point"
        cx="100"
        cy="100"
        r="4"
        fill="var(--accent)"
      />
      <style>{`
        .pulse-point {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-line, .pulse-point { animation: none; }
        }
      `}</style>
    </svg>
  );
}
