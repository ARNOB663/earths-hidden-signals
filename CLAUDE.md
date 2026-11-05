# CLAUDE.md

This repository is documented in **[`AGENTS.md`](AGENTS.md)** — read that first. It is the single
authoritative summary of the code layout, commands, pipeline order and data contracts.

This file used to hold a second, longer summary. It drifted (it described `/signals`, `/about` and
`/monitoring` as live routes and pointed at files that have since been deleted), so it is now only a
pointer to keep one source of truth.

Quick orientation:

- `analysis/` — Python pipeline; writes committed JSON into `web/public/data/`.
- `scripts/signals/` — separate IMERG rain-signal pipeline with its own venv, tests and baseline.
- `web/` — Next.js 16 App Router site that reads `web/public/data/` server-side.
- `docs/` — [`CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md) (audit + cleanup),
  [`RESOURCE_INVENTORY.md`](docs/RESOURCE_INVENTORY.md), [`DATA_SOURCE_CATALOG.md`](docs/DATA_SOURCE_CATALOG.md).

Commands, thresholds and gotchas live in `AGENTS.md` and `web/AGENTS.md`; do not duplicate them here.
