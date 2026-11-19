#!/usr/bin/env node
// Builds three insight tables in data/extras/ (contract: end of SCHEMA.md; plan: extras/PLAN.md, simplified):
//   mandate-screen.json       who clears a top-25 or top-50 cutoff (published rank, parent rank, watch flag)
//   call-sheet.json           30 builders with the strongest public reason for a land banker to call now
//   debt-maturity-watch.json  every outstanding debt instrument due within 24 months
// Usage (from domain-intel/): node scripts/extras-build.mjs && npm run build
// Reads data/dist/domain.json only. Safe to re-run; tolerates missing fields. Each table is written to a temp file then renamed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRAS = path.join(ROOT, 'data/extras');
fs.mkdirSync(EXTRAS, { recursive: true });
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dist/domain.json'), 'utf8'));
const writeAtomic = (f, obj) => { const t = f + '.tmp-' + process.pid; fs.writeFileSync(t, JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(t, f); };
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (x == null ? '' : String(x));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const clip = (s, n) => { s = str(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[ ,;:]+\S*$/, '') + '…' : s; };
const money = (m) => (isNum(m) ? (m >= 1000 ? `$${(m / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })}B` : `$${m.toLocaleString('en-US', { maximumFractionDigits: 1 })}M`) : '');
const CONF_RANK = { Verified: 3, Reported: 2, Inferred: 1 };
const lowestConf = (...cs) => cs.filter((c) => CONF_RANK[c]).sort((a, b) => CONF_RANK[a] - CONF_RANK[b])[0] || '';

// ---- dates (US Eastern, fixed -05:00 like the other extras scripts)
const etNow = new Date(Date.now() - 5 * 3600e3);
const TODAY = etNow.toISOString().slice(0, 10);
const GENERATED = etNow.toISOString().slice(0, 19) + '-05:00';
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m is 1-based
const addMonthsEnd = (iso, n) => { const [y, m] = iso.split('-').map(Number); const t = y * 12 + (m - 1) + n; return monthEnd(Math.floor(t / 12), (t % 12) + 1); };
const WINDOW_END = addMonthsEnd(TODAY, 24);          // 2028-11-30 when run on 2026-11-19
const YEAR_AGO = `${Number(TODAY.slice(0, 4)) - 1}${TODAY.slice(4)}`;
const LIST_PUBLISHED = '2026-05';                     // 2026 Builder 100 published May 2026
// maturity text -> last possible day: YYYY-MM-DD as is, YYYY-MM = month end, YYYY = year end; anything else = null
function maturityEnd(s) {
  s = str(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return monthEnd(+s.slice(0, 4), +s.slice(5, 7));
  if (/^\d{4}$/.test(s)) return `${s}-12-31`;
  return null;
}
const monthsBetween = (a, b) => { const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number); return Math.round(((yb - ya) * 12 + (mb - ma) + (db - da) / 30) * 10) / 10; };
const onOrAfter = (partial, cutoff) => { partial = str(partial).trim(); if (!/^\d{4}/.test(partial)) return false; return partial >= cutoff.slice(0, partial.length); };

const B = arr(D.builders).filter((b) => b && b.builder_id).slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
const byId = new Map(B.map((b) => [b.builder_id, b]));
const ranked = B.filter((b) => isNum(b.rank));
const norm = (s) => str(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(inc|llc|l l c|corp|corporation|co|the|ltd)\b/g, ' ').replace(/\s+/g, ' ').trim();

// ---- named land bankers (same canon() and UNNAMED rules as scripts/competitor-extras.mjs, so names match the competitor tables)
const BIG4 = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
function canon(name) {
  const n = name || '';
  if (/millrose/i.test(n)) return 'Millrose Properties';
  if (/kennedy[- ]lewis/i.test(n)) return 'Kennedy Lewis';
  if (/angelo,? gordon|\btpg\b|essential housing|\bAG (essential|land|real estate)|\bAGWIP\b/i.test(n)) return 'TPG Angelo Gordon';
  if (/domain real estate|\bdw partners\b|\bdomain rep\b/i.test(n)) return 'Domain Real Estate Partners';
  return n.replace(/\s*\(.*$/, '').trim();
}
const UNNAMED = /not (publicly )?(named|disclosed|identified)|undisclosed|unnamed|un-named|\bvarious\b|third[- ]part(y|ies)|no land banker|land sellers|none named|not public|multiple (land bankers|counterparties)|land bankers? \(|^land bank(er|ers|ing)\b/i;
const NONE_STMT = /^no land banker|virtually no land banking|does not use land bank/i;
const MATRIX = new Map(arr(arr(D.extras).find((e) => e.id === 'competitor-builder-matrix')?.rows).map((r) => [r.builder, r]));
const NEG_LINK = /no (public|publicly|known|disclosed) (link|relationship|connection)|not (publicly )?linked|no evidence|none found|no mention/i;
function landBankers(b) {
  const fin = b.financing || {}, names = new Set(); let unnamed = false;
  for (const r of arr(fin.land_banking)) {
    const cp = str(r.counterparty), c = canon(cp), big = BIG4.includes(c);
    if (NONE_STMT.test(cp)) continue;
    if (!big && UNNAMED.test(cp)) { if (['Land banker', 'Investor'].includes(r.counterparty_type)) unnamed = true; continue; }
    if (!big && !['Land banker', 'Investor'].includes(r.counterparty_type)) continue;
    if (c) names.add(c);
  }
  for (const r of arr(fin.competitor_links)) {
    if (!r.firm || /^(no|none)\b/i.test(str(r.relationship)) || NEG_LINK.test(str(r.relationship))) continue;
    names.add(canon(r.firm));
  }
  for (const r of arr(b.competitor_relationships)) { if (r.is_scan || r.competitor_id === 'new-entrants') continue; const f = canon(r.financier || r.competitor_name); if (f && !UNNAMED.test(f)) names.add(f); }
  // Prefer the competitor session's own matrix (shipped inside domain.json) so the names match its tables exactly.
  const m = MATRIX.get(b.builder_id);
  if (m) {
    const fromMatrix = [['domain', 'Domain Real Estate Partners'], ['millrose', 'Millrose Properties'], ['kennedy_lewis', 'Kennedy Lewis'], ['tpg_ag', 'TPG Angelo Gordon']].filter(([k]) => str(m[k]).trim()).map(([, n]) => n)
      .concat(str(m.others).split(/;\s*/).map((x) => x.trim()).filter(Boolean));
    return { names: [...new Set(fromMatrix)].sort(), unnamed, from: 'matrix' };
  }
  return { names: [...names].sort(), unnamed, from: 'own' };
}

// ---- ownership changes since the list (whole-company deals only)
const MINORITY = /minority|stake|division|assets|land\b/i;
const changes = new Map(); // builder_id -> { acquirer, acquirer_id, date, status, confidence, source_url, via }
for (const x of arr(D.ma_industry?.deals)) {
  if (!x || !x.after_ranking || !['Closed', 'Announced'].includes(x.status) || !byId.has(x.target_builder_id)) continue;
  if (MINORITY.test(str(x.target))) continue; // e.g. Berkshire's ~11% Lennar stake is not a change of control
  if (!changes.has(x.target_builder_id)) changes.set(x.target_builder_id, { acquirer: x.acquirer, acquirer_id: byId.has(x.acquirer_builder_id) && x.acquirer_builder_id !== x.target_builder_id ? x.acquirer_builder_id : null, date: str(x.date), status: x.status, confidence: x.confidence, source_url: x.source_url, via: 'industry M&A list' });
}
for (const b of B) for (const m of arr(b.ma)) {
  if (m.role !== 'Target' || !m.after_ranking || !['Closed', 'Announced'].includes(m.status) || changes.has(b.builder_id)) continue;
  changes.set(b.builder_id, { acquirer: m.counterparty, acquirer_id: null, date: str(m.date), status: m.status, confidence: m.confidence, source_url: m.source_url, via: 'builder M&A record' });
}
// parent that is itself a ranked builder: the acquirer on a change of control, else a name match on the recorded parent
function rankedParent(b) {
  const ch = changes.get(b.builder_id);
  if (ch?.acquirer_id) return byId.get(ch.acquirer_id);
  const p = norm(b.parent); if (!p) return null;
  for (const o of ranked) { if (o.builder_id === b.builder_id) continue; const n = norm(o.name); if (n.length >= 6 && (` ${p} `).includes(` ${n} `)) return o; }
  if (ch) { const a = norm(ch.acquirer); for (const o of ranked) { const n = norm(o.name); if (o.builder_id !== b.builder_id && n.length >= 6 && (` ${a} `).includes(` ${n} `)) return o; } }
  return null;
}
const ownerText = (b) => (b.parent ? clip(b.parent, 90) : [str(b.ownership) || 'Not recorded', b.ticker ? `(${b.ticker})` : ''].filter(Boolean).join(' '));

// ===================================================================== 1. mandate-screen
const msRows = ranked.map((b) => {
  const ch = changes.get(b.builder_id), par = rankedParent(b), r = b.rank;
  const watch = [];
  if (r >= 23 && r <= 28) watch.push(`within 3 places of the top-25 cutoff`);
  if (r >= 48 && r <= 53) watch.push(`within 3 places of the top-50 cutoff`);
  if (ch) watch.push(ch.status === 'Closed' ? 'changed hands since the list' : 'sale agreed since the list, not yet closed');
  const chText = ch ? `${ch.status === 'Closed' ? 'Acquired by' : 'Sale agreed to'} ${clip(ch.acquirer, 70)}${ch.date ? ` (${ch.status === 'Closed' ? 'closed' : 'announced'} ${ch.date})` : ''}` : '';
  return {
    rank: r, builder: b.builder_id, tier: str(b.tier), closings: isNum(b.closings) ? b.closings : null,
    owner: ownerText(b), parent_builder: par ? par.builder_id : null, parent_rank: par ? par.rank : null, parent_tier: par ? str(par.tier) : '',
    changed_hands: chText, watch: watch.length ? 'Watch: ' + watch.join('; ') : '',
    confidence: ch ? lowestConf(ch.confidence, b.spine?.confidence) || ch.confidence : str(b.spine?.confidence),
    change_source: ch ? str(ch.source_url) : '', rank_source: str(b.spine?.source_url),
  };
});
const nWatch = msRows.filter((r) => r.watch).length, nChanged = msRows.filter((r) => r.changed_hands).length, nParent = msRows.filter((r) => r.parent_builder).length;
writeAtomic(path.join(EXTRAS, 'mandate-screen.json'), {
  id: 'mandate-screen',
  title: 'Mandate screen: who clears a top-25 or top-50 cutoff',
  subtitle: `${msRows.length} ranked builders. ${nWatch} flagged to watch: near a cutoff (ranks 23-28 or 48-53) or changed hands since the list. ${nChanged} changed hands since the list was published; ${nParent} now sit under another ranked builder.`,
  is_estimate: true,
  method: `Inputs: the published 2026 Builder 100 (ranked by 2025 closings, published May 2026) for rank, tier and closings; each builder's recorded owner or parent; and deals since the list from the industry M&A list and the builders' own M&A records. Rule: rank and tier are shown exactly as published and are not recomputed. "Parent that is a ranked builder" is filled when the builder was bought by a ranked builder after the list (the acquirer on that deal), or when its recorded parent name matches another ranked builder; parents that are not homebuilders on the list (for example Berkshire Hathaway, Sumitomo Forestry, Daiwa House) are shown in the owner column only. "Watch" is raised for ranks 23 to 28 and 48 to 53 (within 3 places of the top-25 or top-50 line) and for any builder bought, or agreed to be sold, after the list; only whole-company deals count (Berkshire's minority stake in Lennar is left out). The source column is the deal's own source. What is missing: Domain's mandate wording (which list, brand or parent level, tested when) is not public, so this table does not decide eligibility; no pro forma league table is computed; builders ranked 101 and below are not in the data, so it cannot show who would move into a place a merger opens. Run ${TODAY}.`,
  generated: GENERATED,
  order: 10,
  columns: [
    { key: 'rank', label: 'Published rank', type: 'number' },
    { key: 'builder', label: 'Builder', type: 'builder_link' },
    { key: 'tier', label: 'Published tier', type: 'text' },
    { key: 'closings', label: '2025 closings', type: 'number' },
    { key: 'owner', label: 'Current owner or parent', type: 'text' },
    { key: 'parent_builder', label: 'Parent that is a ranked builder', type: 'builder_link' },
    { key: 'parent_rank', label: "Parent's rank", type: 'number' },
    { key: 'parent_tier', label: "Parent's tier", type: 'text' },
    { key: 'changed_hands', label: 'Changed hands since the list', type: 'text' },
    { key: 'watch', label: 'Watch', type: 'text' },
    { key: 'confidence', label: 'Confidence', type: 'confidence' },
    { key: 'change_source', label: 'Source of ownership change', type: 'url' },
    { key: 'rank_source', label: 'Ranking source', type: 'url' },
  ],
  rows: msRows,
});

// ===================================================================== 3. debt-maturity-watch (built before the call sheet, which reuses it)
const SKIP_TYPES = /mortgage warehouse/i;
const dmRows = [], skippedDebt = { unparsed: 0, past: [], parent: [] };
for (const b of B) {
  const fin = b.financing || {}, km = fin.key_metrics || {};
  for (const x of arr(fin.debt)) {
    if (str(x.status) !== 'Outstanding' || SKIP_TYPES.test(str(x.type))) continue;
    if (/^parent level/i.test(str(x.instrument))) { skippedDebt.parent.push(`${b.name}: ${clip(x.instrument, 70)}`); continue; }
    const end = maturityEnd(x.maturity);
    if (!end) { skippedDebt.unparsed++; continue; }
    if (end > WINDOW_END) continue;
    if (end < TODAY) { skippedDebt.past.push(`${b.name}: ${clip(x.instrument, 60)} (maturity ${x.maturity})`); continue; }
    dmRows.push({
      maturity: str(x.maturity), _end: end, months_away: monthsBetween(TODAY, end),
      builder: b.builder_id, rank: isNum(b.rank) ? b.rank : null, tier: str(b.tier),
      instrument: clip(x.instrument, 140), type: str(x.type), principal: isNum(x.principal_usd_m) ? x.principal_usd_m : null, rate: clip(x.rate, 80),
      cash: isNum(km.cash_usd_m) ? km.cash_usd_m : null, liquidity: isNum(km.liquidity_usd_m) ? km.liquidity_usd_m : null, metrics_as_of: str(km.as_of),
      confidence: str(x.confidence), source_url: str(x.source_url),
    });
  }
}
dmRows.sort((a, b) => a._end.localeCompare(b._end) || (b.principal ?? 0) - (a.principal ?? 0));
const dmBuilders = new Set(dmRows.map((r) => r.builder));
const withDebt = B.filter((b) => arr(b.financing?.debt).length).length;
const dmTotal = dmRows.reduce((s, r) => s + (r.principal ?? 0), 0);
writeAtomic(path.join(EXTRAS, 'debt-maturity-watch.json'), {
  id: 'debt-maturity-watch',
  title: 'Debt coming due: next 24 months',
  subtitle: `${dmRows.length} instruments at ${dmBuilders.size} builders come due between ${TODAY} and ${WINDOW_END}, about ${money(dmTotal)} in all where an amount is stated. Debt data was found for ${withDebt} of ${B.length} builders.`,
  is_estimate: false,
  method: `A factual list from each builder's recorded debt (company filings and press). Included: every instrument marked Outstanding whose maturity falls between today (${TODAY}) and ${WINDOW_END}. Left out: mortgage warehouse lines (short-term loans that fund buyers' mortgages and roll over continuously), anything Redeemed, and facilities marked Undrawn or only Announced. A maturity given as a month counts as the end of that month and a bare year as 31 December, so a note recorded only as "2028" is not listed. For revolving credit lines the amount is what was drawn on the date shown, not the size of the line. Cash and liquidity are the builder's latest reported figures (liquidity usually means cash plus undrawn credit lines), shown on every row so a reader can compare. What is missing: private builders rarely publish debt, so absence here is not evidence of no debt; ${skippedDebt.unparsed} outstanding instruments have no usable maturity date and are not shown${skippedDebt.past.length ? `; ${skippedDebt.past.length} instruments are still marked Outstanding with a maturity already passed and are not shown (likely repaid or extended; listed for correction: ${skippedDebt.past.join('; ')})` : ''}${skippedDebt.parent.length ? `; ${skippedDebt.parent.length} rows recorded on a builder but describing its parent's borrowing are not shown (${skippedDebt.parent.join('; ')})` : ''}.`,
  generated: GENERATED,
  order: 30,
  columns: [
    { key: 'maturity', label: 'Matures', type: 'date' },
    { key: 'months_away', label: 'Months away', type: 'number' },
    { key: 'builder', label: 'Builder', type: 'builder_link' },
    { key: 'rank', label: 'Rank', type: 'number' },
    { key: 'tier', label: 'Tier', type: 'text' },
    { key: 'instrument', label: 'Instrument', type: 'text' },
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'principal', label: 'Amount ($M)', type: 'usd_m' },
    { key: 'rate', label: 'Interest rate', type: 'text' },
    { key: 'cash', label: "Builder's cash ($M)", type: 'usd_m' },
    { key: 'liquidity', label: "Builder's liquidity ($M)", type: 'usd_m' },
    { key: 'metrics_as_of', label: 'Cash figures as of', type: 'date' },
    { key: 'confidence', label: 'Confidence', type: 'confidence' },
    { key: 'source_url', label: 'Source', type: 'url' },
  ],
  rows: dmRows.map(({ _end, ...r }) => r),
});

// ===================================================================== 2. call-sheet
// Not for-sale homebuilders, so not land-bank prospects (each builder's own profile says so).
const EXCLUDE = {
  'habitat-for-humanity-international': 'nonprofit', 'neighborworks-america': 'nonprofit',
  amh: 'build-to-rent operator', 'middleburg-communities': 'build-to-rent operator', 'bbl-building-co': 'build-to-rent contractor',
  'hancock-builders': 'build-to-rent contractor', 'lifestyle-homes': 'build-to-rent contractor', 'jim-chapman-construction-group': 'build-to-rent contractor',
};
const POINTS = { option_no_banker: 30, unnamed_banker: 20, debt_24m: 25, deal: 20, land_light: 15, new_exec: 15, top25: 10, top50: 5 };
const LAND_CATS = ['Land Acquisition', 'Land (other)', 'Land Development'];
const isLand = (p) => p.priority_group === 'Land' || LAND_CATS.includes(p.role_category);
const isTreasury = (p) => p.role_category === 'Treasury/Capital Markets';
const isCFO = (p) => p.role_category === 'CFO';
const byConf = (a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0);
function bestContact(b) {
  const ppl = arr(b.people).filter((p) => p && p.name && p.level === 'Corporate');
  const landTitle = (p) => /\bland\b/i.test(str(p.title).replace(/\([^)]*\)/g, ''));   // main title names land (not just a side note)
  const tiers = [
    ppl.filter((p) => isLand(p) && landTitle(p) && p.role_category !== 'Land Development'), ppl.filter((p) => isLand(p) && landTitle(p)),
    ppl.filter(isTreasury), ppl.filter(isCFO), ppl.filter(isLand),
  ];
  const named = (p) => (/treasur|capital markets/i.test(str(p.title)) ? 1 : 0);   // within treasury, a title that says so first
  for (const t of tiers) if (t.length) return t.slice().sort((a, b) => byConf(a, b) || named(b) - named(a))[0];
  return null;
}
const publishedContact = (p) => {
  if (!p) return '';
  const bits = [];
  if (str(p.phone).trim()) bits.push(str(p.phone).trim());
  if (str(p.email).trim() && p.email_confidence && p.email_confidence !== 'Inferred') bits.push(str(p.email).trim());
  return bits.join(' / ');
};
const BUILDER_DEAL = /homes|builders?\b|homebuild|communities|construction group/i, NOT_BUILDER = /land seller|reit|apartment|parent, not/i;
function recentDeal(b) {
  // as acquirer on the industry list, or bought / agreed to be sold since the list
  const hits = [];
  for (const x of arr(D.ma_industry?.deals)) {
    if (!x.after_ranking || !['Closed', 'Announced'].includes(x.status) || MINORITY.test(str(x.target))) continue;
    if (x.acquirer_builder_id === b.builder_id) hits.push({ text: `${x.status === 'Closed' ? 'bought' : 'agreed to buy'} ${clip(x.target, 60)} (${x.date})`, date: str(x.date), confidence: x.confidence, source_url: x.source_url });
  }
  for (const m of arr(b.ma)) {
    if (m.role !== 'Acquirer' || !m.after_ranking || !['Closed', 'Announced'].includes(m.status)) continue;
    if (!BUILDER_DEAL.test(str(m.counterparty)) || NOT_BUILDER.test(`${m.counterparty} ${m.description}`)) continue;
    if (ranked.some((o) => o.builder_id !== b.builder_id && norm(m.counterparty).startsWith(norm(o.name)))) continue; // e.g. a parent's deal recorded on a sister brand
    if (hits.some((h) => norm(h.text).includes(norm(m.counterparty).split(' ').slice(0, 2).join(' ')))) continue;
    hits.push({ text: `${m.status === 'Closed' ? 'bought' : 'agreed to buy'} ${clip(m.counterparty, 60)} (${m.date})`, date: str(m.date), confidence: m.confidence, source_url: m.source_url });
  }
  const ch = changes.get(b.builder_id);
  if (ch) hits.push({ text: `${ch.status === 'Closed' ? 'was bought by' : 'agreed to be sold to'} ${clip(ch.acquirer, 60)} (${ch.date})`, date: ch.date, confidence: ch.confidence, source_url: ch.source_url });
  return hits.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}
const LAND_LIGHT = /land[- ]light|asset[- ]light|land[- ]lighter/i, LL_NEG = /\bnot\b|\bno\b|rather than|does not/i;
function landLight(b) {
  const first = str(b.financing?.land_strategy).split(/(?<=\.)\s/)[0];
  return LAND_LIGHT.test(first) && !LL_NEG.test(first) ? clip(first, 110) : '';
}
function newExec(b) {
  const p = arr(b.people).filter((p) => p.level === 'Corporate' && (isLand(p) || p.priority_group === 'Finance' || isTreasury(p) || isCFO(p)) && onOrAfter(p.in_role_since, YEAR_AGO))
    .sort((a, b) => str(b.in_role_since).localeCompare(str(a.in_role_since)))[0];
  return p || null;
}

const csAll = [];
for (const b of ranked) {
  if (EXCLUDE[b.builder_id]) continue;
  const fin = b.financing || {}, d = b.derived || {};
  const lb = landBankers(b);
  const pct = isNum(d.pct_optioned) ? d.pct_optioned : isNum(fin.lots?.pct_optioned) ? fin.lots.pct_optioned : null;
  const debt = dmRows.filter((r) => r.builder === b.builder_id);
  const next = debt[0] || null;
  const due24 = debt.reduce((s, r) => s + (r.principal ?? 0), 0);
  const deal = recentDeal(b), ll = landLight(b), ne = newExec(b);
  const parts = []; // { pts, text, confidence, source_url }
  if (pct != null && pct >= 50 && lb.names.length === 0) parts.push({ pts: POINTS.option_no_banker, text: `${pct}% of its lots are optioned and no land banker is publicly named`, confidence: fin.lots?.confidence, source_url: fin.lots?.source_url });
  else if (lb.unnamed && lb.names.length === 0) parts.push({ pts: POINTS.unnamed_banker, text: 'it reports using land banking but does not name the land banker', confidence: 'Reported', source_url: (arr(fin.land_banking).find((r) => UNNAMED.test(str(r.counterparty))) || {}).source_url });
  if (next) parts.push({ pts: POINTS.debt_24m, text: `${money(due24) || 'debt'} of debt comes due by ${WINDOW_END.slice(0, 7)}, starting with ${clip(next.instrument, 60)} ${next.maturity.length === 10 ? 'on' : 'in'} ${next.maturity}`, confidence: next.confidence, source_url: next.source_url });
  if (deal) parts.push({ pts: POINTS.deal, text: `it ${deal.text}`, confidence: deal.confidence, source_url: deal.source_url });
  if (ll) parts.push({ pts: POINTS.land_light, text: 'it states a land-light strategy', confidence: fin.lots?.confidence || 'Reported', source_url: fin.lots?.source_url || '' });
  if (ne) parts.push({ pts: POINTS.new_exec, text: `${ne.name} became ${clip(ne.title, 60)} in ${ne.in_role_since}`, confidence: ne.confidence, source_url: ne.source_url });
  if (!parts.length) continue;
  const tierPts = b.tier === 'Top 25' ? POINTS.top25 : b.tier === 'Top 50' ? POINTS.top50 : 0;
  const score = parts.reduce((s, p) => s + p.pts, 0) + tierPts;
  parts.sort((a, b) => b.pts - a.pts);
  const texts = parts.map((p) => p.text);
  const reason = texts.length > 1 ? `${texts.slice(0, -1).join(', ')}${texts.length > 2 ? ',' : ''} and ${texts[texts.length - 1]}` : texts[0];
  const contact = bestContact(b);
  const domainLink = lb.names.includes('Domain Real Estate Partners');
  csAll.push({
    score, rank: b.rank, builder: b.builder_id, tier: str(b.tier),
    reason: reason.charAt(0).toUpperCase() + reason.slice(1) + '.' + (domainLink ? ' Existing Domain relationship (public).' : ''),
    person: contact ? contact.name : 'no land or finance contact found', title: contact ? str(contact.title) : '',
    person_confidence: contact ? str(contact.confidence) : '', contact_details: publishedContact(contact),
    pct_optioned: pct, bankers_count: lb.names.length, bankers: lb.names.join(', '),
    next_maturity: next ? next.maturity : '', next_amount: next ? next.principal : null, due_24m: debt.length ? due24 : null,
    recent_deal: deal ? deal.text : '', land_light: ll ? 'Yes' : '', new_exec: ne ? `${ne.name}, ${clip(ne.title, 50)} (${ne.in_role_since})` : '',
    points: parts.map((p) => p.pts).concat(tierPts ? [tierPts] : []).join(' + '),
    confidence: lowestConf(parts[0].confidence, contact?.confidence) || str(parts[0].confidence), source_url: str(parts[0].source_url),
  });
}
csAll.sort((a, b) => b.score - a.score || a.rank - b.rank);
const csRows = csAll.slice(0, 30).map((r, i) => ({ priority: i + 1, ...r }));
const noContact = csRows.filter((r) => !r.title).length;
writeAtomic(path.join(EXTRAS, 'call-sheet.json'), {
  id: 'call-sheet',
  title: 'Call sheet: who to call and why',
  subtitle: `The ${csRows.length} builders with the strongest public reason for a land banker to call now (of ${csAll.length} with at least one reason), highest score first. ${csRows.length - noContact} have a named land or finance contact. Points are an estimate.`,
  is_estimate: true,
  method: `Estimate. Each builder earns points for public reasons to call, added up: ${POINTS.option_no_banker} if half or more of its lots are optioned and no land banker is publicly named (or ${POINTS.unnamed_banker} if it says it uses land banking but does not name the banker); ${POINTS.debt_24m} if any outstanding debt comes due by ${WINDOW_END} (same rules as the "Debt coming due" table); ${POINTS.deal} for a builder acquisition since the list was published (May 2026), as buyer or as the company bought; ${POINTS.land_light} if the first line of its land strategy states a land-light or asset-light approach; ${POINTS.new_exec} if a corporate land or finance executive took the seat in the last 12 months (on or after ${YEAR_AGO}); plus ${POINTS.top25} for a top-25 builder or ${POINTS.top50} for a top-50 builder. The top 30 are kept; ties go to the higher-ranked builder. The reason sentence lists the scoring facts, largest first, and the source column is the source of the largest. Person to call: a corporate land head first (someone whose title names land; acquisition before development), then treasury or capital markets, then the CFO, then any other corporate land-team executive, Verified before Reported before Inferred; if none is recorded the row says "no land or finance contact found" and no one else is substituted. Contact details are shown only when the company publishes them (pattern-built emails are left out). Named land bankers are read from the "Who banks whom" table (competitor research) so the names match it, falling back to the same name rules applied to the builder's own records if that table is missing; "none named" means none found in public sources, not that none exists. Left out: nonprofits (${Object.keys(EXCLUDE).filter((k) => EXCLUDE[k] === 'nonprofit').map((k) => byId.get(k)?.name || k).join(', ')}) and build-to-rent operators and contractors (${Object.keys(EXCLUDE).filter((k) => EXCLUDE[k] !== 'nonprofit').map((k) => byId.get(k)?.name || k).join(', ')}). What is missing: the owned-versus-optioned split is public for only ${B.filter((b) => isNum(b.derived?.pct_optioned)).length} builders and debt for ${withDebt}, so private builders score low on thin data, not on low need; start dates are recorded for about a quarter of executives. The weights are a first guess, printed so they can be changed. Run ${TODAY}.`,
  generated: GENERATED,
  order: 20,
  columns: [
    { key: 'priority', label: 'Priority', type: 'number' },
    { key: 'builder', label: 'Builder', type: 'builder_link' },
    { key: 'tier', label: 'Tier', type: 'text' },
    { key: 'reason', label: 'Why call now', type: 'text' },
    { key: 'person', label: 'Who to call', type: 'person' },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'person_confidence', label: 'Contact confidence', type: 'confidence' },
    { key: 'contact_details', label: 'Published phone or email', type: 'text' },
    { key: 'pct_optioned', label: '% of lots optioned', type: 'pct' },
    { key: 'bankers_count', label: 'Named land bankers', type: 'number' },
    { key: 'bankers', label: 'Land bankers named', type: 'text' },
    { key: 'next_maturity', label: 'Next debt due', type: 'date' },
    { key: 'next_amount', label: 'Next debt amount ($M)', type: 'usd_m' },
    { key: 'due_24m', label: 'All debt due in 24 months ($M)', type: 'usd_m' },
    { key: 'recent_deal', label: 'Recent acquisition', type: 'text' },
    { key: 'land_light', label: 'States land-light approach', type: 'text' },
    { key: 'new_exec', label: 'New land or finance executive', type: 'text' },
    { key: 'points', label: 'Points', type: 'text' },
    { key: 'score', label: 'Score', type: 'number' },
    { key: 'confidence', label: 'Confidence', type: 'confidence' },
    { key: 'source_url', label: 'Source', type: 'url' },
  ],
  rows: csRows.map(({ rank, ...r }) => r),
});

console.log(`mandate-screen: ${msRows.length} rows (${nWatch} watch, ${nChanged} changed hands)`);
console.log(`call-sheet: ${csRows.length} rows (of ${csAll.length} with a reason)`);
console.log(`debt-maturity-watch: ${dmRows.length} rows (${skippedDebt.unparsed} undated outstanding skipped, ${skippedDebt.past.length} past-dated skipped)`);
