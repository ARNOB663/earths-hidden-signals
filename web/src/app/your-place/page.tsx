import type { Metadata } from "next";
import PlaceReport from "@/components/place/PlaceReport";

export const metadata: Metadata = {
  title: "Your place · Earth's Hidden Signals",
  description:
    "Type any town on Earth: its own warming stripes, what changed since 1981, what NASA projections say for 2041–2060, disasters recorded nearby, and what to prepare for.",
};

export default function YourPlacePage() {
  return <PlaceReport />;
}
