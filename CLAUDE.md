# Harvest Tracker — CLAUDE.md

## Project overview

Offline-first PWA for hydroponic greenhouse management. Records planting locations and calculates expected harvest dates 45 days later. Runs entirely in the browser with no server — localStorage is the only persistence layer.

## Stack

- **Vanilla JS (ES modules)** — no framework, no build step, no bundler
- **Plain CSS** with custom properties
- **Node.js `node:test`** for unit tests (runs against `core.js` directly)
- **Service Worker** for offline caching and push notifications
- **GitHub Pages** for hosting (`.nojekyll` suppresses Jekyll processing)

## File layout

```
index.html           Static HTML shell — no generated markup except the table body
styles.css           All styles; CSS custom properties at :root; mobile breakpoint at 760px
core.js              Pure business logic — no DOM, no side effects; safe to import in tests
script.js            All DOM/UI logic; imports from core.js; runs in the browser only
service-worker.js    Cache-first offline strategy + notificationclick handler
manifest.webmanifest PWA manifest (theme green #166534, standalone display)
tests/
  core.test.mjs      Unit tests using node:test; covers core.js exports only
```

## Running and testing

```bash
npm test             # node --test tests/*.test.mjs
```

No dev server is required — open `index.html` directly in a browser or serve with any static file server. There is no build or compile step.

## Architecture rules

**`core.js` must stay pure.** It has no DOM access, no `localStorage`, no `window`. All exported functions are deterministic given their inputs. Tests import it directly via Node.js.

**`script.js` owns the DOM.** It imports from `core.js` and handles all browser APIs — `localStorage`, `Notification`, `ServiceWorker`, `beforeinstallprompt`. Do not move DOM logic into `core.js`.

**No build pipeline.** Do not introduce a bundler, transpiler, or npm dependencies that require a build step. All scripts are loaded as `type="module"` directly.

## Domain model

**Entry schema** (stored in `localStorage` as a JSON array):

```js
{
  id: string,              // crypto.randomUUID() or planting_{timestamp}_{random}
  greenhouseKey: string,   // "GH1" | "GH2" | "GH3"
  greenhouseName: string,  // human display name, denormalized
  row: string,             // e.g. "NFT 3", "Tower 12", "Channel 5", "PVC Wall 2"
  plantingDate: string,    // YYYY-MM-DD local date
  harvestDate: string,     // YYYY-MM-DD local date = plantingDate + 45 days
  notifiedOn: string,      // YYYY-MM-DD of last notification, or "" if never
  createdAt: string        // ISO 8601 timestamp
}
```

**Greenhouse layout** (defined in `core.js`):

| Key | Name          | Rows                                    |
|-----|---------------|-----------------------------------------|
| GH1 | Greenhouse 1  | NFT 1–10, PVC Wall 1–3 (13 total)       |
| GH2 | Greenhouse 2  | Tower 1–20                              |
| GH3 | Greenhouse 3  | Channel 1–20                            |

**Status kinds** returned by `getHarvestStatus(daysLeft)`:

| Kind        | Condition        | CSS class         |
|-------------|------------------|-------------------|
| `overdue`   | daysLeft < 0     | `status-overdue`  |
| `due`       | daysLeft === 0   | `status-due`      |
| `soon`      | 1–7 days left    | `status-soon`     |
| `scheduled` | > 7 days left    | `status-scheduled`|
| `unknown`   | NaN / bad date   | `status-unknown`  |

## Storage

- **Active key**: `harvest-tracker-entries-v2`
- **Legacy key**: `harvestEntries` (migrated automatically on first load via `normalizeEntries`)
- On load, entries are normalized then immediately re-saved under the v2 key

When bumping the storage format, update `STORAGE_KEY` in `script.js` and add migration logic to `normalizeEntries` in `core.js`.

## Date handling

All dates are **local calendar dates in `YYYY-MM-DD` format**. Never use UTC midnight comparisons for due-date logic — `computeDaysLeft` works by comparing local date strings to avoid timezone-off-by-one bugs. Use `parseDateParts` + `Date.UTC` for the day-difference arithmetic (already done in `core.js`).

Display dates use `Intl.DateTimeFormat("en-PH", ...)` — Philippine locale.

## Notifications

Checked in three places:
1. App open (boot)
2. `visibilitychange` → visible
3. `setInterval` every hour while open

A planting is notified at most once per calendar day (`notifiedOn` field). Notifications go through the Service Worker registration when available, falling back to `new Notification()`.

## CSS conventions

- Use existing custom properties (`--green`, `--red`, `--amber`, `--ink`, `--muted`, `--line`, `--surface`, `--page`, `--radius`) — do not hardcode hex values inline.
- Mobile layout collapses at `max-width: 760px`. The table converts to card-style layout using `data-label` attributes on `<td>` and CSS `::before` pseudo-elements.
- Status row colors are applied via `tr.className = status-${status.kind}`.

## XSS safety

All user-visible values written via `innerHTML` must go through `escapeHtml()` in `script.js`. The `id`, `greenhouseName`, and `row` fields all pass through it before being inserted into the DOM.

## Service worker cache

Cache name is `harvest-tracker-cache-v3`. The install handler caches the app shell; the activate handler deletes all caches with a different name. When adding new static assets, add them to `APP_SHELL` in `service-worker.js`. When making a breaking cache change, increment the version number in `CACHE_NAME`.

## Key invariants for tests

- `computeHarvestDate("2026-06-09")` === `"2026-07-24"` (45 days)
- `computeDaysLeft` uses the caller's local date, not UTC
- `sortEntries` returns a new array and does not mutate the input
- `normalizeEntries` filters out entries missing `greenhouseKey`, `row`, or `plantingDate`
