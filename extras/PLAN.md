# Above and beyond: build plan for the five insight tables

Chosen 2026-11-19 from 40 candidates across five seats (Bob, deal team, asset manager, CEO, Tim). Each addition is one JSON table in `data/extras/<id>.json` (contract: end of `SCHEMA.md`), shown by the app under Insights and exported as a workbook sheet.

## How the five were chosen

- Merged first. All five seats proposed the mandate re-rank and the M&A relationship table; four proposed the cost-of-debt gap; three proposed a maturity or walk-away watch.
- Not duplicated. The `competitor-intel` session already ships `competitor-builder-matrix` (who banks whom, white space), `competitor-builder-links` (every public link with amount, lots, date) and `millrose-pricing-and-terms`. The deal tape, wallet share, new-entrant radar and Millrose terms card would repeat those, so they are not in the five (two cheap column additions are suggested under Runners-up).
- One table per user: investor mandates, selling, underwriting, asset management, and Bob's weekly list. Competitor watch runs through tables 2 and 3 and the three existing competitor tables.

| # | id | For | Est. build |
|---|---|---|---|
| 1 | `mandate-screen` | CEO, COO, deal team, Tim (mandate test) | 25 min |
| 2 | `ma-in-play` | Bob (selling), asset managers (protect), competitor watch | 30 min |
| 3 | `rate-gap` | Deal team (underwriting, two-tier product), Bob (which pitch) | 30 min |
| 4 | `counterparty-watch` | Asset managers, CEO before an investor call | 30 min |
| 5 | `call-sheet` | Bob and his team, weekly | 30 min, built last |

## Shared build rules

- One script, `scripts/extras-build.mjs`, reads `data/dist/domain.json` only and writes each table atomically (temp file then rename) to `data/extras/`. Safe to re-run as builder files land. Run `node scripts/build.mjs` afterwards so the app and workbook pick the tables up. Do not edit `scripts/competitor-extras.mjs`; copy its `canon()` and `UNNAMED` rules so financier names match the competitor tables.
- Judgement is a curated input, not a runtime call. Anything an agent has to read and decide (whole-company deal or partial, rating action up or down, which note a debt issuance refers to) goes in `extras/curation.json`, keyed by builder and row, with the sentence it was read from. The script applies it; a re-run gives the same answer.
- Constants: today = 2026-11-19; ranking published May 2026; "last 90 days" = on or after 2026-08-21; "last 6 months" = on or after 2026-05-19; "last 12 months" = on or after 2025-11-19.
- Every table: `is_estimate` as stated below, inputs shown as columns, a `confidence` column (the lowest tag among the rows used) and a `source_url` column. A blank input gives a blank cell, never a zero. The subtitle states coverage (for example "debt data for 41 of 100 builders").
- Allowed column types only: `builder_link | text | number | pct | usd_m | date | confidence | url | person`. A `builder_link` cell is a `builder_id`; use `null` for a company not in the map and confirm the app shows it blank.
- "Named land bankers" everywhere = canonical names from `builders[].financing.land_banking[]` (type Land banker or Investor, counterparty named), `builders[].financing.competitor_links[]` and `builders[].competitor_relationships[]`. "No known banker" always means none found in public sources.
- "Who to call" everywhere = from `builders[].people[]`: `priority_group` Finance (Treasury/Capital Markets before CFO) or Land, `level` Corporate first, Verified before Reported before Inferred. Show name, title and the person's tag. If none, print "not publicly disclosed".

---

## 1. `mandate-screen`

**Title:** Mandate screen: who clears a top-25 or top-50 cutoff after the deals since the list
**Pitch:** The list Domain tests mandates against went stale the day a deal closed; this shows who qualifies now, who is one place from a line, and how the answer changes if the test is at parent level.
**Who uses it:** CEO and COO with investors; deal team before spending time on a builder near a cutoff; Tim as a reference table for Darwin. `is_estimate: true`, `order: 15`.

**Inputs**
- `builders[]`: `builder_id`, `rank`, `tier`, `closings`, `rank_prev`, `ownership`, `parent`, `housing_giants_rank`, `spine.note`, `spine.source_url`, `derived.land_bankers`.
- `ma_industry.deals[]`: `date`, `acquirer`, `acquirer_builder_id`, `target`, `target_builder_id`, `status`, `after_ranking`, `description`, `confidence`, `source_url`. Cross-check with `builders[].ma[]` (`role`, `counterparty`, `status`, `after_ranking`).

**Computation**
1. Deal list = `ma_industry.deals[]` plus any `builders[].ma[]` row not already there (match on normalised acquirer + target). Keep `after_ranking` true and `status` Closed or Announced. In `curation.json` mark each deal whole-company or partial (division, assets, land); partial deals change nothing.
2. Three cases, decided per deal by reading it:
   - A. Ranked builder buys ranked builder (Dream Finders/Beazer, Century/HistoryMaker, Stanley Martin/United Homes, Stanley Martin/Holiday): pro forma closings of the acquirer = own + target's. The target keeps a row, flagged "Absorbed: now tests as <acquirer>, pro forma rank N", and leaves the rank order.
   - B. A parent that is not a ranked homebuilder buys a ranked builder (Berkshire/Taylor Morrison, Sumitomo Forestry/Tri Pointe, Daiwa/CastleRock): closings and brand rank unchanged; flag "New parent"; the parent roll-up in step 5 applies. Warning: the M&A file may carry `acquirer_builder_id: clayton-properties-group` on the Berkshire deal. Do not add Taylor Morrison's closings to Clayton.
   - C. Ranked builder buys a builder outside the top 100: closings unchanged, note "target closings not in ranking; acquirer understated".
3. Closed deals are applied. Announced deals go in a separate "if completed" rank column and are not applied.
4. Sort the remaining rows by pro forma closings (ties keep published order) to get pro forma rank and tier. Vacated places at the bottom are described in the method note as "open; builders ranked 101 and below are not in the data".
5. Parent roll-up: group rows that share an ultimate parent using a small hand map in `curation.json` (Berkshire Hathaway, Sumitomo Forestry, Daiwa House, Sekisui House, Dream Finders, Century). Parent closings = sum; parent rank = the place that sum would hold in the pro forma list.
6. Nearest cutoff = 25 or 50, whichever is closer in rank. Gap = own pro forma closings minus the closings of the first builder outside the line (if inside) or of the last builder inside (if outside), in closings and as a percent of own closings.
7. Flag, first match: Absorbed / Tier up / Tier down / New parent / Boundary watch (pro forma rank 22 to 28 or 47 to 53, or gap within 5%) / No change.

**Columns:** pro forma rank (number), builder (builder_link), published rank, published tier, closings, deal since the list (text), deal status, pro forma closings, pro forma tier, rank if announced deals complete, flag, nearest cutoff, gap in closings, gap % (pct), parent, parent closings, parent-level rank, Pro Builder revenue rank (the other published list), named land bankers, confidence, source (url).

**Method-note caveats**
- Domain's mandate wording is not public (which list, which year, brand or parent, tested at signing or continuously). The table shows published, pro forma and parent-level side by side and does not decide eligibility. This is a question for the COO.
- Closings are added, with no allowance for overlap or timing. Organic growth is not forecast; boundary watch is proximity only.
- Builders ranked 101 and below are not in the data, so the table shows that a place opened, not who takes it.

**How to check** (on today's spine and the M&A fragments in `extras/competitor-work/frag/`; `data/ma_industry.json` was not on disk at planning time, so recompute and do not hard-code)
- Dream Finders 8,608 + Beazer 4,427 = 13,035, moving from 14 to 6, just above Taylor Morrison at 12,997.
- With Beazer absorbed, Green Brick (3,943) moves from 26 to 25 and Hancock Builders (1,374) from 51 to 50. Both cross a tier line without closing one more home; Hancock sits only 21 closings ahead of Edge Homes (1,353), the next builder outside.
- Sum of pro forma closings over ranked rows equals the sum of published closings. Ranked rows + absorbed rows = 100.
- Berkshire at parent level = 12,997 + 9,953 = 22,950, above NVR's 21,915. Taylor Morrison's brand rank moves only because Dream Finders passes it.

---

## 2. `ma-in-play`

**Title:** Relationships in play: what each builder deal since 2025 does to who finances the land
**Pitch:** Every acquisition forces a decision about the target's lots and its land banker; this lists each deal with who financed whom before, whether a land banker carried the deal, and who now makes the call.
**Who uses it:** Bob (an opening with a date on it), asset managers (a relationship that just changed hands), CEO (where a competitor gained a larger platform). `is_estimate: true`, `order: 12`.

**Inputs**
- `ma_industry.deals[]` (all fields) and `builders[].ma[]`, 2025 to date, where either side is in the top 100.
- For each side in the map: named land bankers (shared rule), `financing.land_banking[]` (`counterparty`, `counterparty_type`, `description`, `amount_usd_m`, `lots`, `date`, `confidence`, `source_url`), `financing.capital_events[]` where `type` = Land-bank deal, `financing.lots` (`owned`, `optioned`, `pct_optioned`), `ownership`, `parent`, `people[]`.
- `competitors[].builder_relationships[]` (`builder_id`, `description`, `amount_usd_m`, `lots`, `date`, `confidence`, `source_url`).

**Computation**
1. One row per deal (de-duplicate on normalised acquirer + target; keep the higher-confidence source).
2. Financier sets: A = acquirer's named land bankers, T = target's. If a side reports land banking without naming the banker, print "uses land banking, banker not named".
3. Deal financed by: a land-banking row, a Land-bank deal event or a competitor relationship row dated within 6 months of the deal date whose description names the other party or the acquisition. Record firm, amount and lots. Tag the match with the source row's tag if the source states the link; otherwise Inferred.
4. Call, first match wins:
   - "Domain link (public)": Domain Real Estate Partners is in A or T.
   - "Taken: financed by <firm>": step 3 found a match.
   - "Parent-funded": the acquirer is a corporate or foreign parent, not a ranked builder (or `ownership` is Subsidiary of foreign company / Subsidiary of public company). Print "parent capital may replace third-party land banking; target's bankers at risk".
   - "Two bankers, one treasury": A and T both named and different.
   - "Inherited, open to re-bid": T named, A empty.
   - "Acquirer's banker gains lots": A named, T empty.
   - "Open: no known banker on either side".
   Prefix "Open window" when `status` is Announced; those sort first, then by date descending.
5. Lots that may move off balance sheet (rough) = target `lots.owned` x acquirer `lots.pct_optioned` / 100; blank unless both exist.
6. Who to call = the acquirer's finance head and land head (shared rule). Contacts in flux = count and top two names of the target's Land and Finance people.

**Columns:** date, acquirer (text), acquirer record (builder_link or null), target (text), target record (builder_link or null), status, target rank, target's bankers, acquirer's bankers, deal financed by, financed amount (usd_m), financed lots, acquirer ownership, target owned lots, acquirer % optioned (pct), lots that may move (number), call (text), who to call (person), title, target contacts in flux (text), confidence of the call (confidence), source (url).

**Method-note caveats**
- The call is a rule applied to public facts, tagged Inferred unless a source states it. The rule order is printed.
- "No known banker" is not "no banker". Targets outside the top 100 have no lot or banker data and read "not in map".
- "Lots that may move" assumes the acquirer applies its own owned/optioned mix to the target's land; it is a sizing guess. The note reports how many listed deals had the land carried by a land banker, counted from the rows.

**How to check**
- Dream Finders/Beazer must read "Taken: financed by Millrose Properties" with about $1,068M and 7,000 lots (Millrose profile, 2026-10). Lennar/Rausch Coleman (2025-02) must show Millrose as well.
- Berkshire/Taylor Morrison and Sumitomo Forestry/Tri Pointe must read "Parent-funded".
- Row count = distinct deals in `ma_industry.deals[]` plus any extra from builder files; open three sources and confirm date, parties and status.

---

## 3. `rate-gap`

**Title:** Price to beat: each builder's own cost of money against the land-bank yield Millrose discloses
**Pitch:** Shows, builder by builder, how much more land-bank capital costs than the builder's own debt, which tells the deal team where a two-tier rate matters and tells Bob whether to sell on price or on balance sheet.
**Who uses it:** Deal team pricing a quote and looking for the next two-tier (acquisition, development and construction) candidate after K. Hovnanian; Bob choosing the argument. `is_estimate: true`, `order: 13`.

**Inputs**
- `builders[].financing.debt[]`: `instrument`, `type`, `principal_usd_m`, `rate`, `maturity`, `secured`, `status`, `as_of`, `confidence`, `source_url`.
- `builders[].financing.capital_events[]` where `type` = Debt issuance (`date`, `description`, `amount_usd_m`).
- `builders[].financing.key_metrics` (`credit_ratings`, `net_debt_to_capital_pct`), `financing.lots.pct_optioned`, named land bankers, `rank`, `tier`.
- `competitors[]` where `competitor_id` = `millrose-properties`: `facts[]` with `topic` = Pricing (latest Verified `as_of`), and `debt[]`.

**Computation**
1. Parse `rate`. Fixed coupon = the leading percentage when the string has no SOFR, base rate, prime, floating or "weighted average" wording. Anything else is kept as text. Count unparsed rows per builder.
2. Weighted average fixed coupon = sum(principal x coupon) / sum(principal) over rows with `status` Outstanding, `type` Senior notes or Term loan, a parsed coupon and a principal. Convertibles and preferred are left out of the average (their coupons are not a cost of debt) and shown as text.
3. Marginal coupon = the coupon on the most recently issued fixed-rate note: match the latest Debt issuance event to a debt row by coupon and maturity year (recorded in `curation.json`); fallback is the outstanding fixed note with the latest maturity. Show the instrument, the issue year and which rule was used.
4. Revolver pricing = the margin text as recorded (for example "SOFR + 1.45% to 2.30%"), plus the all-in rate only when the row states one. No SOFR assumption is made.
5. Benchmark = Millrose's weighted-average yield on Other Agreements (non-Lennar builders), read from the latest Verified Pricing fact: 10.8% at 2026-09-30. Lennar's own row uses its contractual 8.5% and says so.
6. Gap in points = benchmark minus marginal coupon.
7. Reading: gap of 2 or less "near own cost of debt: sells on price"; 2 to 4 "moderate premium"; over 4 "wide premium: sells on balance sheet and returns, not price".
8. Two-tier candidate = revolver or project-debt pricing is stated, gap is 3 or more, and the builder already uses land banking or has 50% or more of lots optioned. K. Hovnanian is labelled "Domain's first two-tier deal (reference)".
9. Header block in the method note, each number with its as-of date: Millrose yields (8.5% Lennar, 10.8% other builders, 9.3% total); Millrose's own cost = principal-weighted coupon of its outstanding notes; the 1.25% management fee on tangible assets; yield minus cost; and the most-favoured-rate clause (a lower rate to another customer can be claimed by Lennar on new projects within 180 days), which makes Lennar's rate a practical floor on what Millrose can quote.
10. Sort by gap, smallest first. Builders with only floating or bank debt are listed with text and a blank gap. Builders with no debt rows are left out and counted in the subtitle.

**Columns:** builder (builder_link), rank, tier, credit ratings (text), fixed notes counted (number), weighted average coupon (pct), marginal coupon (pct), marginal instrument (text), issue year and rule (text), secured or unsecured (text), revolver pricing (text), preferred or convertible (text), benchmark yield (pct), gap in points (number), % of lots optioned (pct), named land bankers (text), reading (text), two-tier candidate (text), rate rows not parsed (number), confidence, source (url).

**Method-note caveats**
- A coupon set at issue is not today's market yield; old low-coupon notes flatter the builder. The issue year is shown for that reason.
- An option fee is not like-for-like with a coupon: the land is off balance sheet, the builder holds an option and not an obligation, and the land banker carries development funding. The gap is directional.
- The benchmark is one competitor's portfolio average, not a market quote and not Domain's pricing.
- Coverage is public builders and the few private ones with 144A notes.

**How to check**
- Recompute the weighted average by hand for two builders from their debt rows (Ashton Woods has seven).
- The benchmark cell equals the latest Verified Pricing fact in the Millrose profile, with the same as-of date.
- No floating-rate string appears as a number. Preferred and convertible rows (for example a 12% preferred) appear as text, not in the average.

---

## 4. `counterparty-watch`

**Title:** Counterparty watch: refinancing wall and walk-away flags for every builder
**Pitch:** One row per builder with what falls due in 12 and 24 months against liquidity, plus six plain flags for the conditions under which a builder walks from its options.
**Who uses it:** Asset managers (a Monday scan), the CEO before an investor call, the deal team as a first credit screen; the refinancing-window column is also a reason to call the treasurer. `is_estimate: true` (the debt and liquidity columns are facts; the flags are judgement), `order: 14`.

**Inputs**
- `builders[].financing.debt[]` (`type`, `principal_usd_m`, `maturity`, `secured`, `status`, `instrument`, `confidence`, `source_url`), `derived.next_maturity`.
- `builders[].financing.key_metrics` (`liquidity_usd_m`, `cash_usd_m`, `total_debt_usd_m`, `net_debt_to_capital_pct`, `credit_ratings`, `as_of`).
- `builders[].financing.lots` (`pct_optioned`, `years_supply`), `financing.capital_events[]` (`type` Rating action, Buyback; `date`, `description`).
- `builders[].ma[]` (role Target), `ownership`, `parent`, `spine.note`; `builders[].people[]` (`in_role_since`, `priority_group`, `level`).
- `feed.articles[]` (`builder_ids`, `category`, `score`, `published`, `url`), named land bankers.

**Computation**
1. Maturity date: YYYY-MM is month-end, YYYY is year-end. Due in 12 months = sum of principal on Outstanding rows, excluding Revolver and Mortgage warehouse, maturing on or before 2027-11-30; due in 24 months the same to 2028-11-30. Revolver expiry within 18 months is shown in its own column as a facility expiry, not as debt due.
2. Coverage = liquidity / due in 24 months. Blank if either is missing; "none due" if debt rows exist and nothing falls due.
3. Flags, each with its input in a column and each marked not assessable when the input is missing:
   - Refinancing: due in 24 months is more than half of liquidity (coverage under 2.0x).
   - Leverage: net debt to capital of 45% or more.
   - Secured-heavy: secured share of Outstanding principal over 50% (mortgage warehouse excluded).
   - Option-heavy with long supply: 60% or more of lots optioned and 5 or more years of supply. This measures room to walk, not weakness.
   - Negative rating action in the last 12 months (downgrade or outlook to negative; read by an agent and stored in `curation.json` with the sentence).
   - Change at the top: acquired or under agreement since the ranking, or a CFO, treasury or corporate land head in seat since 2025-11.
4. Status: Watch at three or more flags, Monitor at two, Stable at one or none, but only when at least four of the six are assessable; otherwise "Not enough public data". A buyback in the last 12 months is noted beside the status as an offsetting sign.
5. Quadrant from option use (50% or more = high) and stress (Refinancing or Leverage raised): high and stressed "walk-away risk"; low and stressed "needs capital, underwrite carefully"; high and strong "wallet-share fight"; low and strong "land-light conversion target".
6. Refinancing window open = nearest note or term-loan maturity is 18 months away or less. Who to call = treasury or capital-markets head, else CFO (shared rule).
7. Latest story = the highest-scored feed article in the last 90 days tagged to the builder in Capital markets & ratings or Earnings & guidance (link only, no flag).
8. Sort by flags raised, then by due in 24 months.

**Columns:** builder (builder_link), rank, tier, status (text), flags raised (number), flags assessable (number), which flags (text), quadrant (text), next maturity instrument (text), next maturity (date), months away (number), due in 12 months (usd_m), due in 24 months (usd_m), liquidity (usd_m), coverage (number, x), net debt to capital (pct), secured share (pct), % optioned (pct), years of lot supply (number), ratings and last action (text), change at the top (text), revolver expiry (date), refinancing window (text), who to call (person), title (text), named land bankers (text), latest story (url), metrics as of (date), confidence, source (url).

**Method-note caveats**
- Thresholds are judgement with no back-test; they are printed so the asset managers can move them.
- The table shows conditions for a walk-away, not dollars exposed: option deposits at risk are not in public data.
- Coverage is mainly public builders. Private builders mostly read "Not enough public data", which is not the same as stable. The subtitle counts builders with no public debt data.
- Revolver amounts are commitments as disclosed and are never added to debt due.

**How to check**
- Hand-sum due in 24 months for three builders from their debt rows.
- No builder with fewer than four assessable inputs carries Watch, Monitor or Stable.
- Dream Finders (net debt to capital 48.1%) must raise Leverage. Every raised flag has its number visible in the same row.

---

## 5. `call-sheet`

**Title:** This week's call sheet: a reason, a name and a first line
**Pitch:** The 25 to 30 builders with a dated reason to call now, the person to call, and an opening line built from the event itself. It re-ranks every time the feed is refreshed.
**Who uses it:** Bob and his team. It is the page that joins the map, the feed and the four tables above. `is_estimate: true` (events and names are sourced; the ranking is judgement), `order: 11`. Build last.

**Inputs**
- Rows of `ma-in-play`, `counterparty-watch` and `mandate-screen` (pro forma tier, absorbed status).
- `builders[].financing.land_banking[]`, `financing.capital_events[]`, `competitor_relationships[]`, `financing.competitor_links[]`.
- `builders[].people[]` (`name`, `title`, `role_category`, `priority_group`, `level`, `in_role_since`, `phone`, `email`, `email_confidence`, `confidence`, `source_url`).
- `feed.articles[]` (`category`, `score`, `published`, `builder_ids`, `competitors`, `people`, `suggested_update`, `url`), `builders[].suggested_updates`.

**Computation**
1. Triggers per builder, each with a date, a one-line fact and a source:
   - Competitor deal (weight 30): a land-banking row, Land-bank deal event or competitor relationship dated on or after 2026-05-19 with a financier other than Domain; or a feed article scored 70 or more that names a competitor and the builder.
   - New in seat (25): a Land or Finance person at Corporate level (or a regional land head) with `in_role_since` on or after 2025-11; or a feed article in category Executive change, or a suggested update of kind Executive change, in the last 90 days.
   - M&A (20): the builder is the acquirer (or the target under a new parent) on an `ma-in-play` row whose call is Open window, Inherited, or Open.
   - Refinancing window (15): `counterparty-watch` shows the window open.
   - Financing event (10): a Debt issuance, Facility amendment, Redemption or Rating action in the last 90 days.
2. Score = weight of the best trigger + recency (10 on the day, falling in a straight line to 0 at 90 days; M&A and maturity triggers use the deal date and today) + tier bonus (pro forma top 25 +10, top 50 +5) + 5 when two or more trigger types are present. Keep the best trigger; list the rest in "also".
3. Person: for New in seat, that person. Otherwise the shared who-to-call rule with land head first, then treasury or capital markets, then CFO. Absorbed builders route to the acquirer's people.
4. Opener: one fixed template per trigger type, filled only with the trigger row's own fields (instrument, counterparty, amount, date). No free-written claims.
5. Builders with a public Domain link stay on the list, labelled "existing relationship (public)". Contact details are only those the company publishes; a pattern-built email keeps its Inferred tag.
6. Row confidence = the lower of the trigger's tag and the person's tag. Rows with an Inferred person are shown and flagged "confirm before calling". Keep the top 30 by score.

**Columns:** priority (number), builder (builder_link), pro forma tier (text), trigger (text), trigger date (date), what happened (text), person (person), title (text), published phone or email (text), opener (text), named land bankers (text), also (text), score (number), confidence, source (url).

**Method-note caveats**
- The weights are a first guess, printed in full, and meant to be changed by Bob. The list ranks reasons to call; it does not predict who needs capital.
- `in_role_since` is recorded for about a third of people, so New in seat leans on the feed.
- A name tagged Inferred may be out of date. Nobody was contacted in building this.

**How to check**
- Each row's source opens and states the event. Each person appears in that builder's people list with the same title.
- No opener contains a fact that is not in the trigger row.
- Re-run after a feed refresh and confirm the order changes only where a new article or date explains it.

---

## Runners-up (in order; build only if the five are finished and checked)

1. **`takeout-bench` (deal team, asset managers).** For each market, which other top-100 builders are active and who the local decision-maker is, with a thin-bench flag under four builders. It is the land banker's remedy when a builder walks. From `builders[].profile.markets[]`, `states[]`, `regions[]` and Division or Regional `people[]`. Held back because market names are free text and need a checked synonym list; many private builders will only resolve to state level.
2. **`warm-paths` (Bob).** People whose `prior_role` names another top-100 builder or a land banker, with K. Hovnanian and Lennar alumni first. A concrete reading of "networks". Held back because `prior_role` is filled for about a third of people, and a wrong "moved from X" in front of people who know these executives costs more than the table earns. If built, show only matches an agent has read, each with the source of the current-role row.
3. **`step-two-intake` (Tim, asset managers).** The ranked blanks only Domain's people can fill, turned from `gaps[]` into questions per builder (for example Ashton Woods' $601M of sale-and-option-back lots with investors it does not name). Cheap and deterministic; it supports phase two more than it wins business, so it ranks third.

Two column additions for the `competitor-intel` tables, in place of separate tables: implied dollars per lot (`amount_usd_m` x 1,000,000 / `lots`, where both exist, with the count of usable rows in the subtitle) on `competitor-builder-links`; and first-seen and last-seen dates per financier, so a new name stands out.

## For the roadmap slide (needs internal data or new sources)

- **Wallet share.** Public data gives the denominator (optioned lots) and the named competitors; Domain's own share per builder sits in Darwin.
- **Look-through leverage.** Builder credit with land-bank obligations put back on the balance sheet. Disclosed land-bank dollars are too thin outside the largest publics; needs Domain's own exposure and deal terms.
- **Live price to beat.** Bond market yields (TRACE) in place of coupons at issue, and Domain's own pricing in place of Millrose's average.
- **Mandate test wired to the real wording.** Each fund's cutoff, list and test date from Darwin, run against the pro forma ranking automatically.
- **Entity crosswalk.** Every alias, web and email domain mapped to one builder ID, so emails and Granola notes resolve to a builder by lookup before any model reads them. The join key for the context layer.
- **Chat-ready builder cards with a routing index.** A 500-word card per builder and a 100-row index, so a chat session loads one card and not the whole record.
- **Bank dependency map.** Which banks agent which builders' revolvers; needs syndicate lists from credit-agreement exhibits.
- **Benchmark leave-behind.** A one-page peer comparison Bob can hand a builder CFO; needs Domain's review before anything goes to a customer.
- **Relationship review page.** What changed in 180 days plus the asset manager's answers written into the internal notes field.
- **Collector precision and vote audit.** Noise rate per query and per publisher, and the three-vote rule for changing the rubric; needs votes to accumulate. Sits beside Tim's prospect-portal loop.
- **Job-change alerts and subscriptions.** "Tell me when a mapped land or finance head moves", delivered with the daily digest.
