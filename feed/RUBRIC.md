# Feed relevance rubric v1.4 (Domain Real Estate Partners)

Scores answer one question: **how much should someone at a top-three land banker care about this story today?** Domain finances homebuilders' land and lots. Its customers are the top 100 builders (named relationships: K. Hovnanian, Lennar). Its competitors are Millrose Properties (public, managed by Kennedy Lewis) and TPG Angelo Gordon, plus any new entrant putting capital into builder land or builder lending (the CEO's example: Apollo).

Score = sum of five sub-scores (max 100), then apply caps.

| Sub-score | Max | Full marks when | Partial | Zero |
|---|---|---|---|---|
| `land_banking_competitor` | 30 | The story is directly about land banking or lot-option financing: a land-bank deal, a Millrose / Kennedy Lewis / TPG Angelo Gordon move, another land banker's move (Hearthstone, AG Essential Housing, Blue Owl or any fund doing builder option deals), a new fund or entrant financing builder land, pricing or terms of option deals | Competitor named in passing; adjacent private-credit-to-builders news; lot developers and land sellers to builders such as Forestar or Five Point (10 to 18) | No land-banking or competitor angle |
| `builder_customer` | 25 | A named top-100 builder is the subject and the story changes what Domain knows about it (strategy, land appetite, leadership in land or finance). Named Domain relationships (K. Hovnanian, Lennar) and top-25 builders score highest | Builder is one of several mentioned; small or unranked builder (5 to 12) | No specific builder |
| `financing_capital_markets` | 25 | Builder debt issuance, redemption, credit-facility change, rating action, equity raise, JV or other capital event; or a capital-markets shift that reprices builder funding | Earnings commentary on leverage, liquidity, buybacks (8 to 15) | No financing content |
| `land_lot_supply` | 10 | Owned versus optioned lot mix, land spend, land-light targets, lot pipelines, M&A that moves lot positions | Community count or land commentary in passing (3 to 5) | None |
| `materiality_actionability` | 10 | Large, new, and someone at Domain could act on it this week (call the builder, reprice, brief investors) | Notable but no action (4 to 6) | Routine or stale |

## Caps and floors

- Not about housing, land or builder finance at all (other industries, politics, sport, a product recall), and public land banks (city, county or state land bank authorities, housing-authority or conservation land banking, overseas land-hoarding rules), which share the name but are not Domain's business: cap 10 (`cap10-off-topic`).
- Generic housing-market or macro story with no named builder, including macro credit, rates and spreads stories that name no builder: cap 40 (`cap40-generic`).
- Consumer real estate, community grand openings, model-home or award PR, charity, stock-tip and "top stocks to buy" pieces, price-target notes: cap 20.
- Routine filings with no new information for a land banker (a 10-Q or 10-K cover entry with nothing extracted, an 8-K that only sets an earnings date, reports a shareholder vote or a bylaw change; a regular dividend declaration): cap 45 (`cap45-routine-filing`). This cap wins over the Millrose and competitor floors: a routine Millrose filing is still routine. An earnings 8-K is scored on what the release says about lots, land spend, leverage and liquidity.
- Law-firm "shareholder alert" advertisements are not stories: drop them. The underlying event (for example a securities suit against a competitor) is scored once, from the best source.
- Duplicates and syndicated copies of the same event, within a batch or of a story already in the feed (point `duplicate_of` at the existing article id): keep the best source (primary filing or release first), drop or cap the rest at 30 and point to the kept one.
- A land banker's deal with a named builder (Millrose or anyone else), or a new entrant launching a dedicated platform or fund to finance US builder land or lend to US builders: floor 85 (`floor85-competitor-deal`).
- Any Millrose filing, release or earnings call; any filing or release by another land banker; any other story of a new entrant financing US builder land or lending to US builders: floor 75 (`floor75-competitor`). A capital provider's activity outside US builder land and builder lending (for example a UK development-lending team, an aviation or camper-van deal) gets no floor.
- A homebuilder acquisition, merger or sale announced or closed in the window where a top-50 builder is the acquirer or the target: floor 75 (`floor75-builder-ma`). Commentary on a deal that closed before the window is scored on its sub-scores.
- New debt issuance, a new, amended or upsized credit facility, a rating action, or a land-bank deal by a top-50 builder: floor 70 (`floor70-financing`). Mechanical follow-ons of a deal already in the feed (exchange offers, consent solicitations, redemption of the target's notes) and debt simply repaid at maturity get no floor.
- The head of land, CFO, treasurer, president/COO or CEO changing at a top-25 builder: floor 75 (`floor75-exec-top25`).
- An executive change in a land or finance role at a top-100 builder: floor 65 (`floor65-exec`).

## Bands (what the cutoff buttons mean)

- 90 to 100: tell Bob today. Competitor deals, new entrants, a customer's land-bank or debt move.
- 70 to 89: read this week. Material builder financing, M&A, land strategy shifts, relevant executive changes.
- 40 to 69: context. Earnings colour, market data with a builder angle.
- Under 40: noise for Domain.

## Every scored article also gets

- `why_it_matters`: one sentence, specific to Domain ("Lennar is moving more lots to Millrose, which shrinks the share open to Domain").
- `category`, `builder_ids` (slugs from `data/spine.json`), `people` (names that appear in the map), `competitors`.
- `suggested_update` when the story reports an executive change, a deal or a financing that should change a builder record.

## Tuning loop

Votes and notes from the app (`data/local/votes.json`) are tuning examples. At each refresh the scorer reads them first: upvoted articles are examples of under-scored patterns, downvoted of over-scored, and notes are instructions. Between refreshes the app re-ranks instantly with a transparent local adjustment (see `feed/SPEC.md`). When the same correction shows up three times, change this rubric and bump the version.

## Change log

- **v1.4 (2026-11-19, from the plain-alert baseline and the independent sample check).** (1) Public land banks (Detroit's Land Bank Authority and 39 other city, county and state stories in the plain alert) are now explicitly `cap10-off-topic`; scorers had been reaching the same result by different rules. (2) A regular dividend declaration is a routine filing, and the routine cap beats the Millrose floor (the checker found the rubric as written would have floored Millrose's $0.79 dividend at 75). (3) Scorer instructions now require every figure in a summary, why-it-matters line or suggested update to come from the item itself; the sample check found figures borrowed from related filings and unsourced judgments (none wrong, but not traceable).

- **v1.3 (2026-11-19, from 520 scored items).** (1) No floor covered builder M&A, so Dream Finders closing its Beazer purchase scored 51 on sub-scores while a mechanical note redemption from the same deal was floored at 70: added `floor75-builder-ma` for deals in the window involving a top-50 builder, and removed the financing floor from mechanical follow-ons and maturities. (2) The new-entrant floor lifted Pretium's UK development-lending hire to 75: floors now require US builder land or builder lending. (3) Added `cap10-off-topic` for items from other industries that keyword search lets in, so they can never drift into "context". (4) The top-25 executive floor now includes president/COO (Century Communities named a new president). (5) Macro credit and rate stories with no builder named are explicitly `cap40-generic`.

- **v1.2 (2026-11-19, from the first 140 scored items).** Scorers found three places where the rubric contradicted its own bands. (1) A new-entrant platform with no named builder could not pass 75 because the builder sub-score is zero, yet the bands put new entrants at 90+: added a floor of 85 for a land banker's deal with a named builder and for a new entrant's dedicated builder-land platform (example: Starwood and Trez Capital's residential land-lending partnership). (2) Only Millrose had a floor; other land bankers (Hearthstone with Blue Owl capital, AG Essential Housing) landed in the 40s: the 75 floor now covers any land banker's filing or release, and earnings calls count as releases. Lot developers such as Forestar and Five Point get partial competitor credit (10 to 18). (3) The top land executive of the seventh-largest builder retiring with no successor scored 65, inside "context": added a floor of 75 for land, finance and CEO changes at top-25 builders.

- **v1.1 (2026-11-19, first scoring pass).** Added the routine-filing cap (45): collecting every 8-K from 19 public builders brought in procedural filings that the floors would otherwise have lifted. Added the rule that law-firm class-action advertisements are dropped and the underlying event scored once: a suit against Millrose produced dozens of near-identical law-firm releases. Each scored item now names the single cap or floor applied (`adjustment`), and the build script does the arithmetic, so a score can always be traced to its sub-scores and one named rule.
- **v1 (2026-11-19).** First draft from the meeting transcript.
