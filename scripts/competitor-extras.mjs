#!/usr/bin/env node
// Builds the competitor insight tables in data/extras/ (contract: end of SCHEMA.md).
// Usage: node scripts/competitor-extras.mjs      (safe to re-run any time; skips builder files that do not parse)
// Inputs: data/spine.json, data/builders/*.fin.json (land_banking, competitor_links, lots, land_strategy),
//         data/competitors/*.json (builder_relationships), extras/competitor-work/millrose-terms-table.json (curated rows).
// Outputs: data/extras/competitor-builder-matrix.json, competitor-builder-links.json, millrose-pricing-and-terms.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRAS = path.join(ROOT, 'data/extras');
fs.mkdirSync(EXTRAS, { recursive: true });
const readJson = (f, dflt = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } };
const writeAtomic = (f, obj) => { const t = f + '.tmp-' + process.pid; fs.writeFileSync(t, JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(t, f); };
const now = () => { const d = new Date(Date.now() - 5 * 3600e3); return d.toISOString().slice(0, 19) + '-05:00'; };
const clip = (s, n) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[ ,;:]+\S*$/, '') + '…' : s; };

const spine = (readJson(path.join(ROOT, 'data/spine.json'), { builders: [] }).builders || []).slice().sort((a, b) => a.rank - b.rank);
const spineById = new Map(spine.map((b) => [b.builder_id, b]));

// ---- canonical financier names
const BIG4 = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
function canon(name) {
  const n = name || '';
  if (/millrose/i.test(n)) return 'Millrose Properties';
  if (/kennedy[- ]lewis/i.test(n)) return 'Kennedy Lewis';
  if (/angelo,? gordon|\btpg\b|essential housing|\bAG (essential|land|real estate)|\bAGWIP\b/i.test(n)) return 'TPG Angelo Gordon';
  if (/domain real estate|\bdw partners\b|\bdomain rep\b/i.test(n)) return 'Domain Real Estate Partners';
  if (/forestar/i.test(n)) return 'Forestar Group';
  if (/\bgtis\b|brightshore/i.test(n)) return 'GTIS Partners (Brightshore Capital)';
  if (/v[aä]rde/i.test(n)) return 'Värde Partners';
  return n.replace(/\s*\(.*$/, '').trim();
}
// ---- no-link rule, mirrored from scripts/build.mjs (app-export) so the tables and the build agree.
// A row that records a NEGATIVE or merely indirect finding is context, never a link.
const str = (v) => (v == null ? '' : String(v));
const NO_LINK = /\bno (public|known|direct|documented|current)?\s*(link|financing|land[- ]?bank\w*|lending|relationship|tie)\b|\bno public\b|\bno link\b|not found|none found|nothing found|people link only|\bindirect\b|contact only|only (public )?tie is personal|^no land banker|no financing relationship/i;
const leadOf = (t) => { const x = str(t).trim().slice(0, 260); const i = x.search(/[.:;]\s/); return i > 12 ? x.slice(0, i + 1) : x; };
const NO_LINK_ANYWHERE = /no public (source|evidence|record|statement|link|financing|relationship|disclosure)|no evidence (that|of)|does not (land[- ]?bank|finance)|no (direct|known|documented) (financing|land[- ]?bank)|no financing relationship|people link only/i;
const isNoLink = (t) => NO_LINK.test(leadOf(t)) || NO_LINK_ANYWHERE.test(str(t));
// A counterparty the source does not name (aggregates), same as the build's GENERIC_PARTY.
const GENERIC_PARTY = /not named|unnamed|undisclosed|third[- ]party land bank|land bank entit|not disclosed|not publicly|aggregate|not identif|not individually|^various|^all land|^land bankers?\b|^lot bankers?\b|^third[- ]party|^no land banker|entity name not/i;
// Financing that is not land banking (a term loan, JV equity, preferred, EB-5 loan) is kept but labelled as such.
const LANDBANK_WORDS = /land[- ]?bank|lot[- ]?bank|\boption(s|ed)?\b|homesite|takedown|forward[- ]flow|finished[- ]lot program|lot purchase/i;
const OTHER_FIN_WORDS = /term loan|subordinated|credit facility|revolver|preferred|joint venture|\bjv\b|equity partner|construction loan|eb-5|loan offering|lender|lending|lot developer|master developer/i;
const OTHER_STRONG = /not lot options|term loan|subordinated|preferred (equity|stock|instrument)|terms of the preferred|eb-5|equity joint[- ]venture|joint[- ]venture (capital )?partner|homebuilding joint venture|majority-owned .{0,20}lot developer/i;
const linkType = (t) => {
  const lead = leadOf(t), all = str(t), OTHER = 'Other financing (not land banking)';
  if (OTHER_STRONG.test(lead)) return OTHER;
  if (LANDBANK_WORDS.test(all)) return 'Land banking';   // a package that includes land banking counts as land banking
  return OTHER_STRONG.test(all) || OTHER_FIN_WORDS.test(all) ? OTHER : 'Land banking';
};
// Not a financing link to this builder: part-owners, master developers, a partner of someone else, people-only ties,
// a Kennedy Lewis row that only restates that it manages Millrose (the Millrose row carries the link).
const NOT_A_LINK = /part-owner|master developers? of|capital partner of brookfield|not a land-bank facility|led by .{0,60}former (president|ceo)|is Millrose'?s? (external )?manager|Kennedy Lewis-managed Millrose|landed in Millrose|affiliate of Kennedy Lewis Investment Management, is Millr/i;
// For Domain itself (the readers), never show a snippet-only row.
const domainSnippet = (l) => l.financier === 'Domain Real Estate Partners' && /seen only in (a )?search|snippet/i.test(l.what);
// links whose own text says the firm is an owner, client, LP investor, land seller or historical partner, not a financier of the builder's lots
const NOT_FINANCING = /owner-client|not a land banker|investor \(limited partner\)|investor in the lender|not a borrower|builder investor|land sale|\bsold (about |roughly )?[\d,]+ acres|majority owner|general contractor|^historical|family's land developer|named as the client|indirect people link|no later deal found|describes a sale|\bsold \w+ [\d,]+ acres/i;
const NOT_FINANCIER = new Set(['Berkshire Hathaway', 'Blueprint Capital', 'Montgomery Street Partners', 'Van Tuyl Companies', 'AREY Group', 'Jabez Development']);
const UNNAMED = /^all land banks|not (publicly )?(named|disclosed|identified)|undisclosed|unnamed|un-named|\bvarious\b|third[- ]part(y|ies)|no land banker|land sellers|none named|not public|multiple (land bankers|counterparties)|land bankers? \(|^land bank(er|ers|ing)\b/i;
const NONE_STMT = /^no land banker|virtually no land banking|does not use land bank/i;
const CONF_RANK = { Verified: 3, Reported: 2, Inferred: 1 };

// ---- collect links
const links = [];   // { builder_id, financier, ftype, what, amount_usd_m, lots, date, confidence, source_url, seen_in }
const info = new Map(spine.map((b) => [b.builder_id, { hasFin: false, pct: null, optioned: null, total: null, lotsAsOf: '', strategy: '', unnamed: [], noneStmt: null, lotsSrc: '' }]));
const skipped = [];
const bdir = path.join(ROOT, 'data/builders');
for (const f of fs.existsSync(bdir) ? fs.readdirSync(bdir).filter((x) => x.endsWith('.fin.json')).sort() : []) {
  const d = readJson(path.join(bdir, f));
  if (!d || !d.financing || !info.has(d.builder_id)) { skipped.push(f); continue; }
  const fin = d.financing, I = info.get(d.builder_id);
  I.hasFin = true;
  const L = fin.lots || {};
  I.optioned = typeof L.optioned === 'number' ? L.optioned : null; I.total = typeof L.total_controlled === 'number' ? L.total_controlled : null;
  I.pct = typeof L.pct_optioned === 'number' ? L.pct_optioned : (I.optioned != null && I.total ? Math.round((1000 * I.optioned) / I.total) / 10 : null);
  if (I.pct != null && I.pct > 0 && I.pct <= 1) I.pct = Math.round(I.pct * 1000) / 10;   // tolerate fractions
  I.lotsAsOf = L.as_of || ''; I.lotsSrc = L.source_url || ''; I.strategy = fin.land_strategy || '';
  for (const r of Array.isArray(fin.land_banking) ? fin.land_banking : []) {
    const cp = r.counterparty || '', c = canon(cp), big = BIG4.includes(c);
    if (NONE_STMT.test(cp)) { I.noneStmt = r; continue; }
    if (!big && UNNAMED.test(cp)) { if (['Land banker', 'Investor'].includes(r.counterparty_type)) I.unnamed.push(r); continue; }
    if (!big && !['Land banker', 'Investor'].includes(r.counterparty_type)) continue;     // developers, JV partners, affiliates are not land bankers
    links.push({ builder_id: d.builder_id, financier: c, ftype: big ? 'Land banker' : r.counterparty_type, what: r.description || '', amount_usd_m: r.amount_usd_m ?? null, lots: r.lots ?? null, date: r.date || '', confidence: r.confidence, source_url: r.source_url || '', seen_in: 'Builder research (land_banking)' });
  }
  for (const r of Array.isArray(fin.competitor_links) ? fin.competitor_links : []) {
    if (!r.firm || /^(no|none)\b/i.test(r.relationship || '') || /no (public|publicly|known|disclosed) (link|relationship|connection)|not (publicly )?linked|no evidence|none found|no mention/i.test(r.relationship || '')) continue;
    if (UNNAMED.test(r.firm) && !BIG4.includes(canon(r.firm))) { I.unnamed.push(r); continue; }
    links.push({ builder_id: d.builder_id, financier: canon(r.firm), ftype: 'Land banker', what: r.relationship || '', amount_usd_m: null, lots: null, date: r.date || '', confidence: r.confidence, source_url: r.source_url || '', seen_in: 'Builder research (competitor_links)' });
  }
}
const cdir = path.join(ROOT, 'data/competitors');
for (const f of fs.existsSync(cdir) ? fs.readdirSync(cdir).filter((x) => x.endsWith('.json')).sort() : []) {
  const d = readJson(path.join(cdir, f)); if (!d) { skipped.push(f); continue; }
  for (const r of d.builder_relationships || []) {
    if (!r.builder_id || !info.has(r.builder_id)) continue;
    let fin = canon(d.name), what = r.description || '';
    if (d.competitor_id === 'new-entrants') { const m = what.match(/^([^:]{2,60}):\s*(.*)$/s); if (!m) continue; fin = canon(m[1]); what = m[2]; }
    links.push({ builder_id: r.builder_id, financier: fin, ftype: d.type === 'Lender' ? 'Lender' : 'Land banker', what, amount_usd_m: r.amount_usd_m ?? null, lots: r.lots ?? null, date: r.date || '', confidence: r.confidence, source_url: r.source_url || '', seen_in: `Competitor profile (${d.competitor_id})` });
  }
}
// de-duplicate the same builder + financier + source; drop rows that are not financing
const lseen = new Set();

const selfLink = (l) => { const b = spineById.get(l.builder_id); if (!b) return false; const stem = b.name.toLowerCase().split(/\s+/).slice(0, 2).join(' '); return l.financier.toLowerCase().startsWith(stem); }; // a builder's own land arm
const rejectedNoLink = links.filter((l) => isNoLink(l.what) || GENERIC_PARTY.test(l.financier));
for (const l of links) l.kind = linkType(l.what);
const notFinancing = (l) => NOT_FINANCING.test(BIG4.includes(l.financier) ? str(l.what).replace(/^historical:?\s*/i, '') : l.what);
const ulinks = links.filter((l) => !(isNoLink(l.what) || GENERIC_PARTY.test(l.financier) || NOT_FINANCIER.has(l.financier) || notFinancing(l) || NOT_A_LINK.test(l.what) || domainSnippet(l) || selfLink(l))).filter((l) => { const k = `${l.builder_id}|${l.financier}|${l.source_url}`; if (lseen.has(k)) return false; lseen.add(k); return true; });

// ---- table 1: matrix (one row per top-100 builder)
const cell = (ls) => { if (!ls.length) return ''; const best = ls.slice().sort((a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0) || (b.date || '').localeCompare(a.date || ''))[0];
  const amt = ls.map((l) => l.amount_usd_m).filter((v) => typeof v === 'number').sort((a, b) => b - a)[0];
  const lb = ls.some((l) => l.kind === 'Land banking');
  return `${lb ? 'Land banking' : 'Other financing only'} (${best.confidence}${amt ? `, up to $${Math.round(amt).toLocaleString('en-US')}m` : ''}${best.date ? `, ${best.date}` : ''})`; };
// land-light only when the builder's strategy text leads with it or says it is by design; negated or "rather than" phrasing does not count
const LIGHT = /^\s*(land|asset|capital)[- ](light|lite)\b|(land|asset|capital)[- ](light|lite) by (design|its own)/i;
const NOT_LIGHT = /\bno stated (land|asset)[- ]light|not (land|asset)[- ]light|rather than (land|asset)[- ]light|does not use '?(land|asset)[- ]light/i;
const mrows = spine.map((b) => {
  const I = info.get(b.builder_id), ls = ulinks.filter((l) => l.builder_id === b.builder_id);
  const by = (n) => ls.filter((l) => l.financier === n);
  const others = [...new Set(ls.filter((l) => !BIG4.includes(l.financier)).map((l) => l.financier))];
  const named = [...new Set(ls.map((l) => l.financier))];
  const namedLB = [...new Set(ls.filter((l) => l.kind === 'Land banking').map((l) => l.financier))];
  let ws = '', why = '';
  if (!I.hasFin) why = 'Financing research not landed yet';
  else if (I.noneStmt && !namedLB.length) why = 'Company says it does little or no land banking';
  else if (!namedLB.length) {
    const heavy = I.pct != null && I.pct >= 50, light = LIGHT.test(I.strategy) && !NOT_LIGHT.test(I.strategy), unn = I.unnamed.length > 0;
    if (heavy || light || unn) {
      ws = 'Yes';
      why = [unn ? 'uses land banking but the banker is not named' : '', heavy ? `${I.pct}% of lots optioned` : '', light ? 'states a land-light strategy' : ''].filter(Boolean).join('; ');
      why = why.charAt(0).toUpperCase() + why.slice(1);
    } else why = I.pct != null ? `${I.pct}% optioned; no land banker named` : 'No land banker named; option share not public';
    if (named.length) why += `; other financing only from ${named.join(', ')}`;
  } else why = `${namedLB.length} land banker${namedLB.length > 1 ? 's' : ''} publicly linked` + (named.length > namedLB.length ? `; other financing from ${named.filter((n) => !namedLB.includes(n)).join(', ')}` : '');
  const best = ls.slice().sort((a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0))[0];
  return { rank: b.rank, builder: b.builder_id, pct_optioned: I.pct, optioned_lots: I.optioned,
    domain: cell(by('Domain Real Estate Partners')), millrose: cell(by('Millrose Properties')), kennedy_lewis: cell(by('Kennedy Lewis')), tpg_ag: cell(by('TPG Angelo Gordon')),
    others: others.join('; '), links: namedLB.length, other_financing: named.length - namedLB.length, white_space: ws, basis: why,
    confidence: best ? best.confidence : (I.hasFin ? 'Inferred' : ''), source_url: best ? best.source_url : (I.unnamed[0]?.source_url || I.lotsSrc || '') };
});
const done = mrows.filter((r) => info.get(r.builder).hasFin).length;
writeAtomic(path.join(EXTRAS, 'competitor-builder-matrix.json'), {
  id: 'competitor-builder-matrix', title: 'Who banks whom: land bankers publicly linked to each top-100 builder',
  subtitle: `${mrows.filter((r) => r.links > 0).length} builders have a publicly named land banker or lot-option financier (${mrows.filter((r) => !r.links && r.other_financing).length} more have only other financing named); ${mrows.filter((r) => r.white_space).length} are flagged white space (heavy option use or land-light, no banker named). Financing research is in for ${done} of ${spine.length} builders.`,
  is_estimate: true,
  method: 'Facts, then one judgement. Each filled cell is a public link. "Land banking" means at least one source describes a land-bank, lot-option or homesite-option arrangement with that firm; "Other financing only" means the only public tie is another kind of financing (for example a term loan Kennedy Lewis agented for United Homes Group, or JV equity). Rows whose text records no link, an indirect or people-only link, or an unnamed counterparty are never counted (same rule as the app build). Each cell is a public link found either in that builder\'s financing research (its land_banking and competitor_links rows, from filings and press) or in the competitor profile for that financier; the bracket shows the strongest confidence tag, the largest disclosed amount and the latest date, and every underlying link with its source is in the "Builder-financier links" table. The white-space flag is our estimate, not a fact: it is set when no land banker or lot-option financier is publicly named for the builder AND at least one of these holds: 50% or more of controlled lots are optioned, the builder describes itself as land-light / asset-light, or it reports using land banking without naming the banker. A blank white-space cell with zero links means the builder owns most of its land or its option share is not public. Absence of a public link is not proof of no relationship: most land-bank deals are never announced, and Domain\'s own book is not public. Left out on purpose: developers, JV partners and affiliates selling lots, land sellers, owners and acquirers (e.g. Berkshire Hathaway), rental-community clients, builders that are only limited partners in a lender\'s fund, and historical (pre-2015) partners. Other named financiers include equity JV capital (e.g. GTIS/Brightshore, Presidio) and captive lot developers (Forestar for D.R. Horton), which compete for the same land.',
  generated: now(), order: 20,
  columns: [
    { key: 'rank', label: 'Rank', type: 'number' }, { key: 'builder', label: 'Builder', type: 'builder_link' },
    { key: 'pct_optioned', label: 'Lots optioned %', type: 'pct' }, { key: 'optioned_lots', label: 'Optioned lots', type: 'number' },
    { key: 'domain', label: 'Domain (public)', type: 'text' }, { key: 'millrose', label: 'Millrose', type: 'text' }, { key: 'kennedy_lewis', label: 'Kennedy Lewis', type: 'text' }, { key: 'tpg_ag', label: 'TPG Angelo Gordon', type: 'text' },
    { key: 'others', label: 'Other named financiers', type: 'text' }, { key: 'links', label: 'Land bankers named', type: 'number' }, { key: 'other_financing', label: 'Other financiers named', type: 'number' },
    { key: 'white_space', label: 'White space (estimate)', type: 'text' }, { key: 'basis', label: 'Basis', type: 'text' },
    { key: 'confidence', label: 'Strongest tag', type: 'confidence' }, { key: 'source_url', label: 'Best source', type: 'url' } ],
  rows: mrows });

// ---- table 2: every link, one row each, with its own source
const lrows = ulinks.map((l) => ({ rank: spineById.get(l.builder_id).rank, builder: l.builder_id, financier: l.financier, link_type: l.kind, financier_type: l.ftype, what: clip(l.what, 260),
  amount_usd_m: typeof l.amount_usd_m === 'number' ? l.amount_usd_m : null, lots: typeof l.lots === 'number' ? l.lots : null, date: l.date, confidence: l.confidence, source_url: l.source_url, seen_in: l.seen_in }))
  .sort((a, b) => a.rank - b.rank || a.financier.localeCompare(b.financier));
const finCount = {}; for (const l of lrows) (finCount[l.financier] ||= new Set()).add(l.builder);
const top = Object.entries(finCount).sort((a, b) => b[1].size - a[1].size).slice(0, 6).map(([n, s]) => `${n} ${s.size}`).join(', ');
writeAtomic(path.join(EXTRAS, 'competitor-builder-links.json'), {
  id: 'competitor-builder-links', title: 'Builder-financier links: every public link with its source',
  subtitle: `${lrows.length} sourced links between top-100 builders and land bankers or lot-option financiers. Builders per financier: ${top || 'none yet'}.`,
  is_estimate: false,
  method: 'One row per public link. Link type separates land banking (land-bank, lot-option or homesite-option arrangements) from other financing (term loans, JV equity, preferred, EB-5 loans). Rows whose text records no link ("No public link found"), an indirect or people-only link, or an unnamed or aggregate counterparty are excluded, using the same rule as the app build, as are LP stakes, land sales, owner-clients and a builder\'s own land arm. Taken as stated from the builder research files (land_banking rows typed Land banker or Investor with a named counterparty, and competitor_links rows) and from the competitor profiles (builder_relationships). The same builder and financier can appear more than once when different sources state it. Confidence is the tag on the underlying row: Verified = primary source (filing or company release), Reported = trade press, Inferred = derived or snippet-only.',
  generated: now(), order: 21,
  columns: [ { key: 'rank', label: 'Rank', type: 'number' }, { key: 'builder', label: 'Builder', type: 'builder_link' }, { key: 'financier', label: 'Financier', type: 'text' }, { key: 'link_type', label: 'Link type', type: 'text' }, { key: 'financier_type', label: 'Type', type: 'text' },
    { key: 'what', label: 'What is public', type: 'text' }, { key: 'amount_usd_m', label: 'Amount', type: 'usd_m' }, { key: 'lots', label: 'Lots', type: 'number' }, { key: 'date', label: 'Date', type: 'date' },
    { key: 'confidence', label: 'Confidence', type: 'confidence' }, { key: 'source_url', label: 'Source', type: 'url' }, { key: 'seen_in', label: 'Found in', type: 'text' } ],
  rows: lrows });

// ---- table 3: Millrose pricing and terms (curated rows, each tied to a source that must be in the Millrose profile)
const spec = readJson(path.join(ROOT, 'extras/competitor-work/millrose-terms-table.json'));
const mr = readJson(path.join(cdir, 'millrose-properties.json'));
let termsMsg = 'millrose-pricing-and-terms: no curated spec yet';
if (spec && mr) {
  const known = new Set([...(mr.facts || []), ...(mr.builder_relationships || []), ...(mr.debt || [])].map((r) => r.source_url));
  const rows = [], orphan = [];
  for (const r of spec.rows || []) { if (r.confidence !== 'Inferred' && !known.has(r.source_url)) orphan.push(r.item); rows.push(r); }
  writeAtomic(path.join(EXTRAS, 'millrose-pricing-and-terms.json'), { id: 'millrose-pricing-and-terms', title: spec.title, subtitle: spec.subtitle, is_estimate: !!spec.is_estimate, method: spec.method, generated: now(), order: 22, columns: spec.columns, rows });
  termsMsg = `millrose-pricing-and-terms: ${rows.length} rows` + (orphan.length ? `  WARNING source not in Millrose profile for: ${orphan.join(' | ')}` : '');
}

console.log(`competitor-builder-matrix: ${mrows.length} rows, ${mrows.filter((r) => r.links > 0).length} with a named financier, ${mrows.filter((r) => r.white_space).length} white space, fin files in for ${done}`);
console.log(`competitor-builder-links: ${lrows.length} rows (${links.length - ulinks.length} duplicate or non-financing mentions left out)`);
console.log(termsMsg);
if (skipped.length) console.log(`skipped (did not parse or not in spine): ${skipped.join(', ')}`);
