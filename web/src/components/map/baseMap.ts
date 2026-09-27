// Shared Leaflet setup for every map in the site: dark NASA Blue Marble base,
// a "data" pane for our layers, and a borders/labels overlay above the data.

import L from "leaflet";
import { GIBS_WMTS } from "@/lib/layers";

export interface BaseMap {
  map: L.Map;
  reference: L.LayerGroup;
  dispose: () => void;
}

export function createBaseMap(container: HTMLElement, view: { center: L.LatLngExpression; zoom: number }): BaseMap {
  const map = L.map(container, {
    ...view,
    minZoom: 2,
    maxZoom: 12,
    zoomControl: false,
    worldCopyJump: true,
  });
  L.control.zoom({ position: "topright" }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

  map.createPane("data").style.zIndex = "350";
  const refPane = map.createPane("reference");
  refPane.style.zIndex = "450";
  refPane.style.pointerEvents = "none";

  // NASA Blue Marble relief, desaturated and darkened so the data layer stays the focus.
  L.tileLayer(`${GIBS_WMTS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, {
    maxNativeZoom: 8,
    className: "basemap-dim",
    attribution: '<a href="https://earthobservatory.nasa.gov/features/BlueMarble">NASA Blue Marble</a>',
  }).addTo(map);

  const reference = L.layerGroup([
    L.tileLayer(`${GIBS_WMTS}/Reference_Features_15m/default/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
      pane: "reference",
      maxNativeZoom: 13,
      opacity: 0.55,
    }),
    // Place names. (GIBS Reference_Labels_15m serves opaque black tiles in EPSG:3857, so it can't be used here.)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { pane: "reference", maxNativeZoom: 16, attribution: "Labels &copy; Esri" },
    ),
  ]).addTo(map);

  // Leaflet measures its container once; re-measure whenever the layout changes size.
  const resizeObserver = new ResizeObserver(() => map.invalidateSize());
  resizeObserver.observe(container);

  return {
    map,
    reference,
    dispose: () => {
      resizeObserver.disconnect();
      map.remove();
    },
  };
}
