#!/usr/bin/env node
// Assembles research fragments into data/competitors/*.json and data/ma_industry.json.
// Usage: node scripts/competitor-assemble.mjs [--from <dir with fresh fragment json>]
// Fragments live in extras/competitor-work/frag/. Curation (drops, summaries, row edits) lives in
// extras/competitor-work/curation.json so a re-run never loses hand fixes.
// Rows without a usable source_url or confidence tag are rejected (logged), never written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, 'extras/competitor-work');
const FRAG = path.join(WORK, 'frag');
const OUT = path.join(ROOT, 'data/competitors');
const TODAY = '2026-11-19';
const RANKING_PUBLISHED = '2026-05-01';
fs.mkdirSync(FRAG, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

const readJson = (f, dflt = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } };
const writeAtomic = (f, obj) => { const t = f + '.tmp-' + process.pid; fs.writeFileSync(t, JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(t, f); };
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// 1. pull fresh fragments (only ones that parse)
const fromIdx = process.argv.indexOf('--from');
if (fromIdx > -1) {
  const src = process.argv[fromIdx + 1];
  for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.json'))) {
    const d = readJson(path.join(src, f));
    if (d) fs.copyFileSync(path.join(src, f), path.join(FRAG, f)); else console.log(`skip (does not parse yet): ${f}`);
  }
}

// 2. spine matching
const spine = readJson(path.join(ROOT, 'data/spine.json'), { builders: [] }).builders || [];
const spineIds = new Set(spine.map((b) => b.builder_id));
const norm = (s) => (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\b(inc|llc|corp|corporation|co|company|group|homes|home|the|usa|us|communities|properties|enterprises|holdings)\b/g, ' ').replace(/\s+/g, ' ').trim();
const nameToId = new Map(spine.map((b) => [norm(b.name), b.builder_id]));
const ALIAS = [ // lead-name -> spine slug (only where the spine row is the same company or its current owner)
  [/\blennar\b/i, 'lennar'], [/rausch coleman/i, 'lennar'], [/\bd\.?\s?r\.?\s?horton\b/i, 'd-r-horton'], [/\bpulte/i, 'pultegroup'], [/\bnvr\b|ryan homes/i, 'nvr'],
  [/\bmeritage\b/i, 'meritage-homes'], [/taylor morrison/i, 'taylor-morrison'], [/\bkb home\b/i, 'kb-home'], [/sekisui house|m\.?d\.?c\.? holdings|richmond american|woodside homes/i, 'sekisui-house-us'],
  [/toll brothers/i, 'toll-brothers'], [/century communities/i, 'century-communities'], [/ashton woods|starlight homes/i, 'ashton-woods'], [/clayton properties/i, 'clayton-properties-group'],
  [/\bm\/i homes\b|\bm i homes\b/i, 'm-i-homes'], [/dream finders/i, 'dream-finders-homes'], [/\bdrb\b/i, 'drb-group'], [/hovnanian/i, 'k-hovnanian'], [/david weekley/i, 'david-weekley-homes'],
  [/stanley martin/i, 'stanley-martin'], [/tri pointe/i, 'tri-pointe-homes'], [/\blgi homes\b/i, 'lgi-homes'], [/\bbeazer\b/i, 'beazer-homes'], [/perry homes/i, 'perry-homes'],
  [/mattamy/i, 'mattamy-homes-us'], [/\bdsld\b/i, 'dsld-homes'], [/green brick/i, 'green-brick-partners'], [/new home co|landsea/i, 'new-home-co'], [/highland homes/i, 'highland-homes'],
  [/smith douglas/i, 'smith-douglas-homes'], [/\bshea homes\b/i, 'shea-homes'], [/american homes 4 rent|\bamh\b/i, 'amh'], [/united homes group/i, 'united-homes-group'],
  [/brookfield residential/i, 'brookfield-residential'], [/davidson homes/i, 'davidson-homes'], [/trumark/i, 'trumark-homes'], [/empire (homes|communities)/i, 'empire-homes'],
];
export function matchBuilder(name) {
  if (!name) return null;
  const n = norm(name); if (nameToId.has(n)) return nameToId.get(n);
  for (const [re, id] of ALIAS) if (re.test(name) && spineIds.has(id)) return id;
  return null;
}

// 3. row checks
const CONF = ['Verified', 'Reported', 'Inferred'];
const TOPIC = ['Pricing', 'Portfolio', 'Capital', 'Strategy', 'Terms', 'People', 'Other'];
const TOPIC_ORDER = ['Portfolio', 'Pricing', 'Terms', 'Strategy', 'Capital', 'People', 'Other'];
const rejects = [];
// Aggregators that reprint a company release are secondary: a Verified tag on them is downgraded to Reported (sample check, 11:05 ET).
const AGGREGATOR = /finviz\.com|stocktitan\.net|finance\.yahoo\.com|webull\.com|marketscreener\.com|investing\.com|stockanalysis\.com|fool\.com/i;
// Text-matched corrections from the independent sample check (curation.edit_text: [{match, set}]).
const applyTextEdits = (row) => { for (const e of curation.edit_text || []) { const t = row.fact || row.description || row.instrument || ''; if (t.includes(e.match)) return { ...row, ...e.set }; } return row; };
const okSrc = (r, where) => {
  if (r.confidence === 'Verified' && AGGREGATOR.test(r.source_url || '')) r.confidence = 'Reported';
  if (!CONF.includes(r.confidence)) { rejects.push(`${where}: bad confidence ${JSON.stringify(r.confidence)}`); return false; }
  if (typeof r.source_url !== 'string' || !/^https?:\/\//.test(r.source_url)) { rejects.push(`${where}: no source_url`); return false; }
  if (/linkedin\.com/i.test(r.source_url)) { rejects.push(`${where}: linkedin source`); return false; }
  return true;
};
const numOrNull = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v) => (v == null ? '' : String(v));

const curation = readJson(path.join(WORK, 'curation.json'), {}) || {};
const drops = new Set(curation.drop || []);          // row ids to drop
const edits = curation.edit || {};                   // row id -> partial row override
const summaries = curation.summary || {};            // competitor_id -> summary
const extraGaps = curation.gaps || {};               // competitor_id -> [gap]

const PLAN = {
  'millrose-properties': { name: 'Millrose Properties, Inc. (NYSE: MRP)', type: 'Land banker', manager_or_parent: 'Externally managed by Kennedy Lewis Land and Residential Advisors LLC (Kennedy Lewis Investment Management)',
    frags: ['mr-spin-terms', 'mr-2025-periodics', 'mr-2026-latest', 'mr-capital', 'mr-people-counterparties'], debtFrom: ['mr-capital'] }, // one debt table, from the agent that owned the capital stack
  'kennedy-lewis': { name: 'Kennedy Lewis Investment Management', type: 'Land banker', manager_or_parent: '', frags: ['kennedy-lewis'] },
  'tpg-angelo-gordon': { name: 'TPG Angelo Gordon', type: 'Land banker', manager_or_parent: 'TPG Inc.', frags: ['tpg-angelo-gordon'] },
  'new-entrants': { name: 'New entrants and other land-finance providers (scan)', type: 'New entrant', manager_or_parent: '', frags: ['entrants-alts', 'entrants-specialists'] },
  'domain-real-estate-partners': { name: 'Domain Real Estate Partners', type: 'Land banker', manager_or_parent: 'DW Partners', frags: ['domain-footprint'] },
};

const report = [];
for (const [id, plan] of Object.entries(PLAN)) {
  const frs = plan.frags.map((n) => [n, readJson(path.join(FRAG, n + '.json'))]).filter(([, d]) => d);
  if (!frs.length) { report.push(`${id}: no fragments yet`); continue; }
  const out = { competitor_id: id, name: plan.name, type: plan.type, manager_or_parent: plan.manager_or_parent,
    summary: summaries[id] || frs.map(([, d]) => str(d.summary)).filter(Boolean).join(' '), retrieved: TODAY,
    facts: [], builder_relationships: [], debt: [], people: [], gaps: [], sources_consulted: [] };
  const seen = new Set();
  const take = (kind, r, n, i) => {
    const key = kind === 'facts' ? `${r.topic}|${r.fact}` : kind === 'builder_relationships' ? `${r.builder_name}|${r.description}` : kind === 'debt' ? `${r.instrument}|${r.principal_usd_m}|${r.status}` : `${r.name}|${r.title}`;
    const rid = `${kind[0]}-${hash(key)}`;
    if (drops.has(rid) || seen.has(rid)) return null;
    seen.add(rid);
    const row = applyTextEdits({ ...r, ...(edits[rid] || {}) });
    if (!okSrc(row, `${id} ${n} ${kind}[${i}]`)) return null;
    return [rid, row];
  };
  for (const [n, d] of frs) {
    (d.facts || []).forEach((r, i) => { const t = take('facts', r, n, i); if (!t) return; const [, x] = t;
      if (!x.fact) return; out.facts.push({ topic: TOPIC.includes(x.topic) ? x.topic : 'Other', fact: str(x.fact), as_of: str(x.as_of), confidence: x.confidence, source_url: x.source_url, source_title: str(x.source_title) }); });
    (d.builder_relationships || []).forEach((r, i) => { const t = take('builder_relationships', r, n, i); if (!t) return; const [, x] = t;
      const bid = spineIds.has(x.builder_id) ? x.builder_id : matchBuilder(x.builder_name);
      out.builder_relationships.push({ builder_id: bid, builder_name: str(x.builder_name), description: str(x.description), amount_usd_m: numOrNull(x.amount_usd_m), lots: numOrNull(x.lots), date: str(x.date), confidence: x.confidence, source_url: x.source_url, source_title: str(x.source_title) }); });
    if (!plan.debtFrom || plan.debtFrom.includes(n)) (d.debt || []).forEach((r, i) => { const t = take('debt', r, n, i); if (!t) return; const [, x] = t;
      out.debt.push({ instrument: str(x.instrument), type: str(x.type) || 'Other', principal_usd_m: numOrNull(x.principal_usd_m), rate: str(x.rate), maturity: str(x.maturity), secured: str(x.secured), lenders_agent: str(x.lenders_agent), status: str(x.status), as_of: str(x.as_of), confidence: x.confidence, source_url: x.source_url, source_title: str(x.source_title), note: str(x.note) }); });
    (d.people || []).forEach((r, i) => { const t = take('people', r, n, i); if (!t) return; const [, x] = t;
      if (!x.name || !x.title) return;
      out.people.push({ name: x.name, title: x.title, role_category: str(x.role_category) || 'Other', level: str(x.level) || 'Corporate', geography: str(x.geography), reports_to: str(x.reports_to), reports_to_confidence: str(x.reports_to_confidence),
        email: str(x.email), email_confidence: str(x.email_confidence), phone: str(x.phone), in_role_since: str(x.in_role_since), prior_role: str(x.prior_role), confidence: x.confidence, source_url: x.source_url, source_title: str(x.source_title),
        source_date: str(x.source_date), retrieved: TODAY, note: str(x.note), domain_internal_notes: '' }); });
    for (const g of d.gaps || []) if (g && !out.gaps.includes(g)) out.gaps.push(g);
    for (const s of d.sources_consulted || []) if (/^https?:\/\//.test(s) && !/linkedin\.com/i.test(s) && !out.sources_consulted.includes(s)) out.sources_consulted.push(s);
  }
  for (const g of extraGaps[id] || []) if (!out.gaps.includes(g)) out.gaps.push(g);
  out.facts.sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic) || (b.as_of || '').localeCompare(a.as_of || ''));
  out.builder_relationships.sort((a, b) => (b.amount_usd_m || 0) - (a.amount_usd_m || 0));
  // people: one row per name (first fragment wins)
  const pseen = new Set(); out.people = out.people.filter((p) => { const k = p.name.toLowerCase(); if (pseen.has(k)) return false; pseen.add(k); return true; });
  writeAtomic(path.join(OUT, id + '.json'), out);
  const v = out.facts.filter((f) => f.confidence === 'Verified').length;
  report.push(`${id}: ${out.facts.length} facts (${v} Verified), ${out.builder_relationships.length} builder relationships, ${out.debt.length} debt, ${out.people.length} people, ${out.gaps.length} gaps  [fragments: ${frs.map(([n]) => n).join(', ')}]`);
}

// 4. industry M&A
const MSTAT = ['Announced', 'Closed', 'Terminated', 'Rumored'];
const deals = []; const dseen = new Map();
for (const n of ['ma-2026', 'ma-2025', 'ma-extra']) {
  const d = readJson(path.join(FRAG, n + '.json')); if (!d) continue;
  (d.deals || []).forEach((r, i) => {
    const rid = `m-${hash(`${norm(r.acquirer)}|${norm(r.target)}`)}`;
    if (drops.has(rid)) return;
    const x = applyTextEdits({ ...r, ...(edits[rid] || {}) });
    if (!okSrc(x, `ma ${n}[${i}]`) || !x.acquirer || !x.target) return;
    if (!MSTAT.includes(x.status)) { rejects.push(`ma ${n}[${i}]: bad status ${x.status}`); return; }
    const row = { date: str(x.date), acquirer: x.acquirer, acquirer_builder_id: spineIds.has(x.acquirer_builder_id) ? x.acquirer_builder_id : matchBuilder(x.acquirer),
      target: x.target, target_builder_id: spineIds.has(x.target_builder_id) ? x.target_builder_id : null, description: str(x.description), status: x.status,
      after_ranking: x.after_ranking === true || (str(x.date) >= RANKING_PUBLISHED), map_impact: str(x.map_impact), confidence: x.confidence, source_url: x.source_url, source_title: str(x.source_title) };
    // the same deal can arrive from two agents under different names: also key on the spine slugs when both are known
    const k2 = row.acquirer_builder_id && row.target_builder_id ? `ids|${row.acquirer_builder_id}|${row.target_builder_id}` : null;
    const prev = dseen.get(rid) || (k2 && dseen.get(k2));
    if (prev) { // keep the later-dated row (closing beats announcement), then the stronger tag
      if (row.date > prev.date || (row.date === prev.date && row.confidence === 'Verified' && prev.confidence !== 'Verified')) Object.assign(prev, row); return; }
    dseen.set(rid, row); if (k2) dseen.set(k2, row); deals.push(row);
  });
}
if (deals.length) {
  deals.sort((a, b) => b.date.localeCompare(a.date));
  writeAtomic(path.join(ROOT, 'data/ma_industry.json'), { retrieved: TODAY, deals });
  report.push(`ma_industry: ${deals.length} deals (${deals.filter((d) => d.after_ranking).length} after ranking, ${deals.filter((d) => d.acquirer_builder_id || d.target_builder_id).length} touch a top-100 builder)`);
} else report.push('ma_industry: no fragments yet');

console.log(report.join('\n'));
if (rejects.length) console.log(`\nREJECTED ROWS (${rejects.length}):\n` + rejects.join('\n'));
