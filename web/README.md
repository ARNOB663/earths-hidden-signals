# Earth's Hidden Signals — web app

NASA Space Apps 2026 · *Be An Earth System Trend Detective*. Next.js 16 (App Router) + TypeScript + Tailwind + Leaflet.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also type-checks)
```

## Map Explorer (`/explore`)

The Map Explorer route and its components were **removed on 2026-11-06**; `/explore` now 308-redirects
to `/signal` (see `web/next.config.ts`). The layer definitions remain in `src/lib/layers.ts`, and the
base map in `src/components/map/baseMap.ts` still powers the Signal and Replay maps (NASA GIBS Blue
Marble relief, Esri labels).

| Variable | Source | Record |
|---|---|---|
| Land Surface Temperature (Day) | MODIS Terra, NASA GIBS | Mar 2000 → |
| Air Temperature (2 m) | MERRA-2, NASA GIBS | Jan 1980 → |
| Rainfall Rate | GLDAS, NASA GIBS | Jan 2000 → |
| Root-Zone Soil Moisture | SMAP L4, NASA GIBS | Mar 2015 → (daily) |
| Vegetation Greenness (NDVI) | MODIS Terra, NASA GIBS | Mar 2000 → |
| Tree Cover Loss | Hansen/UMD GFC (Landsat), tiles via Global Forest Watch | 2001–2025 |

- Layers are defined in `src/lib/layers.ts`. The definitions are data for a future context map; no
  current route renders them.
- The forest-loss decoder and GIBS catalog reader were removed with the explorer. Restore them from
  git history when a map surface needs them; see `docs/CODEBASE_AUDIT.md`.

The Signal page's statistics (Watch Level, historical frequency, backtest) come from the committed
datasets under `public/data/`, not from map tiles.
