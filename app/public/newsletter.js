// newsletter.js: the "Create newsletter" panel. Self-contained: settings on the left, live email preview on the right.
//
//   import { newsletterAvailable, openNewsletter } from './newsletter.js';
//   if (await newsletterAvailable()) button.hidden = false;      // GET /newsletter/options answered (routes exist behind the gate only)
//   openNewsletter({ minScore: 70 });                            // opens the panel; Escape or the close button closes it
//
// Back end (app/newsletter.mjs): GET /newsletter/options, POST /newsletter/preview, POST /newsletter/subscribe.
// Styles: newsletter.css (loaded here once). Uses the tokens and shared classes of style.css (.btn, .chip, .seg).
import { icon } from './ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const post = async (path, body) => {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null;
  try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw new Error((j && (j.error || j.reason)) || `The server answered ${r.status}.`);
  return j || {};
};

let OPTIONS = null;     // cached GET /newsletter/options
let availability = null; // promise<boolean>
export function newsletterAvailable() {
  if (!availability) {
    availability = fetch('/newsletter/options', { headers: { Accept: 'application/json' } })
      .then(async (r) => { if (!r.ok) return false; const j = await r.json(); if (!j || !j.defaults) return false; OPTIONS = j; return true; })
      .catch(() => false);
  }
  return availability;
}

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return;
  cssLoaded = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('./newsletter.css', import.meta.url).href;
  document.head.appendChild(l);
}

let root = null;   // the open panel's scrim element
let S = null;      // current settings and form state
let lastFocus = null;
let previewTimer = 0, previewSeq = 0;

const settingsBody = () => ({
  min_score: S.min_score, frequency: S.frequency, max_stories: S.max_stories,
  // empty list means "all" to the back end
  categories: S.cats.size === OPTIONS.categories.length ? [] : [...S.cats],
  builder_ids: [...S.builders],
});
const hourText = (h) => { const n = Number(h); if (!Number.isFinite(n)) return '7 am'; return n === 0 ? '12 am' : n < 12 ? `${n} am` : n === 12 ? '12 pm' : `${n - 12} pm`; };
const seg = (name, opts, cur) => `<span class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-nl-seg="${name}" data-val="${esc(v)}" class="${String(cur) === String(v) ? 'on' : ''}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</span>`;

function close() {
  if (!root) return;
  clearTimeout(previewTimer);
  document.removeEventListener('keydown', onKey, true);
  root.remove(); root = null; S = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
function onKey(e) {
  if (e.key === 'Escape' && root) { e.stopPropagation(); e.preventDefault(); close(); }
}

export async function openNewsletter({ minScore } = {}) {
  loadCss();
  if (root) return;
  lastFocus = document.activeElement;
  root = document.createElement('div');
  root.className = 'nl-scrim';
  root.innerHTML = `<div class="nl" role="dialog" aria-modal="true" aria-label="Create your newsletter"><div class="nl-loading">Loading…</div></div>`;
  document.body.appendChild(root);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', onKey, true);
  const ok = await newsletterAvailable();
  if (!root) return;
  if (!ok) {
    root.querySelector('.nl').innerHTML = `<button type="button" class="nl-x" data-nl-close aria-label="Close">${icon('x')}</button><div class="nl-done"><h2>The newsletter is not available here</h2><p>It is switched on in the hosted portal only.</p><button type="button" class="btn" data-nl-close>Close</button></div>`;
    root.addEventListener('click', (e) => { if (e.target.closest('[data-nl-close]')) close(); });
    return;
  }
  const d = OPTIONS.defaults || {};
  const ms = Number.isFinite(Number(minScore)) && Number(minScore) > 0 ? Number(minScore) : Number(d.min_score ?? 70);
  S = {
    email: savedSub()?.email || '', name: '',
    min_score: ms, custom: ![70, 90].includes(ms),
    frequency: d.frequency === 'weekly' ? 'weekly' : 'daily',
    max_stories: [5, 10, 20].includes(Number(d.max_stories)) ? Number(d.max_stories) : 10,
    cats: new Set((d.categories && d.categories.length ? d.categories : OPTIONS.categories.map((c) => c.name))),
    builders: new Set(d.builder_ids || []),
    bq: '', preview: null, busy: false, error: '', emailError: '', result: null,
  };
  renderForm();
  wire();
  schedulePreview(0);
}

// the newsletter created in this browser is remembered here (email, token, a one-line summary), so reopening can say so and stop it
const LS_KEY = 'domain-newsletter';
const savedSub = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const saveSub = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* private mode: nothing to remember */ } };
const clearSub = () => { try { localStorage.removeItem(LS_KEY); } catch { /* nothing stored */ } };
async function stopSub() {
  const sv = savedSub();
  if (!sv || !sv.token || !root) return;
  const box = root.querySelector('.nl');
  try {
    const r = await fetch('/newsletter/unsubscribe?token=' + encodeURIComponent(sv.token));
    if (!r.ok) throw new Error('not stopped');
    clearSub();
    box.innerHTML = `<button type="button" class="nl-x" data-nl-close aria-label="Close" title="Close (Esc)">${icon('x')}</button><div class="nl-form nl-done" role="status" style="grid-column:1 / -1"><h2>Stopped.</h2><p class="nl-sub">No further issues will go to ${esc(sv.email)}.</p><div class="nl-actions"><button type="button" class="btn" data-nl-close>Done</button><button type="button" class="linkbtn" data-nl-back>Create a new one</button></div></div>`;
  } catch {
    const e = box.querySelector('#nl-err') || box.querySelector('.nl-sub'); if (e) e.textContent = 'Could not stop it just now. Use the unsubscribe link in any issue, or try again.';
  }
}
// the save button says what will happen: send now, or save and show the first issue
const goLabel = () => (OPTIONS && OPTIONS.sending_enabled ? 'Create and send the first issue' : 'Save and preview the first issue');
// ---------- form ----------
function renderForm() {
  const o = OPTIONS;
  root.querySelector('.nl').innerHTML = `
    <button type="button" class="nl-x" data-nl-close aria-label="Close" title="Close (Esc)">${icon('x')}</button>
    <form class="nl-form" novalidate>
      <h2>${icon('mail')} Create your newsletter</h2>
      <p class="nl-sub">The most relevant stories for a land banker, by email.</p>
      ${savedSub()?.token ? `<p class="nl-have">You have a newsletter: ${esc(savedSub().summary || '')}, to ${esc(savedSub().email)}. Saving again updates it. <button type="button" class="linkbtn" data-nl-stop>Stop it</button></p>` : ''}
      <label class="nl-f"><span>Email</span><input type="email" id="nl-email" autocomplete="email" placeholder="you@company.com" value="${esc(S.email)}" required><span class="nl-err" id="nl-email-err" role="alert"></span></label>
      <label class="nl-f"><span>Name <i>optional</i></span><input type="text" id="nl-name" autocomplete="name" placeholder="First name" value="${esc(S.name)}" maxlength="80"></label>
      <div class="nl-row"><span class="nl-l">Minimum relevance</span><span id="nl-score"></span></div>
      <div class="nl-row"><span class="nl-l">How often</span>${seg('frequency', [['daily', 'Daily'], ['weekly', 'Weekly']], S.frequency)}</div>
      <p class="nl-foot nl-when">The first issue looks back 14 days so it is never empty. After that only new stories: each morning for Daily, each Monday for Weekly.</p>
      <div class="nl-row"><span class="nl-l">How many stories</span>${seg('max_stories', [[5, '5'], [10, '10'], [20, '20']], S.max_stories)}</div>
      <div class="nl-block"><div class="nl-l">Topics <span class="nl-links"><button type="button" class="linkbtn" data-nl-cats="all">All</button><button type="button" class="linkbtn" data-nl-cats="none">None</button></span></div><div class="chips" id="nl-cats"></div></div>
      <div class="nl-block"><div class="nl-l">Builders to follow <span class="nl-hint" id="nl-bhint"></span></div>
        <div class="nl-picked" id="nl-picked"></div>
        <div class="nl-pick"><input type="search" id="nl-bq" placeholder="Narrow to specific builders: type a name" autocomplete="off" aria-label="Find a builder to follow"><div class="nl-bres" id="nl-bres" hidden></div></div>
      </div>
      <div class="nl-actions"><button type="submit" class="btn nl-go" id="nl-go">${icon('mail')} ${goLabel()}</button><span class="nl-err" id="nl-err" role="alert"></span></div>
      <p class="nl-foot">${o.sending_enabled ? `Sent at ${esc(hourText(o.send_hour_eastern))} Eastern. Every email has an unsubscribe link.` : 'Email sending is not switched on yet: you will see your first issue here.'}</p>
    </form>
    <div class="nl-prev"><div class="nl-ph" id="nl-ph"></div><div class="nl-frame" id="nl-frame"></div></div>`;
  paintScore(); paintCats(); paintBuilders(); paintPreview();
  setTimeout(() => root && root.querySelector('#nl-email')?.focus(), 30);
}
function paintScore() {
  const el = root.querySelector('#nl-score');
  const cur = S.custom ? 'custom' : String(S.min_score);
  el.innerHTML = `${seg('score', [['70', '70+'], ['90', '90+'], ['custom', 'Custom']], cur)}${S.custom ? `<span class="nl-slider"><input type="range" id="nl-range" min="0" max="100" step="5" value="${S.min_score}" aria-label="Minimum relevance score"><b id="nl-rv">${S.min_score}+</b></span>` : ''}`;
}
function paintCats() {
  root.querySelector('#nl-cats').innerHTML = OPTIONS.categories.map((c) => `<button type="button" class="chip sm ${S.cats.has(c.name) ? 'on' : ''}" data-nl-cat="${esc(c.name)}" aria-pressed="${S.cats.has(c.name)}">${esc(c.name)}<span class="n">${c.count}</span></button>`).join('');
}
function paintBuilders() {
  const picked = OPTIONS.builders.filter((b) => S.builders.has(b.id));
  root.querySelector('#nl-bhint').textContent = picked.length ? `${picked.length} chosen` : 'all builders';
  root.querySelector('#nl-picked').innerHTML = picked.length
    ? picked.map((b) => `<button type="button" class="chip sm on" data-nl-unpick="${esc(b.id)}" title="Remove ${esc(b.name)}">${esc(b.name)} ${icon('x')}</button>`).join('') + '<button type="button" class="linkbtn" data-nl-allb="1">Follow all builders</button>'
    : '';
  paintBuilderResults();
}
function paintBuilderResults() {
  const res = root.querySelector('#nl-bres');
  const q = S.bq.trim().toLowerCase();
  if (!q) { res.hidden = true; res.innerHTML = ''; return; }
  const hits = OPTIONS.builders.filter((b) => !S.builders.has(b.id) && b.name.toLowerCase().includes(q)).slice(0, 8);
  res.innerHTML = hits.length ? hits.map((b) => `<button type="button" data-nl-pick="${esc(b.id)}"><b>${esc(b.name)}</b> <span>#${esc(b.rank ?? '')}</span></button>`).join('') : '<div class="nl-none">No builder by that name.</div>';
  res.hidden = false;
}
function paintPreview() {
  if (!root) return;
  const ph = root.querySelector('#nl-ph'), fr = root.querySelector('#nl-frame');
  if (!ph) return;
  const p = S.preview;
  if (!S.cats.size && !S.result) { ph.innerHTML = '<span class="nl-pk">Preview</span><b>No topics chosen</b>'; fr.innerHTML = '<div class="nl-empty"><b>Choose at least one topic.</b><br>Tap a topic on the left, or "All".</div>'; return; }
  if (!p) { ph.innerHTML = '<span class="nl-pk">Preview</span><b>Building your first issue…</b>'; return; }
  if (p.error) { ph.innerHTML = '<span class="nl-pk">Preview</span><b>The preview could not be loaded.</b>'; fr.innerHTML = `<div class="nl-empty">${esc(p.error)}</div>`; return; }
  ph.innerHTML = `<span class="nl-pk">Preview of the email</span><b title="${esc(p.subject || '')}">${esc(p.subject || '')}</b><span class="nl-count">${p.count} ${p.count === 1 ? 'story matches' : 'stories match'}${p.summary ? ` · ${esc(p.summary)}` : ''}</span>`;
  if (!p.count) { fr.innerHTML = '<div class="nl-empty"><b>No stories match these settings.</b><br>Lower the minimum relevance or add topics.</div>'; return; }
  // The email is drawn in an isolated shadow root, not a frame: a sandboxed srcdoc frame came up blank when it was
  // created a second time (the confirmation state). Styles stay contained; scripts and handlers are stripped first.
  let host = fr.querySelector('.nl-mail');
  if (!host) { fr.innerHTML = ''; host = document.createElement('div'); host.className = 'nl-mail'; host.setAttribute('role', 'document'); host.setAttribute('aria-label', 'Email preview'); host.attachShadow({ mode: 'open' }); fr.appendChild(host); }
  host.shadowRoot.innerHTML = safeEmail(p.html || '');
  host.scrollTop = 0;
}
function safeEmail(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, base, form').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((n) => {
    for (const at of [...n.attributes]) if (/^on/i.test(at.name) || (/^(href|src|xlink:href)$/i.test(at.name) && /^\s*javascript:/i.test(at.value))) n.removeAttribute(at.name);
    if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
  });
  const styles = [...doc.querySelectorAll('style')].map((st) => st.outerHTML).join('');
  doc.querySelectorAll('style').forEach((n) => n.remove());
  const wrap = document.createElement('div');
  wrap.setAttribute('style', (doc.body.getAttribute('style') || '') + ';min-height:100%;box-sizing:border-box');
  wrap.innerHTML = doc.body.innerHTML;
  return styles + wrap.outerHTML;
}
function schedulePreview(ms = 300) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    if (!root || !S || S.result) return;
    const seq = ++previewSeq;
    if (!S.cats.size) return paintPreview(); // an empty list would mean "all topics" to the server
    try { const p = await post('/newsletter/preview', settingsBody()); if (root && S && seq === previewSeq) { S.preview = p; paintPreview(); } }
    catch (err) { if (root && S && seq === previewSeq) { S.preview = { error: 'Check your connection and try again.' }; paintPreview(); } }
  }, ms);
}

// ---------- events ----------
function wire() {
  const box = root.querySelector('.nl');
  box.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-nl-close]')) return close();
    if (t.closest('[data-nl-stop]')) return stopSub();
    if (t.closest('[data-nl-back]')) { S.result = null; S.error = ''; renderForm(); schedulePreview(0); return; }
    if (!S || S.result) return;
    const sg = t.closest('[data-nl-seg]');
    if (sg) {
      const name = sg.dataset.nlSeg, val = sg.dataset.val;
      if (name === 'score') { if (val === 'custom') S.custom = true; else { S.custom = false; S.min_score = Number(val); } paintScore(); }
      else { S[name] = name === 'max_stories' ? Number(val) : val; box.querySelectorAll(`[data-nl-seg="${name}"]`).forEach((b) => { const on = b === sg; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }
      return schedulePreview();
    }
    const cat = t.closest('[data-nl-cat]');
    if (cat) { const n = cat.dataset.nlCat; if (S.cats.has(n)) S.cats.delete(n); else S.cats.add(n); paintCats(); return schedulePreview(); }
    const cs = t.closest('[data-nl-cats]');
    if (cs) { S.cats = new Set(cs.dataset.nlCats === 'all' ? OPTIONS.categories.map((c) => c.name) : []); paintCats(); return schedulePreview(); }
    const pick = t.closest('[data-nl-pick]');
    if (pick) { S.builders.add(pick.dataset.nlPick); S.bq = ''; box.querySelector('#nl-bq').value = ''; paintBuilders(); box.querySelector('#nl-bq').focus(); return schedulePreview(); }
    const un = t.closest('[data-nl-unpick]');
    if (un) { S.builders.delete(un.dataset.nlUnpick); paintBuilders(); return schedulePreview(); }
    if (t.closest('[data-nl-allb]')) { S.builders.clear(); paintBuilders(); return schedulePreview(); }
  });
  box.addEventListener('input', (e) => {
    if (!S) return;
    const t = e.target;
    if (t.id === 'nl-email') { S.email = t.value; if (S.emailError) { S.emailError = ''; box.querySelector('#nl-email-err').textContent = ''; t.classList.remove('bad'); } }
    else if (t.id === 'nl-name') S.name = t.value;
    else if (t.id === 'nl-range') { S.min_score = Number(t.value); box.querySelector('#nl-rv').textContent = S.min_score + '+'; schedulePreview(); }
    else if (t.id === 'nl-bq') { S.bq = t.value; paintBuilderResults(); }
  });
  box.addEventListener('keydown', (e) => {
    if (e.target.id === 'nl-bq' && e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-nl-pick]')?.click(); }
  });
  box.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
}

async function submit() {
  if (!S || S.busy) return;
  const box = root.querySelector('.nl');
  const email = S.email.trim();
  const emailEl = box.querySelector('#nl-email'), emailErr = box.querySelector('#nl-email-err'), err = box.querySelector('#nl-err');
  err.textContent = '';
  if (!email) { S.emailError = 'Enter your email address.'; }
  else if (!EMAIL_RE.test(email)) { S.emailError = 'That does not look like an email address. Check it and try again.'; }
  else S.emailError = '';
  if (S.emailError) { emailErr.textContent = S.emailError; emailEl.classList.add('bad'); emailEl.focus(); return; }
  if (!S.cats.size) { err.textContent = 'Choose at least one topic.'; return; }
  const go = box.querySelector('#nl-go');
  S.busy = true; go.disabled = true; go.textContent = 'Creating…';
  try {
    const r = await post('/newsletter/subscribe', { email, name: S.name.trim() || undefined, ...settingsBody() });
    if (!root || !S) return;
    if (r.ok === false) throw new Error(r.reason || r.error || 'The newsletter could not be created.');
    S.busy = false; S.result = r;
    if (r.token) saveSub({ email, token: r.token, summary: `${S.frequency === 'weekly' ? 'weekly' : 'daily'}, ${S.min_score}+, up to ${S.max_stories} stories` });
    renderDone(r, email);
  } catch (ex) {
    if (!root || !S) return;
    S.busy = false; go.disabled = false; go.innerHTML = `${icon('mail')} ${goLabel()}`;
    const msg = /Failed to fetch|NetworkError|Load failed/i.test(String(ex.message)) ? 'Could not reach the server. Check your connection and try again.' : String(ex.message || 'The newsletter could not be created.');
    err.textContent = msg;
  }
}

function renderDone(r, email) {
  const when = S.frequency === 'weekly' ? 'next week' : 'tomorrow';
  const hour = hourText(r.send_hour_eastern ?? OPTIONS.send_hour_eastern);
  const sent = r.sent === true;
  // sending switched on but this first email did not go: say why in plain words
  const failed = !sent && (r.sending_enabled ?? OPTIONS.sending_enabled) === true && r.reason && !/not switched on/i.test(r.reason);
  const title = sent ? 'First issue sent to you now.' : 'Saved. Here is your first issue.';
  const line = sent ? `Next one ${when} at ${esc(hour)} Eastern.`
    : failed ? `You are on the list, but the first email did not go out (${esc(r.reason)}). The next one is due ${when} at ${esc(hour)} Eastern.`
      : (r.sending_enabled ?? OPTIONS.sending_enabled) ? `Next one ${when} at ${esc(hour)} Eastern.` : 'Email sending is not switched on yet, so nothing was emailed.';
  const settings = [`${S.min_score}+ relevance`, S.frequency === 'weekly' ? 'weekly' : 'daily', `up to ${S.max_stories} stories`, S.cats.size === OPTIONS.categories.length ? 'all topics' : `${S.cats.size} topic${S.cats.size === 1 ? '' : 's'}`, S.builders.size ? `${S.builders.size} builder${S.builders.size === 1 ? '' : 's'}` : 'all builders'];
  root.querySelector('.nl').innerHTML = `
    <button type="button" class="nl-x" data-nl-close aria-label="Close" title="Close (Esc)">${icon('x')}</button>
    <div class="nl-form nl-done" role="status">
      <div class="nl-tick">${icon('verified')}</div>
      <h2>${esc(title)}</h2>
      <p class="nl-sub">${line}</p>
      <dl class="nl-kv"><dt>To</dt><dd>${esc(email)}</dd><dt>Settings</dt><dd>${esc(settings.join(' · '))}</dd><dt>To stop</dt><dd>Use the unsubscribe link at the foot of any issue.</dd></dl>
      <div class="nl-actions"><button type="button" class="btn" data-nl-close>Done</button><button type="button" class="linkbtn" data-nl-back>Change settings</button>${savedSub()?.token ? '<button type="button" class="linkbtn" data-nl-stop>Stop this newsletter</button>' : ''}</div>
    </div>
    <div class="nl-prev"><div class="nl-ph" id="nl-ph"></div><div class="nl-frame" id="nl-frame"></div></div>`;
  const prev = { count: r.count ?? S.preview?.count ?? 0, subject: r.subject ?? S.preview?.subject, html: r.html ?? S.preview?.html, summary: r.summary ?? S.preview?.summary };
  const keep = S.result; S.preview = prev; S.result = null; paintPreview(); S.result = keep;
  const ph = root.querySelector('.nl-pk'); if (ph) ph.textContent = sent ? 'The email we sent' : 'Your first issue';
  root.querySelector('[data-nl-close].btn')?.focus();
}
