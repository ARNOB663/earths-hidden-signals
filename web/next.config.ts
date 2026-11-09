import type { NextConfig } from "next";

/**
 * The seven-page platform retired the earlier analysis-pipeline routes. Their content lives on
 * in the new pages (Signal, Gap, Replay, Accuracy) and in Methods; nothing here is a placeholder
 * for a page that was deleted without a home. Permanent (308) because the old URLs are gone for good.
 *
 * Query strings pass through automatically, so /signals/place?id=… keeps its selection at /signal.
 */
const RETIRED: { source: string; destination: string }[] = [
  { source: "/trends", destination: "/climate-trends" },
  { source: "/hazards", destination: "/signal" },
  { source: "/monitoring", destination: "/signal" },
  { source: "/locations", destination: "/signal" },
  { source: "/countries", destination: "/signal" },
  { source: "/country/:slug", destination: "/signal" },
  { source: "/location/:id", destination: "/signal" },
  { source: "/explore", destination: "/satellite-map" },
  { source: "/findings", destination: "/" },
  { source: "/signals", destination: "/signal" },
  { source: "/signals/place", destination: "/signal" },
  { source: "/signals/evidence", destination: "/signal" },
  { source: "/about", destination: "/methods" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return RETIRED.map(({ source, destination }) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
