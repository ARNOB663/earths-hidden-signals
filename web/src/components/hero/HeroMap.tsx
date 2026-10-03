"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { GIBS_WMTS } from "@/lib/layers";
import { useTheme } from "@/lib/theme";

/**
 * Hero map component for the homepage.
 *
 * Shows a polished, near-square NASA Blue Marble satellite view of South Asia
 * in the far-right area of the hero banner. Reuses the project's GIBS WMTS
 * infrastructure and theme-aware reference layers — the same architecture
 * the Explore page map uses.
 *
 * - Dragging/panning enabled
 * - Scroll-wheel zoom disabled (so users can scroll the page normally)
 * - Zoom controls hidden
 * - Theme-aware reference borders/labels
 * - Clicking navigates to /explore
 */

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";

export default function HeroMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Geographic bounds for South Asia (India, Bangladesh, Nepal, Bhutan, Pakistan, Sri Lanka, Himalayas)
    const southAsiaBounds = L.latLngBounds(
      L.latLng(5, 65),   // Southwest corner (approx.)
      L.latLng(35, 95)   // Northeast corner (approx.)
    );

    const map = L.map(container, {
      center: southAsiaBounds.getCenter(), // Centered on South Asia bounds
      zoom: 5, // Increased zoom to properly frame South Asia
      minZoom: 2,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      dragging: false, // Static banner map
      touchZoom: true,
    });
    mapRef.current = map;

    // NASA Blue Marble with shaded relief — natural Earth satellite view
    // that visitors immediately recognise as a real geographic map.
    // Same tile source used as the dark-mode base layer in baseMap.ts.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const satelliteLayer = L.tileLayer(
      `${GIBS_WMTS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
      {
        maxNativeZoom: 8,
        attribution:
          '<a href="https://earthobservatory.nasa.gov/features/BlueMarble">NASA Blue Marble</a>',
      },
    ).addTo(map);

    // Reference layer (borders + labels) — follows the current theme.
    // Same Esri reference layers used in baseMap.ts.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const refLayer = L.tileLayer(
      `${ESRI}/${theme === "dark" ? "World_Dark_Gray_Reference" : "World_Light_Gray_Reference"}/MapServer/tile/{z}/{y}/{x}`,
      {
        maxNativeZoom: 16,
        opacity: 0.7,
        attribution: "Labels &copy; Esri",
      },
    ).addTo(map);

    // Add a subtle focus marker for Bangladesh/South Asia
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const focusMarker = L.circleMarker([23.685, 90.356], { // Approximate center of Bangladesh
      radius: 4,
      color: theme === 'dark' ? '#1f66c1' : '#1f66c1', // NASA blue
      weight: 1,
      opacity: 0.8,
      fillColor: theme === 'dark' ? 'rgba(31, 102, 193, 0.2)' : 'rgba(31, 102, 193, 0.2)',
      fillOpacity: 0.7
    }).addTo(map);

    // ResizeObserver so Leaflet re-measures when the layout shifts.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    setReady(true);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Theme is only used at init; the hero is brief so we keep the initial choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero-map-wrapper pointer-events-auto">
      <div className="hero-map-inner">
        {/* The Leaflet container */}
        <div
          ref={containerRef}
          className="hero-map-container h-full w-full"
        />

        {/* Label: 45 YEARS OF EARTH DATA / 234/234 LAND CELLS WARMING */}
        {ready && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[500] select-none">
            <div className="inline-block rounded-md bg-black/50 px-2.5 py-1.5 text-[9px] leading-none tracking-wider text-white/90 backdrop-blur-sm">
              <div className="font-medium">45 YEARS OF EARTH DATA</div>
              <div className="mt-0.5 font-semibold opacity-85">234/234 LAND CELLS WARMING</div>
            </div>
          </div>
        )}

        {/* Explore climate signals → link */}
        {ready && (
          <a
            href="/explore"
            className="pointer-events-auto absolute right-2 top-2 z-[500] rounded-md bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
          >
            Explore climate signals &rarr;
          </a>
        )}
      </div>

      {/* ─── Inline styles ─── */}
      <style>{`
        .hero-map-wrapper {
          position: relative;
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1 / 1;
        }

        .hero-map-inner {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset,
            0 0 40px rgba(31, 102, 193, 0.08);
        }

        .hero-map-container {
          background: #0a1628;
        }

        /* Leaflet tile loading background */
        .hero-map-container .leaflet-tile-loaded {
          transition: none;
        }

        /* Responsive sizing for hero map */
        @media (max-width: 639px) {
          .hero-map-wrapper {
            max-width: 280px;
            height: 280px;
          }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .hero-map-wrapper {
            max-width: 320px;
            height: 320px;
          }
        }

        @media (min-width: 1024px) and (max-width: 1279px) {
          .hero-map-wrapper {
            max-width: 340px;
            height: 340px;
          }
        }

        @media (min-width: 1280px) {
          .hero-map-wrapper {
            max-width: 400px;
            height: 400px;
          }
        }
      `}</style>
    </div>
  );
}