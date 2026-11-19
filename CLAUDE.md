# Domain builder map: how a Claude session works in this folder

This folder holds a sourced map of the top 100 US homebuilders (people, org structure, financing, M&A), a scored news feed, competitor profiles and insight tables, built for Domain Real Estate Partners (a land banker). It is a personal project that lives inside an unrelated repo: work only inside `domain-intel/`, never push, and ask before deploying or publishing.

## Answering questions straight from the data

Do not browse the app to answer a question. Read the merged file:

- `data/dist/domain.json`: `builders[]` (each with `rank`, `tier`, `profile`, `people[]`, `financing`, `ma[]`), `people[]` (flat, with `builder_id`), `competitors[]`, `ma_industry`, `feed.articles[]`, `extras[]` (insight tables).
- `data/dist/coverage.json`: totals and per-builder coverage.
- It is large (about 9 MB). Query it with a short `node -e` script instead of reading it whole, for example:

```
node -e "const d=require('./data/dist/domain.json');const b=d.builders.find(x=>x.builder_id==='lennar');console.log(b.people.filter(p=>p.level==='Regional').map(p=>p.name+' | '+p.title+' | '+p.geography))"
```

Rules for answers: quote the fact, its confidence tag (Verified, Reported, Inferred) and its source link; say "not publicly disclosed" when the data says so (see each builder's `gaps`); never fill a gap from memory.

Useful questions this answers directly: who runs land or finance at a builder; every regional head and what they cover; which builders are publicly linked to which land banker; what debt comes due and when; what changed at a builder (its `ma[]`, feed stories tagged with its `builder_id`); who to call (the `call-sheet` insight table).

## Common requests

| Say | What happens | Where it is written down |
|---|---|---|
| "Refresh the Domain feed" | collect, score with votes as tuning examples, rebuild | `feed/RUNBOOK.md`, skill `refresh-feed` |
| "Map / deepen / add `<builder>`" | sourced research into `data/builders/` | skill `map-builder`, `BUILDER-BRIEF.md` |
| "Verify `<builder>`" | a fresh agent re-opens sources and corrects | skill `verify-builder` |
| "Rebuild" | `npm run build` (data, insight tables, workbook) | `README.md` |
| "Deploy" (only when asked) | `./deploy.sh` to the hosted copy behind the PIN | `deploy.sh`, `app/gate.mjs` |

## Ground rules

- Data contract and confidence rules: `SCHEMA.md` (frozen v1). Research rules: `BUILDER-BRIEF.md` (public sources only, never open linkedin.com, no paywall workarounds, no contact with anyone).
- `data/local/` holds votes and Domain's internal notes entered in the app; never overwrite it.
- `domain_internal_notes` fields are for Domain's own people; do not fill them.
- Coordination history from the build day is in `BOARD.md`, `STATUS.md`, `status/` and `TIPS.md`.
