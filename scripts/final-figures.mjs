#!/usr/bin/env node
// Prints the agreed headline figures from data/dist/coverage.json as markdown (used for the FINAL block in status/app-export.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dist/coverage.json'), 'utf8'));
const T = c.totals, t = T.top25, p = T.people_per_builder, n = (x) => Number(x || 0).toLocaleString('en-US');
const at = new Date(c.generated).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
console.log([
  `Agreed figures (build of ${at} ET; source of truth is \`data/dist/coverage.json\` \`totals\`, served as \`totals\` by \`/api/meta\`):`,
  `- **Regional heads: ${n(T.regional_heads_found)}** at ${n(T.builders_with_regional_heads)} builders (${n(T.regional_heads_distinct_individuals)} distinct individuals). Top 25: **${n(t.regional_heads)}** at ${n(t.builders_with_regional_heads)} builders.`,
  `- **Regions listed: ${n(T.regions_listed)}**, with a named leader: **${n(T.regions_with_named_leader)}**. Top 25: **${n(t.regions_with_named_leader)} of ${n(t.regions_listed)}**.`,
  `- Builders ${n(T.builders_covered)} of ${n(T.builders_in_ranking)}; people **${n(T.people_mapped)}** (land ${n(T.people_by_group.Land)}, finance ${n(T.people_by_group.Finance)}); ${T.people_confidence.verified_pct}% of people rows Verified; people per builder ${p.Public.avg_people_per_builder} public, ${p.Private.avg_people_per_builder} private, ${p.Subsidiary.avg_people_per_builder} subsidiary.`,
  `- Land heads at ${n(T.land_heads_found)} builders, finance heads at ${n(T.finance_heads_found)}; **${n(T.builders_with_named_land_banker)}** builders with a publicly named land banker or lot-option financier; **${n(T.debt_instruments)}** debt instruments; ${n(T.feed_articles)} feed stories (${n(T.feed_articles_70_plus)} at 70+, ${n(T.feed_articles_90_plus)} at 90+); ${n(T.unique_sources)} sources; ${n(T.builders_acquired_after_ranking)} ranked builders acquired after the ranking; ${n(T.builders_in_progress)} builders in progress.`,
  c.verification ? `- **Accuracy check: ${n(c.verification.checked)} rows checked, ${n(c.verification.held)} held (${Math.round(100 * c.verification.held / c.verification.checked)}%), ${n(c.verification.corrected)} corrected, ${n(c.verification.downgraded)} downgraded to Inferred, ${n(c.verification.removed)} removed**, across ${n(c.verification.builders_checked)} builders (${c.verification.source}; ${c.verification.log_lines} lines read, ${c.verification.unparsed_lines} not parseable).` : '- Accuracy check: status/verification.log not found, so no tally is stated.',
].join('\n'));

// ---- land-banker links: who is counted as linked to each of the four named firms, with confidence and source ----
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dist/domain.json'), 'utf8'));
const FOUR = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
const out = ['', `Land-banker links counted by the build (source: ${c.land_banker_source}). ${n(T.builders_with_named_land_banker)} builders have at least one named link; ${n(T.builders_with_named_land_banker_not_inferred)} have one better than Inferred.`];
for (const f of FOUR) {
  const rows = d.builders.flatMap((b) => b.derived.land_banker_links.filter((x) => x.firm === f).map((x) => ({ b, x })));
  const cc = T.builders_linked_to_by_confidence[f];
  out.push('', `**${f}: ${rows.length} builders** (${cc.Verified} Verified, ${cc.Reported} Reported, ${cc.Inferred} Inferred)`);
  for (const { b, x } of rows) out.push(`- #${b.rank} ${b.name}: **${x.confidence}**${x.date ? ', ' + x.date : ''}. ${x.what.replace(/\s+/g, ' ').slice(0, 170)}${x.what.length > 170 ? '…' : ''} [source](${x.source_url})${x.rows > 1 ? ` (${x.rows} rows; confidences seen: ${x.confidences.join(', ')})` : ''}`);
}
const others = new Map();
for (const b of d.builders) for (const x of b.derived.land_banker_links) if (!FOUR.includes(x.firm)) { if (!others.has(x.firm)) others.set(x.firm, []); others.get(x.firm).push(`#${b.rank} ${b.name} (${x.confidence})`); }
out.push('', '**Other named financiers counted:** ' + [...others].map(([f, bs]) => `${f}: ${bs.join(', ')}`).join('; ') + '.');
out.push('', '**Recorded as NO link (shown as context in `financing.no_link_notes`, never counted):**');
for (const b of d.builders) for (const x of b.financing?.no_link_notes || []) out.push(`- #${b.rank} ${b.name} / ${x.firm}: ${x.text.replace(/\s+/g, ' ').slice(0, 140)}…${x.other_evidence ? ` [but the map also holds: ${x.other_evidence.confidence}, ${x.other_evidence.date}: ${x.other_evidence.text.slice(0, 110)}…]` : ''}`);
out.push('', `**Rows in the shared links table (\`scripts/competitor-extras.mjs\`, another owner) that this build refused to count:** ${(c.link_table_rows_rejected || []).map((r) => `${r.builder} / ${r.financier} ("${r.what.slice(0, 90)}…")`).join('; ') || 'none'}.`);
console.log(out.join('\n'));
