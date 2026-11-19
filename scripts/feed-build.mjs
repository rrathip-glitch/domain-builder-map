#!/usr/bin/env node
// Assemble data/feed/articles.json from the scorers' output. Deterministic: scorers judge, this script does the arithmetic.
//
//   node scripts/feed-build.mjs            validate every file in data/feed/scored/, compute scores, write articles.json (temp file + rename)
//   node scripts/feed-build.mjs --stats    also print the signal-rate numbers
//
// Files are read in name order and a later entry for the same id replaces an earlier one (review-*.json after batch-*.json).
// Scorer files (data/feed/scored/*.json) are { "articles": [ { id, summary, category, subscores, adjustment, why_it_matters, builder_ids, people,
// competitors, suggested_update, source_type?, publisher_url?, published?, duplicate_of?, drop? } ] }.
// score = sum of the five sub-scores, then the one named cap or floor from feed/RUBRIC.md.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { P, readJson, writeJsonAtomic, loadBuilders, today, canonicalUrl, sha12, ADJ, rubricScore } from './feed-lib.mjs';

const RUBRIC_VERSION = (readJson(join(P.raw, '..', 'rubric-version.json')) ?? { version: 'v1' }).version;
const CATS = ['Land banking & competitors', 'New entrant', 'Builder financing', 'Builder M&A', 'Executive change', 'Land & lots', 'Capital markets & ratings', 'Earnings & guidance', 'Housing market', 'Other'];
const TYPES = ['Filing', 'Press release', 'Trade press', 'News', 'Research'];
const KINDS = ['Executive change', 'Deal', 'Financing', 'Land banking'];
const builderIds = new Set(loadBuilders().map((b) => b.id));
// Deterministic tagger: any ranked builder named in the title, summary or why-it-matters gets its id, so each builder page lists its news.
// Uses feed/queries.json builder_must patterns where set, else the spine name; a few names too generic to match safely are skipped.
const qcfg = readJson(join(P.raw, '..', '..', '..', 'feed', 'queries.json')) ?? {};
const SKIP_AUTO = new Set(['the-villages-of-lake-sumter', 'true-homes', 'view-homes', 'edge-homes', 'empire-homes', 'signature-homes', 'legend-homes', 'home-creations', 'lifestyle-homes', 'national-home-corp', 'related']);
const ALIAS = { 'lennar': 'lennar', 'd-r-horton': 'd\\.? ?r\\.? horton', 'pultegroup': 'pulte', 'toll-brothers': 'toll brothers', 'kb-home': 'kb home', 'meritage-homes': 'meritage homes', 'taylor-morrison': 'taylor morrison', 'dream-finders-homes': 'dream finders', 'beazer-homes': 'beazer', 'k-hovnanian': 'hovnanian', 'lgi-homes': 'lgi homes', 'century-communities': 'century communities', 'm-i-homes': 'm/i homes', 'tri-pointe-homes': 'tri pointe', 'green-brick-partners': 'green brick', 'smith-douglas-homes': 'smith douglas', 'ashton-woods': 'ashton woods', 'david-weekley-homes': 'david weekley|weekley homes', 'clayton-properties-group': 'clayton properties|clayton home building', 'mattamy-homes-us': 'mattamy', 'shea-homes': 'shea homes', 'brookfield-residential': 'brookfield residential', 'stanley-martin': 'stanley martin', 'drb-group': 'drb group|drb homes', 'sekisui-house-us': 'sekisui house|richmond american|mdc holdings', 'nvr': '\\bnvr\\b|ryan homes', 'united-homes-group': 'united homes group', 'dsld-homes': 'dsld' };
const tagRes = loadBuilders().filter((b) => !SKIP_AUTO.has(b.id)).map((b) => {
  const src = ALIAS[b.id] ?? qcfg.builder_must?.[b.id] ?? b.name.replace(/\b(Corp|Inc|Cos|Co|Ltd)\.?$/i, '').trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\const builderIds = new Set(loadBuilders().map((b) => b.id));');
  return [b.id, new RegExp(`(^|[^a-z])(${src})([^a-z]|$)`, 'i')];
});
const autoTag = (text) => tagRes.filter(([, re]) => re.test(text)).map(([id]) => id);
const words = (s) => s.trim().split(/\s+/).filter(Boolean);

// candidates by id (targeted and baseline)
const cand = new Map();
const baselineIds = new Set(); const targetedIds = new Set();
for (const f of ['_baseline.json', '_candidates.json']) for (const it of readJson(join(P.raw, f))?.items ?? []) {
  for (const id of [it.id, ...(it.alias_ids ?? [])]) { if (!cand.has(id) || id === it.id) cand.set(id, it); (f === '_baseline.json' ? baselineIds : targetedIds).add(id); }
}

// Plain headlines for SEC filings ("Dream Finders 8-K: closes Beazer purchase..." instead of item numbers): { "<scored id>": "title" }.
const titleFix = readJson(join(P.scored, '..', 'title-fixes.json'), {}) ?? {};
const problems = []; const byId = new Map(); const dropped = [];
for (const f of readdirSync(P.scored).filter((f) => f.endsWith('.json')).sort()) {
  const j = readJson(join(P.scored, f));
  const list = Array.isArray(j) ? j : j?.articles;
  if (!Array.isArray(list)) { problems.push(`${f}: not readable or no articles array; skipped`); continue; }
  for (const a of list) {
    const c = cand.get(a?.id);
    if (!c) { problems.push(`${f}: id ${a?.id} is not a collected candidate; skipped`); continue; }
    if (a.drop) { dropped.push({ id: a.id, title: c.title, reason: a.drop }); byId.delete(a.id); continue; }
    const { sub, adj, score } = rubricScore(a);
    if (a.adjustment && !ADJ[a.adjustment]) problems.push(`${f}: ${a.id} unknown adjustment "${a.adjustment}" treated as none`);
    let summary = String(a.summary ?? '').trim();
    if (words(summary).length > 40) summary = words(summary).slice(0, 40).join(' ').replace(/[,;:]$/, '') + '…';
    const bids = [...new Set([...(a.builder_ids ?? []).filter((b) => builderIds.has(b)), ...autoTag(`${a.title_fix || c.title} ${a.summary ?? ''} ${a.why_it_matters ?? ''}`)])];
    const badB = (a.builder_ids ?? []).filter((b) => !builderIds.has(b)); if (badB.length) problems.push(`${f}: ${a.id} unknown builder ids dropped: ${badB.join(', ')}`);
    let su = a.suggested_update ?? null;
    if (su && !(builderIds.has(su.builder_id) && KINDS.includes(su.kind) && su.text)) { problems.push(`${f}: ${a.id} suggested_update invalid, removed`); su = null; }
    let url = c.url;
    if (a.publisher_url && /^https?:\/\//.test(a.publisher_url) && !/linkedin\.com|news\.google\.com/i.test(a.publisher_url)) url = canonicalUrl(a.publisher_url);
    const published = /^\d{4}-\d{2}-\d{2}$/.test(a.published ?? '') ? a.published : c.published;
    byId.set(a.id, {
      id: url === c.url ? c.id : sha12(url), url, title: (titleFix[a.id] || a.title_fix || c.title), publisher: a.publisher_fix || c.publisher, published,
      source_type: TYPES.includes(a.source_type) ? a.source_type : (TYPES.includes(c.source_type) ? c.source_type : 'News'),
      summary, category: CATS.includes(a.category) ? a.category : 'Other', score, subscores: sub,
      why_it_matters: String(a.why_it_matters ?? '').trim(), builder_ids: bids, people: [...new Set(a.people ?? [])], competitors: [...new Set(a.competitors ?? [])],
      suggested_update: su ? { builder_id: su.builder_id, kind: su.kind, text: String(su.text) } : null,
      collected_via: c.collected_via, retrieved: c.retrieved ?? today(), scored_by: `llm-rubric-${a.rubric_version ?? j.rubric_version ?? 'v1.1'}`,
      _cid: a.id, _adj: adj, _dup: a.duplicate_of ?? null, _targeted: targetedIds.has(a.id), _baseline: baselineIds.has(a.id),
    });
    if (!CATS.includes(a.category)) problems.push(`${f}: ${a.id} category "${a.category}" not in the list; set to Other`);
  }
}

// Same-event clusters from the duplicate pass (optional file): everything but the keeper is capped at 30.
const clusters = readJson(join(P.scored, '..', 'clusters.json'))?.clusters ?? [];
for (const cl of clusters) {
  const keep = byId.get(cl.keep); if (!keep) continue;
  for (const d of cl.duplicates ?? []) { const x = byId.get(d); if (x && x !== keep) { x.score = Math.min(x.score, 30); x._adj = 'cap30-duplicate'; x.why_it_matters = `Same event as "${keep.title.slice(0, 90)}" (kept as the better source).`; x.suggested_update = null; } }
}

const all = [...byId.values()];
const within = all.filter((a) => Date.parse(a.published) >= Date.now() - 91 * 864e5);
// The feed = targeted candidates, plus any baseline-only story that still earned 70+ (a recall catch).
// Ties: competitor and new-entrant news first (what Bob asked to see first), then customers' financing and deals, then newest.
const CAT_RANK = ['Land banking & competitors', 'New entrant', 'Builder financing', 'Builder M&A', 'Executive change', 'Land & lots', 'Capital markets & ratings', 'Earnings & guidance', 'Housing market', 'Other'];
const feed = within.filter((a) => a._targeted || a.score >= 70).sort((a, b) => b.score - a.score || CAT_RANK.indexOf(a.category) - CAT_RANK.indexOf(b.category) || b.published.localeCompare(a.published));
const strip = ({ _cid, _adj, _dup, _targeted, _baseline, ...rest }) => rest;
const seen = new Set(); const articles = []; const idMap = {};
for (const a of feed) { if (seen.has(a.id)) continue; seen.add(a.id); idMap[a.id] = a._cid; articles.push(strip(a)); }
writeJsonAtomic(join(P.scored, '..', 'id-map.json'), idMap); // article id -> scored candidate id of the entry actually shown

// What changed since the last build (for the refresh report).
const prev = readJson(P.articles)?.articles ?? [];
const prevScore = new Map(prev.map((a) => [a.id, a.score]));
const added = articles.filter((a) => !prevScore.has(a.id));
const moved = articles.filter((a) => prevScore.has(a.id) && Math.abs(prevScore.get(a.id) - a.score) >= 10);
const nowIds = new Set(articles.map((a) => a.id));
const changes = { built: new Date().toISOString(), previous_count: prev.length, count: articles.length, added: added.length, removed_or_aged_out: prev.filter((a) => !nowIds.has(a.id)).length,
  new_70_plus: added.filter((a) => a.score >= 70).map((a) => ({ score: a.score, published: a.published, title: a.title, why_it_matters: a.why_it_matters })),
  rescored_by_10_or_more: moved.map((a) => ({ title: a.title, from: prevScore.get(a.id), to: a.score })),
  new_suggested_updates: added.filter((a) => a.suggested_update).map((a) => ({ ...a.suggested_update, score: a.score, source: a.url })) };
writeJsonAtomic(join(P.scored, '..', 'changes.json'), changes);

writeJsonAtomic(P.articles, { generated: new Date().toISOString(), window_days: 90, rubric_version: RUBRIC_VERSION, articles });
// Side file for the comparison and the status report (not read by the app).
const rate = (arr, n) => (arr.length ? Math.round((arr.filter((a) => a.score >= n).length / arr.length) * 1000) / 10 : 0);
const pre = readJson(join(P.raw, '_prefiltered.json')); const preB = readJson(join(P.raw, '_baseline-prefiltered.json'));
const T = within.filter((a) => a._targeted), B = within.filter((a) => a._baseline);
const stats = {
  generated: new Date().toISOString(), rubric_version: RUBRIC_VERSION,
  targeted: { collected: pre?.collected ?? null, dropped_by_rules: pre?.dropped ?? null, scored: T.length, s70: T.filter((a) => a.score >= 70).length, s90: T.filter((a) => a.score >= 90).length, pct70_of_scored: rate(T, 70), pct90_of_scored: rate(T, 90) },
  baseline: { collected: preB?.collected ?? null, dropped_by_rules: preB?.dropped ?? null, scored: B.length, s70: B.filter((a) => a.score >= 70).length, s90: B.filter((a) => a.score >= 90).length, pct70_of_scored: rate(B, 70) },
  feed_articles: articles.length, dropped_by_scorers: dropped.length, problems: problems.length,
};
writeJsonAtomic(join(P.scored, '..', 'stats.json'), { ...stats, problem_list: problems.slice(0, 200), dropped_list: dropped });
console.log(`articles.json: ${articles.length} articles | 70+: ${articles.filter((a) => a.score >= 70).length} | 90+: ${articles.filter((a) => a.score >= 90).length} | problems: ${problems.length} | dropped by scorers: ${dropped.length}`);
console.log(`since last build: ${added.length} new (${changes.new_70_plus.length} at 70+), ${moved.length} re-scored by 10+ points, ${changes.removed_or_aged_out} aged out or removed -> data/feed/changes.json`);
if (process.argv.includes('--stats')) console.log(JSON.stringify(stats, null, 1));
if (problems.length) console.log(problems.slice(0, 15).join('\n'));
