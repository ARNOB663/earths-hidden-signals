// Leaflet layer for Hansen/UMD tree cover loss tiles (served by Global Forest Watch).
// Each tile is an encoded PNG: blue = loss year - 2000, red = loss intensity.
// We decode pixels in a canvas so the year filter runs in the browser, and we
// tally intensity per year for the tiles in view (a relative loss index).

import L from "leaflet";
import { lossYearColor } from "./lossColors";

export interface ForestLossOptions extends L.GridLayerOptions {
  url: string;
  firstYear: number;
  lastYear: number;
  startYear: number;
  endYear: number;
  /** Receives per-year loss index for the visible area (index 0 = firstYear). */
  onStats?: (totals: number[]) => void;
}

interface TileRecord {
  canvas: HTMLCanvasElement;
  raw: ImageData;
  yearTotals: Float64Array;
  coords: L.Coords;
}

export class ForestLossLayer extends L.GridLayer {
  declare options: ForestLossOptions;
  // Keyed by the tile element: tileunload reports unwrapped coords, createTile gets wrapped ones.
  private tiles = new Map<HTMLElement, TileRecord>();

  constructor(options: ForestLossOptions) {
    super(options);
    L.setOptions(this, options);
    this.on("tileunload", (e: L.TileEvent) => {
      this.tiles.delete(e.tile as unknown as HTMLElement);
      this.scheduleStats();
    });
    this.on("load", () => this.scheduleStats());
  }

  onAdd(map: L.Map): this {
    super.onAdd(map);
    map.on("moveend", this.scheduleStats, this);
    return this;
  }

  onRemove(map: L.Map): this {
    map.off("moveend", this.scheduleStats, this);
    this.tiles.clear();
    return super.onRemove(map);
  }

  setYears(startYear: number, endYear: number): void {
    this.options.startYear = startYear;
    this.options.endYear = endYear;
    for (const rec of this.tiles.values()) this.paint(rec);
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const raw = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rec: TileRecord = { canvas, raw, yearTotals: this.tally(raw), coords };
      this.tiles.set(canvas, rec);
      this.paint(rec);
      done(undefined, canvas);
    };
    // Ocean and empty areas return errors — treat them as blank tiles.
    img.onerror = () => done(undefined, canvas);
    img.src = L.Util.template(this.options.url, { x: coords.x, y: coords.y, z: coords.z });
    return canvas;
  }

  private tally(raw: ImageData): Float64Array {
    const { firstYear, lastYear } = this.options;
    const totals = new Float64Array(lastYear - firstYear + 1);
    const d = raw.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0 || d[i + 2] === 0) continue;
      const idx = 2000 + d[i + 2] - firstYear;
      if (idx >= 0 && idx < totals.length) totals[idx] += d[i];
    }
    return totals;
  }

  private paint(rec: TileRecord): void {
    const { firstYear, lastYear, startYear, endYear } = this.options;
    const ctx = rec.canvas.getContext("2d")!;
    const src = rec.raw.data;
    const out = ctx.createImageData(rec.raw.width, rec.raw.height);
    const dst = out.data;
    const zoomedIn = (this._map?.getZoom() ?? 0) >= 12;
    const span = Math.max(1, lastYear - firstYear);

    for (let i = 0; i < src.length; i += 4) {
      const code = src[i + 2];
      if (src[i + 3] === 0 || code === 0) continue;
      const year = 2000 + code;
      if (year < startYear || year > endYear) continue;
      const [r, g, b] = lossYearColor((year - firstYear) / span);
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      // At low zoom one pixel aggregates many 30 m cells; red carries how much of it was lost.
      dst[i + 3] = zoomedIn ? 235 : Math.round(110 + 145 * Math.sqrt(Math.min(255, src[i]) / 255));
    }
    ctx.putImageData(out, 0, 0);
  }

  private statsTimer: ReturnType<typeof setTimeout> | undefined;

  private scheduleStats = (): void => {
    if (!this.options.onStats) return;
    clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => this.emitStats(), 150);
  };

  private emitStats(): void {
    const map = this._map;
    if (!map || !this.options.onStats) return;
    const { firstYear, lastYear } = this.options;
    const view = map.getBounds();
    const zoom = Math.round(map.getZoom());
    const size = this.getTileSize();
    const totals = new Array<number>(lastYear - firstYear + 1).fill(0);

    for (const rec of this.tiles.values()) {
      const { x, y, z } = rec.coords;
      if (z !== Math.min(zoom, this.options.maxNativeZoom ?? zoom)) continue;
      const nw = map.unproject(L.point(x * size.x, y * size.y), z);
      const se = map.unproject(L.point((x + 1) * size.x, (y + 1) * size.y), z);
      if (!view.intersects(L.latLngBounds(nw, se))) continue;
      rec.yearTotals.forEach((v, i) => (totals[i] += v));
    }
    this.options.onStats(totals);
  }
}
