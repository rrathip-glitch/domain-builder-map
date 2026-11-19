#!/usr/bin/env node
// Rule-based junk filter and batch maker. Runs before any LLM effort.
//
//   node scripts/feed-prefilter.mjs                    filter _candidates.json, cut unscored items into scoring batches
//   node scripts/feed-prefilter.mjs --limit 120        only the top 120 unscored items by priority (first pass)
//   node scripts/feed-prefilter.mjs --baseline         same for the naive-alert set (_baseline.json), batches named base-*
//   node scripts/feed-prefilter.mjs --batch-size 20
//   node scripts/feed-prefilter.mjs --rescore-voted    also re-queue stories that have a vote in data/local/votes.json
//   node scripts/feed-prefilter.mjs --requeue          throw away batches that were cut but never scored, and cut again
//
// Output: data/feed/raw/_prefiltered.json (kept + dropped with the rule that dropped each),
//         data/feed/batches/<prefix>-NNN.json (items waiting for a scorer), data/feed/batches/_builders.txt (slug list for tagging).
import { readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { P, loadConfig, loadBuilders, readJson, writeJsonAtomic } from './feed-lib.mjs';

const args = process.argv.slice(2);
const num = (f, d) => (args.includes(f) ? Number(args[args.indexOf(f) + 1]) : d);
const baseline = args.includes('--baseline');
const limit = num('--limit', Infinity), size = num('--batch-size', 20);
const cfg = loadConfig().prefilter;
const builders = loadBuilders();

const dropRe = cfg.drop_title_patterns.map((p) => new RegExp(p, 'i'));
const hardRe = cfg.junk_overrides_keep.map((p) => new RegExp(p, 'i'));

export function junkReason(it) {
  const pub = `${it.publisher} ${it.publisher_site ?? ''} ${it.url}`.toLowerCase();
  const t = it.title;
  if (it.source_type === 'Filing') {
    // A builder's 10-Q / 10-K cover entry carries no news by itself (the builder map reads those filings); Millrose's and full-text hits are kept.
    if (/^10-[QK]/.test(it.form ?? '') && !it.competitor_hint && /^edgar: .* filings$/.test(it.collected_via)) return 'periodic report marker (read by the builder map, not news)';
    return null;
  }
  if (/[Ѐ-ӿ一-鿿぀-ヿ؀-ۿ]/.test(t)) return 'non-English';
  // Items from the generic query groups must mention housing at all (Bing pads thin result sets with unrelated headlines).
  if (/^bing-news: (builder-ma|capital-markets|new-entrants-themes|wires|trade press)/.test(it.collected_via) && !/home ?build|homes\b|housing|residential|\blots?\b|\bland\b|builder/i.test(`${t} ${it.snippet ?? ''}`)) return 'no housing words (search-engine padding)';
  const p = cfg.drop_publishers.find((x) => pub.includes(x));
  if (p) return `stock-tip or aggregator publisher (${p})`;
  const hit = dropRe.find((re) => re.test(t));
  if (hit) {
    const keep = cfg.keep_title_terms.some((k) => t.toLowerCase().includes(k));
    if (!keep || hardRe.some((re) => re.test(t))) return `title pattern (${hit.source.slice(0, 40)})`;
  }
  return null;
}

// Cheap ordering so the most promising items are scored first. This is not the score.
function priority(it) {
  const s = `${it.title} ${it.snippet}`.toLowerCase(); let p = 0;
  if (/millrose|kennedy lewis|angelo gordon|land bank|lot option|land-light|land light|domain real estate/.test(s)) p += 50;
  if (it.competitor_hint) p += 40;
  if (/senior notes|credit facility|term loan|revolv|notes due|refinanc|redemption|redeem|offering|private credit|financing|lender/.test(s)) p += 25;
  if (/acqui|merger|definitive agreement|take private|to buy /.test(s)) p += 22;
  if (/land (financing|jv|capital|fund)|lot and land|land-capital|residential land|raises \$|launches|essential housing/.test(s)) p += 30;
  if (/\bcfo\b|chief financial|treasurer|land acquisition|division president|names |appoints|promotes/.test(s)) p += 14;
  if (/moody|fitch|s&p|upgrade|downgrade|rating/.test(s)) p += 12;
  if (/\blots?\b|land\b|joint venture/.test(s)) p += 8;
  if (it.entrant_hint && s.includes(it.entrant_hint.toLowerCase())) p += 18;
  const sec = it.sec_items ?? [];
  if (sec.some((x) => ['1.01', '2.03', '2.01', '5.02', '1.02'].includes(x))) p += 30; else if (it.form === '8-K') p += 8;
  if (/^(424B|FWP)/.test(it.form ?? '')) p += 25;
  const b = builders.find((x) => x.id === it.builder_hint);
  if (b) p += b.rank <= 10 ? 12 : b.rank <= 26 ? 9 : b.rank <= 50 ? 5 : 2;
  if (['Filing', 'Press release', 'Trade press', 'Research'].includes(it.source_type)) p += 6;
  p += Math.min(6, (it.dupes ?? 0) * 2); // found by several queries
  p -= Math.min(10, Math.floor((Date.now() - Date.parse(it.published)) / 864e5 / 9)); // slight recency tilt
  return p;
}

const src = readJson(join(P.raw, baseline ? '_baseline.json' : '_candidates.json'));
if (!src) { console.error('Nothing collected yet: run scripts/feed-collect.mjs first.'); process.exit(1); }
const kept = [], dropped = [];
for (const it of src.items) { const r = junkReason(it); if (r) dropped.push({ id: it.id, title: it.title, publisher: it.publisher, reason: r }); else kept.push({ ...it, priority: priority(it) }); }
kept.sort((a, b) => b.priority - a.priority);
writeJsonAtomic(join(P.raw, baseline ? '_baseline-prefiltered.json' : '_prefiltered.json'), { made: new Date().toISOString(), collected: src.items.length, kept: kept.length, dropped: dropped.length, kept_items: kept, dropped_items: dropped });

// Skip anything already scored.
mkdirSync(P.scored, { recursive: true }); mkdirSync(P.batches, { recursive: true });
const scored = new Set();
for (const f of readdirSync(P.scored).filter((f) => f.endsWith('.json'))) for (const a of readJson(join(P.scored, f), [])?.articles ?? readJson(join(P.scored, f), []) ?? []) if (a?.id) scored.add(a.id);
const prefix = baseline ? 'base' : 'batch';
// Batches already cut and still waiting for a scorer are left alone (a scorer may be reading one); --requeue clears them.
const queued = new Set();
const scoredFiles = new Set(readdirSync(P.scored));
for (const f of readdirSync(P.batches).filter((f) => /^(batch|base)-.*\.json$/.test(f) && !scoredFiles.has(f))) {
  if (args.includes('--requeue') && f.startsWith(`${prefix}-`)) { rmSync(join(P.batches, f)); continue; }
  for (const it of readJson(join(P.batches, f))?.items ?? []) queued.add(it.id);
}
// --rescore-voted: stories the team voted on go back to a scorer (who reads the votes first); the new score replaces the old.
const voted = new Set();
if (args.includes('--rescore-voted')) {
  const votes = readJson(P.votes, {}) ?? {}; const idMap = readJson(join(P.scored, '..', 'id-map.json'), {}) ?? {};
  for (const aid of Object.keys(votes)) voted.add(idMap[aid] ?? aid);
}
const known = (it, set) => [it.id, ...(it.alias_ids ?? [])].some((x) => set.has(x));
const todo = kept.filter((it) => (known(it, voted) || !known(it, scored)) && !known(it, queued)).slice(0, limit);
// Date-time stamp so later batches sort (and so override) after earlier ones in data/feed/scored/.
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
let n = 0;
for (let i = 0; i < todo.length; i += size) {
  const items = todo.slice(i, i + size).map(({ id, url, title, publisher, published, snippet, source_type, collected_via, builder_hint, competitor_hint, entrant_hint, form, sec_items }) =>
    ({ id, url, title, publisher, published, snippet, source_type, collected_via, builder_hint, competitor_hint, entrant_hint, form, sec_items }));
  writeJsonAtomic(join(P.batches, `${prefix}-${stamp}-${String(++n).padStart(3, '0')}.json`), { batch: `${prefix}-${stamp}-${String(n).padStart(3, '0')}`, items });
}
writeFileSync(join(P.batches, '_builders.txt'), builders.map((b) => `${b.rank}\t${b.id}\t${b.name}`).join('\n') + '\n');
console.log(`${baseline ? 'baseline' : 'targeted'}: ${src.items.length} collected, ${dropped.length} dropped by rules, ${kept.length} kept; ${scored.size} already scored, ${queued.size} waiting in earlier batches; ${todo.length} newly queued in ${n} batches (${prefix}-${stamp}-*)`);
