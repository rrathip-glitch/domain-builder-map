# swarm-c status (builder research, Builder 100 ranks 55-78 minus #56; 23 builders)

**State:** DONE for D7 scope (first-pass research + one light check per builder). Deepening is held until the orchestrator asks by name. **Updated:** 11:00 ET. **Percent complete:** 100% of the D7 scope.

## Final counts
- Builders with both files valid: **23 / 23** (one validator warning: a Westin land name that is Inferred with no source URL; the note explains it)
- People mapped: **315**, of which **216 Verified** (69%)
- Land heads (Land Acquisition / Development / other): **54** across **19 / 23** builders
- Finance heads (CFO / Treasury / Finance other): **36** across **21 / 23** builders
- Builders with a named land banker or competitor link: **4** (Schuber Mitchell: TPG Angelo Gordon / Essential Housing; Empire: Rooftop Capital, an owner affiliate; WestBay: GTIS JV, Inferred; Challenger: captive lender All Pro Capital)
- Builders with named lenders: **6** (Challenger, Empire, HHHunt, Schuber Mitchell, HistoryMaker via Century's revolver, Esperanza)
- Lot counts found: WestBay 11,490 · Holiday ~10,600 · Ivory 20,548 · Empire ~28,000 (company-wide)
- M&A rows: 16; deals that change the map: Holiday -> Stanley Martin/Daiwa (closed 2026-07-30), McGuinn -> Mungo/Clayton (2026-07-02), HistoryMaker -> Century (2026-10-07), View -> Hunt Companies (2025-10), Trumark bought JK Monarch (2026-03), Empire bought SouthCraft (2025-02)

## Verification (light check per D7, on opus, fresh agents; logged in status/verification.log)
- All 23 builders checked: CEO, CFO, land heads, finance heads, land-banking, lender-named debt and M&A rows.
- **191 rows checked: 170 held, 8 corrected, 12 downgraded to Inferred, 1 removed.**
- Corrections that matter:
  - McGuinn: Nate Gibson is no longer CEO. He is President of Financial Strategy after the Mungo sale (Mungo post, 2026-09-01), and no CEO is named.
  - Hakes Brothers: Kimball Hakes is President per BBB (Builder calls him CEO).
  - Trumark: CFO Colin Severn downgraded (only primary source is March 2023). The master-plan lot row no longer overstates Bishop Ranch as secured.
  - McGuinn: one land manager removed (source no longer lists him).
  - Esperanza: three bank-lender rows (Third Coast, IBC, Bank OZK) downgraded because the public-records source no longer opens.
  - WestBay: the GTIS JV is downgraded because its only source is from 2021.
  - Westin: two developer lot-source rows downgraded.
  - Long Lake: CEO Craig Jones is confirmable from snippets only.

## Thin, and why (candidates if the orchestrator orders a deepen pass)
Builders with no land head or no finance head on a Reported-or-better source:
- **First Texas Homes**: no land or finance person named anywhere public; the state record lists only the owner.
- **Westin Homes**: no finance head; the land names come only from directories.
- **Schuber Mitchell**: CFO and Chief Land Officer are directory or snippet only (ESOP-owned, quiet site).
- **Hakes Brothers**: no land executive public; CFO from directories only.
- **McGuinn**: post-sale leadership unclear; land and CFO roles not public.
- **View Homes**: site names only the CEO and CFO; land runs through parent Hunt Communities.
- **Long Lake**: 4 people; land runs through affiliate Woodmere; no finance officer public.
- **Ivory**: CFO and most staff last named in a December 2021 profile.
- **Holiday**: CFO dropped off the leadership page after the sale.
- **Trumark**: CFO not confirmed current.
- **WestBay**: new CFO unnamed.
- **NeighborWorks**: no land staff by design. It is a nonprofit network, not a land-banking customer.

Not public after a reasonable look, for nearly all 23: owned versus optioned lots, credit facility size and lenders, and treasurer / capital-markets heads. Each builder's `gaps` says so.

## Not conventional builders (mapped lightly, with a plain verdict)
- **NeighborWorks America**: congressionally chartered nonprofit network; owns no land. Not a plausible land-banking customer.
- **Lifestyle Homes (Scottsdale)**: fee-based build-to-rent general contractor; clients own the land. Not a direct customer; it could be a route to BTR land owners.

## Requests posted on BOARD.md
- Spine ownership fixes: Holiday (Stanley Martin/Daiwa), McGuinn (Mungo/Clayton), View (Hunt Companies), Empire (Willowdale, foreign), First America (Signorelli), Lifestyle (BTR contractor). Long Lake's brand leads were wrong.
- To competitor-intel: Rooftop Capital (lot-banking terms published) and the three Essential Housing / TPG Angelo Gordon deals with Schuber Mitchell.
- One question added to `status/QUESTIONS.md`: Daiwa House as a single platform (Stanley Martin, UHG, Holiday, Trumark) now that it is pulling back on US land spend.

## Decisions
- One agent wrote both files per builder, except Trumark (people agent + financing agent).
- Agents killed by the usage limit (McGuinn, Long Lake) were re-run once on opus; no duplicate launches.
- All agents launched after 10:41 ran on opus (D6/D8). The light check used web search only to replace a failed source for key people.
- United Homes Group (#56) is not in this slice (orchestrator covers it).
