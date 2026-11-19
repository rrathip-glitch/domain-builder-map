---
name: map-builder
description: Populate or deepen the Domain builder map for one or more homebuilders (people, division leaders, financing, M&A) with sourced, confidence-tagged rows. Use when asked to "map <builder>", "add <builder>", "deepen <builder>", "fill the gaps on <builder>", or to run the research swarm over a list of builders.
---

# Map a builder into the Domain CRM

The method that produced the map, packaged so any session can repeat it for one builder or a hundred.

## Inputs
- Builder name and `builder_id` (slug from `data/spine.json`; invent a slug only for a builder not in the spine).
- Mode: `new` (no files yet), `deepen` (files exist; fill gaps), or `divisions` (division and regional leader sweep).

## Read first, every time
1. `BUILDER-BRIEF.md`: why this exists, where to look, hard rules, depth targets.
2. `SCHEMA.md`: exact file shapes, enums, confidence-tag rules.
3. `TIPS.md`: the swarm's shared memory. Append one line when you learn a reusable trick or hit a trap.

## Procedure
1. **Split the work by part, one agent per part** (they write different files, so they never collide):
   - `people` -> `data/builders/<id>.people.json` (profile, executive officers, land and finance heads, regional presidents, reporting lines)
   - `divisions` -> `data/builders/<id>.divisions.json` (`part: "people_extra"`; division, area and city presidents and division-level land leaders, market by market). Worth a dedicated agent for any builder with 10 or more divisions.
   - `fin` -> `data/builders/<id>.fin.json` (lots owned vs optioned, land-banking counterparties, every debt instrument, capital events, JVs, competitor links, M&A)
   For a small private builder one agent can write both `people` and `fin`.
2. **Work primary sources outward**: SEC filings and the company's own site first (Verified), then press releases and trade or local press (Reported), then pattern or snippet leads (Inferred). Land and finance roles first: they are who Domain calls.
3. **Confirm currency**: every person needs a 2025 or 2026 source or the live company page. Executives move; training knowledge is a lead, never a source.
4. **Write early, keep the file valid**: save after the officers or the debt table, extend from there. Builds read the folder at any moment.
5. **Record what is not public** in `gaps` ("Treasurer: not publicly disclosed") and stop. Do not search without end.
6. **Validate**: `node scripts/validate.mjs data/builders/<id>.*.json` and fix every ERROR.
7. **Rebuild**: `npm run build` refreshes `data/dist/`, the app and the workbook.
8. In `deepen` mode: read the existing files and their `gaps`, read the builder's row in `data/dist/coverage.json`, target the missing role categories and empty financing sections, and edit the files in place. Never delete a sourced row without a newer source that contradicts it; if a person has left, keep the row, tag it Inferred and say so in `note`, and add the successor.

## Running it as a swarm
Use the Workflow tool with one agent per (builder, part), all prompts pointing at the three files above plus the builder name, id and part. Workflows cap at about 8 concurrent agents each on this machine, so launch several workflows side by side (5 to 6 builders each) and order each list largest builder first. The script used on 2026-11-19 is kept at `scripts/workflows/builder-research.js`.

## Best practices learned (keep this list current)
- One part per agent beats one builder per agent for large public builders: a people agent, a divisions agent and a financing agent each go deeper than one generalist.
- A shared, append-only `TIPS.md` pays for itself in minutes: the first agent to hit an obstacle (for example an SEC rate block) saves every later agent from it.
- When many agents hit sec.gov at once the site returns an "Undeclared Automated Tool" page. Use the company's investor-relations mirror of the same filing instead of retrying.
- Division presidents are found market by market (division pages, "names ... division president" releases, local business journals, HBA boards), not from corporate pages.
- Accuracy beats volume: a wrong name in front of people who know the builder costs more than a blank. When unsure, tag Inferred and say why, or leave it in `gaps`.
- Verification is done by a fresh agent that did not do the research (`verify-builder` skill), sampling rows against their cited sources.
