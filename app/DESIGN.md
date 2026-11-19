# Design package: Domain builder map

Audience: the CEO, COO and head of the business at a finance firm. Not technical, glancing between meetings, sometimes on a shared screen. Every screen answers one question in large type first; detail is one click away.

## Principles
1. One question per screen, answered in large type before anything else.
2. Progressive disclosure: summary, then "Show all", then "Full table". Nothing is removed, only tucked away.
3. Plain words. "News" not "Feed", "Deals" not "M&A", "Share of lots optioned" not "% opt".
4. Every fact carries its confidence colour and a source link with the date it was retrieved.
5. People are the product: a person is always a card you can click for the detail drawer.

## Type (system fonts, no downloads; root size scales with the window so a 1920 shared screen reads bigger)
| Use | Size | Notes |
|---|---|---|
| Page title | 36px (2.1rem) | serif, one per screen |
| Key fact / stat tile value | 28px (1.65rem) | tabular numbers |
| Card title, person name | 20px (1.18rem) | semibold |
| Body | 17px (1rem) | line height 1.5 |
| Label / caption | 14px (0.82rem) | uppercase only for tiny section labels |
Root: `clamp(17px, 0.55vw + 10px, 21px)`: 17px at 1280, about 20.5px at 1920.

## Spacing
4 / 8 / 12 / 16 / 24 / 32 / 48. Cards: 16-20 padding, 12 radius, 1px line, soft shadow on hover only. Page gutter 32, content up to 1680 wide.

## Colour
| Token | Value | Use |
|---|---|---|
| Ink | `#14213d` | text, top bar |
| Muted | `#55607a` | secondary text |
| Paper | `#f5f4ef` | page background |
| Surface | `#ffffff` | cards |
| Line | `#dcdde3` | borders |
| Accent (one) | `#1f4fd1` cobalt | links, active controls, Land tag (the people Domain calls first) |
| Finance tag | `#6d3fc4` violet | only to tell Finance from Land |
| Verified | `#12805c` green | primary source opened |
| Reported | `#b7791f` amber | secondary source |
| Inferred | `#6b7280` grey | derived or unconfirmed lead |
Confidence colours are never used for anything else, and the legend sits under the top bar on every screen. Score badges use ink and accent, never green or amber.

## Components
- **Big search**: one box for builders, people and competitors; "/" focuses it; results drop down grouped.
- **Stat tile**: label, one large number, one line of context; the whole tile is a link.
- **Builder row**: rank, name with tier and owner, closings, share of lots optioned (bar), known land bankers, next debt due; click to expand a preview (CEO, CFO, land head, every regional head with geography, "Open").
- **Person card**: confidence stripe on the left, name, title, "Covers" geography; Land and Finance tags; click opens the drawer.
- **Chip**: big rounded filter button; one active per group.
- **Score badge**: 0-100 in a rounded square; 90+ ink, 70+ accent, 40+ outline, under 40 grey.
- **Segmented control**: 2-4 options, one on (org map view, daily / weekly, cards / full table).
- **Detail drawer**: right-hand panel for a person: title, covers, reports to, direct reports, confidence, source link and date, published contact, Domain internal notes. Escape closes.
- **Source link**: confidence dot and word, link to the page, "dated" and "retrieved" dates.
- **Table**: only where rows are really tabular; a few columns by default, "Full table" shows every column; click a heading to sort.

## Screens
Home (search, four tiles, top stories, top of the call sheet) · Builders (rows, chips, preview) · Builder (at-a-glance strip; tabs: Org map, Financing, News, Deals, Profile and gaps, Sources) · People (search, role chips, cards or table, CSV) · News (score-first cards, cutoff All / 70+ / 90+ and slider, daily / weekly, votes with note and instant re-rank) · Competitors · Deals · Insights (takeaway first, method note, table) · Coverage · Sources.

## Icons (D13)
One inline-SVG set in `app/public/ui.js` (`icon(name)`): 24 px grid, stroke 1.9, round caps, colour inherited from the text, no emoji, no icon font, no network. Always next to a label or with a tooltip.
- Navigation and tabs: home, building (builders), users (people, org map), news, target (competitors), merge (deals), chart (insights), table (full table), ext (source link).
- Role groups: pin (Land), bank (Finance), star (C-suite), map (Regional), grid (Division), person (other).
- Fact types: lots (lots optioned), cal (debt due), bank (land banker), phone, mail, pencil (internal note), up / down (votes), print, download.
- Confidence marks differ in shape as well as colour: check in a circle (Verified), dot in a circle (Reported), dashed circle (Inferred).

## Region marker: US tile map (D14)
`usMap(states)` in `ui.js`: each state is a rounded square in roughly its place (12 by 8 grid), highlighted states in the accent colour, the rest pale; the state list is the tooltip. Used on region cards, regional-head cards, the person drawer, the builder preview and the builder header (whole footprint). States come from `statesIn()` (two-letter codes, state names, common metros); nothing derivable means no map.

## Text rules (D12)
No paragraph longer than one sentence on screen: `short()` shows the first sentence and "more". A tag or column that is the same on every row is stated once above the table. Research caveats in brackets are trimmed from labels and kept in the tooltip and the drawer.

## Component modules (mounted 11:47 ET)
- `icons.js`: the icon set; `ui.js` wraps it as `icon(name)` and keeps a few extra glyphs (home, people, competitors, insights, table, print).
- `usmap.js` + `usmap.css` + `usstates-paths.js`: the US map with real state outlines; `ui.js` wraps it as `usMap(states)` (the region marker), and Home uses the interactive version shaded by builders active.
- `stateview.js`: the By state tab (`#/states`, `#/states/TX`).
- `orgmap.js` + `orgmap.css`: the org diagram on each builder page; `org.js` and the built-in diagram in `app.js` are the fallback.
Tokens the modules read from `style.css` (keep these names): `--ink --muted --paper --surface --line --line2 --accent --accent-soft --fin --fin-soft --ver --rep --inf --r --shadow --sans --serif`.

## Brand cues and the colour rule (D23)
Cues taken from Domain Real Estate Partners' public website (read in a browser, nothing copied): forest green `#3E5539`, cream paper `#FAF9F6`, warm line `#E3E1D9`, Garamond-style serif headings over a plain sans body, generous white space, a stat strip of large numerals. This portal is not an official Domain product and uses no Domain logo, image or text.
One rule for colour:
- **Green (`--brand`) frames the page**: top bar, page titles, the "Regional heads" tier label, the Top 25 pill. It never marks a fact.
- **Blue (`--accent`) is anything you click or that carries data**: links, primary buttons, the selected chip, bars, the maps, the Land tag.
- **Charcoal (`--ink`)** is text and the strongest score badge (90+).
- **Confidence keeps its own three colours** (Verified green, Reported amber, Inferred grey), always with a shape-coded mark and the word, so the brand green is never read as "Verified".
