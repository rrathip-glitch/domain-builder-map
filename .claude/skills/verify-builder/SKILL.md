---
name: verify-builder
description: Independently check a builder's map files against their cited sources and correct them. Use when asked to "verify <builder>", "red-team the map", "spot-check the data", or before showing the map to anyone who knows the builders.
---

# Verify a builder's rows against their sources

Run this as a fresh agent that did not do the research. Its job is to try to prove rows wrong.

## Read first
`SCHEMA.md` (confidence rules) and `BUILDER-BRIEF.md` (source rules: never open linkedin.com, no paywall workarounds).

## Procedure
1. Open `data/builders/<id>.people.json`, `<id>.divisions.json` (if present) and `<id>.fin.json`.
2. Choose rows to check, highest stakes first: CEO, CFO, every land and finance head, regional presidents, then a random sample of division presidents; every `land_banking` and `competitor_links` row; the lots table; the three largest and the nearest-maturity debt rows; every M&A row. For a large builder check at least 25 rows; for a small one, all of them.
3. For each row open the `source_url` and confirm the fact is stated there, the person holds that title, and the source is recent enough. Then run one independent search to see whether the person has since left or the instrument has been redeemed or refinanced.
4. Act on what you find, editing the file in place:
   - Holds: leave it. If it was tagged lower than the source supports, upgrade it.
   - Source does not state it, or source is dead: find a replacement source; if none, downgrade to Inferred with a note, or remove the row and add a line to `gaps`.
   - Wrong or superseded (person left, title changed, note redeemed): correct it with the newer source; keep a one-line `note` of what changed.
5. Re-run `node scripts/validate.mjs` on every file you touched.
6. Append a one-line result to `status/verification.log`: `<id>: checked N, held H, corrected C, downgraded D, removed R`.

## Return
Counts as above, the specific corrections (old -> new, with source), and any pattern worth a line in `TIPS.md`.
