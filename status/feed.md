# status/feed.md (session: feed)

## FINAL (11:43 by machine clock)

**Done**
- `data/feed/articles.json`: 545 scored articles over the 90-day window; 50 at 40+, 25 at 70+, 1 at 90+. Every collected batch is scored, including the deep-collection additions. The top 30 has one story per event (23 same-event clusters). Every article has a score and an ISO published date (0 missing). 225 articles carry `builder_ids`: the scorers' tags plus a name tagger in the build.
- Collector: one command, `node scripts/feed-collect.mjs` (plus `--deep` and `--baseline`), plain Node 22 with no keys or npm dependencies. It checks robots.txt and rate-limits each host; EDGAR is called with a declared client.
- Baseline comparison: `data/extras/feed-vs-baseline.json`. The plain "land banking" alert returned 80 headlines, 0 at 70+, 1 at 40+, and its best story scored 46. The targeted feed has 25 at 70+ and 50 at 40+. The numbers are also in `feed/SPEC.md`.
- Sample check by a fresh agent (`data/feed/sample-check.json`): 10 random articles. All links, titles, dates and publishers were right; 7 of 10 passed outright. All fixes are applied, including 3 fact errors (`data/feed/scored/review-20261119-1145.json`, `-1146.json`).
- `feed/SPEC.md`, `feed/RUNBOOK.md` and `.claude/skills/refresh-feed/SKILL.md` are written. The rubric is v1.4, with its change log at the bottom.
- App data rebuilt with `npm run build:data`; the app's data includes all 545 feed articles.

**Not done, and why**
- Wave-1 and wave-2 items below the top 30 are not re-scored under v1.4. They were scored under v1.1 to v1.3, and the later versions only added caps and floors that the review passes applied to everything scoring 45+. Each article's `scored_by` records the version that scored it.
- Builders ranked 27 to 100 have thin coverage: 80 stories for 74 builders. That is a limit of public news coverage, not of the collector. Deeper coverage would need local business-journal sources, which are often paywalled.
- GDELT was never used: it returned rate-limit errors (HTTP 429) all day. Google News and Yahoo Finance RSS are excluded because their robots.txt files disallow automated access.

**Could not be verified**
- Four stories were scored from headline and snippet only, because their pages were paywalled or blocked: The Real Deal, Seeking Alpha, and some Business Journals pages. Those scores are conservative.
- Two facts rest on one secondary source. AGWIP is described as "Lennar's land banker", and whose capital stands behind AGWIP is unconfirmed. Hearthstone is treated as Five Point's land-banking arm.
- Only 10 articles were independently re-opened. Facts in other summaries were checked by their own scorers, not by a second agent.

**Refresh request (one line):** `refresh the Domain feed` (said to a Claude session opened in `domain-intel/`)

---

**State (11:43 machine clock): DONE.** `data/feed/articles.json`: 545 scored articles over the 90-day window, 25 at 70+ (about 2 a week), 1 at 90+; top 30 de-duplicated (one story per event); every article has a score and a published date; filings carry plain headlines. App data rebuilt (`npm run build:data`: feed 545). Collector runs clean from one command (`node scripts/feed-collect.mjs`; priority set, all 100 builders, `--deep`, `--baseline`). Baseline comparison done (`data/extras/feed-vs-baseline.json`): plain "land banking" alert 80 headlines, **0** at 70+, best story 46; targeted feed **25** at 70+. Independent sample check passed after fixes. Spec, runbook and skill written. Rubric v1.4.
**Running now:** nothing. **Left (optional, later):** re-score wave-2 items under v1.4 only if votes ask for it; more private-builder sources (local business journals) if Domain wants deeper coverage of ranks 27-100.
**Percent complete:** 100%.

## Where to open
- Scored feed (the app reads it): `data/feed/articles.json` (replaced whole by temp file + rename, SCHEMA shape exactly)
- What changed in the last build: `data/feed/changes.json`; counts and signal rates: `data/feed/stats.json`
- Spec: `feed/SPEC.md` (with the comparison numbers) · Runbook: `feed/RUNBOOK.md` · Skill: `.claude/skills/refresh-feed/SKILL.md`
- Rubric: `feed/RUBRIC.md` (v1.2, change log at the bottom) · Scorer instructions: `feed/SCORER-PROMPT.md`
- Collector: `node scripts/feed-collect.mjs` (queries in `feed/queries.json`) → `scripts/feed-prefilter.mjs` → scorers → `scripts/feed-build.mjs`; comparison `scripts/feed-compare.mjs`

## Counts (12:00)
- Collected: 699 unique targeted candidates in the 90-day window (1,133 raw results, ~1,240 polite requests); 260 dropped by junk rules before any model effort; plain alert: 80 unique.
- Scored: ~660 targeted + 80 baseline, by about 35 agents · In feed: 545 · 40+: 50 · 70+: 25 · 90+: 1.
- SEC filings scoring 40+ now carry plain headlines (`data/feed/title-fixes.json`) instead of item numbers.
- Builder links: 200 of 512 articles carry builder_ids (29 builders); a deterministic tagger in the build now adds any ranked builder named in the title, summary or why-it-matters, on top of the scorers' tags.
- The all-100 sweep found little news for builders ranked 27 to 100 (80 items for 74 builders): most private regional builders are rarely covered in the 90-day window. That is a real finding, not a collection gap.

## Top stories so far (all opened and checked by scorers)
- Dream Finders closed its Beazer acquisition (Oct 20), funded partly by a $572M Millrose land-bank facility plus $675M of convertible preferred (Millrose bought ~$488M of 12% preferred).
- Millrose Q3: $9.9B homesites under option; ~42% outside Lennar at ~10.8% yield; $1B senior notes (6.50% 2029 / 6.75% 2031); $250M buyback.
- New entrants: Starwood Capital + Trez Capital land-loan partnership ($450M seed, $1B+/yr target); Strata Land (Wafra/Hunt) launched; AREC raised $390M for lot and land deals; TPG Essential Housing IV got a $200M commitment.
- Lennar's land banker AGWIP bought 444 Phoenix lots for $60M; Hunterbrook short report on Lennar–Millrose transactions.
- KB Home's EVP Real Estate (top land executive) retires Nov 30, no successor named.

## Sample check (fresh agent, did not score; report in `data/feed/sample-check.json`)
- 10 articles, stratified random (5 at 70+, 3 at 40-69, 2 under 40). All 10 links, titles, dates and publishers correct.
- Fixed: Millrose Q3 said 22 non-Lennar counterparties (it is 21); LGI revolver counted the $175M accordion inside commitments (it is on top, capped at $1.3B); a Millrose dividend score was only defensible after a rubric fix (v1.4: routine cap beats the Millrose floor).
- Also fixed: an unsupported Hunterbrook characterisation, an unsourced "leverage above target" line, an unsupported "owns most of its land" line, a wrong people tag, a summary cut mid-sentence, and figures borrowed from Millrose's release now attributed to it. Scorer instructions now require every figure to come from the item itself.

## Decisions made (no questions asked)
- **Google News RSS and Yahoo Finance RSS are not used**: their robots.txt disallow automated access. News search runs on Bing News RSS (short queries + a keyword guard, because Bing pads thin results with unrelated headlines) and GDELT when it is not rate-limiting (it mostly is).
- SEC EDGAR via `data.sec.gov` and EDGAR full-text search (www.sec.gov was rate-blocking the swarm).
- Builders' 10-Q/10-K cover entries are filtered out of the feed (the map reads those filings); 8-Ks and offering documents stay.
- Scorers output five sub-scores plus one named cap/floor; a script adds them up. Rubric moved to v1.2 and then v1.3 (change log in the rubric) after scorers showed new entrants could never reach the 90+ band the rubric itself assigns them (see change log).
- Law-firm class-action ads are dropped; the underlying Millrose/Lennar securities suit is scored once from the best source.

- Every article must have a score and an ISO published date (checked in the build: 0 missing) so the app can sort by relevance or date.
- Auto builder tagging skips names too generic to match safely (The Villages, True Homes, View Homes, Edge Homes, Empire Homes, Signature Homes, Legend Homes, Home Creations, Lifestyle Homes, National Home Corp); scorers still tag those by hand.

## Blockers
- None.
