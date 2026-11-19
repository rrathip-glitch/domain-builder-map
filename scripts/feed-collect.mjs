#!/usr/bin/env node
// Domain feed collector. Plain Node 22, no API keys, no npm dependencies.
//
//   node scripts/feed-collect.mjs                 collect everything (tier 1 then tier 2) + baseline
//   node scripts/feed-collect.mjs --tier 1        priority set only (competitors, new entrants, Millrose, top builders)
//   node scripts/feed-collect.mjs --tier 2        the wide set only (all 100 builders)
//   node scripts/feed-collect.mjs --deep          pages 2-3 of the competitor, M&A, capital-markets and top-50 builder searches (reaches further back)
//   node scripts/feed-collect.mjs --baseline      only the naive "land banking" alert
//   node scripts/feed-collect.mjs --merge-only    rebuild _candidates.json from the raw files already on disk
//
// What it does: runs the query sets in feed/queries.json against free public sources (Bing News RSS, the GDELT news API,
// SEC EDGAR, trade-press RSS), keeps the last N days, de-duplicates, and writes
//   data/feed/raw/<group>.json     one file per query group, exactly what each source returned (title, link, publisher, date, snippet)
//   data/feed/raw/_candidates.json the merged, de-duplicated targeted set
//   data/feed/raw/_baseline.json   the naive alert, kept separate for the comparison
// Every request passes a robots.txt check and a per-host rate limit (feed-lib.mjs). It stores only what the feed itself publishes. It never opens article pages, linkedin.com, or anything behind a login.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { P, loadConfig, loadBuilders, politeGet, parseFeed, canonicalUrl, dedupe, guessSourceType, sha12, isoDate, today, writeJsonAtomic, readJson } from './feed-lib.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const tierArg = args.includes('--tier') ? Number(args[args.indexOf('--tier') + 1]) : null;
const cfg = loadConfig();
const WINDOW = cfg.window_days;
const cutoff = Date.now() - WINDOW * 864e5;
const log = (m) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${m}`);
const stats = { requests: 0, failed: 0, items: 0 };

const inWindow = (d) => { const t = Date.parse(d); return Number.isFinite(t) && t >= cutoff && t <= Date.now() + 864e5; };

function makeItem({ url, title, publisher, date, snippet, via, set, source_type, hints = {} }) {
  const u = canonicalUrl(url);
  return { id: sha12(u), url: u, title: title.trim(), publisher: publisher || '', published: isoDate(date), snippet: (snippet || '').slice(0, 400),
    source_type: source_type || guessSourceType(publisher, u), collected_via: via, set, retrieved: today(), ...hints };
}

// ---- news search: Bing News RSS (short plain queries, direct publisher links) + GDELT (boolean, full text, best-effort) ----
// Bing pads thin result sets with unrelated headlines, so every result must contain the query's key words.
function mustFor(q, extra = []) {
  const phrases = [...q.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const res = extra.map((x) => new RegExp(x, 'i'));
  return (text) => {
    const t = text.toLowerCase();
    if (!res.every((re) => re.test(t))) return false;
    if (extra.length) return true;
    if (phrases.length) return phrases.some((p) => t.includes(p) || t.includes(p.replace(/-/g, ' ')));
    const words = q.replace(/site:\S+/g, '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.filter((w) => t.includes(w)).length >= Math.ceil(words.length / 2);
  };
}
async function bingNews(q, via, set, hints, must, byDate, first = 0) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}${byDate ? '&qft=' + encodeURIComponent('sortbydate="1"') : ''}${first ? `&first=${first}` : ''}&format=rss`;
  stats.requests++;
  const xml = await politeGet(url, { log });
  if (!xml) { stats.failed++; return []; }
  return parseFeed(xml).filter((i) => inWindow(i.date) && must(`${i.title} ${i.desc}`)).map((i) =>
    makeItem({ url: i.link, title: i.title, publisher: decodeURIComponent(i.source || ''), date: i.date, snippet: i.desc, via: `bing-news: ${via}`, set, hints }));
}
let gdeltOff = false; let gdeltFails = 0;
async function gdelt(q, via, set, hints) {
  if (gdeltOff || flag('--no-gdelt')) return [];
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + ' sourcelang:english')}&mode=artlist&maxrecords=250&timespan=${WINDOW}d&format=json&sort=datedesc`;
  stats.requests++;
  const txt = await politeGet(url, { log });
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  if (!j) { stats.failed++; if (/limit requests/i.test(txt ?? '') || ++gdeltFails >= 2) { gdeltOff = true; log('GDELT is rate-limiting or unreachable; skipping GDELT for the rest of this run'); } return []; }
  gdeltFails = 0;
  return (j.articles ?? []).map((a) => ({ ...a, date: a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z') })).filter((a) => inWindow(a.date) && a.title)
    .map((a) => makeItem({ url: a.url, title: a.title.replace(/\s+/g, ' '), publisher: a.domain, date: a.date, snippet: '', via: `gdelt: ${via}`, set, hints }));
}
// One search = Bing by relevance, and (when deep is set) Bing newest-first.
async function search(q, via, set, hints = {}, { must = [], deep = true } = {}) {
  const m = mustFor(q, must);
  const out = await bingNews(q, via, set, hints, m, false);
  if (deep) out.push(...await bingNews(q, via, set, hints, m, true));
  stats.items += out.length;
  return out;
}

// ---- SEC EDGAR (data.sec.gov submissions API + full-text search). Declared client, well under 2 requests per second. ----
const ITEM = { '1.01': 'material agreement', '1.02': 'agreement terminated', '2.01': 'acquisition or disposition completed', '2.02': 'results of operations', '2.03': 'new debt or obligation', '2.04': 'debt acceleration trigger', '3.02': 'unregistered equity sale', '5.02': 'officer or director change', '5.03': 'charter/bylaw change', '5.07': 'shareholder vote', '7.01': 'Reg FD disclosure', '8.01': 'other events', '9.01': 'exhibits' };
const FORM_NOTE = { '10-Q': 'quarterly report', '10-K': 'annual report', '424B5': 'prospectus supplement (securities offering)', '424B2': 'prospectus supplement (securities offering)', FWP: 'free writing prospectus (offering terms)', 'S-3ASR': 'shelf registration' };
async function edgarCompany(c) {
  const cik10 = c.cik.padStart(10, '0');
  stats.requests++;
  const txt = await politeGet(`https://data.sec.gov/submissions/CIK${cik10}.json`, { log });
  if (!txt) { stats.failed++; return []; }
  let j; try { j = JSON.parse(txt); } catch { return []; }
  if (!j.name?.toLowerCase().includes(c.expect)) { log(`EDGAR: CIK ${c.cik} is "${j.name}", expected "${c.expect}"; skipped`); return []; }
  const r = j.filings.recent; const out = [];
  const allForms = cfg.edgar.all_forms_for.includes(c.id);
  for (let i = 0; i < r.form.length; i++) {
    if (!inWindow(r.filingDate[i])) continue;
    const form = r.form[i];
    if (!allForms && !cfg.edgar.forms.includes(form)) continue;
    if (allForms && /^(3|4|5|144)$/.test(form)) continue; // insider ownership forms are noise
    const acc = r.accessionNumber[i]; const accNo = acc.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${Number(c.cik)}/${accNo}/${r.primaryDocument[i].replace(/^xsl[^/]+\//, '')}`;
    const items = (r.items[i] || '').split(',').filter(Boolean);
    const what = items.length ? items.filter((x) => x !== '9.01').map((x) => `Item ${x} ${ITEM[x] ?? ''}`.trim()).join('; ') : (FORM_NOTE[form] ?? r.primaryDocDescription[i] ?? '');
    out.push(makeItem({ url, title: `${j.name} ${form}${what ? `: ${what}` : ''}`, publisher: 'SEC EDGAR', date: r.filingDate[i],
      snippet: `Form ${form} filed ${r.filingDate[i]}. ${what}. Accession ${acc}.`, via: `edgar: ${c.id} filings`, set: 'targeted', source_type: 'Filing',
      hints: { builder_hint: c.builder_id ?? undefined, competitor_hint: c.competitor ?? undefined, form, sec_items: items } }));
  }
  stats.items += out.length;
  return out;
}
async function edgarFullText(q) {
  const start = isoDate(cutoff), end = today();
  stats.requests++;
  const txt = await politeGet(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&dateRange=custom&startdt=${start}&enddt=${end}&forms=8-K,10-Q,10-K,424B5,S-1,S-11`, { log });
  if (!txt) { stats.failed++; return []; }
  let j; try { j = JSON.parse(txt); } catch { return []; }
  const seen = new Set(); const out = [];
  for (const h of j.hits?.hits ?? []) {
    const s = h._source; if (seen.has(s.adsh) || !inWindow(s.file_date)) continue; seen.add(s.adsh);
    const cik = Number(s.ciks[0]); const file = h._id.split(':')[1];
    const name = (s.display_names[0] || '').replace(/\s+\(CIK.*$/, '').trim();
    const items = s.items ?? [];
    const what = items.filter((x) => x !== '9.01').map((x) => `Item ${x} ${ITEM[x] ?? ''}`.trim()).join('; ');
    out.push(makeItem({ url: `https://www.sec.gov/Archives/edgar/data/${cik}/${s.adsh.replace(/-/g, '')}/${file}`, title: `${name} ${s.form}${what ? `: ${what}` : ''} (mentions ${q.replace(/"/g, '')})`,
      publisher: 'SEC EDGAR', date: s.file_date, snippet: `Form ${s.form} filed ${s.file_date}; document ${s.file_type} matches the full-text search ${q}.`, via: `edgar full-text: ${q}`, set: 'targeted', source_type: 'Filing', hints: { form: s.form, sec_items: items } }));
  }
  stats.items += out.length;
  return out;
}

// ---- trade-press RSS, read whole ----
async function tradeFeed(f) {
  stats.requests++;
  const xml = await politeGet(f.url, { log });
  if (!xml) { stats.failed++; return []; }
  const out = parseFeed(xml).filter((i) => inWindow(i.date)).map((i) => makeItem({ url: i.link, title: i.title, publisher: f.publisher, date: i.date, snippet: i.desc, via: `rss: ${f.publisher}`, set: 'targeted', source_type: f.source_type }));
  stats.items += out.length;
  return out;
}

function saveGroup(id, items, extra = {}) {
  writeJsonAtomic(join(P.raw, `${id}.json`), { group: id, collected: new Date().toISOString(), window_days: WINDOW, count: items.length, ...extra, items });
  log(`${id}: ${items.length} items in window`);
}

async function runBaseline() {
  const items = [];
  for (const q of cfg.baseline.queries) {
    // The naive alert as a user would set it up: the bare phrase (quoted and unquoted), no builder or competitor names,
    // no guard beyond the words themselves. Paged so the sample is deep enough to measure.
    for (const query of [`"${q}"`, q]) for (const byDate of [false, true]) for (let page = 0; page < (cfg.baseline.pages ?? 8); page++) {
      stats.requests++;
      const got = await bingNews(query, `baseline ${query}`, 'baseline', {}, () => true, byDate, page * 10 + (page ? 1 : 0));
      stats.items += got.length; items.push(...got);
      if (!got.length) break;
    }
    const g = await gdelt(`"${q}"`, `baseline "${q}"`, 'baseline', {}); stats.items += g.length; items.push(...g);
  }
  saveGroup('baseline', dedupe(items), { note: 'Naive alert: the plain phrase with no builder or competitor names. Kept apart from the targeted set.' });
}

async function gdeltQueue(list) { const out = []; for (const [q, via, hints] of list) { const g = await gdelt(q, via, 'targeted', hints ?? {}); stats.items += g.length; out.push(...g); } return out; }

async function runTier(tier) {
  const builders = loadBuilders(); const bq = cfg.builder_queries;
  const nameOf = (b) => cfg.builder_search_names[b.id] ?? `"${b.name.replace(/\b(Corp|Inc|Cos|Co|Ltd)\.?$/, '').trim()}"`;
  // GDELT runs alongside Bing (different host, its own slow lane).
  const gq = [];
  for (const g of cfg.search_groups.filter((g) => g.tier === tier)) {
    for (const q of g.gdelt ?? []) gq.push([q, `${g.id}: ${q}`]);
    if (g.gdelt_template) for (const n of g.names) gq.push([g.gdelt_template.replaceAll('{name}', n), `${g.id}: ${n}`, { entrant_hint: n }]);
  }
  for (const b of builders) if (tier === 1 ? b.rank <= bq.tier1_max_rank : b.rank > bq.tier1_max_rank) gq.push([bq.gdelt_template.replaceAll('{name}', nameOf(b)), `builder ${b.id}`, { builder_hint: b.id }]);
  const gdeltDone = gdeltQueue(gq).then((items) => { if (items.length) saveGroup(`gdelt-tier${tier}`, items); });

  if (cfg.edgar.tier === tier) {
    const items = [];
    for (const c of cfg.edgar.companies) items.push(...await edgarCompany(c));
    for (const q of cfg.edgar.full_text_queries) items.push(...await edgarFullText(q));
    saveGroup('edgar', items);
  }
  for (const g of cfg.search_groups.filter((g) => g.tier === tier)) {
    const items = [];
    if (g.queries) for (const { q, must } of g.queries) items.push(...await search(q, `${g.id}: ${q}`, 'targeted', {}, { must: [...(must ?? []), ...(g.must_group ?? [])] }));
    if (g.templates) for (const n of g.names) for (const t of g.templates)
      items.push(...await search(t.replaceAll('{name}', n), `${g.id}: ${n}`, 'targeted', { entrant_hint: n }, { must: [n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ...(g.must_extra ?? [])], deep: false }));
    saveGroup(g.id, items);
  }
  if (cfg.trade_rss.tier === tier) {
    const items = [];
    for (const f of cfg.trade_rss.feeds) items.push(...await tradeFeed(f));
    for (const { q, must } of cfg.trade_rss.site_searches) items.push(...await search(q, `trade press: ${q}`, 'targeted', {}, { must: [...(must ?? []), ...(cfg.trade_rss.must_group ?? [])] }));
    saveGroup('trade-press', items);
  }
  // builder x financing / deals / people / land
  if (!builders.length) log('data/spine.json not found: builder queries skipped (rerun when the spine exists)');
  const items = [];
  for (const b of builders) {
    const top = b.rank <= bq.tier1_max_rank;
    const terms = tier === 1 ? (top ? bq.tier1_terms : []) : top ? bq.tier2_terms : b.rank >= bq.small_builder_from_rank ? bq.small_builder_terms : [...bq.tier1_terms, ...bq.tier2_terms.slice(0, 2)];
    const names = [nameOf(b), ...(terms.length ? cfg.builder_also_search[b.id] ?? [] : [])];
    const must = [cfg.builder_must[b.id] ?? nameOf(b).replace(/"/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')];
    for (const [ni, name] of names.entries()) for (const t of ni === 0 ? terms : terms.slice(0, 3))
      items.push(...await search(`${name} ${t}`, `builder ${b.id}: ${t.replace(/"/g, '')}`, 'targeted', { builder_hint: b.id }, { must, deep: tier === 1 && b.rank <= 10 }));
    if (terms.length && b.rank % 5 === 0) { log(`  builders: through rank ${b.rank}, ${items.length} items so far`); saveGroup(`builders-tier${tier}`, items); }
  }
  if (builders.length && items.length) saveGroup(`builders-tier${tier}`, items);
  await gdeltDone;
}

// --deep: pages 2 and 3 of the most important searches (Bing returns about ten results a page, newest-heavy), to reach back through the 90 days.
async function runDeep() {
  const pages = cfg.deep?.pages ?? [11, 21];
  const builders = loadBuilders().filter((b) => b.rank <= (cfg.deep?.max_rank ?? 50)); const bq = cfg.builder_queries;
  const nameOf = (b) => cfg.builder_search_names[b.id] ?? `"${b.name.replace(/\b(Corp|Inc|Cos|Co|Ltd)\.?$/, '').trim()}"`;
  const jobs = [];
  for (const g of cfg.search_groups.filter((g) => (cfg.deep?.groups ?? ['competitors', 'new-entrants-themes', 'builder-ma', 'capital-markets']).includes(g.id)))
    for (const { q, must } of g.queries ?? []) jobs.push([q, `${g.id}: ${q}`, {}, [...(must ?? []), ...(g.must_group ?? [])]]);
  for (const b of builders) for (const t of bq.tier1_terms) jobs.push([`${nameOf(b)} ${t}`, `builder ${b.id}: ${t.replace(/"/g, '')}`, { builder_hint: b.id }, [cfg.builder_must[b.id] ?? nameOf(b).replace(/"/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\function merge() {')]]);
  const items = [];
  for (const [i, [q, via, hints, must]] of jobs.entries()) {
    const m = mustFor(q, must);
    for (const first of pages) { stats.requests++; const got = await bingNews(q, `${via} (deep)`, 'targeted', hints, m, false, first); stats.items += got.length; items.push(...got); if (!got.length) break; }
    if (i % 50 === 49) { log(`  deep: ${i + 1}/${jobs.length} searches, ${items.length} items`); saveGroup('deep-pages', items); }
  }
  saveGroup('deep-pages', items);
}

function merge() {
  const files = readdirSync(P.raw).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  let targeted = [], baseline = [];
  for (const f of files) {
    const j = readJson(join(P.raw, f)); if (!j?.items) continue;
    for (const it of j.items) {
      if (/linkedin\.com/i.test(it.url) || Date.parse(it.published) < cutoff) continue;
      (it.set === 'baseline' ? baseline : targeted).push(it);
    }
  }
  const rawT = targeted.length;
  // Filings first so a filing wins over a news copy of the same title; then newest first.
  targeted.sort((a, b) => (a.source_type === 'Filing' ? 0 : 1) - (b.source_type === 'Filing' ? 0 : 1) || (/full-text/.test(a.collected_via) ? 1 : 0) - (/full-text/.test(b.collected_via) ? 1 : 0) || b.published.localeCompare(a.published));
  // One entry per SEC filing: a full-text hit on a filing we already have from the company list only adds to its trail.
  const acc = (it) => it.source_type === 'Filing' ? it.url.match(/\/data\/\d+\/(\d{18})\//)?.[1] : null;
  const byAcc = new Map();
  targeted = targeted.filter((it) => { const a = acc(it); if (!a) return true; const first = byAcc.get(a); if (first) { first.also_found_via = [...new Set([...(first.also_found_via ?? []), it.collected_via])]; return false; } byAcc.set(a, it); return true; });
  targeted = dedupe(targeted);
  baseline = dedupe(baseline.sort((a, b) => b.published.localeCompare(a.published)));
  writeJsonAtomic(join(P.raw, '_candidates.json'), { merged: new Date().toISOString(), window_days: WINDOW, raw_items: rawT, count: targeted.length, items: targeted });
  writeJsonAtomic(join(P.raw, '_baseline.json'), { merged: new Date().toISOString(), window_days: WINDOW, count: baseline.length, items: baseline });
  log(`merged: ${rawT} raw targeted items -> ${targeted.length} unique in the ${WINDOW}-day window; baseline ${baseline.length} unique`);
}

const t0 = Date.now();
if (!flag('--merge-only')) {
  if (flag('--baseline')) await runBaseline();
  else if (flag('--deep')) await runDeep();
  else {
    if (tierArg !== 2) await runTier(1);
    if (tierArg !== 1) await runTier(2);
    if (tierArg === null) await runBaseline();
  }
}
merge();
log(`done in ${Math.round((Date.now() - t0) / 1000)}s: ${stats.requests} requests, ${stats.failed} failed, ${stats.items} items returned`);
