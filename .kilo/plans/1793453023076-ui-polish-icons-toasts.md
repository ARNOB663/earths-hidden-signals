# UI Polish, Lucide Migration, Motion Icons & Toasts

## Goal

Refine `web/` visually to a professional scientific-dashboard standard without changing routes, data flow, or functionality. Replace Phosphor with `lucide-react`, add a small set of `motion`-powered animated icons, and add a `sonner` toast system wired to real user outcomes. Fix actual layout/spacing/alignment defects found in the audit — not blanket overrides.

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Icons | Migrate all 21 Phosphor files to `lucide-react`; remove `@phosphor-icons/react`. One shared size/stroke scale. |
| Toasts | Mount `<Toaster>` at root; only real events (no per-click success noise). |
| Motion | ~4 shared animated primitives only; everything else stays CSS transitions. |
| Validation | Playwright audit at 375/430/768/1366/1920; script kept **out of** the repo. |
| Navbar | Tabs collapse below `lg`; verify 1024–1280 has no crowding. |
| Gating | Validate once per task group, fix forward. |

## Audit findings (verified in code)

**Real defects to fix**
1. **Text glyphs used as icons** — `CountryMap.tsx:444` renders `"❚❚"` / `"▶"` as text; `EvidenceStory.tsx:90` renders `◌`, `!`, `▣` as bare `<span>`s. These have no consistent metrics and fail the "no emoji/glyph icons" rule.
2. **No error/loading boundaries** — `src/app/` has no `error.tsx` and no `loading.tsx`. A thrown render error shows the default Next error page; there is no consistent empty/error state.
3. **Icon scale is ad hoc** — sizes span 10/13/14/15/16/17/18/20/22 with mixed `regular|fill|duotone|bold` weights and no shared token. Two components reuse `Drop` for both Rain and Soil water concerns.
4. **Legend label collision risk** — `ui/index.tsx:58-78` `TrendLegend` puts "decrease word" and its `-limit or less` value in the same grid cell with no wrap/`min-w-0`, so at narrow widths (floating map legend, 375px) the two labels meet "No change" in the middle column.
5. **Navbar density** — `SiteNav.tsx:82-135`: logo + 6 tabs (from `lg`) + expanding search + language pill + theme pill + menu in one 64px row. At 1024–1279 the tabs, search expansion (`xl:w-56`), and two pills compete for width.
6. **Toast surface** — `ShareButton.tsx` and `CountrySearch` have no feedback for copy / no-match / empty-submit; catalog fallback (`lib/gibs.ts` `live: false`) is silent to the user.
7. **Z-index is ad hoc** — values range 10→1500 with no named scale; toasts need to sit above `Tour` (1500) and the search menu (1200).

**Already good — do not touch**
- Design tokens are centralized in `globals.css:7-107` (light/dark, semantic `--ink/-2/-3`, `--line`, `--accent*`, chart `--warm-*`/`--cool-*`, hazard `--ev-*`). Reuse these; add no new palette.
- Charts already use `ResizeObserver` with a 240px floor (`SeriesChart.tsx:43-51`).
- i18n `T`/`useT` keeps en/bn side by side — every new string must use it.
- Root tokens drive canvas rendering via `cssVar()` (`lib/theme.ts:54`) — don't rename CSS variables.

## Constraints

- Do **not** modify anything under `web/public/data/`, `analysis/`, or any JSON output.
- Do not change routes, `places.ts` IDs, or `generateStaticParams`.
- Leave unrelated in-progress work alone: `web/src/app/globals.css` (country-search block), `web/src/components/site/CountrySearch.tsx` (mobile dropdown), `.serena/project.yml`. Commit only this task's files.
- Only `web/` is in scope. Run everything from `web/`.
- Phosphor `weight="duotone"`/`"fill"` has no lucide equivalent; map those to a single stroke weight and preserve emphasis via color (`text-accent`, `text-watch`) and size, not weight. Accept this simplification; do not reintroduce a second icon library.
- Every user-facing string goes through `T`/`useT`.

---

## Task Group 1 — Icon foundation & Phosphor → Lucide migration

**Install:** `npm install lucide-react motion sonner` (all three absent from `package.json`).

**Create `src/components/ui/icons.tsx`** — single source of icon sizing:
- Export `ICON = { sm: 14, md: 16, lg: 20, xl: 22 }` and `type IconSize = keyof typeof ICON`.
- Export a `GIcon` wrapper that applies `strokeWidth={1.75}` (lucide default is 2) and `aria-hidden` by default, so stroke weight is uniform everywhere.
- Central `HAZARD_ICONS` / `TREND_ICONS` / `LAYER_ICONS` name→lucide-component maps, replacing the scattered maps in `CountryMap.tsx:64-79`, `MapExplorer.tsx:52`, `HazardExplorer.tsx`.

**Mapping rules (apply mechanically, then review visually):**

| Phosphor | Lucide |
|---|---|
| `MagnifyingGlass` | `Search` |
| `CaretDown` | `ChevronDown` |
| `List` | `Menu` |
| `SidebarSimple` | `PanelLeft` |
| `ShareNetwork` | `Share2` |
| `Check` | `Check` |
| `CheckCircle` | `CircleCheck` |
| `Warning` | `TriangleAlert` |
| `Question` | `CircleHelp` |
| `Thermometer` | `Thermometer` |
| `Drop` | `Droplets` (Rain) / `Droplet` (soil water — distinct icon, fixes reuse defect) |
| `Sun` | `Sun` |
| `Moon` | `Moon` |
| `Monitor` | `Monitor` |
| `Leaf` | `Leaf` |
| `Plant` | `Sprout` |
| `TreeEvergreen` | `TreePine` |
| `ChartLineUp` | `ChartLine` |
| `BookOpen` | `BookOpen` |
| `Flask` | `FlaskConical` |
| `Planet` / `GlobeHemisphereEast` | `Globe` |
| `MapTrifold` | `Map` |
| `MapPin` | `MapPin` |
| `UsersThree` | `Users` |
| `Lightbulb` | `Lightbulb` |
| `CloudRain` | `CloudRain` |
| `DownloadSimple` | `Download` |
| `Table` | `Table` |
| `ArrowsHorizontal` | `MoveHorizontal` |
| `ArrowRight/Left/Down` | `ArrowRight/Left/Down` |
| `Compass` | `Compass` |
| `X` | `X` |
| `Play` / `Pause` | `Play` / `Pause` |

**Files to convert (all 21):** `app/page.tsx`, `app/findings/page.tsx`, `app/country/[countrySlug]/page.tsx`, `components/country/CountryMap.tsx`, `components/findings/{StoryNav,visuals}.tsx`, `components/hazards/HazardExplorer.tsx`, `components/hero/HeroClimateStory.tsx`, `components/home/EvidenceStory.tsx`, `components/map/{CompareDivider,MapExplorer,MapLoading,MapPlaceSearch,PlaceClimateContext}.tsx`, `components/site/{CountrySearch,SiteNav,Tour}.tsx`, `components/trends/TrendExplorer.tsx`, `components/ui/{DataActions,index,ShareButton}.tsx`.

**Fix the glyph defects in this pass:**
- `CountryMap.tsx:444` → `<Play/>` / `<Pause/>` from the icon map.
- `EvidenceStory.tsx:90` → real lucide icons (`Globe`, `ChartLine`, `TriangleAlert`, `BookOpen`) through `GIcon`; delete the `◌`/`!`/`▣` spans.
- Replace the inline SVGs in `CountryMap.tsx` legend chevron (`:388-390`), `SiteNav` `Logo` stays (it is brand artwork, not an icon), and `ListIcon` (`:84-90`) with `Menu`/`PanelLeft`.

**Verify after:** `grep` returns zero `phosphor` references; `npm run lint`; `npm run build`.

---

## Task Group 2 — Spacing, typography & component consistency

1. **`TrendLegend` collision fix** (`ui/index.tsx:51-90`): make the three label cells `min-w-0 flex flex-col`, add `leading-snug`, and let the `-limit or less` line wrap under the word instead of beside it. Verify at 375px inside the floating map legend.
2. **Standardize card surfaces**: audit every `rounded-*` on card-like containers and normalize to three levels (`rounded-xl` for controls, `rounded-2xl` for cards/panels, `rounded-full` for pills). Panel components already mostly agree; fix outliers in `findings/visuals.tsx` and `app/page.tsx`.
3. **Button size standardization**: unify interactive controls on `h-10` (40px) touch target, `h-8` for in-pill segments. `DataActions.BUTTON`, `Segmented`, legend toggles, and map panel buttons should share one constant.
4. **Heading hierarchy**: check `h1`→`h4` scale consistency across the 8 routes; no page should introduce a new size scale. Use existing `text-3xl sm:text-4xl` (section) / `text-xl` (card title) / `text-xs uppercase tracking` (eyebrow) pattern.
5. **Overflow guards**: add `min-w-0` on flex children that contain filenames/numbers (place names in `MapPlaceSearch`, country names in `CountrySearch` results, stat values in `Stat`).
6. **Z-index scale**: add named tokens in `globals.css` (e.g. `--z-map:500; --z-map-panel:600; --z-nav:1000; --z-menu:1200; --z-tour:1500; --z-toast:2000`) and replace the ad-hoc `z-[...]` classes with them. No visual change; makes the toast layering explicit.

---

## Task Group 3 — Navbar & interaction states

1. **Navbar breakpoints** (`SiteNav.tsx`): keep tabs at `lg` and up; if the 1024–1280 Playwright capture shows crowding, gate the tab labels to `xl` and show icon-only tabs between `lg` and `xl`. Ensure the search pill's expanded width (`w-44 xl:w-56`) cannot push the pills off-screen by giving the control cluster `shrink-0` and the nav `min-w-0`.
2. **Focus states**: every button/link must show the same visible focus ring (already partly handled by the country-search block — extend the same pattern to map controls, segmented controls, and legend toggles).
3. **Hover/active transitions**: standardize on `transition-colors duration-150` for controls and `duration-300` for panels; remove inconsistent `transition-all` on `Segmented` (`ui/index.tsx:112`).
4. **Dropdown correctness**: confirm `CountrySearch` menu and `MapPlaceSearch` results are not clipped by `overflow-hidden` ancestors; verify z-index against the sticky nav.

---

## Task Group 4 — Motion icon primitives

Create `src/components/ui/motion-icons.tsx`:
- `useReducedMotionPref()` — wraps `useReducedMotion` from `motion`, returning `true` on `prefers-reduced-motion`.
- `Spinner` — continuous rotation (loading states, replaces `MapLoading`'s static globe).
- `SearchPulse` — subtle scale/opacity on search focus/typing (wraps `lucide` `Search`).
- `AlertPulse` — gentle pulse for `TriangleAlert` in hazard warnings.
- `SuccessCheck` — animated path draw / pop for `CircleCheck`, used in toasts and `ShareButton` copied state.

Rules: all components return the static lucide icon when reduced motion is on; animations must be `aria-hidden`; nothing animates on mount except spinner/alert which convey state.

Apply only where state is conveyed: `MapLoading`, `MapExplorer`/`TrendExplorer`/`HazardExplorer` loading text, hazard warning callout (`HazardExplorer.tsx:295`), `ShareButton` copied confirmation, toast icons.

---

## Task Group 5 — Toast system

**Create `src/components/ui/toast.ts`** — the single wrapper the brief asks for:

```tsx
import { toast as sonner } from "sonner";
import { CircleCheck, CircleX, TriangleAlert, Info, LoaderCircle } from "lucide-react";

export const toast = {
  success: (msg: string, desc?: string) => sonner.success(msg, { description: desc, icon: <CircleCheck /> }),
  error:   (msg: string, desc?: string) => sonner.error(msg, { description: desc, icon: <CircleX /> }),
  warning: (msg: string, desc?: string) => sonner.warning(msg, { description: desc, icon: <TriangleAlert /> }),
  info:    (msg: string, desc?: string) => sonner.info(msg, { description: desc, icon: <Info /> }),
  loading: (msg: string, desc?: string) => sonner.loading(msg, { description: desc, icon: <LoaderCircle /> }),
};
```

**Mount `<Toaster>`** in `layout.tsx` inside `<body>`, after `<TourBar/>`:
- `position="bottom-right"` (desktop) / `bottom-center` (mobile via `expand`), `theme` bound to the current `data-theme` (read through a small client `ToasterHost` so light/dark stay in sync), `richColors` off, custom `toastOptions.className` using `bg-card border-line text-ink shadow-soft`, `duration` 4000 (success/info) / 6000 (warning/error), `closeButton`, `invisible when reduced motion` transitions.

**Wire only real events** (each must use `useT` strings):

| Site | Type | Trigger |
|---|---|---|
| `CountrySearch.submit` with empty query | warning | "Type a country name to search" |
| `CountrySearch` submit with no matching result | warning | "No country matches that search" + link hint |
| `CountrySearch` successful country selection | success | "Opening {country}" — **debounced/deduped**, skip if same slug as current path |
| `ShareButton` copy success / failure | success / error | "Link copied" / "Could not copy the link" |
| `DataActions` download click | success | "Download started" |
| `MapExplorer` / `TrendExplorer` / `HazardExplorer` layer change | info | "Showing {layer}" — only on explicit user selection, not initial mount |
| `lib/gibs` fallback (`info.live === false`) surfaced on map mount | warning | "NASA catalog unreachable — showing saved dates" |
| Global `error.tsx` | error | "Something went wrong" + retry action |

**No toast** for: route changes, theme/lang toggles, tab switches, initial data load, every map pan/zoom.

Create `src/app/error.tsx` (`"use client"`) rendering a consistent error card (title, explanation via `T`, `reset()` button) and firing the error toast once on mount; create `src/app/loading.tsx` with a neutral skeleton that matches card radii and the `Spinner`.

---

## Task Group 6 — Responsive verification & final QA

1. Write a throwaway Playwright script **outside** the repo (`/tmp/kilo/audit.py`) using the existing venv at `/tmp/kilo/venv`:
   - Routes: `/`, `/countries`, `/findings`, `/explore`, `/trends`, `/hazards`, `/methods`, `/country/pakistan`.
   - Widths: 375, 430, 768, 1024, 1366, 1920. Heights: 800 / 1080.
   - For each: assert `document.documentElement.scrollWidth <= clientWidth` (no horizontal scroll), capture full-page screenshot, collect `console` errors and `pageerror`.
2. Fix every overflow/overlap found, re-running the script per group.
3. Keyboard pass: Tab through navbar, search, each page's primary controls; confirm focus is visible and order is sane.
4. Reduced-motion pass: emulate `prefers-reduced-motion: reduce`; confirm no spinners/animations run and toasts still appear.
5. Footer check: `layout.tsx:143-151` uses `"↗"` and `"→"` text glyphs — replace with lucide `ArrowUpRight` / `ArrowRight` for consistency with Task Group 1.

**Final gate:** `npm run lint` → `npm run build` (build also type-checks) → screenshot audit clean → console clean.

---

## Commit plan

One commit per task group, only files touched by that group, style matching existing history (`feat(ui):`, `fix(nav):`, `chore(deps):`). Exclude `globals.css` country-search block, `CountrySearch.tsx` mobile-dropdown work, `.serena/`, `.playwright-mcp/`, and `web/AGENTS.md`.

Suggested:
1. `chore(deps): add lucide-react, motion, sonner`
2. `refactor(ui): migrate icons from phosphor to lucide with shared scale`
3. `fix(ui): correct legend label collisions, control sizing and z-index scale`
4. `fix(nav): tidy navbar breakpoints and focus/transition states`
5. `feat(ui): animated icon primitives with reduced-motion support`
6. `feat(ui): sonner toast system and error/loading boundaries`

## Risks

- **Duotone/fill loss** — decorative visualizations in `findings/visuals.tsx` and `app/page.tsx` depend on Phosphor weights for emphasis. Plan to compensate with color and size; review those two pages visually first.
- **Icon name drift** — several Phosphor names have no 1:1 lucide match. The table above is the contract; anything not listed must be chosen during implementation and added to `icons.tsx`.
- **Toast + nav stacking** — must exceed `Tour` (1500) and search menu (1200); using the named `--z-toast` token avoids regressions.
- **`motion` and React 19 / Next 16** — verify the package supports React 19 at install time; if it does not, fall back to CSS keyframes and report it.
- **Unrelated work in tree** — `globals.css` and `CountrySearch.tsx` already have uncommitted changes from other work; commits must be staged by explicit file path, never `git add -A`.

## Out of scope

- Any data pipeline, JSON regeneration, new routes, or i18n string changes beyond newly added toast/error copy.
- Redesigning hero artwork, charts, or map tile rendering.
- Replacing the brand `Logo` SVG.
