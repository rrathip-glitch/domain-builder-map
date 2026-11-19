# swarm-d status (ranks 79 to 100, 22 private builders)

**State:** DONE for D7 scope. All 22 builders have valid people and fin files, and all 22 have had the one light check (fresh opus agents) with corrections applied. No deepening run, per D7; ready to deepen if the orchestrator asks. Updated 2026-11-19 11:00 ET.
**Percent complete:** 100% of the D7 scope.

## Final counts
- Builders with valid people + fin files: **22 / 22** (validator: 0 errors; 6 warnings, all snippet-only Inferred rows with no source_url and an explaining note)
- People mapped: **218** (Verified 141, Reported 35, Inferred 42)
- Land heads (Land Acquisition / Development / other): **42 across 16 builders**
- Finance heads (CFO / Treasury / Finance other): **16 across 13 builders**
- Builders with a named lender, land banker, lot seller/developer or capital partner row: **18 / 22**. **No builder in this slice has a third-party land banker or any public link to Domain, Millrose, Kennedy Lewis or TPG Angelo Gordon.** Lender names come mostly from public records (Alabama UCC filings for Stone Martin; recorded loans via a records aggregator for Riverside, Saratoga, Ball).
- M&A rows: 1 (Misawa Homes bought 51% of Visionary Homes, 2024-06, kept for context). No 2025-2026 deal found for any builder in the slice.
- Light check (CEO, CFO, land heads, finance heads, land-banking, M&A rows only): **22 builders, 194 rows checked, 175 held, 14 corrected, 3 downgraded, 2 removed. Every identity confirmed.** Log: `status/verification.log` (Park Square's line has a correction line below it: held 11, not 10).

## Corrections the check made (most material)
- national-home-corp: removed Mike Hyland as President; Michael Bergman has been CEO and president since late 2025 (HousingWire / Builder's Daily, 2026-09-09).
- veridian-homes: Bill Bublitz is CFO of parent Forgewell Building Group, and Erik Schuchardt is VP Finance at Veridian; both upgraded to Verified on forgewellbg.com.
- home-creations: removed an unsupported "buys finished lots from Houston developers" row and summary claim; COO MJ Farzaneh downgraded (sources 2021-22).
- park-square-homes: 7 fixes. Four land staff upgraded to Reported. Unsupported parent and date claims removed. "Open VP of Land seat" reworded: it is seen only in search snippets.
- american-legend-homes: Hillwood row narrowed to Treeline; the source does not say ALH builds in Ramble or Landmark.
- saratoga-homes: founder David Bombach's CEO title downgraded to Reported (only the Builder firm page says CEO).
- stone-martin-builders: CEO Frank Plan downgraded to Inferred (newest source naming him CEO is from 2023).
- lombardo-homes: President Mike Van Pamel upgraded to Reported (St. Louis Magazine, 2026-02).
- jim-chapman-construction-group, ici-homes, signature-homes: wording fixes where a row claimed more than its source.

## Identity and ownership calls (all confirmed by the check; spine mismatches posted to BOARD 10:50)
- Visionary Homes: 51% owned by Misawa Homes Co. (Japan) since 2024-06 (spine says Private).
- Signature Homes = the Hoover/Birmingham, AL company (Pro Builder lists signature.homes with the same 528 closings), not the Pleasanton one.
- Saratoga Homes: HQ El Paso, TX. National Home Corp.: Wade Jurney / Michael Bergman company, HQ now Houston (launched from Atlanta). Christopher Alan Homes: HQ Fort Myers, FL.
- Owner groups: Riverside Homebuilders (Lackland Holdings), Veridian (Forgewell Building Group), Chesapeake Homes (L.M. Sandler & Sons, sister land developer Wakefield Development), American Legend (Bright family: Bright Industries / Bright Realty).
- Jim Chapman Construction Group is a build-to-rent general contractor and lot developer, not a for-sale builder. Colen Built Development builds only on the family's own 13,000-acre Ocala ranch and calls itself debt-free. Both are weak land-banking prospects.

## Findings worth a look (for Domain)
- Most of this slice owns and develops land through owner-affiliated entities rather than option lots: Riverside (Lackland), Stone Martin (SMB Land LLC), Taber (Premium Land LLC), Olthof (Cedar Lake Development LLC), Chesapeake (Wakefield), American Legend (Bright Realty), Schell (Ocean Atlantic), ICI (land subsidiaries), Home Creations (Shaz Investments). Lackland says on its own site that it does not want new financing sources.
- San Joaquin Valley Homes is funded by Presidio Residential Capital (a 2018 source says Presidio funds all its projects). Whether that still holds in 2026 is unsettled.
- Signature Homes carries ESOP acquisition debt (.2M at end-2024). ICI Homes and David Weekley co-develop Seven Pines (Jacksonville), with the last takedown expected late 2026. Barron Collier named Christopher Alan Homes a Brightshore (Naples) builder, 2026-09. Park Square Homes' closings fell from 996 to 522 (2024 to 2025).

## What could not be found (honest list)
- **No named land head (6):** riverside-homebuilders, stone-martin-builders, home-creations, national-home-corp, colina-homes, signature-homes. Land is run by owners or affiliates and no title is published. Ball Homes' and Colen's only land rows are weak: Ball's comes from a 2012 source, and Colen's single source does not name his employer.
- **No named finance head (9):** ball-homes, colen-built-development (CFO job advertised 2025, no holder named), riverside-homebuilders, stone-martin-builders, homes-by-taber, visionary-homes, national-home-corp, colina-homes, olthof-homes. Some others are directory- or snippet-only: Home Creations' CFO, Signature's CFO, and Park Square's CFO (who may be the affiliate's).
- **Fewer than 5 people:** colina-homes (1, founder only), colen-built-development (3), homes-by-taber (4).
- **No named lender or capital counterparty at all:** lombardo-homes, veridian-homes, colen-built-development (self-described debt-free), national-home-corp (only 2022 lender names from a release, tagged Inferred; buyer-mortgage JV with loanDepot).
- **Lot counts (owned vs optioned):** not public for any builder in the slice.
- Credit-facility sizes and terms: not public for any builder in the slice. The lender names from public records show that loans exist, not their size.

## Leads for a deepening pass (not chased, per D7)
Lombardo land: Steven Valentine, Joe Klee (directory summaries). Veridian Milwaukee land: Matt Cudney (forgewellbg.com). Visionary: John B. Warnick (land), Brad Robinson (CFO). Home Creations: CEO title (MJ and Ali Farzaneh per a Builder snippet). Park Square: Kelly Thomas (land, snippet only), current CFO. Schell: Greg Tobias's current role. San Joaquin Valley Homes: current Presidio terms. County deed-of-trust searches for lender names were not run for the builders that have none.

## Where to open output
`data/builders/<id>.people.json` and `<id>.fin.json` for the ids in `status/swarm-d-assignment.json`.

## Decisions
- One agent per builder wrote both files (all 22 are private, thin footprint). Seven first-pass agents hit the usage limit at about 10:40 ET with nothing written; all 7 re-ran on opus and finished by 10:58 ET.
- Per D6/D7/D8: every agent after 10:45 ran on opus. One light check per builder, 2 to 4 builders per agent (6 agents in all). No deepening.
