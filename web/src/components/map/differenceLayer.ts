// Leaflet layer that shows how a NASA GIBS variable changed between two dates.
// GIBS tiles are lossless PNGs whose colours come from a colour map where every colour is unique,
// so each pixel can be turned back into a value. We fetch the same tile for both dates, subtract
// the values pixel by pixel, and paint the result on a diverging colour scale.

import L from "leaflet";
import { DIFF_ENDS, type DiffKind } from "./diffColors";

export interface DifferenceOptions extends L.GridLayerOptions {
  /** Tile URL templates ({z}/{y}/{x}) for the earlier and the later date. */
  urlThen: string;
  urlNow: string;
  /** Colour → value pairs from the colour map, as [r << 16 | g << 8 | b, value]. */
  values: [number, number][];
  /** The change (in display units) that gets the strongest colour. */
  range: number;
  kind: DiffKind;
  /** Colour for "no change", from the current theme. */
  mid: [number, number, number];
}

const TILE = 256;

function loadPixels(url: string): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TILE;
      canvas.height = TILE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, TILE, TILE);
      resolve(ctx.getImageData(0, 0, TILE, TILE).data);
    };
    // Missing tiles (no data for that date or area) simply stay blank.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export class DifferenceLayer extends L.GridLayer {
  declare options: DifferenceOptions;
  private lookup: Map<number, number>;

  constructor(options: DifferenceOptions) {
    super(options);
    L.setOptions(this, options);
    this.lookup = new Map(options.values);
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    const at = (template: string) => L.Util.template(template, { x: coords.x, y: coords.y, z: coords.z });
    Promise.all([loadPixels(at(this.options.urlThen)), loadPixels(at(this.options.urlNow))]).then(([then, now]) => {
      if (then && now) this.paint(canvas, then, now);
      done(undefined, canvas);
    });
    return canvas;
  }

  private paint(canvas: HTMLCanvasElement, then: Uint8ClampedArray, now: Uint8ClampedArray) {
    const ctx = canvas.getContext("2d")!;
    const out = ctx.createImageData(TILE, TILE);
    const o = out.data;
    const { range, kind, mid } = this.options;
    const { less, more } = DIFF_ENDS[kind];
    for (let i = 0; i < then.length; i += 4) {
      if (then[i + 3] === 0 || now[i + 3] === 0) continue;
      const a = this.lookup.get((then[i] << 16) | (then[i + 1] << 8) | then[i + 2]);
      const b = this.lookup.get((now[i] << 16) | (now[i + 1] << 8) | now[i + 2]);
      if (a === undefined || b === undefined) continue;
      const d = b - a;
      const t = Math.min(1, Math.abs(d) / range);
      const end = d < 0 ? less : more;
      o[i] = mid[0] + (end[0] - mid[0]) * t;
      o[i + 1] = mid[1] + (end[1] - mid[1]) * t;
      o[i + 2] = mid[2] + (end[2] - mid[2]) * t;
      o[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }
}
