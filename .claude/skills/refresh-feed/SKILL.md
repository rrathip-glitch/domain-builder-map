---
name: refresh-feed
description: Refresh the Domain news and research feed: collect new stories, score them against the rubric (reading votes as tuning examples), rebuild the app data and report what changed. Use when asked to "refresh the Domain feed", "update the feed", "score the new stories", "re-score with my votes", or "run the baseline comparison".
---

# Refresh the Domain feed

Work in the project root (the folder that holds `feed/`, `scripts/` and `data/`). Full detail is in `feed/RUNBOOK.md`; these are the steps. Do not ask the user questions along the way; make the sensible choice and say what you chose in the report.

## Rules
- Free public sources only. Never open linkedin.com. Never work around a paywall or bot check. Do not put the user's name or email in any request.
- Scripts collect; you and your subagents judge. Never hand-edit `data/feed/articles.json`: it is built by `scripts/feed-build.mjs`.
- Never touch `data/local/` except to read `votes.json`.

## Steps

1. **Collect.** Run `node scripts/feed-collect.mjs` in the background (about 30 minutes; `--tier 1` is the 10-minute priority version: competitors, new entrants, SEC filings, the largest builders). It prints one line per query group and a merged count at the end.
2. **Filter and cut batches.** `node scripts/feed-prefilter.mjs` (add `--rescore-voted` if the user asked for votes to be applied to stories already scored). It prints how many were dropped by rules, how many are already scored, and how many batches are waiting.
3. **Score.** For each `data/feed/batches/batch-*.json` that has no file of the same name in `data/feed/scored/`, start one subagent (run them in parallel, up to about ten at a time) with this prompt, filling in the name:

   > You are a feed scorer on the Domain feed project. Project folder: `<absolute project root>` (work only inside it; write only your one output file). Read `feed/SCORER-PROMPT.md` and follow it exactly. Your batch: `data/feed/batches/<name>.json`. Write your output to `data/feed/scored/<name>.json`. Today is `<date>`.

   If `data/local/votes.json` exists, the scorer prompt already tells them to read it first. When all have finished, check that every batch has a scored file; re-run any that is missing or invalid.
4. **Same-event pass.** Start one subagent: "Read `data/feed/scored/*.json` joined to `data/feed/raw/_candidates.json` by id. Among items whose sub-scores sum to 60 or more, find groups that report the same event (same company, same transaction or announcement, within a few days). For each group pick the one to keep (SEC filing, then company release, then trade press, then news; prefer the one whose summary has the most facts) and write `data/feed/clusters.json` as `{ "clusters": [ { "event": "", "keep": "<id>", "duplicates": ["<id>"] } ] }`. Merge with clusters already in that file." The build caps duplicates at 30 and points them at the kept story.
4b. **Plain headlines.** One subagent adds a plain headline to `data/feed/title-fixes.json` for each new SEC filing scoring 40+ (company + form + what happened, from the item's own summary; key = scored id from `data/feed/id-map.json`).
4c. **Spot check** (after a large refresh). A fresh subagent that did not score opens 10 random articles (5 at 70+, 3 at 40-69, 2 under 40) and checks link, title, date, publisher, every figure and the score. Write corrections as full entries in `data/feed/scored/review-<YYYYMMDD-HHMM>.json`; later files override earlier ones.
5. **Build.** `node scripts/feed-build.mjs --stats`. Fix anything it lists under problems (usually by re-running one batch).
6. **Rebuild the app data.** `npm run build` (or `npm run build:data` to skip the workbook). Then `node scripts/feed-compare.mjs` if baseline batches were scored.
7. **Report** to the user from `data/feed/changes.json` and the stats line: how many candidates were collected, how many were new, how many scored 70+ and 90+; the new 70+ stories, each with its score and why-it-matters sentence; suggested updates to builder records; anything re-scored by 10 points or more; and any source that failed.

## Votes
`data/local/votes.json` is `{ "<article id>": { "vote": 1 | -1, "note": "", "ts": "" } }`. Scorers treat votes as worked examples and notes as instructions. If the same correction appears three times, propose a change to `feed/RUBRIC.md`, make it, add a line to the change log at the bottom of that file, and bump `data/feed/rubric-version.json`.

## Comparison against the plain alert (when asked, or monthly)
`node scripts/feed-collect.mjs --baseline`, then `node scripts/feed-prefilter.mjs --baseline`, score the `base-*` batches as in step 3, then `node scripts/feed-compare.mjs`. It writes `data/extras/feed-vs-baseline.json` and prints the signal rates.
