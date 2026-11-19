// Newsletter: subscriptions, digest builder, sender and daily scheduler.
// Owned by the orchestrator. Mounted by app/gate.mjs under /newsletter/* (app/server.mjs is untouched).
//
//   GET  /newsletter/options                 -> defaults, categories, builders, whether sending is switched on
//   POST /newsletter/preview    {settings}   -> { count, subject, html }   (what today's issue would be)
//   POST /newsletter/subscribe  {email, name?, ...settings} -> { ok, id, sent, count, subject, html, sending_enabled }
//   POST /newsletter/update     {token, ...settings}        -> { ok }
//   GET  /newsletter/unsubscribe?token=...   -> small confirmation page (works without the PIN)
//
// Settings: min_score (0-100, default 70), frequency ("daily" | "weekly"), max_stories (1-20, default 10),
//           categories [] (empty = all), builder_ids [] (empty = all builders).
// Sending needs RESEND_API_KEY and NEWSLETTER_FROM in the environment; without them everything works except
// the actual send, and the first issue is returned as a preview instead.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA = process.env.DOMAIN_DATA_DIR ? path.resolve(process.env.DOMAIN_DATA_DIR) : path.join(ROOT, 'data');
const LOCAL = path.join(DATA, 'local');
const SUBS_FILE = path.join(LOCAL, 'subscriptions.json');
const DIST = path.join(DATA, 'dist', 'domain.json');
const KEY = (process.env.RESEND_API_KEY || '').trim();
const FROM = (process.env.NEWSLETTER_FROM || '').trim();
const PORTAL = (process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/, '');
const SEND_HOUR = Number(process.env.NEWSLETTER_HOUR || 7); // 7 am Eastern
const TZ = 'America/New_York';
const DEFAULTS = { min_score: 70, frequency: 'daily', max_stories: 10, categories: [], builder_ids: [] };

export const sendingEnabled = () => Boolean(KEY && FROM);

// ---------- storage ----------
function loadSubs() { try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return []; } }
function saveSubs(subs) {
  fs.mkdirSync(LOCAL, { recursive: true });
  const tmp = SUBS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(subs, null, 2));
  fs.renameSync(tmp, SUBS_FILE);
}
let cache = { mtime: 0, articles: [], builders: new Map() };
function loadFeed() {
  try {
    const st = fs.statSync(DIST);
    if (st.mtimeMs !== cache.mtime) {
      const d = JSON.parse(fs.readFileSync(DIST, 'utf8'));
      cache = { mtime: st.mtimeMs, articles: (d.feed && d.feed.articles) || [], builders: new Map((d.builders || []).map((b) => [b.builder_id, { name: b.name, rank: b.rank }])) };
    }
  } catch { /* keep the last good copy */ }
  return cache;
}

// ---------- settings ----------
function cleanSettings(x = {}) {
  const n = (v, lo, hi, def) => { const k = Number(v); return Number.isFinite(k) ? Math.min(hi, Math.max(lo, Math.round(k))) : def; };
  const arr = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.length < 80).slice(0, 100) : []);
  return {
    min_score: n(x.min_score, 0, 100, DEFAULTS.min_score),
    frequency: x.frequency === 'weekly' ? 'weekly' : 'daily',
    max_stories: n(x.max_stories, 1, 20, DEFAULTS.max_stories),
    categories: arr(x.categories),
    builder_ids: arr(x.builder_ids),
  };
}
const daysAgo = (iso) => (Date.now() - new Date(iso + 'T12:00:00Z').getTime()) / 86400000;

// Stories for one issue: above the cutoff, matching the chosen topics and builders, not sent to this person before,
// most relevant first. The first issue looks back 14 days so it is never empty on day one; later issues carry only new stories.
function pickStories(settings, sentIds = [], first = false) {
  const { articles } = loadFeed();
  const sent = new Set(sentIds);
  const windowDays = first ? 14 : settings.frequency === 'weekly' ? 9 : 4;
  return articles
    .filter((a) => typeof a.score === 'number' && a.score >= settings.min_score)
    .filter((a) => !sent.has(a.id))
    .filter((a) => a.published && daysAgo(a.published) <= windowDays && daysAgo(a.published) >= -1)
    .filter((a) => !settings.categories.length || settings.categories.includes(a.category))
    .filter((a) => !settings.builder_ids.length || (a.builder_ids || []).some((id) => settings.builder_ids.includes(id)))
    .sort((a, b) => b.score - a.score || String(b.published).localeCompare(String(a.published)))
    .slice(0, settings.max_stories);
}

// ---------- email ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => { try { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch { return iso; } };
function describe(settings) {
  const { builders } = loadFeed();
  const bits = [`scoring ${settings.min_score} or higher`, settings.frequency === 'weekly' ? 'weekly' : 'daily', `up to ${settings.max_stories} stories`];
  if (settings.categories.length) bits.push('topics: ' + settings.categories.join(', '));
  if (settings.builder_ids.length) bits.push('builders: ' + settings.builder_ids.map((id) => builders.get(id)?.name || id).join(', '));
  return bits.join(' · ');
}
function renderEmail(sub, stories) {
  const { builders } = loadFeed();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const n = stories.length;
  const subject = n ? `Domain builder feed: ${n} ${n === 1 ? 'story' : 'stories'} at ${sub.settings.min_score}+ · ${today}` : `Domain builder feed: nothing new at ${sub.settings.min_score}+ today`;
  const unsub = PORTAL && sub.token ? `${PORTAL}/newsletter/unsubscribe?token=${sub.token}` : '';
  const rows = stories.map((a) => {
    const tags = (a.builder_ids || []).slice(0, 4).map((id) => builders.get(id)?.name || id).concat((a.competitors || []).slice(0, 3));
    const colour = a.score >= 90 ? '#0b5d3b' : a.score >= 70 ? '#1d4ed8' : '#5b6472';
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #e6e8ee;vertical-align:top;width:54px">
<div style="background:${colour};color:#fff;font:700 18px/40px Arial,sans-serif;width:44px;height:40px;text-align:center;border-radius:8px">${a.score}</div></td>
<td style="padding:14px 0 14px 12px;border-bottom:1px solid #e6e8ee;vertical-align:top">
<a href="${esc(a.url)}" style="font:700 17px/1.3 Arial,sans-serif;color:#0f1b33;text-decoration:none">${esc(a.title)}</a>
<div style="font:15px/1.45 Arial,sans-serif;color:#1f2937;margin-top:5px">${esc(a.summary || '')}</div>
<div style="font:13px/1.4 Arial,sans-serif;color:#6b7280;margin-top:6px">${esc(a.publisher || '')} · ${esc(fmtDate(a.published))}${tags.length ? ' · ' + esc(tags.join(', ')) : ''}</div></td></tr>`;
  }).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:26px 28px">
<tr><td colspan="2"><div style="font:700 13px Arial,sans-serif;letter-spacing:.08em;color:#1d4ed8;text-transform:uppercase">Domain builder feed</div>
<div style="font:700 24px/1.25 Georgia,serif;color:#0f1b33;margin:6px 0 4px">${n ? `${n} ${n === 1 ? 'story' : 'stories'} worth your time` : 'Nothing new above your cutoff'}</div>
<div style="font:14px Arial,sans-serif;color:#6b7280;margin-bottom:8px">${esc(today)} · most relevant first</div></td></tr>
${rows || '<tr><td colspan="2" style="font:15px Arial,sans-serif;color:#374151;padding:14px 0">No new story cleared your cutoff since the last issue.</td></tr>'}
<tr><td colspan="2" style="padding-top:18px;font:13px/1.5 Arial,sans-serif;color:#6b7280">
You get this because you created a newsletter in the Domain builder map: ${esc(describe(sub.settings))}.
${PORTAL ? `<br><a href="${PORTAL}/#/news" style="color:#1d4ed8">Open the feed</a>` : ''}${unsub ? ` · <a href="${unsub}" style="color:#1d4ed8">Unsubscribe</a>` : ''}
<br>Scores are a 0 to 100 relevance rating against a written rubric; each story links to its source.</td></tr></table></body></html>`;
  const text = stories.map((a) => `[${a.score}] ${a.title}\n${a.summary || ''}\n${a.url}`).join('\n\n') + (unsub ? `\n\nUnsubscribe: ${unsub}` : '');
  return { subject, html, text };
}
async function deliver(sub, mail) {
  if (!sendingEnabled()) return { sent: false, reason: 'sending is not switched on' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [sub.email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { sent: true, id: j.id } : { sent: false, reason: j.message || 'email service returned ' + r.status };
  } catch (e) { return { sent: false, reason: String(e.message || e) }; }
}
async function sendIssue(sub, { first = false } = {}) {
  const stories = pickStories(sub.settings, sub.sent_ids, first);
  const mail = renderEmail(sub, stories);
  if (!stories.length && !first) return { sent: false, count: 0, reason: 'nothing new above the cutoff', ...mail };
  const res = await deliver(sub, mail);
  if (res.sent) { sub.sent_ids = [...(sub.sent_ids || []), ...stories.map((a) => a.id)].slice(-2000); sub.last_sent = new Date().toISOString(); }
  return { ...res, count: stories.length, ...mail };
}

// ---------- scheduler: once a day at SEND_HOUR Eastern (weekly subscriptions on Mondays) ----------
function easternNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
}
export async function runDue({ force = false } = {}) {
  const now = easternNow();
  if (!force && now.hour !== SEND_HOUR) return { ran: false };
  const subs = loadSubs(); let sent = 0;
  for (const sub of subs) {
    if (sub.unsubscribed || sub.last_run_date === now.date) continue;
    if (sub.settings.frequency === 'weekly' && now.weekday !== 'Mon' && !force) continue;
    sub.last_run_date = now.date;
    const r = await sendIssue(sub); if (r.sent) sent++;
  }
  saveSubs(subs);
  return { ran: true, sent };
}
export function startScheduler() {
  const t = setInterval(() => { runDue().catch(() => {}); }, 5 * 60 * 1000);
  t.unref?.();
}

// ---------- HTTP ----------
const hits = new Map(); // crude per-address limit on subscribe
function limited(ip) { const now = Date.now(); const a = (hits.get(ip) || []).filter((t) => now - t < 3600000); a.push(now); hits.set(ip, a); return a.length > 12; }
function readBody(req) { return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); }); }
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

// Public route (no PIN): the unsubscribe link in an email.
export function handlePublic(req, res, url) {
  if (url.pathname !== '/newsletter/unsubscribe' || req.method !== 'GET') return false;
  const token = url.searchParams.get('token') || '';
  const subs = loadSubs(); const sub = subs.find((s) => s.token === token);
  if (sub) { sub.unsubscribed = true; saveSubs(subs); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Unsubscribed</title><body style="font:18px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;color:#0f1b33"><div>${sub ? 'You are unsubscribed. No more emails will be sent to ' + esc(sub.email) + '.' : 'That link is no longer valid.'}</div></body>`);
  return true;
}
// PIN-protected routes.
export async function handle(req, res, url) {
  if (!url.pathname.startsWith('/newsletter/')) return false;
  const route = url.pathname.slice('/newsletter/'.length);
  if (route === 'options' && req.method === 'GET') {
    const { articles, builders } = loadFeed();
    const cats = {}; for (const a of articles) if (a.category) cats[a.category] = (cats[a.category] || 0) + 1;
    return json(res, 200, { defaults: DEFAULTS, sending_enabled: sendingEnabled(), from: sendingEnabled() ? FROM : null, send_hour_eastern: SEND_HOUR,
      categories: Object.entries(cats).filter(([c]) => c !== 'Other').sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      builders: [...builders].map(([id, b]) => ({ id, name: b.name, rank: b.rank })).sort((a, b) => a.rank - b.rank), subscribers: loadSubs().filter((s) => !s.unsubscribed).length }), true;
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' }), true;
  const body = await readBody(req);
  if (route === 'preview') {
    const settings = cleanSettings(body);
    const stories = pickStories(settings, [], true);
    const mail = renderEmail({ settings, email: '', token: '' }, stories);
    return json(res, 200, { count: stories.length, subject: mail.subject, html: mail.html, summary: describe(settings) }), true;
  }
  if (route === 'subscribe') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
    if (limited(ip)) return json(res, 429, { error: 'Too many requests. Try again later.' }), true;
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(email) || email.length > 200) return json(res, 400, { error: 'Enter a valid email address.' }), true;
    const subs = loadSubs();
    if (subs.filter((s) => !s.unsubscribed).length >= 500) return json(res, 400, { error: 'The subscriber list is full.' }), true;
    let sub = subs.find((s) => s.email === email);
    const settings = cleanSettings(body);
    if (sub) { sub.settings = settings; sub.unsubscribed = false; sub.name = String(body.name || sub.name || '').slice(0, 80); }
    else { sub = { id: crypto.randomBytes(6).toString('hex'), token: crypto.randomBytes(18).toString('hex'), email, name: String(body.name || '').slice(0, 80), settings, created: new Date().toISOString(), sent_ids: [] }; subs.push(sub); }
    const r = await sendIssue(sub, { first: true });
    sub.last_run_date = easternNow().date;
    saveSubs(subs);
    return json(res, 200, { ok: true, id: sub.id, token: sub.token, sent: Boolean(r.sent), reason: r.sent ? null : r.reason, count: r.count, subject: r.subject, html: r.html, summary: describe(settings), sending_enabled: sendingEnabled(), send_hour_eastern: SEND_HOUR }), true;
  }
  if (route === 'update') {
    const subs = loadSubs(); const sub = subs.find((s) => s.token === body.token);
    if (!sub) return json(res, 404, { error: 'Subscription not found.' }), true;
    sub.settings = cleanSettings(body); if (body.unsubscribe === true) sub.unsubscribed = true; saveSubs(subs);
    return json(res, 200, { ok: true, summary: describe(sub.settings) }), true;
  }
  return json(res, 404, { error: 'not found' }), true;
}
