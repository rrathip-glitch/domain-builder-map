#!/usr/bin/env node
// Domain builder map: zero-build local app. Plain Node HTTP server, no dependencies.
//   node app/server.mjs        (PORT env, default 4173)
// Reads data/dist/ on every request (cached by file mtime) so a rebuild shows up on refresh.
// Runtime state (votes, notes) lives in data/local/ and survives rebuilds.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { rankFeed, learnedWeights, DIRECT, LEARN_CAP, FEATURES } from './lib/rank.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// Static root. PUBLIC_DIR (resolved against the project root) lets another front end be served without touching this file.
const PUBLIC = process.env.PUBLIC_DIR ? path.resolve(ROOT, process.env.PUBLIC_DIR) : path.join(HERE, 'public');
// Shared modules owned by the server side (vote maths, org-map model). Served at /lib/<name>.js for any front end.
const LIB = path.join(HERE, 'lib');
const DATA = process.env.DOMAIN_DATA_DIR ? path.resolve(process.env.DOMAIN_DATA_DIR) : path.join(ROOT, 'data');
const DIST = path.join(DATA, 'dist');
const LOCAL = path.join(DATA, 'local');
const EXPORTS = path.join(ROOT, 'exports');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.ico': 'image/x-icon' };

// ---------- data access ----------
const cache = new Map(); // file -> { mtimeMs, size, raw, json }
function readDist(name) {
  const file = path.join(DIST, name);
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const c = cache.get(file);
  if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c;
  try {
    const raw = fs.readFileSync(file);
    const entry = { mtimeMs: st.mtimeMs, size: st.size, raw, json: JSON.parse(raw.toString('utf8')), gz: null };
    cache.set(file, entry);
    return entry;
  } catch { return c || null; } // keep serving the last good read if a file is unreadable for a moment
}
const EMPTY = { generated: '', builders: [], people: [], competitors: [], ma_industry: { deals: [] }, feed: { articles: [] }, extras: [], sources: [], totals: {}, legend: {} };
const domain = () => readDist('domain.json')?.json || EMPTY;

function readLocal(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(LOCAL, name), 'utf8')); } catch { return fallback; }
}
let writeChain = Promise.resolve();
function writeLocal(name, obj) {
  writeChain = writeChain.then(() => {
    fs.mkdirSync(LOCAL, { recursive: true });
    const file = path.join(LOCAL, name);
    const tmp = file + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
    fs.renameSync(tmp, file);
  }).catch((e) => console.error('write failed', name, e.message));
  return writeChain;
}
const getVotes = () => readLocal('votes.json', {});
const getNotes = () => { const n = readLocal('notes.json', {}); return { builders: n.builders || {}, people: n.people || {} }; };

function tuningExamples() {
  const d = domain();
  const votes = getVotes();
  const ranked = rankFeed(d.feed.articles || [], votes);
  const examples = ranked.filter((a) => a.adj.vote).map((a) => ({
    article_id: a.id, url: a.url, title: a.title, publisher: a.publisher, published: a.published, category: a.category,
    builder_ids: a.builder_ids, competitors: a.competitors, base_score: a.score, subscores: a.subscores,
    vote: a.adj.vote, direction: a.adj.vote > 0 ? 'under-scored (reader wants more like this)' : 'over-scored (reader wants less like this)',
    note: votes[a.id]?.note || '', voted_at: votes[a.id]?.ts || '', adjusted_score: a.adj.adjusted,
  }));
  // votes on stories no longer in the feed window are kept as examples too
  const known = new Set(ranked.map((a) => a.id));
  for (const [id, v] of Object.entries(votes)) if (!known.has(id) && v.vote) examples.push({ article_id: id, url: v.url || '', title: v.title || '', vote: v.vote, note: v.note || '', voted_at: v.ts || '', base_score: v.base_score ?? null, category: v.category || '', publisher: v.publisher || '', builder_ids: v.builder_ids || [], competitors: v.competitors || [] });
  return {
    generated: new Date().toISOString(), rubric_version: d.feed.rubric_version || '',
    how_to_use: 'Read before scoring at the next refresh. Upvotes are examples of under-scored patterns, downvotes of over-scored ones, notes are instructions. When the same correction shows up three times, change feed/RUBRIC.md and bump the version.',
    adjustment_rule: { direct_vote_points: DIRECT, learned_cap: LEARN_CAP, per_feature: FEATURES },
    vote_count: examples.length, upvotes: examples.filter((e) => e.vote > 0).length, downvotes: examples.filter((e) => e.vote < 0).length,
    learned_weights: learnedWeights(d.feed.articles || [], votes),
    examples,
  };
}

// ---------- search ----------
const norm = (s) => String(s ?? '').toLowerCase();
function search(q, limit = 50) {
  const d = domain();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return { q, builders: [], people: [], competitors: [] };
  const hit = (text) => terms.every((t) => text.includes(t));
  const builders = d.builders.filter((b) => hit(norm([b.name, b.profile?.legal_name, (b.profile?.brand_names || []).join(' '), b.parent, b.ticker, b.hq, b.states.join(' '), (b.profile?.markets || []).join(' '), b.ownership].join(' '))))
    .slice(0, limit).map((b) => ({ builder_id: b.builder_id, name: b.name, rank: b.rank, tier: b.tier, ownership: b.ownership, hq: b.hq, people: b.derived.people_count }));
  const people = d.people.filter((p) => hit(norm([p.name, p.title, p.geography, p.role_category, p.priority_group, p.builder_name].join(' '))))
    .slice(0, limit * 4).map((p) => ({ person_id: p.person_id, name: p.name, title: p.title, geography: p.geography, builder_id: p.builder_id, builder_name: p.builder_name, rank: p.rank, priority_group: p.priority_group, confidence: p.confidence }));
  const competitors = d.competitors.filter((c) => hit(norm([c.name, c.type, c.manager_or_parent, c.summary].join(' ')))).slice(0, limit).map((c) => ({ competitor_id: c.competitor_id, name: c.name, type: c.type }));
  return { q, builders, people, competitors };
}

function filterPeople(qs) {
  const d = domain();
  const q = norm(qs.get('q'));
  const eq = (k, v) => !qs.get(k) || String(v) === qs.get(k);
  return d.people.filter((p) => eq('group', p.priority_group) && eq('role', p.role_category) && eq('level', p.level) && eq('builder', p.builder_id) && eq('confidence', p.confidence) && eq('ownership', p.ownership_group)
    && (!qs.get('tier') || (p.rank != null && p.rank <= Number(qs.get('tier'))))
    && (!qs.get('state') || p.builder_states.includes(qs.get('state')) || new RegExp('\\b' + qs.get('state') + '\\b').test(p.geography))
    && (!q || norm([p.name, p.title, p.geography, p.builder_name, p.role_category].join(' ')).includes(q)));
}
const csvCell = (v) => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function peopleCsv(rows, notes) {
  const cols = ['name', 'title', 'priority_group', 'role_category', 'level', 'geography', 'builder_name', 'rank', 'tier', 'ownership', 'reports_to', 'reports_to_confidence', 'email', 'email_confidence', 'phone', 'in_role_since', 'confidence', 'source_url', 'source_title', 'source_date', 'retrieved', 'note'];
  const lines = [[...cols, 'domain_internal_notes'].join(',')];
  for (const p of rows) lines.push([...cols.map((c) => csvCell(p[c])), csvCell(notes.people[p.person_id]?.text || '')].join(','));
  return '﻿' + lines.join('\r\n');
}

// ---------- rebuild from the page (local use only) ----------
// Runs the same two scripts as `npm run build`. Off when the server is exposed beyond this computer or pointed at another data folder.
const CAN_REBUILD = HOST === '127.0.0.1' && !process.env.DOMAIN_DATA_DIR && process.env.ALLOW_REBUILD !== '0'
  && process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT && !process.env.APP_PIN // never in the hosted copy (it runs behind app/gate.mjs)
  && fs.existsSync(path.join(ROOT, 'scripts', 'build.mjs')) && fs.existsSync(path.join(ROOT, 'data', 'builders'));
let rebuilding = null;
function rebuild() {
  if (rebuilding) return rebuilding;
  const run = (script) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(ROOT, 'scripts', script), '--quiet'], { cwd: ROOT, timeout: 120000 }, (err, stdout, stderr) => (err ? reject(new Error((stderr || err.message).slice(0, 500))) : resolve(stdout))));
  rebuilding = run('build.mjs').then(() => run('export-xlsx.mjs')).finally(() => { rebuilding = null; });
  return rebuilding;
}

// ---------- http ----------
function send(req, res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra };
  if (buf.length > 1400 && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && !/spreadsheetml/.test(type)) { buf = zlib.gzipSync(buf, { level: 5 }); headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('invalid JSON body')); } });
    req.on('error', reject);
  });
}
function serveStatic(req, res, dir, rel) {
  const file = path.normalize(path.join(dir, rel));
  if (!file.startsWith(dir + path.sep)) return send(req, res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(req, res, 404, { error: 'not found' });
    const ext = path.extname(file);
    const extra = ext === '.xlsx' || ext === '.csv' ? { 'Content-Disposition': `attachment; filename="${path.basename(file)}"` } : {};
    send(req, res, 200, buf, MIME[ext] || 'application/octet-stream', extra);
  });
}

const builderSummary = (b) => ({ builder_id: b.builder_id, name: b.name, rank: b.rank, tier: b.tier, closings: b.closings, revenue_usd_m: b.revenue_usd_m, ownership: b.ownership, ownership_group: b.ownership_group, ticker: b.ticker, parent: b.parent, hq: b.hq, states: b.states, derived: b.derived });

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  const qs = url.searchParams;
  const d = domain();

  if (p === '/api/health') return send(req, res, 200, { ok: true, data_generated: d.generated || null, builders: d.builders.length, people: d.people.length });
  if (p === '/api/meta') return send(req, res, 200, { generated: d.generated, retrieved: d.retrieved, ranking: d.ranking, totals: d.totals, legend: d.legend, workbook: fs.existsSync(path.join(EXPORTS, 'Domain-Builder-Map.xlsx')), can_rebuild: CAN_REBUILD });
  if (p === '/api/data') {
    // The merged file is large, so it carries a validator: a reload that already has this build gets a 304 with no body.
    // "no-cache" makes the browser ask every time, so a rebuild still shows on refresh.
    const e = readDist('domain.json');
    if (!e) return send(req, res, 200, EMPTY);
    const etag = `W/"${e.size}-${Math.round(e.mtimeMs)}"`;
    const headers = { ETag: etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
    if ((req.headers['if-none-match'] || '').split(',').map((x) => x.trim()).includes(etag)) { res.writeHead(304, headers); return res.end(); }
    return send(req, res, 200, e.raw, 'application/json; charset=utf-8', headers);
  }
  if (p === '/api/coverage') return send(req, res, 200, readDist('coverage.json')?.json || { totals: {}, builders: [], validation_issues: [] });
  if (p === '/api/builders') return send(req, res, 200, d.builders.map(builderSummary));
  if (p.startsWith('/api/builders/')) {
    const b = d.builders.find((x) => x.builder_id === p.slice('/api/builders/'.length));
    if (!b) return send(req, res, 404, { error: 'builder not found' });
    const ids = new Set(b.news_ids);
    const notes = getNotes();
    return send(req, res, 200, { ...b, news: rankFeed(d.feed.articles.filter((a) => ids.has(a.id)), getVotes()).sort((x, y) => String(y.published).localeCompare(String(x.published))), domain_internal_notes: notes.builders[b.builder_id]?.text || '', people: b.people.map((x) => ({ ...x, domain_internal_notes: notes.people[x.person_id]?.text || '' })) });
  }
  if (p === '/api/people' || p === '/api/people.csv') {
    const rows = filterPeople(qs);
    if (p.endsWith('.csv') || qs.get('format') === 'csv') return send(req, res, 200, peopleCsv(rows, getNotes()), MIME['.csv'], { 'Content-Disposition': 'attachment; filename="domain-rolodex.csv"' });
    return send(req, res, 200, { count: rows.length, people: rows });
  }
  if (p === '/api/feed') {
    const cutoff = Number(qs.get('cutoff')) || 0;
    const rows = rankFeed(d.feed.articles, getVotes()).filter((a) => a.adj.adjusted >= cutoff).sort((a, b) => b.adj.adjusted - a.adj.adjusted || String(b.published).localeCompare(String(a.published)));
    return send(req, res, 200, { generated: d.feed.generated, window_days: d.feed.window_days, rubric_version: d.feed.rubric_version, cutoff, count: rows.length, articles: rows });
  }
  if (p === '/api/competitors') return send(req, res, 200, d.competitors);
  if (p.startsWith('/api/competitors/')) { const c = d.competitors.find((x) => x.competitor_id === p.slice('/api/competitors/'.length)); return c ? send(req, res, 200, c) : send(req, res, 404, { error: 'competitor not found' }); }
  if (p === '/api/ma') return send(req, res, 200, d.ma_industry);
  if (p === '/api/insights') return send(req, res, 200, d.extras.map((x) => ({ id: x.id, title: x.title, subtitle: x.subtitle || '', is_estimate: !!x.is_estimate, rows: x.rows.length })));
  if (p.startsWith('/api/insights/')) { const x = d.extras.find((e) => e.id === p.slice('/api/insights/'.length)); return x ? send(req, res, 200, x) : send(req, res, 404, { error: 'insight not found' }); }
  if (p === '/api/sources') return send(req, res, 200, d.sources);
  if (p === '/api/search') return send(req, res, 200, search(qs.get('q') || ''));
  if (p === '/api/tuning-examples') {
    const t = tuningExamples();
    return send(req, res, 200, JSON.stringify(t, null, 1), MIME['.json'], qs.get('download') ? { 'Content-Disposition': 'attachment; filename="tuning-examples.json"' } : {});
  }

  if (p === '/api/rebuild' && req.method === 'POST') {
    if (!CAN_REBUILD) return send(req, res, 403, { ok: false, error: 'rebuild from the page is only available when the app runs locally' });
    const t = Date.now();
    try { await rebuild(); return send(req, res, 200, { ok: true, ms: Date.now() - t, generated: domain().generated }); } catch (e) { return send(req, res, 500, { ok: false, error: e.message }); }
  }
  if (p === '/api/votes') {
    if (req.method === 'GET') return send(req, res, 200, getVotes());
    if (req.method === 'POST') {
      const body = await readBody(req);
      const id = String(body.id || '');
      if (!id) return send(req, res, 400, { error: 'id required' });
      const votes = getVotes();
      const vote = body.vote === 1 || body.vote === -1 ? body.vote : body.vote === 0 ? 0 : (votes[id]?.vote || 0);
      const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : (votes[id]?.note || '');
      if (!vote && !note) delete votes[id];
      else {
        const a = d.feed.articles.find((x) => x.id === id);
        votes[id] = { vote, note, ts: new Date().toISOString(), ...(a ? { title: a.title, url: a.url, publisher: a.publisher, category: a.category, builder_ids: a.builder_ids, competitors: a.competitors, base_score: a.score } : {}) };
      }
      await writeLocal('votes.json', votes);
      await writeLocal('tuning-examples.json', tuningExamples());
      return send(req, res, 200, { ok: true, votes });
    }
  }
  if (p === '/api/notes') {
    if (req.method === 'GET') return send(req, res, 200, getNotes());
    if (req.method === 'POST') {
      const body = await readBody(req);
      const kind = body.kind === 'person' ? 'people' : body.kind === 'builder' ? 'builders' : null;
      const id = String(body.id || '');
      if (!kind || !id) return send(req, res, 400, { error: 'kind (builder|person) and id required' });
      const notes = getNotes();
      const text = String(body.text ?? '').slice(0, 20000);
      if (text.trim()) notes[kind][id] = { text, ts: new Date().toISOString() }; else delete notes[kind][id];
      await writeLocal('notes.json', notes);
      return send(req, res, 200, { ok: true, saved: notes[kind][id] || null });
    }
  }
  if (p.startsWith('/api/')) return send(req, res, 404, { error: 'unknown route' });

  if (p.startsWith('/exports/')) return serveStatic(req, res, EXPORTS, p.slice('/exports/'.length));
  if (p.startsWith('/lib/')) return serveStatic(req, res, LIB, p.slice('/lib/'.length));
  if (p === '/' || p === '/index.html') return serveStatic(req, res, PUBLIC, 'index.html');
  // a front end that does not ship its own copy of a shared module gets the server's
  if ((p === '/rank.js' || p === '/org.js') && !fs.existsSync(path.join(PUBLIC, p.slice(1)))) return serveStatic(req, res, LIB, p.slice(1));
  return serveStatic(req, res, PUBLIC, p.slice(1));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(req.method, req.url, e); try { send(req, res, 500, { error: e.message }); } catch { /* response already sent */ } });
});
server.listen(PORT, HOST, () => console.log(`Domain builder map: http://localhost:${PORT}  (front end: ${path.relative(ROOT, PUBLIC)}, data: ${path.relative(ROOT, DIST)}, state: ${path.relative(ROOT, LOCAL)})`));
