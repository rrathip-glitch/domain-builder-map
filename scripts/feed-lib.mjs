// Shared helpers for the Domain feed scripts. Plain Node 22, no dependencies.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const P = {
  config: join(ROOT, 'feed/queries.json'),
  spine: join(ROOT, 'data/spine.json'),
  raw: join(ROOT, 'data/feed/raw'),
  scored: join(ROOT, 'data/feed/scored'),
  batches: join(ROOT, 'data/feed/batches'),
  articles: join(ROOT, 'data/feed/articles.json'),
  votes: join(ROOT, 'data/local/votes.json'),
  extras: join(ROOT, 'data/extras'),
};

export const readJson = (p, fallback = null) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
};
// Write to a temp file, then rename: readers never see a half-written file.
export const writeJsonAtomic = (p, obj) => {
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 1));
  renameSync(tmp, p);
};
export const sha12 = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
export const today = () => isoDate(Date.now());

export function loadConfig() { return readJson(P.config); }
export function loadBuilders() {
  const s = readJson(P.spine);
  if (s?.builders?.length) return s.builders.map((b) => ({ id: b.builder_id, name: b.name, rank: b.rank }));
  // Spine not written yet: fall back to whatever builder files exist.
  return [];
}

// ---- polite fetching: per-host spacing, declared client, robots.txt ----
const lastHit = new Map();
const robotsCache = new Map();
let cfgCache = null;
const cfg = () => (cfgCache ??= loadConfig());

async function rawFetch(url, opts = {}) {
  const host = new URL(url).host;
  const gap = cfg().rate_ms[host] ?? cfg().rate_ms.default;
  const slot = Math.max(Date.now(), (lastHit.get(host) ?? 0) + gap); // reserve the next slot for this host
  lastHit.set(host, slot);
  if (slot > Date.now()) await sleep(slot - Date.now());
  const ctrl = AbortSignal.timeout(opts.timeout ?? 20000);
  return fetch(url, { ...opts, signal: ctrl, redirect: 'follow', headers: { 'User-Agent': cfg().user_agent, Accept: '*/*', ...(opts.headers ?? {}) } });
}

async function robotsAllows(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.host)) {
    let rules = [];
    try {
      const r = await rawFetch(`${u.origin}/robots.txt`, { timeout: 10000 });
      if (r.ok) rules = parseRobots(await r.text());
    } catch { /* no robots file reachable: treat as no rules */ }
    robotsCache.set(u.host, rules);
  }
  const path = u.pathname + u.search;
  let best = { len: -1, allow: true };
  for (const r of robotsCache.get(u.host)) {
    if (r.re.test(path) && r.path.length > best.len) best = { len: r.path.length, allow: r.allow };
  }
  return best.allow;
}
function parseRobots(txt) {
  const rules = []; let inStar = false; let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2];
    if (k === 'user-agent') { inStar = lastWasAgent ? inStar || v === '*' : v === '*'; lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!inStar || !v || (k !== 'allow' && k !== 'disallow')) continue;
    const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    rules.push({ path: v, allow: k === 'allow', re });
  }
  return rules;
}

// GET with robots check, spacing and two retries with backoff. Returns text or null (never throws).
export async function politeGet(url, { log = () => {}, headers } = {}) {
  if (/linkedin\.com/i.test(url)) return null; // never
  if (!(await robotsAllows(url))) { log(`robots.txt disallows ${url}; skipped`); return null; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await rawFetch(url, { headers });
      if (r.ok) return await r.text();
      if (r.status === 429 || r.status >= 500) { await sleep(4000 * (attempt + 1) ** 2); continue; }
      log(`HTTP ${r.status} ${url}`); return null;
    } catch (e) { if (attempt === 2) log(`fetch failed ${url}: ${e.message}`); await sleep(2000 * (attempt + 1)); }
  }
  return null;
}

// ---- tiny RSS / Atom reader (enough for news-search and trade feeds) ----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
export const stripTags = (s = '') => decodeEntities(decodeEntities(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; };
const attr = (xml, name, a) => { const m = xml.match(new RegExp(`<${name}\\s[^>]*${a}=["']([^"']+)["']`, 'i')); return m ? decodeEntities(m[1]) : ''; };

export function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'));
    let link = decodeEntities(tag(b, 'link')).trim() || attr(b, 'link', 'href');
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const desc = stripTags(tag(b, 'description') || tag(b, 'summary') || '');
    const source = stripTags(tag(b, 'source')) || stripTags(tag(b, 'News:Source'));
    const sourceUrl = attr(b, 'source', 'url');
    if (title && link) out.push({ title, link, date: stripTags(date), desc, source, sourceUrl });
  }
  return out;
}

// ---- normalising and de-duplication ----
export function canonicalUrl(u) {
  try {
    const x = new URL(u);
    // Bing wraps the publisher link: https://www.bing.com/news/apiclick.aspx?...&url=<publisher>
    if (/bing\.com$/.test(x.host) && x.searchParams.get('url')) return canonicalUrl(x.searchParams.get('url'));
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|cmpid|ref$|oc$|tsrc|guccounter|guce_)/i.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString().replace(/\/$/, '');
  } catch { return u; }
}
export const titleKey = (t) => t.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|a|an|inc|corp|corporation|co|llc)\b/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (t) => new Set(titleKey(t).split(' ').filter((w) => w.length > 2));
export function nearSame(a, b) {
  const A = tokens(a), B = tokens(b); if (A.size < 4 || B.size < 4) return false;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter) >= 0.82;
}
// Source preference when two items are the same story: filing, then release, then trade press, then news.
const TYPE_RANK = { Filing: 0, 'Press release': 1, 'Trade press': 2, Research: 2, News: 3 };
export function dedupe(items) {
  const byUrl = new Map(); const byTitle = new Map(); const kept = [];
  const better = (a, b) => (TYPE_RANK[a.source_type] ?? 9) < (TYPE_RANK[b.source_type] ?? 9) || (!/news\.google\.com/.test(a.url) && /news\.google\.com/.test(b.url));
  for (const it of items) {
    const k = titleKey(it.title);
    let dup = byUrl.get(it.url) ?? byTitle.get(k);
    if (!dup) {
      // near-identical titles within 4 days of each other
      const day = Date.parse(it.published);
      dup = kept.find((o) => Math.abs(Date.parse(o.published) - day) <= 4 * 864e5 && nearSame(o.title, it.title));
    }
    if (dup) {
      dup.also_found_via = [...new Set([...(dup.also_found_via ?? []), it.collected_via])].slice(0, 8);
      dup.dupes = (dup.dupes ?? 0) + 1;
      // Every id ever merged into this item stays findable, so scores and votes survive a re-merge that picks a different copy.
      dup.alias_ids = [...new Set([...(dup.alias_ids ?? []), dup.id, it.id, ...(it.alias_ids ?? [])])];
      if (better(it, dup)) { // swap in the better source, keep the merged trail
        const keep = { also_found_via: dup.also_found_via, dupes: dup.dupes, alias_ids: dup.alias_ids };
        byUrl.delete(dup.url); Object.assign(dup, it, keep, { id: sha12(it.url) }); byUrl.set(dup.url, dup);
      }
      continue;
    }
    byUrl.set(it.url, it); byTitle.set(k, it); kept.push(it);
  }
  return kept;
}

const TRADE = /builderonline|probuilder|housingwire|bisnow|zondahome|johnburns|constructiondive|multihousingnews|globest|connectcre|therealdeal|commercialobserver|bizjournals|costar|nahb|eyeonhousing|buildermagazine|builder magazine|pro builder|builder$|professional builder|housing ?wire|real deal|commercial observer|business journal|multi-housing|pere|private debt investor|pitchbook|trepp|crenews|homebuilding/i;
const WIRE = /prnewswire|businesswire|globenewswire|accesswire|newswire|business wire|pr newswire|globe newswire|investor relations|\binvestors?\.|\bir\./i;
export function guessSourceType(publisher = '', url = '') {
  const s = `${publisher} ${url}`;
  if (/sec\.gov|SEC EDGAR/i.test(s)) return 'Filing';
  if (WIRE.test(s)) return 'Press release';
  if (/john burns|zonda|eye on housing|calculated risk|fitch ratings|moody|s&p global/i.test(s)) return 'Research';
  if (TRADE.test(s)) return 'Trade press';
  return 'News';
}

// ---- rubric arithmetic (feed/RUBRIC.md): five sub-scores, then one named cap or floor ----
export const SUB_MAX = { land_banking_competitor: 30, builder_customer: 25, financing_capital_markets: 25, land_lot_supply: 10, materiality_actionability: 10 };
export const ADJ = {
  none: (s) => s,
  'cap40-generic': (s) => Math.min(s, 40),
  'cap20-consumer': (s) => Math.min(s, 20),
  'cap30-duplicate': (s) => Math.min(s, 30),
  'cap45-routine-filing': (s) => Math.min(s, 45),
  'cap10-off-topic': (s) => Math.min(s, 10), // v1.3
  'floor85-competitor-deal': (s) => Math.max(s, 85), // v1.2
  'floor75-competitor': (s) => Math.max(s, 75),
  'floor75-exec-top25': (s) => Math.max(s, 75), // v1.2
  'floor75-builder-ma': (s) => Math.max(s, 75), // v1.3
  'floor70-financing': (s) => Math.max(s, 70),
  'floor65-exec': (s) => Math.max(s, 65),
};
export function rubricScore(a) {
  const sub = {}; for (const k of Object.keys(SUB_MAX)) sub[k] = Math.max(0, Math.min(SUB_MAX[k], Math.round(Number(a?.subscores?.[k]) || 0)));
  const adj = ADJ[a?.adjustment] ? a.adjustment : 'none';
  const sum = Object.values(sub).reduce((x, y) => x + y, 0);
  return { sub, adj, score: Math.max(0, Math.min(100, ADJ[adj](sum))) };
}
