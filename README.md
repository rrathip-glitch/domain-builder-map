# Domain builder map

A sourced map of the top 100 US homebuilders (people, financing, M&A), land-banking competitors, and a scored news feed, for Domain Real Estate Partners. Everything is local files: no database, no API key, no network at run time.

## Run it

```
cd domain-intel
npm install        # once (only dependency: exceljs, for the workbook)
npm run build      # merge data -> data/dist/, then write the workbook and CSVs
npm start          # the app at http://localhost:4173  (PORT=5000 npm start to change)
```

The app's top bar also has a **Refresh data** button that runs the same build from the page (local use only).

`npm run check` re-opens the workbook and checks every sheet (rows present, hyperlinks well-formed, confidence fills right, nothing clipped, dates are real dates).

`npm run build` is safe to run by anyone at any time, as often as you like (about 2 seconds). It never crashes on a bad input file and never leaves a half-written output: every file is written to a temp name and renamed. The app re-reads `data/dist/` on each request, so after a rebuild just refresh the browser.

## Where things are

| Path | What |
|---|---|
| `exports/Domain-Builder-Map.xlsx` | The workbook: Read me (with "How this was built"), Builders, People, Regions & heads, Lots & metrics, Debt, Land banking, Capital events, JVs, M&A, Competitors, Feed, one sheet per insight table, Sources, Coverage |
| `exports/csv/` | The same tables as CSV |
| `data/dist/domain.json` | All merged data as one clean JSON file (what the app and workbook read) |
| `data/dist/coverage.json` | Coverage numbers and the per-builder tracker, plus any input files held back |
| `app/` | The local app: `server.mjs` (plain Node, no dependencies) and `public/` (one page, vanilla JS) |
| `scripts/build.mjs` | The merge. `scripts/export-xlsx.mjs` writes the workbook. `scripts/validate.mjs` checks research files |
| `data/local/` | What people type in the app: `votes.json`, `notes.json`, `tuning-examples.json`. Never touched by a rebuild |
| `data/spine.json`, `data/builders/`, `data/competitors/`, `data/ma_industry.json`, `data/feed/articles.json`, `data/extras/` | Inputs, written by the research sessions. Shapes are in `SCHEMA.md` |

## One definition per headline number

Every headline number is computed once, in `scripts/build.mjs`, and written to `coverage.json` `totals` (the same object is `totals` in `domain.json` and `/api/meta`, which the portal's Home tiles read; the workbook's Read me and Coverage sheets read it too). The wording of each definition is in `totals.definitions`. Regional heads: named people at Regional level whose role is leading a region, area or group (`level = Regional` and `role_category = Regional President`), counted once per builder; `totals.top25` has the same counts for the 25 largest builders. Named land bankers: a row counts only if it asserts a financing relationship with a named land banker or lot-option financier (the same links as the "Builder-financier links" and "Who banks whom" tables, re-checked by the build). Rows that record no link or only an indirect or people link go to `financing.no_link_notes` and are never counted; unnamed "land bank" arrangements are never counted. Every counted link keeps its confidence and source in `derived.land_banker_links`; `derived.land_bankers_display` adds "(Inferred)" or "(Reported)" to the name where the link is not Verified. The "How this was built" text is `coverage.json` `how_built`.

## Workbook layout

Lead columns first; long text in "Notes: ..." columns at the far right; a column that would say the same thing on every row is removed and stated once in the note above the header; a confidence or status that is the same on nine rows in ten shows only the rows that differ; dates are real dates shown as 15 Mar 2027; money is $ millions shown as $1,234.5M. The CSVs keep every column and raw values.

## What the build does

- Joins the ranking (`spine.json`) with each builder's people, extra people (`<id>.divisions.json`) and financing files.
- Includes every builder file that parses. If a file does not yet pass `scripts/validate.mjs` (research agents save early), its builder is flagged "in progress" with the validator's messages on the Coverage tab; a row with its own problem (no source link, a value outside the allowed list) is left out until fixed. Only a file that cannot be read at all is skipped, and then the last readable copy (`data/dist/.lastgood/`) is used if there is one, so a file caught mid-write never removes a builder from the map.
- De-duplicates people within a builder by normalised name, keeping the higher-confidence row and merging the rest ("Also listed in").
- Derives: rank tier (Top 25 / Top 50 / Top 100), each person's function for Domain (Land, Finance, C-suite, Regional, Division, Other), % of lots optioned, known land bankers, next debt maturity, and the list of unique sources.

## The app

Builders (sortable, filter by tier / ownership / state / land banker / lots optioned / debt maturing; click a row for an inline preview of CEO, CFO, land heads and regional heads) · builder page (interactive org map: a tree from the CEO through corporate land and finance to regional heads and their divisions, with zoom, collapse, and Regional-heads-only / Land + Finance-only toggles; tables by function; reporting-line tree; financing, M&A, news, gaps, sources, Domain internal notes) · People (the Rolodex, with CSV download of the current filter) · Feed (ten per day or week, cutoff All / 70+ / 90+ / slider, votes that re-rank at once and show their working) · Competitors · M&A · Insights (one tab per file in `data/extras/`, plus a debt maturity ladder the build adds up from the Debt rows) · Coverage · Sources. Each builder page has a "Print pre-call brief" button (print or save as PDF). Every fact shows a confidence colour (Verified green, Reported amber, Inferred grey) and a source link with its retrieval date.

JSON API (all GET unless noted): `/api/health`, `/api/meta`, `/api/data` (sent with an `ETag` and `Cache-Control: no-cache`, so a reload that already has this build gets a 304 and a rebuild still shows on refresh), `/api/builders`, `/api/builders/<id>`, `/api/people?q=&group=&role=&level=&tier=&state=&builder=&confidence=`, `/api/people.csv`, `/api/feed?cutoff=70`, `/api/competitors`, `/api/competitors/<id>`, `/api/ma`, `/api/insights`, `/api/insights/<id>`, `/api/sources`, `/api/coverage`, `/api/search?q=`, `/api/votes` (GET, POST `{id, vote: 1|-1|0, note}`), `/api/notes` (GET, POST `{kind: "builder"|"person", id, text}`), `/api/tuning-examples`, `/api/rebuild` (POST; only when the app runs locally).

Feed votes: a vote moves that story by 15 points; each vote also teaches small weights for the story's category, builders, competitors and publisher that nudge other stories sharing them (learned part capped at 15 either way). The rule lives in `app/lib/rank.js` (the page ships the same file). Every vote rewrites `data/local/tuning-examples.json`, which the next feed refresh reads.

Front end: the static root is `app/public` unless `PUBLIC_DIR` is set (resolved against the project root), so another front end can be served without touching the server. Shared modules used by both sides live in `app/lib/` (`rank.js` vote maths, `org.js` org-map model) and are served at `/lib/`.

Deploying (hosting files belong to the orchestrator): the server uses only relative paths and the `PORT` env var. Set `HOST=0.0.0.0` on a host such as Railway; `DOMAIN_DATA_DIR` can point the app at a data folder elsewhere.
