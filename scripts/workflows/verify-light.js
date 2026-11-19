export const meta = {
  name: 'verify-light',
  description: 'Light independent check of the highest-stakes rows for each builder against cited sources',
  phases: [{ title: 'Verify' }],
}
const ROOT = '/Users/rathiprajakumar/Desktop/RWorks/domain-intel'
const results = await parallel(args.builders.map((b) => () => agent(
  `You are an independent checker for a research database on US homebuilders built for a land-banking firm. You did not do the research. Today is 2026-11-19. Work only inside ${ROOT}/.

Read ${ROOT}/.claude/skills/verify-builder/SKILL.md, ${ROOT}/SCHEMA.md (confidence rules) and the source rules in ${ROOT}/BUILDER-BRIEF.md (never open linkedin.com; no paywall or bot-check workarounds), and skim ${ROOT}/TIPS.md for how to reach filings.

BUILDER: ${b.name}  (builder_id: ${b.id}). Files: ${ROOT}/data/builders/${b.id}.people.json, ${b.id}.divisions.json (if present), ${b.id}.fin.json.

This is a LIGHT check: the readers know these builders personally, and a wrong name costs more than a blank. Check only the highest-stakes rows, at most about 25 in total: the CEO, CFO, every corporate land head and finance / treasury head, every regional head (level "Regional") and each profile.regions leader, every land_banking row that names a counterparty, every competitor_links row, the lots table, the nearest-maturity debt row, and every M&A row. For each: open the cited source_url and confirm it states the fact and that the confidence tag fits the source type; where the source is older than 2025, look once for evidence the person has moved on. Prefer WebFetch on the cited URL; use WebSearch sparingly.

Fix in place: correct what a newer source contradicts (keep a short note of what changed), downgrade to Inferred with a note where the source does not support the row or is stale, upgrade where the tag is lower than the source supports, and remove a row only when it is clearly wrong (add a line to gaps). Do not add new research. Keep files valid JSON at every save, then run: node ${ROOT}/scripts/validate.mjs on each file you touched and fix every ERROR.

Append one line to ${ROOT}/status/verification.log with a shell append:  echo "${b.id}: checked N, held H, corrected C, downgraded D, removed R (light check, top-32)" >> ${ROOT}/status/verification.log

Return: the counts, and each correction as "old -> new (source)". Nothing else.`,
  { label: `verify:${b.id}`, phase: 'Verify', agentType: 'general-purpose', model: 'opus' })
  .then((r) => ({ id: b.id, summary: typeof r === 'string' ? r.slice(0, 900) : r }))))
return results.map((r, i) => r || { id: args.builders[i].id, summary: 'FAILED' })
