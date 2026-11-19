#!/usr/bin/env node
// Merges everything under data/ into data/dist/domain.json and data/dist/coverage.json.
// Safe to run by anyone at any time: no network, never crashes on a bad input file,
// writes to a temp file and renames so readers never see a half-written file.
// Usage: node scripts/build.mjs [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile } from './validate.mjs';
import { orgModel, isRegionalHead } from '../app/lib/org.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.DOMAIN_DATA_DIR ? path.resolve(process.env.DOMAIN_DATA_DIR) : path.join(ROOT, 'data'); // override is for tests
const DIST = path.join(DATA, 'dist');
const LASTGOOD = path.join(DIST, '.lastgood');
const QUIET = process.argv.includes('--quiet');
const TODAY = new Date().toISOString().slice(0, 10);

const CONF_RANK = { Verified: 3, Reported: 2, Inferred: 1 };
const LAND_ROLES = ['Land Acquisition', 'Land Development', 'Land (other)'];
const FIN_ROLES = ['CFO', 'Treasury/Capital Markets', 'Finance (other)'];
const CSUITE_ROLES = ['CEO', 'Chair/Founder', 'President/COO'];
export const PRIORITY_ORDER = ['Land', 'Finance', 'C-suite', 'Regional', 'Division', 'Other'];
const ROLE_ORDER = ['Land Acquisition', 'Land Development', 'Land (other)', 'CFO', 'Treasury/Capital Markets', 'Finance (other)', 'CEO', 'Chair/Founder', 'President/COO', 'Regional President', 'Division President', 'Legal/GC', 'Operations (other)', 'Sales/Marketing', 'Board', 'Other'];
const LEVEL_ORDER = ['Corporate', 'Regional', 'Division'];
// Names used to recognise the four firms Domain asked about, wherever they appear.
const NAMED_FIRMS = [
  { firm: 'Millrose Properties', re: /millrose/i },
  { firm: 'Domain Real Estate Partners', re: /\bdomain real estate|\bdw partners/i },
  { firm: 'TPG Angelo Gordon', re: /angelo[\s,]*gordon|\btpg\b|essential housing/i },
  { firm: 'Kennedy Lewis', re: /kennedy[\s-]*lewis/i },
];
// A counterparty the source does not name ("unnamed land banks", "not named in filings", aggregates).
const GENERIC_PARTY = /not named|unnamed|undisclosed|third[- ]party land bank|land bank entit|not disclosed|not publicly|aggregate|not identif|not individually|^various|^all land|^land bankers?\b|^lot bankers?\b|^third[- ]party|^no land banker|entity name not/i;
// A competitor-link row that records a negative finding ("No public link found").
// A row that records a NEGATIVE or merely indirect finding ("No public link found", "Indirect people link only",
// "Historical seller-side contact only") is not a financing relationship and must never count as a land-banker link.
// The test reads the row's opening statement, where researchers state such findings.
const NO_LINK = /\bno (public|known|direct|documented|current)?\s*(link|financing|land[- ]?bank\w*|lending|relationship|tie)\b|\bno public\b|\bno link\b|not found|none found|nothing found|people link only|\bindirect\b|contact only|only (public )?tie is personal|^no land banker/i;
const leadOf = (t) => { const x = str(t).trim().slice(0, 260); const i = x.search(/[.:;]\s/); return i > 12 ? x.slice(0, i + 1) : x; };
// ...and an explicit denial anywhere in the row ("No public source says X land-banks its lots") also disqualifies it
const NO_LINK_ANYWHERE = /no public (source|evidence|record|statement|link|financing|relationship|disclosure)|no evidence (that|of)|does not (land[- ]?bank|finance)|no (direct|known|documented) (financing|land[- ]?bank)/i;
const isNoLink = (t) => NO_LINK.test(leadOf(t)) || NO_LINK_ANYWHERE.test(str(t));
const NEGATIVE_LINK = { test: isNoLink }; // kept under the old name for any caller
function canonFirm(name) {
  const n = str(name);
  for (const nf of NAMED_FIRMS) if (nf.re.test(n)) return nf.firm;
  return n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/,?\s+(Inc\.?|LLC|L\.L\.C\.|L\.P\.|LP|Corp\.?|Corporation)\s*$/i, '').replace(/\s+/g, ' ').trim();
}

const issues = []; // { file, status, errors[] }
const log = (...a) => { if (!QUIET) console.log(...a); };

// ---------- small helpers ----------
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const listJson = (dir) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.')).sort(); } catch { return []; } };
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? '' : String(v));
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const slug = (s) => str(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ''))];

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// Load a JSON file that must pass `check` (returns array of error strings).
// On failure fall back to the last copy that passed, so a file caught mid-write
// never removes a builder that was already in the map.
function loadChecked(file, check) {
  const rel = path.relative(path.dirname(DATA), file);
  const cache = path.join(LASTGOOD, path.relative(DATA, file));
  let errs = [], warns = [], data = null;
  try {
    const res = check(file);
    errs = res.errs || []; warns = res.warns || [];
    if (!errs.length) data = readJson(file);
  } catch (e) { errs = ['could not read: ' + e.message]; }
  if (data) {
    try {
      const raw = fs.readFileSync(file);
      if (!exists(cache) || !fs.readFileSync(cache).equals(raw)) { fs.mkdirSync(path.dirname(cache), { recursive: true }); const t = cache + '.tmp'; fs.writeFileSync(t, raw); fs.renameSync(t, cache); }
    } catch { /* cache is best-effort */ }
    return { data, status: 'ok', warns };
  }
  if (exists(cache)) {
    try {
      data = readJson(cache);
      issues.push({ file: rel, status: 'invalid, using last good copy', errors: errs.slice(0, 8) });
      return { data, status: 'stale', warns };
    } catch { /* fall through */ }
  }
  let pending = null;
  try { const d = readJson(file); pending = { people: arr(d.people).length, debt: arr(d.financing?.debt).length }; } catch { /* unparseable */ }
  issues.push({ file: rel, status: 'skipped (failed validation)', errors: errs.slice(0, 8), pending_rows: pending });
  return { data: null, status: 'skipped', warns };
}
const parseOnly = (shape) => (file) => { try { const d = readJson(file); return { errs: shape(d) || [], warns: [] }; } catch (e) { return { errs: ['invalid JSON: ' + e.message], warns: [] }; } };

// ---------- name handling ----------
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'cpa', 'esq', 'phd', 'mba']);
export function normName(name) {
  return str(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|".*?"|“.*?”/g, ' ').replace(/[^a-z\s'-]/g, ' ').replace(/['-]/g, '')
    .split(/\s+/).filter((t) => t && t.length > 1 && !SUFFIX.has(t)).join(' ');
}

function priorityGroup(p) {
  if (LAND_ROLES.includes(p.role_category)) return 'Land';
  if (FIN_ROLES.includes(p.role_category)) return 'Finance';
  if (CSUITE_ROLES.includes(p.role_category)) return 'C-suite';
  if (p.role_category === 'Regional President') return 'Regional';
  if (p.role_category === 'Division President') return 'Division';
  if (p.level === 'Regional') return 'Regional';
  if (p.level === 'Division') return 'Division';
  return 'Other';
}
const tierOf = (rank) => (rank == null ? '' : rank <= 25 ? 'Top 25' : rank <= 50 ? 'Top 50' : rank <= 100 ? 'Top 100' : 'Unranked');

function mergePeople(rows) {
  // rows: [{...person, _from}] ; returns de-duplicated list
  const byKey = new Map();
  for (const r of rows) {
    const key = normName(r.name) || slug(r.name);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  const out = [];
  for (const [key, group] of byKey) {
    group.sort((a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0) || str(b.source_date).localeCompare(str(a.source_date)) || (a._from === 'people' ? -1 : 1));
    const keep = { ...group[0] };
    const also = [];
    for (const o of group.slice(1)) {
      for (const k of ['geography', 'reports_to', 'email', 'phone', 'in_role_since', 'prior_role']) {
        if (!keep[k] && o[k]) { keep[k] = o[k]; if (k === 'reports_to') keep.reports_to_confidence = o.reports_to_confidence; if (k === 'email') keep.email_confidence = o.email_confidence; }
      }
      if (o.note && !keep.note) keep.note = o.note; // one note per person: the kept row's, else the first other one
      if (isUrl(o.source_url) && o.source_url !== keep.source_url) also.push({ title: o.title, confidence: o.confidence, source_url: o.source_url, source_title: o.source_title || '', source_date: o.source_date || '' });
      else if (o.title && o.title !== keep.title) also.push({ title: o.title, confidence: o.confidence, source_url: o.source_url || '', source_title: o.source_title || '', source_date: o.source_date || '' });
    }
    keep.also_listed = also;
    keep.merged_rows = group.length;
    keep._key = key;
    delete keep._from;
    out.push(keep);
  }
  return out;
}

// maturity strings: "2031-04", "2031", "2031-04-15", or free text containing a year
function maturityKey(m) {
  const s = str(m);
  let x = s.match(/(20\d\d)-(\d\d)(?:-(\d\d))?/);
  if (x) return `${x[1]}-${x[2]}-${x[3] || '28'}`;
  x = s.match(/(20\d\d)/);
  if (x) return `${x[1]}-12-31`;
  return '';
}

function sourceType(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Other'; }
  if (/sec\.gov$/.test(host)) return 'SEC filing';
  if (/web\.archive\.org$/.test(host)) return 'Archive capture';
  if (/(\.gov|\.us)$/.test(host)) return 'Government record';
  if (/(builderonline|probuilder|housingwire|bizjournals|zonda|builder\.media|nahb|constructiondive|therealdeal|bisnow|globest|costar|multihousingnews|homebuilderdigest|bdmag)\./.test(host)) return 'Trade press';
  if (/(businesswire|prnewswire|globenewswire|accesswire|newsfilecorp|einpresswire)\./.test(host)) return 'Press release';
  if (/(reuters|bloomberg|wsj|cnbc|nytimes|ft\.com|marketwatch|yahoo|seekingalpha|fool\.com|barrons|forbes|fortune)\./.test(host)) return 'News';
  if (/^(investors?|ir)\./.test(host) || /investor/.test(host)) return 'Company investor site';
  return 'Web';
}

// ---------- load ----------
fs.mkdirSync(DIST, { recursive: true });
const t0 = Date.now();

let spine = null;
const spineRes = loadChecked(path.join(DATA, 'spine.json'), parseOnly((d) => (Array.isArray(d.builders) ? [] : ['builders must be an array'])));
if (spineRes.data) spine = spineRes.data;
else if (!exists(path.join(DATA, 'spine.json'))) { issues.pop(); issues.push({ file: 'data/spine.json', status: 'missing: builders listed from files present, no ranks', errors: [] }); }

const spineIds = new Set(arr(spine?.builders).map((r) => r.builder_id));
const builderFiles = listJson(path.join(DATA, 'builders'));
const partsById = new Map(); // id -> { people, extras:[], fin, files:[] }
const partOf = (id) => { if (!partsById.has(id)) partsById.set(id, { people: null, extras: [], fin: null, files: [] }); return partsById.get(id); };
// Board directive D4: research agents save early, so INCLUDE any builder file that parses. Validator messages mark
// the builder "in progress"; a row with its own problem (no source, bad enum) is dropped and counted; only a file
// that does not parse is left out (its last parseable copy is used if there is one).
const ROW_ERR = /^(people|land_banking|debt|capital_events|joint_ventures|competitor_links|ma)\[(\d+)\]/;
let rowsDropped = 0;
function loadBuilderFile(file, fname) {
  const rel = path.relative(path.dirname(DATA), file);
  const cache = path.join(LASTGOOD, path.relative(DATA, file));
  let d = null, raw = null;
  try { raw = fs.readFileSync(file); d = JSON.parse(raw.toString('utf8')); } catch { d = null; }
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    try { if (!exists(cache) || !fs.readFileSync(cache).equals(raw)) { fs.mkdirSync(path.dirname(cache), { recursive: true }); const t = cache + '.tmp'; fs.writeFileSync(t, raw); fs.renameSync(t, cache); } } catch { /* cache is best-effort */ }
  } else {
    d = null;
    if (exists(cache)) { try { d = readJson(cache); issues.push({ file: rel, status: 'does not parse (probably mid-write): using the last copy that did', errors: [] }); } catch { d = null; } }
    if (!d) { issues.push({ file: rel, status: 'skipped (does not parse)', errors: ['invalid JSON'] }); return { data: null, status: 'skipped', messages: [], dropped: 0 }; }
    file = cache;
  }
  let errs = [], warns = [];
  try { const v = validateFile(file); errs = v.errs || []; warns = v.warns || []; } catch (e) { errs = ['validator failed: ' + e.message]; }
  // when validating the cached copy, a "file name does not start with builder_id" style message still applies; keep it
  if (!d.part) d.part = /\.fin\.json$/.test(fname) ? 'financing' : /\.people\.json$/.test(fname) ? 'people' : 'people_extra';
  if (!errs.length) return { data: d, status: file === cache ? 'stale' : 'ok', messages: [], dropped: 0, warns };
  const drop = {}; const fileLevel = []; const rowMsgs = [];
  for (const e of errs) {
    const m = e.match(ROW_ERR);
    if (m) { (drop[m[1]] = drop[m[1]] || new Set()).add(Number(m[2])); rowMsgs.push(e); }
    else if (/^financing\.lots/.test(e)) { if (d.financing) d.financing.lots = null; rowMsgs.push(e + ' (lots left out)'); }
    else if (/^(financing\.)?key_metrics/.test(e)) { if (d.financing) d.financing.key_metrics = null; rowMsgs.push(e + ' (key metrics left out)'); }
    else fileLevel.push(e);
  }
  let dropped = 0;
  const cut = (holder, key) => { if (holder && Array.isArray(holder[key]) && drop[key]) { const before = holder[key].length; holder[key] = holder[key].filter((_, i) => !drop[key].has(i)); dropped += before - holder[key].length; } };
  cut(d, 'people'); cut(d, 'ma');
  for (const k of ['land_banking', 'debt', 'capital_events', 'joint_ventures', 'competitor_links']) cut(d.financing, k);
  rowsDropped += dropped;
  issues.push({ file: rel, status: `included, research in progress${dropped ? `; ${dropped} row(s) left out` : ''}`, errors: [...fileLevel, ...rowMsgs].slice(0, 8), rows_dropped: dropped, in_progress: true });
  return { data: d, status: 'in_progress', messages: [...fileLevel, ...rowMsgs], dropped, warns };
}
for (const f of builderFiles) {
  const full = path.join(DATA, 'builders', f);
  const res = loadBuilderFile(full, f);
  const idFromName = f.replace(/\.(people|divisions|fin|[a-z0-9_-]+)\.json$/i, '');
  const id = spineIds.has(idFromName) ? idFromName : (typeof res.data?.builder_id === 'string' && res.data.builder_id) || idFromName;
  if (!res.data && !spineIds.has(id)) continue; // a bad file for an unknown builder is listed as an issue, not shown as a builder
  const slot = partOf(id);
  slot.files.push({ file: f, status: res.status, rows_dropped: res.dropped || 0, messages: (res.messages || []).slice(0, 6) });
  if (!res.data) continue;
  const d = res.data;
  if (d.part === 'people') { if (slot.people) slot.extras.push(d); else slot.people = d; }
  else if (d.part === 'people_extra') slot.extras.push(d);
  else if (d.part === 'financing' && d.financing && typeof d.financing === 'object') slot.fin = d;
}

const competitors = [];
for (const f of listJson(path.join(DATA, 'competitors'))) {
  const res = loadChecked(path.join(DATA, 'competitors', f), parseOnly((d) => (d && (d.name || d.competitor_id) ? [] : ['name / competitor_id missing'])));
  if (res.data) competitors.push({ competitor_id: res.data.competitor_id || f.replace(/\.json$/, ''), ...res.data, facts: arr(res.data.facts), builder_relationships: arr(res.data.builder_relationships), debt: arr(res.data.debt), people: arr(res.data.people), gaps: arr(res.data.gaps), sources_consulted: arr(res.data.sources_consulted) });
}

let maIndustry = { retrieved: '', deals: [] };
if (exists(path.join(DATA, 'ma_industry.json'))) {
  const res = loadChecked(path.join(DATA, 'ma_industry.json'), parseOnly((d) => (Array.isArray(d.deals) ? [] : ['deals must be an array'])));
  if (res.data) maIndustry = res.data;
}

let feed = { generated: '', window_days: 90, rubric_version: '', articles: [] };
if (exists(path.join(DATA, 'feed', 'articles.json'))) {
  const res = loadChecked(path.join(DATA, 'feed', 'articles.json'), parseOnly((d) => (Array.isArray(d.articles) ? [] : ['articles must be an array'])));
  if (res.data) feed = res.data;
}

const extras = [];
for (const f of listJson(path.join(DATA, 'extras'))) {
  const res = loadChecked(path.join(DATA, 'extras', f), parseOnly((d) => (Array.isArray(d.columns) && Array.isArray(d.rows) ? [] : ['columns and rows must be arrays'])));
  if (res.data) extras.push({ id: res.data.id || f.replace(/\.json$/, ''), title: res.data.title || f, ...res.data });
}
extras.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || str(a.title).localeCompare(str(b.title)));

// ---------- builders ----------
const spineRows = spine ? arr(spine.builders) : [];
const spineById = new Map(spineRows.map((r) => [r.builder_id, r]));
const allIds = uniq([...spineRows.map((r) => r.builder_id), ...partsById.keys()]);
const nameOf = (id) => spineById.get(id)?.name || partsById.get(id)?.people?.profile?.brand_names?.[0] || partsById.get(id)?.people?.profile?.legal_name || id;

// feed index
const articles = arr(feed.articles).filter((a) => a && a.id && a.title).map((a) => ({ ...a, builder_ids: arr(a.builder_ids), competitors: arr(a.competitors), people: arr(a.people), subscores: a.subscores || {} }));
const newsByBuilder = new Map();
for (const a of articles) for (const id of uniq([...a.builder_ids, a.suggested_update?.builder_id])) { if (!newsByBuilder.has(id)) newsByBuilder.set(id, []); newsByBuilder.get(id).push(a.id); }

// competitor relationships by builder
const compRelByBuilder = new Map();
const nameToId = new Map();
for (const r of spineRows) nameToId.set(normName(r.name), r.builder_id);
for (const c of competitors) for (const rel of c.builder_relationships) {
  const id = rel.builder_id || nameToId.get(normName(rel.builder_name)) || null;
  if (!id) continue;
  if (!compRelByBuilder.has(id)) compRelByBuilder.set(id, []);
  // The "new entrants" profile is a scan of many financiers: the financier's name leads each description ("Värde Partners: ...").
  const isScan = c.competitor_id === 'new-entrants' || /\bscan\b|new entrants/i.test(c.name || '');
  const lead = str(rel.description).match(/^([^:.]{3,60}):\s/);
  const financier = isScan ? (lead ? canonFirm(lead[1]) : 'Other land-finance provider') : canonFirm(c.name || c.competitor_id);
  compRelByBuilder.get(id).push({ competitor_id: c.competitor_id, competitor_name: c.name || c.competitor_id, financier, is_scan: isScan, ...rel });
}

const sources = new Map(); // url -> entry
function addSource(url, { title = '', retrieved = '', confidence = '', builder_id = null, used_for = '', date = '' } = {}) {
  if (!isUrl(url)) return;
  // research files sometimes annotate a consulted URL ("https://... (403, not read)"): keep the link clean and the remark as a note
  let remark = '';
  const parts = String(url).trim().match(/^(https?:\/\/\S+)\s+(.*)$/);
  if (parts) { url = parts[1]; remark = parts[2].replace(/^\(|\)$/g, '').trim(); }
  let s = sources.get(url);
  if (!s) { s = { url, title: '', type: sourceType(url), retrieved: '', source_date: '', builder_ids: [], used_for: [], facts: 0, best_confidence: '', note: '' }; sources.set(url, s); }
  if (remark && !s.note) s.note = remark;
  if (title && (!s.title || (s.title.length < 12 && title.length > s.title.length))) s.title = title;
  if (retrieved && retrieved > s.retrieved) s.retrieved = retrieved;
  if (date && !s.source_date) s.source_date = date;
  if (builder_id && !s.builder_ids.includes(builder_id)) s.builder_ids.push(builder_id);
  if (used_for && !s.used_for.includes(used_for)) s.used_for.push(used_for);
  if (confidence) { s.facts++; if ((CONF_RANK[confidence] || 0) > (CONF_RANK[s.best_confidence] || 0)) s.best_confidence = confidence; }
}

// "Known land bankers" is ONE list everywhere. When the competitor session's per-link table ("Builder-financier links",
// the rows behind "Who banks whom") is present, each builder's links come from it, so the Builders column, the coverage
// count, the call sheet and those tables cannot disagree. The no-link rule above is applied again here as a safety net,
// and every counted link keeps its confidence and source. Without the table the build derives the list itself.
const linkTable = extras.find((x) => x.id === 'competitor-builder-links');
const linksByBuilder = new Map();
const linkRowsRejected = []; // rows in the other owner's table that this build refused to count, for the status report
for (const r of arr(linkTable?.rows)) {
  if (!r || !r.builder || !r.financier) continue;
  if (isNoLink(r.what) || GENERIC_PARTY.test(str(r.financier))) { linkRowsRejected.push({ builder: r.builder, financier: r.financier, what: str(r.what).slice(0, 160) }); continue; }
  if (!linksByBuilder.has(r.builder)) linksByBuilder.set(r.builder, []);
  linksByBuilder.get(r.builder).push({ firm: canonFirm(r.financier), type: r.financier_type || '', what: str(r.what), amount_usd_m: r.amount_usd_m ?? null, lots: r.lots ?? null, date: r.date || '', confidence: r.confidence || '', source_url: r.source_url || '', source_title: r.source_title || '', seen_in: r.seen_in || '' });
}
const FOUR_FIRMS = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
// one summary row per firm: the strongest-confidence row, newest first within a confidence
function summariseLinks(rows) {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.firm)) by.set(r.firm, []); by.get(r.firm).push(r); }
  return [...by].map(([firm, rs]) => {
    rs.sort((x, y) => (CONF_RANK[y.confidence] || 0) - (CONF_RANK[x.confidence] || 0) || str(y.date).localeCompare(str(x.date)));
    const best = rs[0];
    return { firm, confidence: best.confidence, date: best.date, amount_usd_m: best.amount_usd_m, what: best.what.length > 220 ? best.what.slice(0, 219) + '…' : best.what, source_url: best.source_url, source_title: best.source_title, rows: rs.length, confidences: uniq(rs.map((x) => x.confidence)) };
  }).sort((x, y) => (FOUR_FIRMS.includes(x.firm) ? FOUR_FIRMS.indexOf(x.firm) : 9) - (FOUR_FIRMS.includes(y.firm) ? FOUR_FIRMS.indexOf(y.firm) : 9) || (CONF_RANK[y.confidence] || 0) - (CONF_RANK[x.confidence] || 0) || x.firm.localeCompare(y.firm));
}

const builders = [];
const peopleFlat = [];
for (const id of allIds) {
  const sp = spineById.get(id) || null;
  const parts = partsById.get(id) || { people: null, extras: [], fin: null, files: [] };
  const profile = parts.people?.profile || null;
  const retrieved = parts.people?.retrieved || parts.fin?.retrieved || sp?.retrieved || spine?.retrieved || '';
  const rank = sp?.rank ?? null;
  const ownership = profile?.ownership || sp?.ownership || '';
  const name = sp?.name || profile?.brand_names?.[0] || profile?.legal_name || id;
  const base = {
    builder_id: id, name, rank, tier: tierOf(rank),
    closings: sp?.closings ?? null, revenue_usd_m: sp?.revenue_usd_m ?? null, rank_prev: sp?.rank_prev ?? null,
    ownership, ownership_group: ownership === 'Public' ? 'Public' : /^Subsidiary/.test(ownership) ? 'Subsidiary' : ownership ? 'Private' : '',
    ticker: profile?.ticker || sp?.ticker || null, parent: profile?.parent || sp?.parent || null,
    hq: profile?.hq_city ? [profile.hq_city, profile.hq_state].filter(Boolean).join(', ') : (sp?.hq || ''),
    housing_giants_rank: sp?.housing_giants_rank ?? null, housing_giants_revenue_usd_m: sp?.housing_giants_revenue_usd_m ?? null,
    in_spine: !!sp,
    in_progress: parts.files.some((x) => x.status === 'in_progress'),
    in_progress_notes: parts.files.filter((x) => x.status === 'in_progress').flatMap((x) => x.messages.map((m) => `${x.file}: ${m}`)).slice(0, 12),
    spine: sp ? { confidence: sp.confidence || 'Reported', source_url: sp.source_url || spine?.list_url || '', housing_giants_source_url: sp.housing_giants_source_url || '', note: sp.note || '', retrieved: spine?.retrieved || '' } : null,
  };
  if (sp) { addSource(sp.source_url || spine?.list_url, { title: `${spine?.ranking_year || ''} ${spine?.ranking_name || 'Builder 100'} list`.trim(), retrieved: spine?.retrieved, confidence: sp.confidence || 'Reported', builder_id: id, used_for: 'Ranking' }); addSource(sp.housing_giants_source_url, { title: 'Pro Builder Top 200 (Housing Giants) rankings', retrieved: spine?.retrieved, builder_id: id, used_for: 'Ranking cross-check' }); }

  // people
  const rawPeople = [
    ...arr(parts.people?.people).map((p) => ({ ...p, _from: 'people' })),
    ...parts.extras.flatMap((x) => arr(x.people).map((p) => ({ ...p, _from: 'extra' }))),
  ].filter((p) => p && p.name);
  const merged = mergePeople(rawPeople).map((p) => {
    const pg = priorityGroup(p);
    return {
      person_id: `${id}--${slug(p._key)}`, builder_id: id,
      name: p.name, title: p.title || '', role_category: p.role_category || 'Other', level: p.level || '', priority_group: pg,
      geography: p.geography || '', reports_to: p.reports_to || '', reports_to_confidence: p.reports_to_confidence || '',
      email: p.email || '', email_confidence: p.email_confidence || '', phone: p.phone || '',
      in_role_since: p.in_role_since || '', prior_role: p.prior_role || '',
      confidence: p.confidence, source_url: p.source_url || '', source_title: p.source_title || '', source_date: p.source_date || '', retrieved: p.retrieved || retrieved,
      note: p.note || '', also_listed: p.also_listed, merged_rows: p.merged_rows, domain_internal_notes: '',
    };
  });
  merged.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority_group) - PRIORITY_ORDER.indexOf(b.priority_group) || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || ROLE_ORDER.indexOf(a.role_category) - ROLE_ORDER.indexOf(b.role_category) || a.name.localeCompare(b.name));
  const byNorm = new Map(merged.map((p) => [normName(p.name), p]));
  for (const p of merged) {
    const boss = p.reports_to ? byNorm.get(normName(p.reports_to)) : null;
    p.reports_to_id = boss ? boss.person_id : '';
    addSource(p.source_url, { title: p.source_title, retrieved: p.retrieved, confidence: p.confidence, builder_id: id, used_for: 'People', date: p.source_date });
    for (const o of p.also_listed) addSource(o.source_url, { title: o.source_title, retrieved: p.retrieved, confidence: o.confidence, builder_id: id, used_for: 'People', date: o.source_date });
  }
  if (profile) addSource(profile.source_url, { title: `${name} profile source`, retrieved, confidence: profile.confidence, builder_id: id, used_for: 'Profile' });

  // financing
  const fin = parts.fin?.financing || null;
  const lots = fin?.lots && (fin.lots.total_controlled != null || fin.lots.owned != null || fin.lots.optioned != null) ? { ...fin.lots } : null;
  if (lots && lots.pct_optioned == null && lots.optioned != null && (lots.total_controlled || (lots.owned != null && lots.owned + lots.optioned))) {
    const tot = lots.total_controlled || lots.owned + lots.optioned;
    lots.pct_optioned = Math.round((lots.optioned / tot) * 1000) / 10; lots.pct_optioned_derived = true;
  }
  const debt = arr(fin?.debt).map((d) => ({ ...d, maturity_key: maturityKey(d.maturity) })).sort((a, b) => (a.maturity_key || '9999').localeCompare(b.maturity_key || '9999'));
  const live = debt.filter((d) => d.status !== 'Redeemed' && d.maturity_key && d.maturity_key >= TODAY);
  // corporate debt first: mortgage warehouse lines renew every year and say little about land funding
  const corp = live.filter((d) => d.type !== 'Mortgage warehouse');
  const nm = corp.find((d) => d.status === 'Outstanding') || corp[0] || live.find((d) => d.status === 'Outstanding') || live[0] || null;
  const next_maturity = nm ? { maturity: nm.maturity, maturity_key: nm.maturity_key, instrument: nm.instrument, type: nm.type, principal_usd_m: nm.principal_usd_m ?? null, status: nm.status, confidence: nm.confidence, source_url: nm.source_url } : null;
  const landBanking = arr(fin?.land_banking).map((x) => ({ ...x, unnamed: GENERIC_PARTY.test(str(x.counterparty)), negative: isNoLink(x.description) || /^no land banker/i.test(str(x.counterparty)) }));
  const allCompLinks = arr(fin?.competitor_links).map((x) => ({ ...x, negative: isNoLink(x.relationship) }));
  const allCompRels = (compRelByBuilder.get(id) || []).map((x) => ({ ...x, negative: isNoLink(x.description) }));
  // negative and indirect findings are kept as context, never as links
  const noLinkNotes = [
    ...allCompLinks.filter((x) => x.negative).map((x) => ({ firm: canonFirm(x.firm), text: x.relationship, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '', from: 'builder research' })),
    ...allCompRels.filter((x) => x.negative).map((x) => ({ firm: x.financier, text: x.description, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '', from: `${x.competitor_name} profile` })),
    ...landBanking.filter((x) => x.negative).map((x) => ({ firm: canonFirm(x.counterparty), text: x.description || x.counterparty, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '', from: 'builder research' })),
  ];
  const compLinks = allCompLinks.filter((x) => !x.negative);
  const compRels = allCompRels.filter((x) => !x.negative);
  // the build's own derivation: rows that assert a financing relationship with a named land banker or investor
  const ownLinkRows = [
    ...landBanking.filter((x) => ['Land banker', 'Investor'].includes(x.counterparty_type) && !x.unnamed && !x.negative).map((x) => ({ firm: canonFirm(x.counterparty), what: str(x.description), amount_usd_m: x.amount_usd_m ?? null, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '' })),
    ...compLinks.filter((x) => NAMED_FIRMS.some((nf) => nf.re.test(str(x.firm)))).map((x) => ({ firm: canonFirm(x.firm), what: str(x.relationship), amount_usd_m: null, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '' })),
    ...compRels.filter((x) => !x.is_scan || /land[\s-]*bank/i.test(str(x.description))).map((x) => ({ firm: x.financier, what: str(x.description), amount_usd_m: x.amount_usd_m ?? null, date: x.date || '', confidence: x.confidence, source_url: x.source_url, source_title: x.source_title || '' })),
  ].filter((x) => x.firm && !GENERIC_PARTY.test(x.firm));
  const ownLinks = summariseLinks(ownLinkRows);
  const landBankerLinks = linkTable ? summariseLinks(linksByBuilder.get(id) || []) : ownLinks;
  const landBankers = landBankerLinks.map((x) => x.firm);
  const unnamedLandBanking = landBanking.some((x) => x.unnamed && !x.negative && (x.counterparty_type === 'Land banker' || /land[\s-]*bank/i.test(str(x.counterparty))));
  const named_firms = FOUR_FIRMS.filter((f) => landBankers.includes(f));
  const firms_checked = uniq(noLinkNotes.map((x) => x.firm)).filter((f) => FOUR_FIRMS.includes(f) && !named_firms.includes(f));
  // a "no link found" note should not hide older or weaker evidence that exists elsewhere in the map: attach it
  for (const note of noLinkNotes) { const o = ownLinks.find((x) => x.firm === note.firm); if (o && !landBankers.includes(note.firm)) note.other_evidence = { text: o.what, confidence: o.confidence, date: o.date, source_url: o.source_url }; }
  // difference between the shared table and the build's own reading of the four named firms, for the status report
  const ownFour = FOUR_FIRMS.filter((f) => ownLinks.some((x) => x.firm === f));
  const fourDiff = { only_in_table: named_firms.filter((f) => !ownFour.includes(f)), only_in_own: ownFour.filter((f) => !named_firms.includes(f)).map((f) => ({ firm: f, ...ownLinks.find((x) => x.firm === f) })) };
  const ma = arr(parts.fin?.ma).slice().sort((a, b) => str(b.date).localeCompare(str(a.date)));
  const industryDeals = arr(maIndustry.deals).filter((d) => d.acquirer_builder_id === id || d.target_builder_id === id);

  for (const [rows, used] of [[landBanking, 'Land banking'], [debt, 'Debt'], [arr(fin?.capital_events), 'Capital events'], [arr(fin?.joint_ventures), 'Joint ventures'], [compLinks, 'Competitor links'], [ma, 'M&A']]) {
    for (const r of rows) addSource(r.source_url, { title: r.source_title, retrieved: parts.fin?.retrieved, confidence: r.confidence, builder_id: id, used_for: used, date: r.as_of || r.date });
  }
  if (lots) addSource(lots.source_url, { title: lots.source_title, retrieved: parts.fin?.retrieved, confidence: lots.confidence, builder_id: id, used_for: 'Lots', date: lots.as_of });
  if (fin?.key_metrics?.source_url) addSource(fin.key_metrics.source_url, { title: fin.key_metrics.source_title, retrieved: parts.fin?.retrieved, confidence: fin.key_metrics.confidence, builder_id: id, used_for: 'Key metrics', date: fin.key_metrics.as_of });
  const consulted = uniq([...arr(parts.people?.sources_consulted), ...parts.extras.flatMap((x) => arr(x.sources_consulted)), ...arr(parts.fin?.sources_consulted)]).filter(isUrl);
  for (const u of consulted) addSource(u, { retrieved, builder_id: id, used_for: 'Consulted' });

  const gaps = uniq([...arr(parts.people?.gaps), ...parts.extras.flatMap((x) => arr(x.gaps)), ...arr(parts.fin?.gaps)].map(str));
  const cnt = (g) => merged.filter((p) => p.priority_group === g).length;
  const conf = { Verified: 0, Reported: 0, Inferred: 0 };
  for (const p of merged) if (conf[p.confidence] != null) conf[p.confidence]++;
  const landHeads = merged.filter((p) => p.priority_group === 'Land' && p.level === 'Corporate');
  const finHeads = merged.filter((p) => p.priority_group === 'Finance' && p.level === 'Corporate');
  const regHeads = merged.filter(isRegionalHead);
  const regsListed = arr(profile?.regions);
  // a company-listed region has a named leader when the company's list names one, or a mapped regional head's own title or geography names that region
  let regsNamed = regsListed.filter((r) => r && r.leader && str(r.leader).trim()).length;
  try { regsNamed = orgModel({ people: merged, profile }).cards.filter((c) => c.fromProfile && (str(c.leaderName).trim() || c.heads.length)).length; } catch { /* keep the simple count */ }
  const wholeDeal = (m) => !/minority|\bstake\b|not an acquisition|asset purchase|lots only/i.test(`${m.target || ''} ${m.counterparty || ''} ${str(m.description).slice(0, 80)}`); // a share purchase is not a change of parent
  const acq = [
    ...ma.filter((m) => m.role === 'Target' && m.after_ranking && wholeDeal(m) && !['Terminated', 'Rumored'].includes(m.status)).map((m) => ({ by: m.counterparty, date: m.date || '', status: m.status, confidence: m.confidence, source_url: m.source_url })),
    ...industryDeals.filter((m) => m.target_builder_id === id && m.after_ranking && wholeDeal(m) && !['Terminated', 'Rumored'].includes(m.status)).map((m) => ({ by: m.acquirer, date: m.date || '', status: m.status, confidence: m.confidence, source_url: m.source_url })),
  ].sort((a, b2) => str(b2.date).localeCompare(str(a.date)))[0] || null;
  const states = uniq(arr(profile?.states).map((s) => str(s).trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s))).sort();

  const b = {
    ...base,
    retrieved,
    profile: profile ? { ...profile, states: arr(profile.states), markets: arr(profile.markets), regions: arr(profile.regions), brand_names: arr(profile.brand_names) } : null,
    states,
    people: merged,
    financing: fin ? { summary: fin.summary || '', land_strategy: fin.land_strategy || '', lots, land_banking: landBanking, debt, capital_events: arr(fin.capital_events).slice().sort((a, b2) => str(b2.date).localeCompare(str(a.date))), joint_ventures: arr(fin.joint_ventures), key_metrics: fin.key_metrics || null, competitor_links: compLinks, no_link_notes: noLinkNotes, retrieved: parts.fin?.retrieved || '' } : null,
    competitor_relationships: compRels,
    ma, industry_deals: industryDeals,
    news_ids: newsByBuilder.get(id) || [],
    suggested_updates: articles.filter((a) => a.suggested_update && (a.suggested_update.builder_id === id || (!a.suggested_update.builder_id && a.builder_ids.includes(id)))).map((a) => ({ article_id: a.id, kind: a.suggested_update.kind || '', text: a.suggested_update.text || '', title: a.title, url: a.url, published: a.published, score: a.score })),
    gaps,
    sources_consulted: consulted,
    files: parts.files,
    derived: {
      has_profile: !!profile, has_people: merged.length > 0, has_financing: !!fin,
      people_count: merged.length, confidence_counts: conf,
      land_count: cnt('Land'), finance_count: cnt('Finance'), csuite_count: cnt('C-suite'), regional_count: cnt('Regional'), division_count: cnt('Division'), other_count: cnt('Other'),
      regional_heads: regHeads.length, regional_head_names: regHeads.map((p) => p.name), regions_listed: regsListed.length, regions_with_named_leader: regsNamed,
      acquired_after_ranking: acq,
      land_head_found: landHeads.length > 0, finance_head_found: finHeads.length > 0,
      land_heads: landHeads.map((p) => p.name), finance_heads: finHeads.map((p) => p.name),
      lots_total: lots?.total_controlled ?? (lots && lots.owned != null && lots.optioned != null ? lots.owned + lots.optioned : null),
      lots_owned: lots?.owned ?? null, lots_optioned: lots?.optioned ?? null, pct_optioned: lots?.pct_optioned ?? null, years_supply: lots?.years_supply ?? null,
      land_bankers: landBankers, land_bankers_unnamed: unnamedLandBanking, named_firms, firms_checked_no_link: firms_checked,
      // every counted link with its confidence and source; *_display carries the tag for anything short of Verified
      land_banker_links: landBankerLinks,
      land_bankers_display: landBankerLinks.map((x) => (x.confidence && x.confidence !== 'Verified' ? `${x.firm} (${x.confidence})` : x.firm)),
      land_bankers_inferred_only: landBankerLinks.filter((x) => x.confidence === 'Inferred').map((x) => x.firm),
      named_firm_confidence: Object.fromEntries(landBankerLinks.filter((x) => FOUR_FIRMS.includes(x.firm)).map((x) => [x.firm, x.confidence])),
      land_banker_check: fourDiff,
      debt_count: debt.length, debt_outstanding_usd_m: debt.filter((d) => d.status === 'Outstanding' && typeof d.principal_usd_m === 'number').reduce((s, d) => s + d.principal_usd_m, 0) || null,
      next_maturity,
      ma_count: ma.length + industryDeals.length, ma_after_ranking: ma.filter((m) => m.after_ranking).length + industryDeals.filter((m) => m.after_ranking).length,
      news_count: (newsByBuilder.get(id) || []).length, gaps_count: gaps.length,
      status: (merged.length > 0 && fin) ? 'People + financing' : merged.length > 0 ? 'People only' : fin ? 'Financing only' : profile ? 'Profile only' : 'Not yet mapped',
    },
  };
  builders.push(b);
  for (const p of merged) peopleFlat.push({ ...p, builder_name: name, rank, tier: base.tier, ownership, ownership_group: base.ownership_group, hq: base.hq, builder_states: states });
}
builders.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.name.localeCompare(b.name));
peopleFlat.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || PRIORITY_ORDER.indexOf(a.priority_group) - PRIORITY_ORDER.indexOf(b.priority_group) || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.name.localeCompare(b.name));

// ---------- derived insight: debt maturity ladder (facts from the Debt rows, no estimate) ----------
{
  const y0 = Number(TODAY.slice(0, 4));
  const years = [y0, y0 + 1, y0 + 2, y0 + 3, y0 + 4];
  const rows = [];
  for (const b of builders) {
    const debt = (b.financing?.debt || []).filter((d) => d.status === 'Outstanding' && d.type !== 'Mortgage warehouse' && typeof d.principal_usd_m === 'number' && d.principal_usd_m > 0);
    if (!debt.length) continue;
    const row = { rank: b.rank, builder: b.builder_id, instruments: debt.length, outstanding: 0, later: 0, undated: 0, next_maturity: b.derived.next_maturity?.maturity || '', next_instrument: b.derived.next_maturity?.instrument || '', pct_optioned: b.derived.pct_optioned, land_bankers: [...b.derived.land_bankers, ...(b.derived.land_bankers_unnamed ? ['unnamed'] : [])].join(', ') };
    for (const y of years) row['y' + y] = 0;
    for (const d of debt) {
      row.outstanding += d.principal_usd_m;
      const yr = Number((d.maturity_key || '').slice(0, 4));
      if (!yr) row.undated += d.principal_usd_m; else if (yr > years[years.length - 1]) row.later += d.principal_usd_m; else if (yr >= y0) row['y' + yr] += d.principal_usd_m; else row.undated += d.principal_usd_m;
    }
    const soon = row['y' + y0] + row['y' + (y0 + 1)] + row['y' + (y0 + 2)];
    row.due_3y_pct = row.outstanding ? Math.round((soon / row.outstanding) * 1000) / 10 : null;
    for (const k of Object.keys(row)) if (typeof row[k] === 'number' && k !== 'rank' && k !== 'instruments' && k !== 'pct_optioned' && k !== 'due_3y_pct') row[k] = row[k] ? Math.round(row[k] * 10) / 10 : null;
    rows.push(row);
  }
  rows.sort((a, b) => (b.due_3y_pct ?? -1) - (a.due_3y_pct ?? -1) || (a.rank ?? 999) - (b.rank ?? 999));
  if (rows.length) extras.push({
    id: 'debt-maturity-ladder', title: 'Debt maturity ladder', subtitle: 'Outstanding principal by maturity year for each builder with debt on record: who has a refinancing wall coming, next to how land-light they already are.',
    is_estimate: false, order: 900, generated: new Date().toISOString(), derived_by_build: true,
    method: 'Added up by the build from the Debt rows (status Outstanding, principal known), so every number traces to a sourced instrument on the builder page and the Debt sheet. Undrawn revolvers, instruments with no principal on record and mortgage warehouse lines (financial-services funding that renews every year) are left out, so totals can be below reported total debt. "Due within 3 years" is the share of recorded principal maturing in the current year or the next two. Sorted by that share. Private builders rarely disclose debt, so absence here means not public, not debt-free.',
    columns: [
      { key: 'rank', label: 'Rank', type: 'number' }, { key: 'builder', label: 'Builder', type: 'builder_link' },
      { key: 'outstanding', label: 'Principal recorded ($M)', type: 'usd_m' }, { key: 'due_3y_pct', label: 'Due within 3 years', type: 'pct' },
      ...years.map((y) => ({ key: 'y' + y, label: String(y), type: 'usd_m' })), { key: 'later', label: `${years[years.length - 1] + 1}+`, type: 'usd_m' }, { key: 'undated', label: 'No date', type: 'usd_m' },
      { key: 'next_maturity', label: 'Next maturity', type: 'date' }, { key: 'next_instrument', label: 'Instrument', type: 'text' }, { key: 'instruments', label: 'Instruments', type: 'number' },
      { key: 'pct_optioned', label: '% lots optioned', type: 'pct' }, { key: 'land_bankers', label: 'Known land bankers', type: 'text' },
    ],
    rows,
  });
}

// sources from competitors, industry M&A, feed
for (const c of competitors) {
  for (const r of [...c.facts, ...c.builder_relationships, ...c.debt, ...c.people]) if (r && typeof r === 'object') addSource(r.source_url, { title: r.source_title, retrieved: c.retrieved, confidence: r.confidence, used_for: `Competitor: ${c.name || c.competitor_id}`, date: r.as_of || r.date || r.source_date });
  for (const u of c.sources_consulted) addSource(u, { retrieved: c.retrieved, used_for: `Competitor: ${c.name || c.competitor_id}` });
}
for (const d of arr(maIndustry.deals)) addSource(d.source_url, { title: d.source_title, retrieved: maIndustry.retrieved, confidence: d.confidence, used_for: 'Industry M&A', date: d.date });
const sourceList = [...sources.values()].sort((a, b) => b.facts - a.facts || a.url.localeCompare(b.url));

// ---------- coverage ----------
const ranked = builders.filter((b) => b.in_spine);
const scope = ranked.length ? ranked : builders;
const covered = scope.filter((b) => b.derived.has_people || b.derived.has_financing);
const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
const median = (xs) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const grp = (g) => { const withPeople = scope.filter((b) => b.ownership_group === g && b.derived.has_people); const xs = withPeople.map((b) => b.derived.people_count); return { builders: scope.filter((b) => b.ownership_group === g).length, builders_with_people: withPeople.length, people: xs.reduce((s, x) => s + x, 0), avg_people_per_builder: avg(xs), median_people_per_builder: median(xs), max_people: xs.length ? Math.max(...xs) : 0 }; };
const confTot = { Verified: 0, Reported: 0, Inferred: 0 };
for (const p of peopleFlat) if (confTot[p.confidence] != null) confTot[p.confidence]++;
// confidence across every fact row, not only people
const factConf = { Verified: 0, Reported: 0, Inferred: 0 };
const tally = (r) => { if (r && factConf[r.confidence] != null) factConf[r.confidence]++; };
for (const b of builders) {
  b.people.forEach(tally); if (b.profile) tally(b.profile);
  if (b.financing) { tally(b.financing.lots); if (b.financing.key_metrics?.source_url) tally(b.financing.key_metrics); for (const k of ['land_banking', 'debt', 'capital_events', 'joint_ventures', 'competitor_links']) b.financing[k].forEach(tally); }
  b.ma.forEach(tally);
}
const share = (c) => { const t = c.Verified + c.Reported + c.Inferred; const pc = (n) => (t ? Math.round((n / t) * 1000) / 10 : 0); return { total: t, verified_pct: pc(c.Verified), reported_pct: pc(c.Reported), inferred_pct: pc(c.Inferred), ...c }; };
const byGroup = Object.fromEntries(PRIORITY_ORDER.map((g) => [g, peopleFlat.filter((p) => p.priority_group === g).length]));
const tierCov = (t) => { const xs = scope.filter((b) => b.tier === t); return { builders: xs.length, with_people: xs.filter((b) => b.derived.has_people).length, with_financing: xs.filter((b) => b.derived.has_financing).length, people: xs.reduce((s, b) => s + b.derived.people_count, 0) }; };

const coverage = {
  generated: new Date().toISOString(),
  land_banker_source: linkTable ? 'data/extras/competitor-builder-links.json (shared with the "Who banks whom" table), re-checked by the build\'s no-link rule' : 'derived by the build from builder and competitor files',
  link_table_rows_rejected: linkRowsRejected,
  build_ms: 0,
  spine_present: !!spine,
  totals: {
    builders_in_ranking: ranked.length,
    builders_total: builders.length,
    builders_covered: covered.length,
    builders_with_people: scope.filter((b) => b.derived.has_people).length,
    builders_with_financing: scope.filter((b) => b.derived.has_financing).length,
    builders_with_both: scope.filter((b) => b.derived.has_people && b.derived.has_financing).length,
    people_mapped: peopleFlat.length,
    people_by_group: byGroup,
    people_per_builder: { Public: grp('Public'), Private: grp('Private'), Subsidiary: grp('Subsidiary'), all: { builders_with_people: scope.filter((b) => b.derived.has_people).length, avg_people_per_builder: avg(scope.filter((b) => b.derived.has_people).map((b) => b.derived.people_count)) } },
    people_confidence: share(confTot),
    all_facts_confidence: share(factConf),
    regional_heads_found: scope.reduce((s2, b) => s2 + b.derived.regional_heads, 0),
    builders_with_regional_heads: scope.filter((b) => b.derived.regional_heads > 0).length,
    regions_listed: scope.reduce((s2, b) => s2 + b.derived.regions_listed, 0),
    regions_with_named_leader: scope.reduce((s2, b) => s2 + b.derived.regions_with_named_leader, 0),
    builders_acquired_after_ranking: scope.filter((b) => b.derived.acquired_after_ranking).length,
    regional_heads_distinct_individuals: new Set(peopleFlat.filter(isRegionalHead).map((p) => normName(p.name))).size,
    top25: (() => { const xs = scope.filter((b) => b.rank != null && b.rank <= 25); const sum = (f) => xs.reduce((s2, b) => s2 + f(b), 0); return {
      builders: xs.length, people: sum((b) => b.derived.people_count), regional_heads: sum((b) => b.derived.regional_heads), builders_with_regional_heads: xs.filter((b) => b.derived.regional_heads > 0).length,
      regions_listed: sum((b) => b.derived.regions_listed), regions_with_named_leader: sum((b) => b.derived.regions_with_named_leader),
      land_heads_found: xs.filter((b) => b.derived.land_head_found).length, finance_heads_found: xs.filter((b) => b.derived.finance_head_found).length }; })(),
    definitions: {
      regional_heads_found: 'Named people at Regional level whose role is leading a region, area or group (level = Regional and role category = Regional President), counted once per builder. Region-level land, finance, sales and operations staff are not counted.',
      regions_listed: 'Regions, areas, groups or segments in each builder\'s own description of how it is organised (profile.regions).',
      regions_with_named_leader: 'Listed regions whose leader is named: the company\'s region list names one, or a mapped regional head\'s own title or geography names that region.',
      people_mapped: 'People rows after de-duplication within each builder.',
      land: 'People in a land acquisition, land development or other land role, at any level.',
      finance: 'People in a CFO, treasury / capital markets or other finance role, at any level.',
      land_heads_found: 'Builders with at least one land role at corporate level.',
      finance_heads_found: 'Builders with at least one CFO, treasury or finance role at corporate level.',
      builders_with_named_land_banker: 'Builders with at least one row that asserts a financing relationship with a named land banker or lot-option financier: the same links as the "Builder-financier links" and "Who banks whom" tables. Rows that record no link or only an indirect or people link, unnamed "land bank" arrangements, developers and affiliates are not counted. Each link keeps its confidence; some rest only on an Inferred source.',
      debt_instruments: 'Debt rows across all builders: notes, revolvers, term loans, warehouse lines, project debt.',
    },
    land_heads_found: scope.filter((b) => b.derived.land_head_found).length,
    builders_with_any_land_contact: scope.filter((b) => b.derived.land_count > 0).length,
    finance_heads_found: scope.filter((b) => b.derived.finance_head_found).length,
    builders_with_any_finance_contact: scope.filter((b) => b.derived.finance_count > 0).length,
    builders_with_lots_split: scope.filter((b) => b.derived.pct_optioned != null).length,
    builders_with_named_land_banker: scope.filter((b) => b.derived.land_bankers.length > 0).length,
    builders_with_unnamed_land_banking_only: scope.filter((b) => b.derived.land_bankers.length === 0 && b.derived.land_bankers_unnamed).length,
    builders_linked_to: Object.fromEntries(NAMED_FIRMS.map((nf) => [nf.firm, scope.filter((b) => b.derived.named_firms.includes(nf.firm)).length])),
    builders_linked_to_by_confidence: Object.fromEntries(FOUR_FIRMS.map((f) => [f, ['Verified', 'Reported', 'Inferred'].reduce((o, c) => ({ ...o, [c]: scope.filter((b) => b.derived.named_firm_confidence[f] === c).length }), {})])),
    builders_with_named_land_banker_not_inferred: scope.filter((b) => b.derived.land_banker_links.some((x) => x.confidence !== 'Inferred')).length,
    no_link_notes: builders.reduce((s2, b) => s2 + (b.financing?.no_link_notes.length || 0), 0),
    link_table_rows_rejected: linkRowsRejected.length,
    land_banking_relationships: builders.reduce((s, b) => s + (b.financing?.land_banking.length || 0), 0),
    debt_instruments: builders.reduce((s, b) => s + b.derived.debt_count, 0),
    builders_with_debt: scope.filter((b) => b.derived.debt_count > 0).length,
    capital_events: builders.reduce((s, b) => s + (b.financing?.capital_events.length || 0), 0),
    joint_ventures: builders.reduce((s, b) => s + (b.financing?.joint_ventures.length || 0), 0),
    ma_deals_builder: builders.reduce((s, b) => s + b.ma.length, 0),
    ma_deals_industry: arr(maIndustry.deals).length,
    competitors_profiled: competitors.length,
    feed_articles: articles.length,
    feed_articles_70_plus: articles.filter((a) => a.score >= 70).length,
    feed_articles_90_plus: articles.filter((a) => a.score >= 90).length,
    insight_tables: extras.length,
    unique_sources: sourceList.length,
    gaps_recorded: builders.reduce((s, b) => s + b.gaps.length, 0),
    builders_in_progress: scope.filter((b) => b.in_progress).length,
    files_in_progress: issues.filter((i) => i.in_progress).length,
    rows_left_out_by_validation: rowsDropped,
    validation_failures: issues.filter((i) => /skipped/.test(i.status)).length,
    files_using_last_good_copy: issues.filter((i) => /last (good )?copy/.test(i.status)).length,
    by_tier: { 'Top 25': tierCov('Top 25'), 'Top 50': tierCov('Top 50'), 'Top 100': tierCov('Top 100') },
  },
  validation_issues: issues,
  builders: builders.map((b) => ({
    builder_id: b.builder_id, name: b.name, rank: b.rank, tier: b.tier, ownership: b.ownership, ownership_group: b.ownership_group,
    status: b.derived.status, in_progress: b.in_progress, in_progress_notes: b.in_progress_notes, has_profile: b.derived.has_profile, has_people: b.derived.has_people, has_financing: b.derived.has_financing,
    people: b.derived.people_count, verified: b.derived.confidence_counts.Verified, reported: b.derived.confidence_counts.Reported, inferred: b.derived.confidence_counts.Inferred,
    land: b.derived.land_count, finance: b.derived.finance_count, csuite: b.derived.csuite_count, regional: b.derived.regional_count, division: b.derived.division_count, other: b.derived.other_count,
    regional_heads: b.derived.regional_heads, regions_listed: b.derived.regions_listed, regions_with_named_leader: b.derived.regions_with_named_leader,
    land_head_found: b.derived.land_head_found, finance_head_found: b.derived.finance_head_found,
    lots_split_known: b.derived.pct_optioned != null, land_bankers: b.derived.land_bankers.length, debt_instruments: b.derived.debt_count, ma: b.derived.ma_count, news: b.derived.news_count, gaps: b.derived.gaps_count,
    files: b.files,
  })),
};

// ---------- "How this was built": one text, used by the workbook (Read me, Coverage) and available to the app ----------
{
  const T0 = coverage.totals;
  // The accuracy-check tally is COMPUTED from status/verification.log, where each checking agent appends one line per builder:
  //   "<builder_id>: checked N, held N, corrected N, downgraded N, removed N (...)". A later line for the same builder that says
  //   "CORRECTION ... (checked N, held N, ...)" replaces that builder's previous line. Nothing is typed in by hand.
  let ver = null;
  try {
    const NUMS = /checked (\d+), held (\d+), corrected (\d+), downgraded (\d+), removed (\d+)/;
    const entries = []; let unparsed = 0;
    for (const line of fs.readFileSync(path.join(ROOT, 'status', 'verification.log'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const id = (line.match(/^([a-z0-9][a-z0-9-]*):/) || [])[1];
      const m = line.match(NUMS);
      if (!id || !m) { unparsed++; continue; }
      const e = { id, checked: +m[1], held: +m[2], corrected: +m[3], downgraded: +m[4], removed: +m[5] };
      if (/CORRECTION/i.test(line)) { const i = entries.map((x) => x.id).lastIndexOf(id); if (i >= 0) entries[i] = e; else entries.push(e); } else entries.push(e);
    }
    if (entries.length) {
      const sum = (k) => entries.reduce((t, e) => t + e[k], 0);
      ver = { checked: sum('checked'), held: sum('held'), corrected: sum('corrected'), downgraded: sum('downgraded'), removed: sum('removed'), builders_checked: new Set(entries.map((e) => e.id)).size, log_lines: entries.length, unparsed_lines: unparsed, source: 'computed from status/verification.log' };
    }
  } catch { /* no log: the sentence then says so */ }
  const n = (x) => Number(x || 0).toLocaleString('en-US');
  const ppb = T0.people_per_builder;
  coverage.verification = ver;
  coverage.totals.verification = ver;
  coverage.how_built = [
    { label: 'Spine', text: `The ${spine?.ranking_year || 2026} ${spine?.ranking_name || 'Builder 100'} (ranked by ${spine?.data_year || 2025} closings), cross-checked against Pro Builder's 2026 list. The publisher blocks automated reads, so the list was read from the Internet Archive's copy of the publisher's page and is tagged Reported.` },
    { label: 'Research', text: 'About 200 research agents, one per builder part (leadership; division and regional leaders; financing and M&A), reading SEC filings, company sites and press releases, trade and local press, and state officer records. Every fact carries a source link, a retrieval date and a confidence tag. LinkedIn was never opened; no paywall was bypassed.' },
    { label: 'Regional heads', text: `A second targeted pass on the 25 largest builders. ${n(T0.top25.regions_with_named_leader)} of ${n(T0.top25.regions_listed)} regions at those builders have a publicly named head.` },
    { label: 'Accuracy check', text: ver ? `A fresh agent that did not do the research re-opened the sources for the highest-stakes rows on ${ver.builders_checked >= T0.builders_in_ranking ? 'every builder' : `${n(ver.builders_checked)} builders`}: ${n(ver.checked)} rows checked, ${n(ver.held)} held (${Math.round((100 * ver.held) / ver.checked)}%), ${n(ver.corrected)} corrected, ${n(ver.downgraded)} downgraded to Inferred, ${n(ver.removed)} removed.` : 'A fresh agent that did not do the research re-opened the sources for the highest-stakes rows on every builder; the tally is in status/verification.log.' },
    { label: 'Result', text: `${n(T0.builders_covered)} builders, ${n(T0.people_mapped)} people (${n(T0.people_by_group.Land)} land, ${n(T0.people_by_group.Finance)} finance, ${n(T0.regional_heads_found)} regional heads); ${T0.people_confidence.verified_pct}% of people rows Verified; an average of ${ppb.Public.avg_people_per_builder} people per public builder against ${ppb.Private.avg_people_per_builder} per private builder; ${n(T0.builders_with_named_land_banker)} builders with a publicly named land banker; ${n(T0.debt_instruments)} debt instruments.` },
    { label: 'Where the method ran out', text: `(a) Some builders publish no one below their executive officers, so their regional heads are marked "not publicly disclosed" (for example NVR, Tri Pointe, and K. Hovnanian's group presidents). (b) Filings report land banking in aggregate and rarely name the land banker, so counterparties are named for only ${n(T0.builders_with_named_land_banker)} builders. (c) Private builders disclose almost nothing about financing. (d) Names seen only in third-party directories or search snippets are kept as leads and tagged Inferred. (e) State-level volumes are not public, so geography is by presence, not by size.` },
  ];
}

const domain = {
  generated: coverage.generated,
  how_built: coverage.how_built,
  retrieved: spine?.retrieved || TODAY,
  ranking: spine ? { name: spine.ranking_name, year: spine.ranking_year, data_year: spine.data_year, list_url: spine.list_url, notes: spine.notes || '' } : null,
  legend: { Verified: 'Primary source opened in this run (SEC filing, company site or release, government record).', Reported: 'Secondary source opened in this run (trade press, news, published rankings, directories).', Inferred: 'Derived, pattern-built, snippet-only or stale. Treat as a lead to confirm.' },
  builders, people: peopleFlat, competitors, ma_industry: maIndustry,
  feed: { generated: feed.generated || '', window_days: feed.window_days ?? 90, rubric_version: feed.rubric_version || '', articles },
  extras, sources: sourceList,
  totals: coverage.totals,
};
coverage.build_ms = Date.now() - t0;
writeAtomic(path.join(DIST, 'domain.json'), JSON.stringify(domain));
writeAtomic(path.join(DIST, 'coverage.json'), JSON.stringify(coverage, null, 1));

const T = coverage.totals;
log(`build ok in ${coverage.build_ms} ms -> data/dist/domain.json (${(fs.statSync(path.join(DIST, 'domain.json')).size / 1024).toFixed(0)} KB)`);
log(`  builders ${T.builders_total} (ranked ${T.builders_in_ranking}); covered ${T.builders_covered}; with people ${T.builders_with_people}; with financing ${T.builders_with_financing}`);
log(`  people ${T.people_mapped} (Verified ${T.people_confidence.verified_pct}% / Reported ${T.people_confidence.reported_pct}% / Inferred ${T.people_confidence.inferred_pct}%)`);
log(`  land heads ${T.land_heads_found}; finance heads ${T.finance_heads_found}; named land banker ${T.builders_with_named_land_banker}; debt instruments ${T.debt_instruments}`);
log(`  feed ${T.feed_articles}; competitors ${T.competitors_profiled}; insight tables ${T.insight_tables}; sources ${T.unique_sources}`);
log(`  in progress: ${T.builders_in_progress} builders (${T.files_in_progress} files not yet passing validation, ${T.rows_left_out_by_validation} rows left out); unparseable files skipped: ${T.validation_failures}`);
if (issues.length) { log(`  ${issues.length} file note(s):`); for (const i of issues) log(`    ${i.file}: ${i.status}${i.errors?.length ? ' :: ' + i.errors[0] : ''}`); }
