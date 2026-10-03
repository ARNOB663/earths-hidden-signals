"use client";

import dynamic from "next/dynamic";

const HeroMapClient = dynamic(() => import("@/components/hero/HeroMap"), {
  ssr: false,
});

export default function HeroMapWrapper() {
  return <HeroMapClient />;
}