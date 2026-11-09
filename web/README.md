# Earth's Hidden Signals — web app

NASA Space Apps 2026 · *Be An Earth System Trend Detective*. Next.js 16 (App Router) + TypeScript + Tailwind + Leaflet.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also type-checks)
```

## Map Explorer (`/explore`)

| Variable | Source | Record |
|---|---|---|
| Land Surface Temperature (Day) | MODIS Terra, NASA GIBS | Mar 2000 → |
| Air Temperature (2 m) | MERRA-2, NASA GIBS | Jan 1980 → |
| Rainfall Rate | GLDAS, NASA GIBS | Jan 2000 → |
| Vegetation Greenness (NDVI) | MODIS Terra, NASA GIBS | Mar 2000 → |
| Tree Cover Loss | Hansen/UMD GFC (Landsat), tiles via Global Forest Watch | 2001–2025 |

- Layers are defined in `src/lib/layers.ts`. Add a GIBS layer by adding an entry there.
- `src/lib/gibs.ts` reads NASA's GIBS catalog on the server (cached for a day), so the date slider only offers months that exist. Legends come from NASA's own colormaps.
- Forest loss tiles store the loss year in the blue channel. `src/components/map/forestLossLayer.ts` decodes them in the browser to filter by year and build the per-year chart.
- Links are shareable, for example `/explore?layer=air-temp&date=2024-05-01` or `/explore?layer=forest-loss&from=2015&to=2025`.

The map shows pictures of the data. The statistics (Mann-Kendall, Sen's slope, hectares per year) will be computed from downloaded NASA datasets for the Trend Analysis tab, not from these tiles.
