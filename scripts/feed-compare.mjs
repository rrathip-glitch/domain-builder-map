#!/usr/bin/env node
// The proof of improvement: the naive "land banking" alert against the targeted queries, both scored with the same rubric.
//   node scripts/feed-compare.mjs      writes data/extras/feed-vs-baseline.json (an Insights tab in the app) and prints the numbers
// Signal rate = share of what the alert delivers that scores 70 or higher. Items the junk filter removed count as delivered noise
// (a reader of the raw alert would still have seen them); they are counted, not scored.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { P, readJson, writeJsonAtomic, rubricScore } from './feed-lib.mjs';

const scores = new Map(); // candidate id -> score (or 'dropped')
for (const f of readdirSync(P.scored).filter((f) => f.endsWith('.json')).sort()) {
  const j = readJson(join(P.scored, f)); for (const a of (Array.isArray(j) ? j : j?.articles) ?? []) {
    if (a.drop) { scores.set(a.id, 'dropped'); continue; }
    scores.set(a.id, rubricScore(a).score);
  }
}
const clusters = readJson(join(P.scored, '..', 'clusters.json'))?.clusters ?? [];
for (const cl of clusters) for (const d of cl.duplicates ?? []) if (typeof scores.get(d) === 'number') scores.set(d, Math.min(scores.get(d), 30));

function measure(label, rawFile, preFile, note) {
  const raw = readJson(join(P.raw, rawFile))?.items ?? []; const pre = readJson(join(P.raw, preFile));
  const keptIds = new Set((pre?.kept_items ?? []).map((i) => i.id));
  const delivered = raw.length; const junk = raw.filter((i) => !keptIds.has(i.id)).length;
  const scoreOf = (i) => [i.id, ...(i.alias_ids ?? [])].map((x) => scores.get(x)).find((x) => x !== undefined);
  const sc = raw.filter((i) => keptIds.has(i.id)).map(scoreOf).filter((x) => x !== undefined);
  const nums = sc.filter((x) => typeof x === 'number');
  const s40 = nums.filter((x) => x >= 40).length, s70 = nums.filter((x) => x >= 70).length, s90 = nums.filter((x) => x >= 90).length, under40 = nums.filter((x) => x < 40).length + sc.filter((x) => x === 'dropped').length + junk;
  const pending = keptIds.size - sc.length;
  const base = delivered - pending; // only what has been judged
  const pct = (n) => (base ? Math.round((n / base) * 1000) / 10 : null);
  const ranked = raw.filter((i) => typeof scoreOf(i) === 'number').sort((a, b) => scoreOf(b) - scoreOf(a));
  const best = ranked[0] ? `${scoreOf(ranked[0])}: ${ranked[0].title}` : '';
  return { source: label, best, s40, pct40: pct(s40), delivered, judged: base, noise_removed_by_rules: junk, scored_by_llm: sc.length, s70, s90, pct70: pct(s70), pct90: pct(s90), pct_noise: pct(under40), pending, note };
}
const rows = [
  measure('Naive alert: "land banking"', '_baseline.json', '_baseline-prefiltered.json', 'What a plain keyword alert delivers: municipal land banks, overseas land schemes, law-firm notices, and a few real stories.'),
  measure('Targeted queries + rubric', '_candidates.json', '_prefiltered.json', 'Builder and competitor names combined with financing terms, SEC filings, trade press; junk filter, then the rubric.'),
];
const [b, t] = rows;
// The targeted row's counts above the cutoffs come from the built feed itself, so they match what the app shows
// (the feed folds aliases and re-reviewed copies together; counting raw candidates can differ by one or two).
const built = readJson(P.articles)?.articles ?? [];
for (const n of [40, 70, 90]) t[`s${n}`] = built.filter((a) => a.score >= n).length;
t.pct70 = Math.round((t.s70 / t.judged) * 1000) / 10; t.best = built[0] ? `${built[0].score}: ${built[0].title}` : t.best;
const mult = b.pct70 ? Math.round((t.pct70 / b.pct70) * 10) / 10 : null;
writeJsonAtomic(join(P.extras, 'feed-vs-baseline.json'), {
  id: 'feed-vs-baseline', title: 'Feed versus a plain "land banking" alert',
  subtitle: `Same 90 days, same rubric: the plain alert delivered ${b.delivered} headlines and ${b.s70} worth reading this week (70+); the targeted feed found ${t.s70}, about ${Math.round(t.s70 / 13 * 10) / 10} a week.`,
  is_estimate: false,
  method: 'Both sets were collected the same way over the same 90 days (Bing News RSS, GDELT when available; the targeted set also reads SEC EDGAR and trade press) and scored with the same rubric (feed/RUBRIC.md). "Delivered" is every unique item the queries returned. Items removed by the rule-based junk filter (stock tips, law-firm notices, non-English) count as noise without being scored. Signal rate is the share of judged items scoring 70 or higher; noise rate is the share under 40. The targeted collection is deliberately wide (it casts a net over 100 builders and every financing term), so its raw signal rate is low by design; what a reader sees is the list above the cutoff, which is all signal. The plain alert has the opposite problem: it is narrow and still almost all noise, because in the news "land bank" mostly means a city or county land bank authority.',
  generated: new Date().toISOString(), order: 60,
  columns: [
    { key: 'source', label: 'Source', type: 'text' }, { key: 'delivered', label: 'Items delivered', type: 'number' }, { key: 'noise_removed_by_rules', label: 'Removed by junk rules', type: 'number' },
    { key: 'scored_by_llm', label: 'Scored', type: 'number' }, { key: 's70', label: 'Scoring 70+', type: 'number' }, { key: 's90', label: 'Scoring 90+', type: 'number' },
    { key: 'pct70', label: 'Signal rate (70+)', type: 'pct' }, { key: 'pct_noise', label: 'Noise rate (under 40)', type: 'pct' }, { key: 'best', label: 'Best story it found (score: title)', type: 'text' }, { key: 'note', label: 'What it is', type: 'text' },
  ],
  rows: rows.map(({ judged, pending, pct90, ...r }) => r),
});
console.log(JSON.stringify({ rows, signal_rate_multiple: mult }, null, 1));
