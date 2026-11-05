# Codebase Cleanup — Audit

Repo: `ARNOB663/earths-hidden-signals` · HEAD `b864e27d` · clean working tree.
Scope audited: the whole tracked tree (`git ls-files`) plus on-disk artifacts.

This is the Stage 1 deliverable (§7, task A1). It records what was found, the decisions taken
(D1–D3, resolved below), and the plan that was executed in Stages 2–4. It was checked against the
source, not accepted from the first pass: corrections from that verification are in §9.

---

## Decisions taken

- **D1 — remove dormant code.** Delete the unreachable component subtrees and their transitively
  dead libraries; keep the datasets (the inventory's data half of the policy stands).
- **D2 — rename.** `ui/index.tsx`'s row-style `Stat` is renamed `StatRow` (it has no surviving
  consumer after D1, so it is removed with the dormant parts of `ui/index.tsx`).
- **D3 — docs.** `README.md` is corrected and root `CLAUDE.md` becomes a pointer to `AGENTS.md`.
- **Scope.** Full behaviour-preserving consolidation of the duplicate UI patterns in §2 and §3.

---

## 0. The one constraint that overrides "remove dead code"

The repo carries an explicit, documented retention policy that conflicts with a naive cleanup:

`docs/RESOURCE_INVENTORY.md:8-16` defines a status vocabulary and an instruction:

- **Dormant** — *"a working implementation whose caller or UI was retired. **Keep the code and data**;
  re-wire rather than rewrite when a surface needs it again."*
- **Context** — *"computed and committed, but no current primary route reads it directly. **Keep it**."*

`scripts/signals/tests/test_inventory.py` enforces the data half of this in CI
(`test_every_hazard_dataset_stays_committed_after_its_page_was_retired`). No test enforces the *code*
half, so dormant **components** are currently "keep" by policy only.

**This is the first decision the plan needs from you** (§7, decision D1): honour the dormant-code
policy, or treat it as superseded by this cleanup task. The audit below is arranged so either choice
is cheap, because the dead code is cleanly separable.

Also: `.kilo/plans/1793705663794-signals-plan.md`, referenced by `scripts/signals/README.md:3`,
**does not exist**. The README also self-describes as *"step 1 of 11 … Nothing here produces data
yet"*, which is stale — `scripts/signals/` is Live per the inventory and produces `signals/frequency/`.

---

## 1. Unreachable component subtrees (largest finding)

Every primary route imports from `@/components/...`. Cross-referencing all imports:

| Folder / file | Imported by a route? | Lines | Inventory status |
|---|---|---|---|
| `components/country/*` (3 files) | **No** | 742 | Dormant |
| `components/findings/*` (4 files) | **No** | 1,433 | Dormant |
| `components/hazards/*` (4 files) | **No** | 1,051 | Dormant |
| `components/trends/*` (3 files) | **No** | 1,121 | Dormant |
| `components/map/{MapExplorer,LeafletMap,CompareDivider,differenceLayer,ForestLossChart,MapPlaceSearch,PlaceClimateContext,baseMap,diffColors,forestLossLayer,lossColors,MapExplorer.module.css}` | **No** | ~1,600 | Dormant |
| (exception) `components/map/{MapLoading,MapSheet}` | **Yes** — `SignalExplorer`, `ReplayExplorer` | 186 | Live (mis-filed under a "Dormant" folder) |
| `components/home/EvidenceStory.tsx` | **No** | 190 | **Inventory says "Live" — wrong** |
| `components/hero/HeroClimateStory.tsx` | **No** | 241 | **Inventory says "Live" — wrong** |
| `components/hero/HeroImageSlideshow.tsx` | **Yes** — `/` | 194 | Live |
| `components/intelligence/{AlertPreferences,IntelligenceStrip,LocationsBrowser,Locator,parts}.tsx` | **No** | 991 | Dormant |
| `components/intelligence/MethodsIntelligence.tsx` | **Yes** — `/methods` | 197 | Live |
| `components/site/`, `components/signal/*`, `components/ui/*` | Yes (all) | — | Live |

Two unreachable files are **additionally untracked by the inventory's own terminology** — an
"abandoned experiment" rather than dormant: `findings/` was retired with no rewire plan
(`docs/RESOURCE_INTEGRATION_MAP.md:64`: *"Retire UI; keep data story text if reused"*).

**Approx. 7.0k unreachable component lines** (excluding the 186 live `map/` files and `ui/`).

### 1a. Transitively orphaned libraries

| File | Lines | Imported only by |
|---|---|---|
| `lib/names.ts` | 181 | the orphan components above (+ `lib/countries.ts`) |
| `lib/countryReport.ts` | 299 | **nothing at all** (already unreachable) |
| `lib/countries.ts` | 97 | orphan components / `data.ts` dead readers |
| `lib/places.ts` | 100 | `trends/TrendExplorer` (orphan) |
| `lib/geo.ts` | 67 | `country/CountryMap` (orphan) |
| `lib/mapPlaces.ts` | 23 | `map/*` (orphan) |
| `lib/gibs.ts` | 100 | `map/*` (orphan) |
| `lib/dates.ts` | 68 | `map/MapExplorer` (orphan) → **not** used by live code |
| `lib/hazards.ts` | 145 | types only; `HAZARD_META` used by orphan `EvidenceStory`; `HazardId` also by `ui/icons.tsx` |
| `lib/download.ts` | 37 | orphan charts + `/methods` (`CITATION`) → **Live, keep** |
| `lib/plain.ts` | 38 | orphan explorers + `ui/index.tsx` (`sureness`) → **Live, keep** |

### 1b. Dead readers inside a live file

`web/src/lib/data.ts` exports 13 readers; **only 3 are used** (`readManifest`, `readCrosscheck`,
`readTrendZones` — all from `/methods`). Dead exports: `readHazardZones`, `readLandslides`,
`readFloods`, `readFireGrid`, `readPlaceSignals`, `readMapPlaces`, `readCountries`, `readLatest`,
`readTrendGrid`. Removing them also drops the `countries`/`hazards`/`mapPlaces` imports from
`data.ts`.

---

## 2. Duplicate implementations (behaviour-preserving consolidations)

1. **Two `Stat` components, same name, different semantics.**
   `components/signal/levels.tsx:98` (`Stat` = boxed `<dt>/<dd>` tile with label+hint) vs
   `components/ui/index.tsx:165` (`Stat` = plain label/value row). Different behaviour → **rename,
   do not merge.** See D2.
2. **`MetricCell` in `/accuracy` (`accuracy/page.tsx:14-26`) duplicates `signal/levels.tsx:Stat`**
   (same tile markup, `rounded-xl border-line bg-card px-3 py-2*`, `dt` label, `dd` value, `dd` hint)
   with two differences: 2xl vs lg value text and no `hintBn`. → Merge into `Stat` with an optional
   `size`/`valueClass`; `MetricCell`'s hints are English-only today and become bilingual.
3. **Three hand-rolled sample banners.** `SampleNotice` (`signal/SampleNotice.tsx`) exists and is used
   on `/signal/[id]` and `/act`, but `/` (`page.tsx:123-130`) and `/signal` (`signal/page.tsx:112-119`)
   hand-roll the same `border-watch bg-watch-soft` banner with re-worded text. → Route both through
   `SampleNotice`. **Careful:** the `/` copy says "backtest on /accuracy", the `/signal` copy adds
   "historical case sizes"; `SampleNotice`'s `where` prop must support both placements.
4. **Three near-identical "frequency sentence" formatters** computing
   `75% interval low–high` from `frequency.level`:
   `app/page.tsx:194-201`, `app/signal/page.tsx:249-250`, `signal/SignalExplorer.tsx:490-491`
   (plus a 4th in `signal/ShareCard.tsx:28` and a 5th in `signal/observation.tsx:133-134`).
   → One `formatFrequency(level, {bn})` helper in `lib/signals/`.
5. **Repeated section eyebrow class** `text-xs font-semibold uppercase tracking-[0.18em] text-accent`
   appears **10×** across `app/*/page.tsx`. → One `<Eyebrow>` primitive (or a `const` in `ui/`).
6. **Repeated card surface** `rounded-xl border border-line bg-card` appears **~18×** across live pages
   and components; `rounded-2xl border border-line bg-sunken p-*` appears **5×**. → Design-token
   classes in `globals.css` (`@apply`-free, e.g. `.card`, `.panel-muted`) or a `Card` primitive.
7. **`pct` has two implementations:** `components/signal/levels.tsx:126` (imported by
   `/accuracy`, `/replay`) and `lib/intelligence/conclude.ts:98` (different signature/rounding).
   `conclude.ts`'s only live consumer is `MethodsIntelligence` — check whether they can share one.
8. **Two `optionalJson`-style readers**: `lib/signals/model.ts:144-151` and
   `lib/geography/data.ts` read JSON independently of `lib/data.ts`. Verify before merging — they
   differ in caching/error behaviour.

---

## 3. Repeated content across pages

- The "not a forecast / not an official warning" disclaimer appears as prose on `/` (`page.tsx:297-302`),
  `/signal` (`page.tsx:91-109` + `[id]` metadata), `/act` (2×), `/for-organizations` (2×),
  `/accuracy` (footer line), `/signal/[id]` metadata. The **hero badge copy**
  ("Observational screening · not a forecast") is duplicated verbatim between `/` and `/signal`.
  → Keep the full explanation on `/methods` and the Home footer; replace the rest with a short shared
  `<SafetyNote/>` (one line + link to `/methods`), not by deleting the scientific explanation.
- The **coverage `<dl>` of four `Stat`s** is duplicated almost verbatim between `/` (`page.tsx:146-175`)
  and `/signal` (`signal/page.tsx:121+`) — same labels, hints and counts. → Extract one
  `CoverageStats` component; Home is the overview, Signal is the working surface.
- "Not enough historical evidence to calculate a reliable frequency" (or close variants) appears
  **7×** across `model.ts`, `observation.tsx`, `History.tsx`, `app/page.tsx`, `ShareCard.tsx`.
  → Single constant; keep per-surface context.
- Do **not** dedupe: the `/methods` methodology prose, source attribution, or the `methods#data`
  dataset table — these are the canonical copies the task says to preserve.

---

## 4. Unused / stray files and assets (tracked)

| Path | Problem |
|---|---|
| `.playwright-mcp/` (56 files, **1.5 MB**) | Debug session logs, page YAML dumps and 5 PNG screenshots committed at repo root by a tool. Referenced by nothing; introduced by commit `b475270d`. |
| `home-new.png` (**1.1 MB**, repo root) | Screenshot, referenced by nothing. |
| `web/public/features/*-{dark,light}.webp` (6) | Feature-card images for retired pages; referenced by nothing. |
| `web/public/features/image/{img1.jpg,img3.jpeg,img4_preview.jpg,img5_preview.jpg}` | Unreferenced. (`hero-flood-commons-01/02`, `img2.jpeg`, `img4.avif`, `img5.avif` **are** used by `HeroImageSlideshow.tsx`.) |
| `web/public/hero-bg.webp` | Referenced by nothing. |
| `web/public/data/signals/south-asia/*.rgb/.alpha` + `index.json` | "Context"; not read by any live route (only `CountryMap`, orphan). **Data — keep per policy.** |
| `web/public/data/signals/flood-catalogue.json`, `archive/`, `mapped` demo scores | Verify against live readers before touching. |
| `analysis/evaluation_baseline.json` | **Live** — CI gate. Keep. |
| `scripts/signals/{spike.py,spike_imerg_probe.py,spike_report.md}` | Dormant "record of evidence" by policy. |
| `scripts/signals/raw/` (on disk, gitignored) | Fine. `.venv/` (on disk) fine. |

**Baseline hygiene note:** `.playwright-mcp/` should also be added to `.gitignore` if it is still
produced by the `webapp-testing` skill.

---

## 5. Repository-integrity issues found (report, do not "fix" blindly)

1. **`web/public/data/signals/frequency/` (~53k files, 211 MB of the 227 MB `signals/` tree) is
   gitignored and untracked, but `web/src/lib/signals/model.ts:403` requires it at build time.**
   The inventory documents this as "Generated, gitignored". Consequence: a clean clone **cannot
   build the site** without first running `scripts/signals/backtest.py`. This is a pre-existing
   deployment risk, out of scope for a cleanup, but it must be recorded in the audit and left alone.
2. Total `web/public/data/` ≈ **240 MB** committed. Any data "cleanup" here would be large and
   risky; the guard test forbids removing hazard datasets. **Recommendation: no data deletion in
   this cleanup** beyond the provably unreferenced `south-asia` context files only if you explicitly
   waive the retention policy (D1).
3. `CLAUDE.md` is stale (root `AGENTS.md` already says "prefer this file"; `CLAUDE.md` routes
   `/signals`, `/about`, `/monitoring` as if live). Task says correct misleading docs → trim
   `CLAUDE.md` to a pointer at `AGENTS.md` rather than maintaining two divergent summaries.
4. `README.md` "What's inside" table still advertises Trends/Hazards/Map Explorer as live pages.

---

## 6. Internationalisation

`lib/bn.ts` + `lib/i18n.tsx` (`<T en bn>`) + `lib/names.ts`. Findings:

- There is **no key/value translation dictionary** — translations are inline `en`/`bn` pairs, so
  "duplicate/unused keys" means **unused entries in the `Record` tables in `lib/names.ts`**
  (`ZONE_BN`, `HAZARD_BN`, `PLACE_BN`, `COUNTRY_BN`, `UNIT_BN`, `DEFINITION_BN`, `AGREEMENT_BN`).
  Every one of these maps is consumed **only by orphan components**. If D1 = remove dormant code,
  `lib/names.ts` disappears entirely; otherwise leave it.
- Hardcoded English on live surfaces worth checking: `/accuracy` `MetricCell` hints (English only),
  season labels `"monsoon" / "pre-monsoon"` in `accuracy/page.tsx:134`, `app/page.tsx` `Stat` hints
  are bilingual (fine).
- `unitBn`, `bnNum`, `bnMonth`, `bnDay` — verify `bnMonth`/`bnDay` are used; if only orphan map code
  uses them, move/delete with that code.

---

## 7. Proposed staged plan (small, reversible commits)

### Decisions needed before Stage 2
- **D1 — Dormant-code policy.** Remove the ~7.0k unreachable component lines + orphaned libs
  (§1, §1a, §4 assets), or keep them per `RESOURCE_INVENTORY.md` and only fix *labels* (mark
  `EvidenceStory`/`HeroClimateStory` Dormant instead of Live, move `MapLoading`/`MapSheet` to a
  live folder)? **Recommendation: remove** — the task explicitly targets dead code and duplicate
  UI, and the code is recoverable from git. But this is a policy reversal, so it is your call.
- **D2 — `Stat` name collision:** rename the `ui/index.tsx` row-style one to `StatRow` (touches
  `TrendExplorer`, `HazardExplorer`, `CountryTrends`). **Recommendation: yes.**
- **D3 — Docs scope:** may I edit `README.md` and replace `CLAUDE.md` with a pointer? **Recommendation: yes.**

### Stage 2 — Code cleanup (only after D1/D2)
1. `docs/CODEBASE_AUDIT.md` — commit this audit (the Stage 1 deliverable).
2. If D1=remove: delete `components/{country,findings,hazards,trends}`, orphan `components/map/*`,
   `components/home/`, `hero/HeroClimateStory.tsx`, dead `components/intelligence/*`;
   move `MapLoading`+`MapSheet` → `components/map/live/` (or `components/map/` keeping name);
   delete `lib/{names,countryReport,countries,places,geo,mapPlaces,gibs,dates}.ts`; trim
   `lib/data.ts` to its 3 live readers; trim `lib/hazards.ts` to what `ui/icons.tsx` needs; delete
   `lib/intelligence/{forecast,guidance}.ts`; remove their tests if any.
   Verify each with `grep` for the symbol before deleting.
3. If D1=keep: only relabel the inventory and fix `MapLoading`/`MapSheet` placement.
4. Consolidate §2 items 2,4,5,6,7 behind existing modules; no new files except
   `formatFrequency` (in `lib/signals/`) and optionally one `Eyebrow`/`Card`.
5. Remove the `.playwright-mcp/` + `home-new.png` + unused `features/` assets; gitignore
   `.playwright-mcp/`.

### Stage 3 — UI/content
- `SampleNotice` everywhere (§2.3); `CoverageStats` extraction (§3); one `<SafetyNote/>`; bilingual
  `/accuracy` hints and season labels; keep `/methods` and `/for-organizations` canonical text.

### Stage 4 — Data/config
- **No dataset deletion** (guard test + policy). Update `docs/RESOURCE_INVENTORY.md` and
  `README.md` to match reality; fix `scripts/signals/README.md` stale status and dangling plan ref.
- Re-check `package.json`: all 6 deps are used (`leaflet`, `lucide-react`, `motion`, `next`,
  `react`, `react-dom`, `sonner`); `framer-motion`/`zod` are transitive only — **no change**.

### Stage 5 — Verification (exact commands in this repo)
- `cd analysis && python -m pytest -q`
- `cd analysis && python intelligence.py --reproduce && python evaluate.py --check && git diff --exit-code -- ../web/public/data`
- `python3 -m pytest -q scripts/signals/tests/test_guardrails.py` (from repo root)
- `scripts/signals/.venv/bin/python -m pytest -q scripts/signals/tests` (from `scripts/signals`)
- `cd web && npm run lint && npm run build` (build is also the type check)
- `cd web && node --experimental-strip-types --test src/lib/signals/age.test.ts`
- Smoke-visit all 9 routes + confirm the 13 retired routes still 308.

### Risks
- Removing dormant components may break the *intent* of `RESOURCE_INTEGRATION_MAP.md` rewiring
  plans; git history is the recovery path.
- Touching `lib/data.ts` types can break `/methods` — verify via build.
- Do **not** touch thresholds (`analysis/intel/thresholds.py`), formulas, backtest, or committed
  scientific datasets.

---

## 8. Summary numbers

- Unreachable component lines: **~7,000** (7 folders/files groups in §1).
- Transitively dead library files: **8** (`names, countryReport, countries, places, geo,
  mapPlaces, gibs, dates`) ≈ **834 lines**, plus 10 dead readers in `data.ts`.
- Duplicate implementations to consolidate: **8** (§2), of which 1 is a rename and 1 needs a
  behaviour check.
- Stray tracked artifacts: **~2.6 MB** (`.playwright-mcp/`, `home-new.png`, unused `features/*`).
- Datasets to delete: **0** (§4/§5 — policy + guard test).

---

## 9. Verification corrections (checked against source)

These were found re-reading the tree, and supersede the first pass where they disagree.

1. **`components/map/MapSheet.tsx` is not a live stray.** It is imported only by `MapExplorer`,
   `TrendExplorer` and `HazardExplorer` — all dormant. `ReplayExplorer` renders an inline
   `bg-sunken` placeholder, not `MapLoading`. Only `MapLoading` is live (`SignalExplorer`), so only
   it needs relocating.
2. **`components/map/baseMap.ts` is live**, alongside `SignalMap` and `ReplayMap`; it plus
   `lib/layers.ts` and `lib/theme.ts` are what `MapLoading` needs to keep working.
3. **The frequency sentence has 6 formatting sites, not 5**: `/` (`page.tsx:194`), `/signal`
   exemplar (`signal/page.tsx:249`), `SignalExplorer` detail (`:490`), `ShareCard` (`:28`,
   English, copy-only), `observation.tsx` (the frequency paragraph at `:116`), and the interval
   line at `observation.tsx:133`. `/accuracy` and `History` also repeat `low–high` intervals but
   from metric objects, not `frequency.level`.
4. **`/for-organizations` has a third `MetricCell` clone** (`for-organizations/page.tsx:98`) using
   the same `text-2xl` tile as `/accuracy`. There are two clones, not one.
5. **`/signal`'s sample banner duplicates the one inside `SignalExplorer`.** The page-level banner
   is page copy; the component-level one is per row.
6. **`scripts/signals/README.md` is stale** (self-describes as "step 1 of 11 … nothing produces data
   yet", references a plan file that does not exist). Corrected in Stage 4.
7. **There is no separate `typecheck` script**; `npm run build` is the only type check.
8. **The shell blocks pipes, `;`, `>`, `$()`, heredocs and multi-line commands**, and `rg` is not
   installed — use the Grep tool or plain `grep -rn`.
9. **Grep must exclude `**/.venv/`**; vendored numpy/pip carry hundreds of `TODO`/`FIXME` hits.
   There are no `TODO`/`FIXME` markers in project source, so §3's TODO cleanup had nothing to do.
10. **The analysis pipeline parses two web files as data.** `analysis/intel/names.py` reads
    `web/src/lib/places.ts` and `web/src/lib/names.ts` (that one imports `HazardId` from
    `web/src/lib/hazards.ts`). None of the three has a component importer, but deleting them breaks
    `python -m pytest` (`tests/test_locations.py`) and the web build. They are kept and marked
    "Data (pipeline input)" in the inventory.
11. **`intelligence.py --reproduce` already failed the CI gate at HEAD, before this work.** The
    committed `web/public/data/intelligence/*.json` record `codeHash: ed572887abaa977d`, but hashing
    the committed `analysis/intel/*.py` + `analysis/intelligence.py` with `inputs.code_hash()` gives
    `c7a0ef1403239ce6`, so `git diff --exit-code -- ../web/public/data` fails on a clean tree. Nothing
    under `analysis/` was changed here. Re-committing the intelligence JSON from a `--reproduce` run
    is the fix, and it belongs with whoever next touches the pipeline.
