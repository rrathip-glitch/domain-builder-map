# competitor-intel status

**State:** DONE (first version). All files exist, parse, carry sources and tags; the independent 15-row source check ran and its fixes are applied. Further deepening only if the orchestrator asks (D7).
**Percent:** 100. **Updated:** 12:05 ET (no-link fix).

## Open these
| File | What | Rows now |
|---|---|---|
| `data/competitors/millrose-properties.json` | Teardown from SEC filings (Form 10/424B1, 10-K, 10-Qs, 8-K exhibits incl. the master agreements, credit agreement, indentures), earnings calls | 262 facts (216 Verified), 21 builder relationships, 10 debt instruments, 17 people |
| `data/ma_industry.json` | Builder M&A Jan 2025 to 2026-11-19 | 28 deals, 11 after the ranking, 22 touch a top-100 builder |
| `data/competitors/kennedy-lewis.json` | KL private land-banking (Fund III/IV, KLRES), allocation vs Millrose | 38 facts, 7 builders, 13 people |
| `data/competitors/tpg-angelo-gordon.json` | TPG AG land banking | 33 facts, 17 builders (most from county LLC names, tagged Inferred), 6 people |
| `data/competitors/new-entrants.json` | Apollo (Olympus Housing Capital), Blackstone, Blue Owl/Hearthstone, Guggenheim/Bedrock, Starwood/Trez, Strata, Walton, Forestar and more; one fact row per firm, firm name leads | 73 facts, 17 builders, 36 people |
| `data/competitors/domain-real-estate-partners.json` | Domain's public footprint | 42 facts, 12 builders, 22 people |
| `data/extras/millrose-pricing-and-terms.json` | Lennar vs other builders: yield, rate formula, deposits, pools, walk-away, flexibility, cost of debt, covenants | 21 rows |
| `data/extras/competitor-builder-matrix.json` | Every top-100 builder x Domain / Millrose / KL / TPG AG / others, white-space flag (estimate) | 100 rows: 19 with a named land banker, 3 more with other financing only, 9 white space |
| `data/extras/competitor-builder-links.json` | Every builder-financier link with its own source | 75 rows, each labelled Land banking or Other financing (no-link, indirect, unnamed and non-financing rows left out) |

Regenerate everything: `node scripts/competitor-assemble.mjs && node scripts/competitor-extras.mjs` (the second alone is enough as builder files land; it skips files that do not parse).

## Headlines for the Domain team
- Millrose: Lennar 63.5% of $9.25B at a fixed 8.5%; 21 other builders at 10.8% floating with ~10% floors and ~10% deposits; 95-96% of capital in cross-termination pools; zero walk-aways reported. Only 5 non-Lennar names are public.
- Millrose now pairs land banking with corporate capital: $1.07B for Dream Finders' Beazer takeover incl. a $488M 12% perpetual preferred. Leverage 36% vs the 33% ceiling it stopped repeating; no equity below book.
- Lennar's filed founder rights cap its money at risk per pool ($50M seed / $25M new) and give it a most-favoured-rate right on Millrose's third-party pricing.
- New entrants: Apollo's Olympus Housing Capital (June 2025) is led by a Domain co-founder per Apollo's release; Blackstone, Blue Owl/Hearthstone, Guggenheim, Starwood/Trez and Strata all entered in 2026.
- Map-changing M&A after the ranking: Berkshire bought Taylor Morrison (#6) and is folding Clayton (#12) builders under it; Dream Finders (#14) bought Beazer (#21); Sumitomo bought Tri Pointe (#19); Stanley Martin bought UHG (#56) and Holiday (#62); Clayton/Mungo bought McGuinn (#65); Century bought HistoryMaker (#77).

- TPG Essential Housing (TPG AG) decks posted by a pension fund: ~20% first-loss deposits (about double Millrose's ~10%), options under 40 months, EHF-4 $2bn first close Q3 2026 toward $3bn+.
- Millrose's "Other Agreements" overstates independence: in 2025, builders independent of Lennar paid only 12% of option fees ($69.4M of $570.9M).
- **For Domain's own attention:** a May 2024 Domain one-pager marked not for general distribution downloads without login from insuranceaum.com (median rate, term, monthly net returns 2016-2024, fee model, client names). See `domain-real-estate-partners.json`.

## No-link fix (12:05 ET, orchestrator request)
`scripts/competitor-extras.mjs` now applies the same no-link rule as `scripts/build.mjs`: a row whose opening statement or text records no link ("No public link found", "no public source says...", "people link only", "indirect", "none found", "no financing relationship") or names an unnamed/aggregate counterparty is never a link. Also excluded: part-owners, master developers, a partner of someone else, people-only ties (e.g. Strata led by a former Landsea president), Kennedy Lewis rows that only restate that it manages Millrose, a builder's own land arm, and any snippet-only row naming Domain. Each link now has a **Link type**: "Land banking" (land-bank, lot-option or homesite-option arrangement) or "Other financing (not land banking)" (term loans, JV equity, preferred, EB-5). In "Who banks whom" the four firm cells read "Land banking (...)" or "Other financing only (...)", and the white-space flag looks at land bankers only.
Effect: links 87 -> 75; builders with a named land banker 24 -> 19, plus 3 with other financing only (Kolter/EB5AN, Homes by WestBay/GTIS, SJV Homes/Presidio). Removed false positives include Hovnanian, Beazer and Risewell "No public link found" rows naming Domain, Taylor Morrison/Millrose "indirect" row, Risewell/Olympus, Empire/Rooftop, Risewell/Strata, Perry/Brookfield, Kolter/Brookfield and Trez, Brookfield Residential's own land arm.
One judgement call: **K. Hovnanian is shown as linked to Domain, tagged Inferred, dated 2015-10**, on the strength of the October 2015 Hovnanian-Domain announcement of a $125M land-banking arrangement (in the Domain profile; also the only builder filing on EDGAR that names Domain). It is historical, not current. The app build's own count may treat it differently; `npm run build` re-run clean at 12:05 (build reports 22 builders with any named financier, which includes the 3 other-financing-only builders). `millrose-pricing-and-terms.json` was not affected.

## Builders shown as linked to the four firms (generated 2026-11-19T17:01Z from data/extras/competitor-builder-links.json after the no-link fix)

One line per builder and firm: link type, the strongest confidence tag, then every supporting source. Inferred rows rest on old, derived or registry-only evidence; read them as leads.

### Domain Real Estate Partners
- **Lennar Corp.** (#2): Land banking; strongest tag **Verified**. Sources: Reported 2026-01 https://commercialobserver.com/2026/01/lennar-cc-homes-sunrise-solterra/ · Verified 2026-03 https://domainrealestatepartners.com/press.html · Verified 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf
- **PulteGroup** (#3): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf
- **Toll Brothers** (#9): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf
- **Ashton Woods Homes** (#11): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf
- **Clayton Properties Group** (#12): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf
- **Hovnanian Enterprises** (#16): Land banking; strongest tag **Inferred**. Sources: Inferred 2015-10 https://ca.marketscreener.com/quote/stock/HOVNANIAN-ENTERPRISES-INC-12965/news/Hovnanian-Enterprises-and-Domain-Real-Estate-Partners-Announce-125-Million-Land-Banking-Arrangement-21165954/
- **David Weekley Homes** (#17): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-04 https://insuranceaum.com/sites/default/files/2024-05/Domain%20One-Pager%20-%20May%202024.pdf

### Millrose Properties
- **Lennar Corp.** (#2): Land banking; strongest tag **Verified**. Sources: Verified 2026-09 https://www.sec.gov/Archives/edgar/data/2017206/000119312526432747/ck0002017206-ex99_1.htm · Verified 2026-08 https://www.sec.gov/Archives/edgar/data/920760/000162828026064557/R15.htm · Verified 2025-02 https://www.sec.gov/Archives/edgar/data/920760/000162828026003870/R17.htm · Verified 2025-02 https://www.sec.gov/Archives/edgar/data/2017206/000201720626000002/ck0002017206-20251231.htm · Verified 2026-08 https://www.sec.gov/Archives/edgar/data/2017206/000119312526378466/d83131d8k.htm · Verified 2025-02 https://www.sec.gov/Archives/edgar/data/2017206/000119312525068773/d931976d10k.htm · Verified 2025-02 https://www.sec.gov/Archives/edgar/data/2017206/000119312526447297/R11.htm · Verified 2025-02 https://www.sec.gov/Archives/edgar/data/2017206/000201720626000002/R14.htm · Inferred 2025-12 https://www.sec.gov/Archives/edgar/data/2017206/000201720626000002/R38.htm
- **Taylor Morrison** (#6): Land banking; strongest tag **Verified**. Sources: Verified 2025-07 https://newsroom.taylormorrison.com/2025-07-23-Taylor-Morrison-and-Kennedy-Lewis-Investment-Management-Agree-to-Financing-Facility-for-Build-to-Rent-Communities · Verified 2025-07 https://www.sec.gov/Archives/edgar/data/2017206/000095017025100569/ck0002017206-ex99_2.htm
- **Dream Finders Homes** (#14): Land banking; strongest tag **Verified**. Sources: Verified 2026-10 https://www.sec.gov/Archives/edgar/data/1825088/000162828026069387/R21.htm · Verified 2026-10 https://www.sec.gov/Archives/edgar/data/2017206/000119312526447297/R27.htm · Reported 2026-08 https://stocktitan.net/news/MRP/millrose-properties-announces-land-banking-capital-support-for-dream-o2644oikf7kl.html · Verified 2026-10 https://www.sec.gov/Archives/edgar/data/2017206/000119312526432747/ck0002017206-ex99_2.htm · Verified 2026-10 https://www.sec.gov/Archives/edgar/data/1825088/000162828026066548/dream-20261020.htm · Verified 2026-09 https://www.sec.gov/Archives/edgar/data/1825088/000162828026061981/dream-20260914.htm
- **Beazer Homes** (#21): Land banking; strongest tag **Verified**. Sources: Verified 2026-10 https://www.sec.gov/Archives/edgar/data/2017206/000119312526432747/ck0002017206-ex99_1.htm · Verified 2026-10 https://www.sec.gov/Archives/edgar/data/2017206/000119312526432747/ck0002017206-ex99_2.htm · Reported 2026-08 https://finviz.com/news/379360/millrose-properties-to-provide-capital-support-for-dream-finders-homes-announced-acquisition-of-beazer-homes-with-up-to-125-billion-commitment
- **Risewell Homes** (#27): Land banking; strongest tag **Verified**. Sources: Verified 2025-06 https://www.sec.gov/Archives/edgar/data/2017206/000201720626000002/R14.htm · Verified 2025-06-25 https://www.sec.gov/Archives/edgar/data/2017206/000119312526432747/ck0002017206-ex99_2.htm · Verified 2025-06 https://www.sec.gov/Archives/edgar/data/1721386/000173112225000715/e6593_ex99-1.htm

### Kennedy Lewis
- **Lennar Corp.** (#2): Land banking; strongest tag **Reported**. Sources: Reported 2021 https://hntrbrk.com/breaking-news/lennar-millrose
- **Taylor Morrison** (#6): Land banking; strongest tag **Verified**. Sources: Verified 2025-07 https://investors.taylormorrison.com/news-and-events/news/news-details/2025/Taylor-Morrison-and-Kennedy-Lewis-Investment-Management-Agree-to-Financing-Facility-for-Build-to-Rent-Communities/default.aspx · Verified 2025-07 https://newsroom.taylormorrison.com/2025-07-23-Taylor-Morrison-and-Kennedy-Lewis-Investment-Management-Agree-to-Financing-Facility-for-Build-to-Rent-Communities
- **Dream Finders Homes** (#14): Land banking; strongest tag **Verified**. Sources: Verified 2026-08 https://www.sec.gov/Archives/edgar/data/1825088/000162828026054558/dream-20260806.htm
- **Stanley Martin Homes** (#18): Other financing only (not land banking); strongest tag **Verified**. Sources: Verified 2026-05-04 https://www.sec.gov/Archives/edgar/data/1830188/000110465926054519/tm2613353d1_8k.htm
- **Beazer Homes** (#21): Land banking; strongest tag **Verified**. Sources: Verified 2026-08 https://www.sec.gov/Archives/edgar/data/1825088/000162828026054558/dream-20260806.htm
- **Risewell Homes** (#27): Land banking; strongest tag **Verified**. Sources: Verified 2025-05 https://www.sec.gov/Archives/edgar/data/1721386/000114036125020285/ny20049177x1_ex99b1.htm
- **United Homes Group** (#56): Other financing only (not land banking); strongest tag **Verified**. Sources: Verified 2024-12 https://www.sec.gov/Archives/edgar/data/1830188/000110465924127664/tm2430715d1_8k.htm

### TPG Angelo Gordon
- **Lennar Corp.** (#2): Land banking; strongest tag **Verified**. Sources: Verified 2020-10 https://www.sec.gov/Archives/edgar/data/0000920760/000162828021000722/len-20201130x10kxexh1012.htm · Reported 2026-03 https://newsletter.hntrbrk.com/p/what-lennar-owes · Reported 2023-12 https://commercialobserver.com/2024/01/tpgangelogordon-41-acres-purchase-socal/ · Verified 2026-03 https://sbcera.legistar.com/View.ashx?M=F&ID=15307088&GUID=958E1BB0-C566-40E7-B141-DF1DD34975AD · Reported 2026-09 https://ktar.com/?p=5908764 · Inferred 2023-12 https://commercialobserver.com/2023/12/calif-housing-tpg-angelo-gordon/ · Verified 2025-08 https://www.tdlr.texas.gov/TABS/Search/Project/TABS2025026082
- **PulteGroup** (#3): Land banking; strongest tag **Inferred**. Sources: Inferred 2024-05 https://therealdeal.com/miami/2024/05/13/pultegroups-divosta-plans-145-homes-in-palm-beach-county · Inferred 2024-04 https://therealdeal.com/national/phoenix/2024/04/12/david-weekley-and-varde-buy-606-home-lots-outside-phoenix
- **Meritage Homes** (#5): Land banking; strongest tag **Inferred**. Sources: Inferred 2026-04 https://www.tdlr.texas.gov/TABS/Search/Project/TABS2026017834
- **Toll Brothers** (#9): Land banking; strongest tag **Reported**. Sources: Reported 2023-12 https://commercialobserver.com/2024/01/tpgangelogordon-41-acres-purchase-socal/ · Reported 2023-12 https://commercialobserver.com/2023/12/tpg-angelo-gordon-buys-plot-socal-34m/
- **Century Communities** (#10): Land banking; strongest tag **Inferred**. Sources: Inferred 2025 https://bizfileonline.sos.ca.gov/api/report/GetImageByNum/060125151179101185068005243026080173193126245191
- **Hovnanian Enterprises** (#16): Land banking; strongest tag **Inferred**. Sources: Inferred 2021-11 https://www.corporationwiki.com/p/3bhsht/ag-ehc-ii-hov-multi-state-1-llc
- **Risewell Homes** (#27): Land banking; strongest tag **Inferred**. Sources: Inferred 2025-03 https://www.bizprofile.net/ny/new-york/tpg-ag-ehc-iii-26 · Inferred 2025-04 https://www.bizprofile.net/ny/new-york/tpg-ag-ehc-iii-35
- **Empire Homes** (#61): Land banking; strongest tag **Inferred**. Sources: Inferred 2026-05 https://agendalink.fortbendcountytx.gov/docs/2026/CCTR/20260514_4087/67904%5F051426%5FPlat%5FTalon%5FRidge%5FSec%5F1%2Epdf
- **Schuber Mitchell Homes** (#70): Land banking; strongest tag **Reported**. Sources: Reported 2026-10 https://talkbusiness.net/2026/10/real-deals-100-lots-in-pea-ridge-sell-for-8-08-million/ · Reported 2026-02 https://talkbusiness.net/2026/02/real-deals-143-lots-in-pea-ridge-sell-for-10-5-million/ · Reported 2025-12 https://talkbusiness.net/2025/12/real-deals-tontitown-lots-sell-twice-in-one-day-for-combined-15-76-million/ · Inferred  https://www.builderonline.com/?p=170593 · Inferred 2025-11 https://www.builderonline.com/land/schuber-mitchell-homes-establishes-land-banking-partnership-with-essential-housing/

## Independent source check (11:05 ET, fresh Opus agent, 15 random rows across all files)
Result: 6 hold, 9 partly hold, 0 fail, 0 unreachable; 1 wrong tag. Every partial had the core fact right but added a detail the cited page does not state (pulled from another source the agent had read). All 9 rewritten to what the cited source says (via `curation.json` `edit_text`, so re-runs keep them). Systemic fixes: Verified tags on aggregator reprints (Finviz, StockTitan, Yahoo Finance, transcript sites) now auto-downgrade to Reported. **Read the profiles with that in mind: numbers are reliable; secondary details inside a long row may come from a sibling source in the same profile rather than the one linked.**

## What is thin and why
- Shared web-search budget ran out mid-run for most agents, so: builder-by-builder sweeps for Millrose/KL/TPG mentions in other builders' 10-Ks were partial; ranks ~30-100 got no name-by-name M&A search; small private M&A (JTW counts 18 US deals in 2025, we have 13) is incomplete.
- builderonline.com, BusinessWire and several IR sites returned 403; www.sec.gov blocks curl from this machine (read via WebFetch / data.sec.gov / IR mirrors instead).
- Millrose `gaps` list 10 source conflicts between its own filings (e.g. Rausch homesites 24k vs 25k, New Home land $522.8M vs '$700M', Dream Finders preferred $525M vs $500M); not reconciled.
- Not public anywhere: Millrose per-builder rates, deposits and sizes for its 16+ unnamed counterparties; KL and TPG AG private-fund pricing and book size.

## Decisions
- New entrants are one `new-entrants.json` with one fact row per firm (firm name leads each fact and each builder-relationship description), not one file per firm.
- Millrose debt table comes from the one agent that owned the capital stack, to avoid duplicate instruments.
- M&A: Berkshire's ~11% Lennar stake and Builders FirstSource's purchase of Pulte's ICG unit are kept but described as minority stake / supplier divestiture (no rank row changes).
- Research agents wrote fragments to scratch; `scripts/competitor-assemble.mjs` merges them, drops any row without an http source or a valid tag, and matches builder names to spine slugs. Hand fixes live in `extras/competitor-work/curation.json` so re-runs keep them.

## Blockers
None.
