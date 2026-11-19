# swarm-b status (builder research, 23 builders in ranks 23-54)

Updated 11:09 ET, 2026-11-19

- **State**: DONE for passes 1 and 2. All 23 builders researched, validated and light-checked by a fresh Opus agent (per D6/D7). Deepening (pass 3) is on hold until the orchestrator asks for it by name; candidates are listed below.
- **Percent complete**: 100% of what D7 asks for.
- **Output**: `data/builders/<id>.people.json` and `<id>.fin.json` for every id in `status/swarm-b-assignment.json`. All 46 files pass `scripts/validate.mjs` (a few warnings for snippet-only Inferred rows with no URL, each explained in its note).
- **Blockers**: none. Two first-run agents hit a usage-limit error before writing (CBH Homes, AMH financing); both were re-run on Opus and finished.

## Final counts
| Measure | Count |
|---|---|
| Builders with valid people + fin files | 23 / 23 |
| People mapped | 404 (265 Verified, 66%) |
| Land heads (Land Acquisition / Development / other) | 70, at 20 of 23 builders |
| Finance heads (CFO / Treasury / Finance other) | 57, at 20 of 23 builders |
| Builders with a named third-party land banker | 1 (AMH: Värde Partners, $500M facility announced 2022; AMH bought back the last land in 2025) |
| Builders with a named lender, capital partner or land source | 21 of 23 (lenders named at 15) |
| M&A rows | 16 |
| Light check (CEO, CFO, land and finance heads, land-banking, lender and M&A rows) | 23 / 23 builders; 297 rows checked: 259 held, 14 corrected, 17 downgraded, 7 removed (`status/verification.log`) |

## What the check changed (headline)
- Middleburg: removed CFO, CIO and Head of Capital Markets (all off the live leadership page). No current CFO is published.
- Eastwood: removed its only land-head lead (snippet-only, past tense). Eastwood has no named land head.
- Habitat: Habitat Capital head Daniel Gura left 02/2026 (FY2026 Form 990); no successor public.
- True Homes: CEO Mark Boyce downgraded to Inferred (sources conflict with David Cuthbertson).
- CFO downgraded to Inferred (directories only): Castlerock (Bruce Torkelson), CBH (Serena Clark). Adams (Brian Stringfellow) and Davidson (Jeff Deane, last named 2021) stay Inferred.
- Removed as "not a transaction": Castlerock's CRC Holdings reorganisation, Bloomfield's DRB/Brightland row (sister subsidiaries). DSLD: one land-seller row removed (source did not mention DSLD).
- GL Homes: five land-deal rows downgraded to Inferred because The Real Deal now returns 403 to every check.

## Ownership differs from the ranking spine (for the orchestrator / app)
The spine lists these as "Private"; the builder files record the actual parent from primary sources:
- Bloomfield Homes (65% since 2017) and Edge Homes (70% since 2017): Sumitomo Forestry subsidiaries, now sisters of Tri Pointe (acquired 2026-05-14).
- Castlerock Communities: Daiwa House via CRC Holdings LLC (Daiwa 89.11%, set up 2025-12-01 "to facilitate financing").
- Minto Communities USA: The Minto Group, Ottawa (Greenberg family).
- Betenbough Homes: Betenbough Companies, PBC, 100% employee-owned (ESOP). Kolter Homes: The Kolter Group (land sits in Kolter Land, part-owned by Brookfield Residential since 2024-11).
- DSLD HQ is now Baton Rouge (7660 Pecue Lane), not Denham Springs. Maronda HQ: Imperial, PA.

## Not conventional for-sale builders (stated plainly in each file)
- Habitat for Humanity International: nonprofit; affiliates buy land; not a land-banking customer (runs its own $82.5M property acquisition fund).
- Middleburg Communities: rental developer (apartments, build-to-rent); "closings" are rental starts; weak fit, only pre-development land carry.
- AMH: build-to-rent REIT; has used a land banker (Värde) and may again, but owns 93% of its 5,422 lots and is a net land seller now; small near-term need.
- The Villages: family-owned retirement community; owns its land; infrastructure funded by CDD bonds; not a core customer.
- BBL Building Co.: general contractor building rentals on clients' land (Bette Companies, Latham NY); not a direct customer.
- Hancock Builders: Phoenix build-to-rent contractor and fee developer; land and debt sit with owner-clients; weak today.
- Epcon: franchise model plus company-owned communities; projects funded through small Form D raises.

## Most useful for Domain (from this slice)
- Sumitomo Forestry (Bloomfield, Edge) is pushing its US builders toward option contracts with a stretched balance sheet and a bridge loan due 2027-05-10; Millrose already works with its JPI unit. Question added to `status/QUESTIONS.md`.
- Maronda: a 2026 job posting describes an "asset/land lite philosophy" and asks the Florida regional president to find land banking and third-party developers. No partner named yet.
- True Homes: about 19,000 lots against ~2,100 closings (about 9 years, my arithmetic); a 2025 land-director posting mentions managing off-balance-sheet investors. Davidson: job snippets mention a "Director of Land Banking Operations" (not confirmed).
- CBH Homes: Radiance (1,200 acres, 6,800+ units near Micron, Boise) sits on land CBH does not own; no option contract is public.
- GL Homes: a TPG Angelo Gordon link exists only as a 2014 seller-side land purchase; Hearthstone bought sites in the same Avenir round where GL bought. Kolter: land runs through Brookfield Kolter Land Partners.

## Thin, and why (deepening candidates if the orchestrator asks)
- No land head named: Eastwood, BBL (n/a, contractor), Habitat (n/a). Only Inferred land names: DSLD (Brian Cohn, title unpublished), Maronda, Epcon, Hayden, Bloomfield, AMH (EVP Development Inferred).
- No finance head named: The Villages, True Homes, Bloomfield (parent-level only). Only Inferred: Adams, CBH, Castlerock (CastleRock CFO), Davidson.
- Fewer than 5 confirmed people: DSLD (5 total, 1 Verified: no leadership page).
- Maronda: 22 people but none Verified; it publishes no leadership page.
- Not public for any private builder in the slice: lot counts (except True Homes, AMH), credit facility terms, agent banks. Lenders come mostly from a county-records aggregator (Elementix) and are tagged Inferred or Reported.

## Decisions
- Separate people and financing agents for DSLD, Adams, AMH, Maronda, Bloomfield, Minto, Davidson, GL, Kolter and Castlerock; one agent for both files on the other 13.
- Light check per D7 on Opus, 1-3 builders per checking agent; web search only to find who holds a failed land or finance seat.
- Rows whose counterparty is a lot seller, developer, affiliate or client are kept in `land_banking` but typed as such, never "Land banker".
