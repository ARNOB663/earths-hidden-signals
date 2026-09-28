// Shared Leaflet setup for every map in the site: a theme-aware base map, a "data" pane
// for our layers, and a borders/labels overlay above the data.

import L from "leaflet";
import { GIBS_WMTS } from "@/lib/layers";
import type { Theme } from "@/lib/theme";

export interface BaseMap {
  map: L.Map;
  /** Borders and place names; add/remove this group to toggle them. */
  reference: L.LayerGroup;
  setTheme: (theme: Theme) => void;
  dispose: () => void;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";

function baseLayers(theme: Theme): L.Layer[] {
  if (theme === "light") {
    return [L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 16, attribution: "Base map &copy; Esri" })];
  }
  // NASA Blue Marble relief, desaturated and darkened so the data layer stays the focus.
  return [
    L.tileLayer(`${GIBS_WMTS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, {
      maxNativeZoom: 8,
      className: "basemap-dim",
      attribution: '<a href="https://earthobservatory.nasa.gov/features/BlueMarble">NASA Blue Marble</a>',
    }),
  ];
}

function referenceLayers(theme: Theme): L.Layer[] {
  const labels = L.tileLayer(
    `${ESRI}/${theme === "light" ? "World_Light_Gray_Reference" : "World_Dark_Gray_Reference"}/MapServer/tile/{z}/{y}/{x}`,
    { pane: "reference", maxNativeZoom: 16, attribution: "Labels &copy; Esri" },
  );
  if (theme === "light") return [labels];
  // (GIBS Reference_Labels_15m serves opaque black tiles in EPSG:3857, so only its borders layer is used.)
  return [
    L.tileLayer(`${GIBS_WMTS}/Reference_Features_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
      pane: "reference",
      maxNativeZoom: 13,
      opacity: 0.55,
    }),
    labels,
  ];
}

export function createBaseMap(
  container: HTMLElement,
  view: { center: L.LatLngExpression; zoom: number },
  theme: Theme,
  /** Put the zoom buttons on the side the page's panel doesn't cover. */
  zoomPosition: L.ControlPosition = "topright",
): BaseMap {
  const map = L.map(container, { ...view, minZoom: 2, maxZoom: 12, zoomControl: false, worldCopyJump: true });
  L.control.zoom({ position: zoomPosition }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

  map.createPane("data").style.zIndex = "350";
  const refPane = map.createPane("reference");
  refPane.style.zIndex = "450";
  refPane.style.pointerEvents = "none";

  const base = L.layerGroup(baseLayers(theme)).addTo(map);
  const reference = L.layerGroup(referenceLayers(theme)).addTo(map);
  let current = theme;

  // Leaflet measures its container once; re-measure whenever the layout changes size.
  const resizeObserver = new ResizeObserver(() => map.invalidateSize());
  resizeObserver.observe(container);

  return {
    map,
    reference,
    setTheme: (next) => {
      if (next === current) return;
      current = next;
      base.clearLayers();
      baseLayers(next).forEach((l) => base.addLayer(l));
      reference.clearLayers();
      referenceLayers(next).forEach((l) => reference.addLayer(l));
    },
    dispose: () => {
      resizeObserver.disconnect();
      map.remove();
    },
  };
}
