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

// Esri's reference layers carry both the borders and the place names. (GIBS Reference_Labels_15m and
// Reference_Features_15m serve opaque black tiles in EPSG:3857, which would darken the data beneath.)
function referenceLayers(theme: Theme): L.Layer[] {
  return [
    L.tileLayer(
      `${ESRI}/${theme === "light" ? "World_Light_Gray_Reference" : "World_Dark_Gray_Reference"}/MapServer/tile/{z}/{y}/{x}`,
      { pane: "reference", maxNativeZoom: 16, attribution: "Labels &copy; Esri" },
    ),
  ];
}

/**
 * A canvas renderer for layers that draw many shapes: one canvas per pane instead of a DOM element
 * per shape. Leaflet's overlay pane redraws its canvas on every mouse move, so pages with thousands
 * of rectangles turn that redraw off and one canvas serves them all.
 */
export function createCanvasRenderer(options: L.RendererOptions = {}): L.Canvas {
  const renderer = L.canvas(options);
  const internals = renderer as unknown as { _updateHoverStyle?: () => void };
  internals._updateHoverStyle = () => {};
  return renderer;
}

export function createBaseMap(
  container: HTMLElement,
  view: { center: L.LatLngExpression; zoom: number },
  theme: Theme,
  /** Put the zoom buttons on the side the page's panel doesn't cover. */
  zoomPosition: L.ControlPosition = "topright",
): BaseMap {
  const map = L.map(container, { ...view, minZoom: 2, maxZoom: 12, zoomControl: false, worldCopyJump: true, trackResize: false });
  L.control.zoom({ position: zoomPosition }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

  // Custom panes must also carry leaflet-pane: only .leaflet-pane is positioned absolutely, and a
  // pane without it renders its layer in normal flow at the top of the map.
  // Trend background (360) sits under this pane (380), which sits under the Esri labels (450).
  const rasterPane = map.createPane("dataRaster");
  rasterPane.classList.add("leaflet-pane");
  rasterPane.style.zIndex = "360";
  rasterPane.style.pointerEvents = "none";
  const dataPane = map.createPane("data");
  dataPane.classList.add("leaflet-pane");
  dataPane.style.zIndex = "380";
  const refPane = map.createPane("reference");
  refPane.classList.add("leaflet-pane");
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
