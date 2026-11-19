# Feed runbook: "refresh the Domain feed"

Say **"refresh the Domain feed"** to a Claude session opened in this folder. The session follows `.claude/skills/refresh-feed/SKILL.md`, which is this runbook as steps. Nothing runs live and there is no API key: scripts collect, Claude sessions judge, the app reads a file.

A refresh is incremental. Stories already scored are kept; only new candidates are scored; stories older than 90 days fall out.

## The steps

| # | Step | Command or action | Takes |
|---|---|---|---|
| 1 | Collect | `node scripts/feed-collect.mjs` (everything) or `node scripts/feed-collect.mjs --tier 1` (competitors, new entrants, SEC filings, the 26 largest builders) | about 30 min full, 10 min tier 1 |
| 2 | Filter junk, cut batches | `node scripts/feed-prefilter.mjs` | seconds |
| 3 | Score | One scoring agent per file in `data/feed/batches/batch-*.json`, each told to follow `feed/SCORER-PROMPT.md` and write `data/feed/scored/<same name>.json`. Scorers read `data/local/votes.json` first. | about 5 to 10 min per wave of batches |
| 4 | Same-event pass | One agent reads the titles of everything scoring 60+ and writes `data/feed/clusters.json` (which stories are the same event, which source to keep) | 5 min |
| 4b | Plain headlines for filings | One agent writes `data/feed/title-fixes.json` (`{ "<scored id>": "Millrose 8-K: Q3 net income $130M…" }`) for every SEC filing scoring 40+, from each item's own summary | 2 min |
| 4c | Spot check (after big refreshes) | A fresh agent that did not score opens 10 random articles and checks link, date, publisher, every figure and the score; fixes go in a `data/feed/scored/review-<date>.json` file (later files override earlier ones) | 10 min |
| 5 | Build | `node scripts/feed-build.mjs --stats` writes `data/feed/articles.json` (temp file, then rename) and `data/feed/changes.json` | seconds |
| 6 | Rebuild the app data | `npm run build` | seconds |
| 7 | Report | Read `data/feed/changes.json` and tell the user: how many new stories, the new 70+ ones with their why-it-matters lines, suggested updates to builder records, anything re-scored | 1 min |

Optional, monthly: rerun the comparison against the plain alert.
`node scripts/feed-collect.mjs --baseline`, `node scripts/feed-prefilter.mjs --baseline`, score the `base-*` batches the same way, then `node scripts/feed-compare.mjs` (writes `data/extras/feed-vs-baseline.json`).

## How votes change the next refresh

1. In the app, the up and down arrows (and an optional note) are saved to `data/local/votes.json`. The feed re-ranks at once using a local adjustment; nothing is re-scored at that moment.
2. At the next refresh every scorer reads the votes before scoring: an upvote is an example of a story scored too low, a downvote of one scored too high, and a note is an instruction ("we do not care about build-to-rent").
3. To re-score stories that were voted on, add `--rescore-voted` in step 2. Their old scores are replaced.
4. When the same correction shows up three times, change `feed/RUBRIC.md`, add a line to its change log, and bump the version in `data/feed/rubric-version.json`. Every article records the rubric version that scored it.

## Tuning what is collected

Everything is in `feed/queries.json`: competitor names, new-entrant names, the terms combined with each builder, trade-press feeds, SEC companies, and the junk rules. Builder names come from `data/spine.json`, so a builder added to the map is searched at the next refresh with no other change.

## Files

| File | What |
|---|---|
| `feed/queries.json` | Query sets and junk rules (edit to tune collection) |
| `feed/RUBRIC.md` | The scoring rubric and its change log |
| `feed/SCORER-PROMPT.md` | What each scoring agent is told |
| `data/feed/raw/` | What the collector returned, one file per query group; `_candidates.json` is the merged set; `_prefiltered.json` shows what the junk rules dropped and why |
| `data/feed/batches/`, `data/feed/scored/` | Scoring work in and out |
| `data/feed/articles.json` | The scored feed the app reads |
| `data/feed/changes.json`, `data/feed/stats.json` | What changed in the last build; counts and signal rates |
| `data/local/votes.json` | Votes and notes from the app (never overwritten) |

## Rules the collector keeps

Free public sources only. A robots.txt check and a per-host rate limit on every request. SEC EDGAR with a declared client at under two requests per second. No article pages are opened by the collector; it stores title, link, publisher, date and the feed's own snippet. It never opens linkedin.com and never works around a paywall. Scorers may open an article to judge it and write a short summary in their own words.

## If something goes wrong

- A source returns nothing: the collector logs it and carries on; check the log lines printed at the end of step 1. `data/feed/raw/<group>.json` shows what each group returned.
- A scorer's file is not valid: `feed-build.mjs` skips it and lists it under problems; re-run that batch.
- The app shows an old feed: run step 5, then step 6. `articles.json` is only ever replaced whole.
