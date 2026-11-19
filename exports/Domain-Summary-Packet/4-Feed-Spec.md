# Domain news and research feed: spec (v0.1, 2026-11-19)

**What it is.** A short ranked list of the stories that matter most to Domain: about ten per day, with a weekly view. Each story has a 0 to 100 relevance score, the reason it matters to Domain in one sentence, and links to the builders and people in the map. A cutoff control (All / 70+ / 90+) sets how much you see. Up and down votes tune it.

**What it is not.** A scrolling ticker or a keyword alert. Collection is plain scripts; the language model is used only for judgment.

## 1. Sources (free and public, collected ahead of time)

| Source | What it brings | How |
|---|---|---|
| News search (Bing News RSS) | Coverage of named builders and competitors | Builder and competitor names combined with financing terms, not "land banking" alone |
| SEC EDGAR | Millrose's filings (all of them) and 8-Ks and offering documents from 19 public builders; full-text search for "land banking", "Millrose", "lot option" in any filing | `data.sec.gov`, declared client, under 2 requests a second |
| Trade press | HousingWire, Pro Builder, Builder, Bisnow, NAHB Eye on Housing, John Burns, Zonda | RSS where offered, site-limited news search otherwise |
| Press-release wires | PR Newswire, Business Wire, GlobeNewswire | Site-limited search for notes offerings, facilities, acquisitions, appointments |
| GDELT news API | Full-text boolean search across global news | Used when its free tier is not rate-limiting |

The query sets live in `feed/queries.json`:
- **Competitors:** Millrose, Kennedy Lewis, TPG Angelo Gordon (and its Essential Housing funds), "land banking" / "land banker" with homebuilder, lot option, land-light, Forestar and other lot developers.
- **New entrants:** about 30 capital providers (Apollo, Blackstone, Brookfield, KKR, Ares, Oaktree, Värde, Starwood, Blue Owl, Sixth Street, Fortress and others) each combined with homebuilder + land / lots / financing.
- **Every builder in the top 100** combined with senior notes, credit facility, land banking, acquisition, CFO; the largest 26 also with land, lots, joint venture, ratings and earnings. Builder names come from the map's spine, so a new builder is searched automatically.
- **Builder M&A and capital markets:** acquisitions, notes offerings, facility changes, rating actions, CFO and land appointments.

Rules: last 90 days only; de-duplicated by link and by near-identical headline; robots.txt respected (Google News and Yahoo Finance feeds are excluded for that reason); no paywall workarounds; linkedin.com never opened; only title, link, publisher, date and the feed's own snippet are stored.

## 2. Junk filter (a script, before any model effort)

Drops stock-tip and price-target pieces, "fund X bought shares of Y" filler, law-firm class-action advertisements, grand openings and model homes, non-English items, and builders' 10-Q / 10-K cover entries (the map reads those). Every drop is kept in `data/feed/raw/_prefiltered.json` with the rule that dropped it, so nothing disappears silently.

## 3. Rubric and scoring

Full rubric: `feed/RUBRIC.md` (currently v1.4; each article records the version that scored it). Five sub-scores add to 100:

| Sub-score | Max | Full marks when |
|---|---|---|
| Land banking and competitors | 30 | A land-bank deal, a Millrose / Kennedy Lewis / TPG Angelo Gordon move, a new fund financing builder land |
| Builder (customer) | 25 | A top-100 builder is the subject and the story changes what Domain knows about it |
| Financing and capital markets | 25 | Notes, facilities, ratings, equity, JVs |
| Land and lot supply | 10 | Owned versus optioned mix, land spend, lot pipelines |
| Materiality and actionability | 10 | Someone at Domain could act on it this week |

Then one named cap or floor (for example: any Millrose filing or new-entrant story floors at 75; a top-50 builder's debt or land-bank deal at 70; consumer and stock-tip pieces cap at 20; routine filings cap at 45; duplicates cap at 30). Scoring agents read each candidate (opening the filing or article when the headline is not enough), write the sub-scores, a 40-word summary in their own words, one sentence on why it matters to Domain, tags, and a suggested update to the builder record when the story reports an executive change, a deal or a financing. A script adds up the score, so every number traces to five sub-scores and one named rule.

Bands: **90+** tell Bob today; **70 to 89** read this week; **40 to 69** context; **under 40** noise.

## 4. Proof it beats the keyword alert

Same 90 days, same rubric, two inputs: the plain "land banking" alert the COO uses today, and the targeted queries above.

| Same 90 days, same rubric (run 2026-11-19) | Plain "land banking" alert | Targeted feed |
|---|---|---|
| Headlines delivered | 80 | 699 (wide net by design) |
| Worth a look (40+) | 1 | 50 |
| Read this week (70+) | **0** | **25** (about 2 a week) |
| Tell Bob today (90+) | 0 | 1 |
| Noise (under 40, incl. junk-filtered) | 99% | 93% of the raw net, which the cutoff hides |
| Best story it found | 46: a HousingWire column on 2027 land negotiations | 93: Dream Finders closes its $2.2B Beazer purchase, funded partly by a $572M Millrose land-bank facility |

What the plain alert delivered instead: 40 of its 80 headlines were about city and county land bank authorities (12 on Detroit's alone); the rest included the West Bank (6), World Bank loans (3), farmland prices and sports. It missed every story in the targeted top 20: Millrose's $1B notes and Q3, Starwood and Trez's land-lending launch, Strata Land, Lennar's $60M land-banked Phoenix lots, KB Home's head of land retiring. None of them uses the phrase "land banking" in its headline.

How to read the two signal rates: the targeted collection casts a deliberately wide net (100 builders times every financing term), so most of what it collects is noise; the rubric and the cutoff remove it, and the reader only sees what is above the line. The plain alert is narrow and still almost all noise, because in the news "land bank" mostly means a city land bank authority.

Live numbers: the **Feed versus a plain "land banking" alert** tab under Insights (`data/extras/feed-vs-baseline.json`, rebuilt by `node scripts/feed-compare.mjs`).

Why the plain alert fails: "land bank" in news mostly means municipal land banks (Detroit, Kingston, Colorado's Prop 123 grants), overseas land-holding schemes, and law-firm notices; it misses the stories that matter most because they do not use the phrase: Millrose's notes offering, a builder's new credit facility, a land executive retiring.

## 5. The tuning loop

1. **Vote.** Each story has up and down arrows and an optional note ("we don't care about build-to-rent"). Votes are saved locally (`data/local/votes.json`), never overwritten by a refresh.
2. **Instant re-rank.** The app adjusts the ranking at once with a visible local rule (a voted story moves; stories that share its category and builder move a little), without waiting for a refresh.
3. **Next refresh.** Every scoring agent reads the votes before it scores: upvotes are examples of stories scored too low, downvotes of stories scored too high, notes are instructions. Voted stories can be re-scored on request.
4. **Rubric change.** When the same correction shows up three times, the rubric is changed, the change is logged at the bottom of `feed/RUBRIC.md`, and the version goes up. Every article records the rubric version that scored it.

## 6. Refresh

No API key and no live feed. Say **"refresh the Domain feed"** to a Claude session in this folder (runbook: `feed/RUNBOOK.md`; skill: `.claude/skills/refresh-feed/`). It collects, filters, scores the new candidates in parallel, rebuilds the app data, and reports what changed: new 70+ stories with their reasons, suggested updates to builder records, and anything re-scored.

## 7. Later version: subscriptions and a daily digest

- **Subscriptions** are saved filters: a threshold plus optional scope. "Send me anything 70 or higher", "anything 90+ about Lennar or K. Hovnanian", "every new-entrant story", "executive changes in land or finance roles". Each person keeps their own.
- **Daily digest** at 7 a.m.: the top ten new stories of the last day above the reader's threshold, each with score, one-line reason and link; a weekly digest on Mondays with the week's top ten and any builder records that changed.
- **Immediate alert** for 90+ stories that match a subscription (email or Teams).
- **What it needs:** a scheduled refresh (the same runbook on a timer), a sender (the firm's email or Teams), and per-person subscription settings. The scoring does not change; subscriptions only filter what is already scored.
- **Also later:** Domain's own notes and emails as a source (Tim's nightly relevance scan) feeding the same rubric, so a builder's page shows news and internal history side by side.

## 8. Known limits (first version)

- News search returns only what the search engines index for each query; small private builders get little coverage.
- Paywalled stories are scored from headline and snippet only, conservatively.
- Scores are a model's judgment against a written rubric; the first pass is expected to be wrong in places. That is what the votes are for.
