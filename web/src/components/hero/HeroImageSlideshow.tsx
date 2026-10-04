"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const slides = [
  {
    src: "/features/image/hero-flood-commons-01.jpg",
    alt: "Bangladesh floodwater surrounding homes and boats",
    objectPosition: "60% center",
  },
  {
    src: "/features/image/img2.jpeg",
    alt: "Bangladesh flood scene with families and homes in water",
    objectPosition: "58% center",
  },
  {
    src: "/features/image/hero-flood-commons-02.jpg",
    alt: "People navigating floodwater by boat in Bangladesh",
    objectPosition: "58% center",
  },
  {
    src: "/features/image/img4.avif",
    alt: "Satellite science imagery showing South Asian flood and river patterns",
    objectPosition: "center center",
  },
  {
    src: "/features/image/img5.avif",
    alt: "Climate-vulnerable landscape in South Asia with water and terrain",
    objectPosition: "center center",
  },
];

export default function HeroImageSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const goTo = useCallback(
    (targetIndex: number, autoplay = false) => {
      if (isAnimating) return;

      if (!autoplay && reduceMotionRef.current) {
        setActiveIndex(targetIndex);
        return;
      }

      const next = (targetIndex + slides.length) % slides.length;
      setNextIndex(next);
      setIsAnimating(true);
      setIsEntering(true);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsEntering(false));
      });

      window.setTimeout(() => {
        setActiveIndex(next);
        setNextIndex(null);
        setIsEntering(false);
        window.setTimeout(() => setIsAnimating(false), 120);
      }, 900);
    },
    [isAnimating],
  );

  useEffect(() => {
    if (reduceMotionRef.current) return;

    const timer = window.setInterval(() => {
      goTo((activeIndex + 1) % slides.length, true);
    }, 5600);

    return () => window.clearInterval(timer);
  }, [activeIndex, goTo]);

  return (
    <div className="group absolute inset-0 z-0 overflow-hidden" aria-label="Hero image carousel">
      <div className="absolute inset-0 h-full w-full overflow-hidden">
        {slides.map((slide, index) => {
          const isCurrent = index === activeIndex && nextIndex === null;
          const isOutgoing = index === activeIndex && nextIndex !== null;
          const isIncoming = index === nextIndex;
          const isVisible = isCurrent || isOutgoing || isIncoming;

          if (!isVisible) return null;

          const transform =
            isCurrent && nextIndex === null
              ? "translate3d(0,0,0)"
              : isOutgoing
                ? "translate3d(-100%,0,0)"
                : isIncoming
                  ? isEntering
                    ? "translate3d(100%,0,0)"
                    : "translate3d(0,0,0)"
                  : "translate3d(100%,0,0)";

          const opacity = isCurrent || isIncoming || isOutgoing ? 1 : 0;

          return (
            <div
              key={`${slide.src}-${index}`}
              className="absolute inset-0 h-full w-full overflow-hidden transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform,
                opacity,
                zIndex: isIncoming ? 1 : 0,
              }}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="100vw"
                style={{
                  objectFit: "cover",
                  objectPosition: slide.objectPosition,
                  transform: "scale(1.04)",
                  filter: "brightness(0.78) saturate(0.9)",
                }}
                className="h-full w-full"
              />
            </div>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 2,
          background:
            "linear-gradient(90deg, rgba(5, 12, 25, 0.84) 0%, rgba(5, 12, 25, 0.72) 35%, rgba(5, 12, 25, 0.58) 70%, rgba(5, 12, 25, 0.52) 100%)",
        }}
      />

      <div
        className="hero-transition-fade pointer-events-none absolute inset-x-0 bottom-0 h-60"
        style={{ zIndex: 3 }}
      />

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 flex items-center gap-3 text-white/80">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => goTo((activeIndex - 1 + slides.length) % slides.length)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-950/30 text-lg opacity-0 transition-all duration-200 hover:bg-white/12 group-hover:opacity-100"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => goTo((activeIndex + 1) % slides.length)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-950/30 text-lg opacity-0 transition-all duration-200 hover:bg-white/12 group-hover:opacity-100"
        >
          →
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-6 right-28 z-10 flex items-center gap-2 text-lg text-white/70">
        {slides.map((slide, index) => (
          <button
            key={`${slide.src}-indicator`}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => goTo(index)}
            className="pointer-events-auto flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-transparent p-0 transition-all duration-200"
          >
            <span
              className={`block h-2 w-2 rounded-full transition-all duration-200 ${
                index === activeIndex ? "bg-white scale-100" : "bg-white/35 scale-75"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
