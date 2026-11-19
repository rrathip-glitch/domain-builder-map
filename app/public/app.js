// Domain builder map: single page, vanilla JS, no build step. Design: app/DESIGN.md
import { rankFeed, learnedWeights, DIRECT, LEARN_CAP } from './rank.js';
import { orgModel, statesIn } from './org.js';
import { icon, usMap, GROUP_ICON } from './ui.js';

let D = null;            // data/dist/domain.json
let VOTES = {};          // data/local/votes.json
let NOTES = { builders: {}, people: {} };
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const GROUPS = ['Land', 'Finance', 'C-suite', 'Regional', 'Division', 'Other'];
const SUB_LABELS = { land_banking_competitor: ['Land banking and competitors', 30], builder_customer: ['Builder (customer)', 25], financing_capital_markets: ['Financing and capital markets', 25], land_lot_supply: ['Land and lot supply', 10], materiality_actionability: ['How material, how actionable', 10] };

// ---------- formatting ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 1 }));
const usd = (x) => { if (x == null || x === '' || Number.isNaN(Number(x))) return ''; const n = Number(x); return n >= 1000 ? '$' + (n / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'B' : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M'; };
const pct = (x) => (x == null || x === '' ? '' : Number(x).toLocaleString('en-US', { maximumFractionDigits: 0 }) + '%');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const CF_ICON = { Verified: 'verified', Reported: 'reported', Inferred: 'inferred' };
const CF_WHY = { Verified: 'Verified: primary source opened (filing, company page or release, government record)', Reported: 'Reported: secondary source (trade press, news, rankings)', Inferred: 'Inferred: derived or unconfirmed, a lead to confirm' };
const conf = (c, word = true) => (c ? `<span class="cf ${esc(c)}" title="${esc(CF_WHY[c] || c)}">${icon(CF_ICON[c] || 'inferred')}${word ? esc(c) : ''}</span>` : '');
const ext = (url, text) => (/^https?:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || host(url))}${icon('ext')}</a>` : esc(text || ''));
const trunc = (s, n = 60) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const fmtDate = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (!m) return String(iso || ''); const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]; return m[3] ? `${Number(m[3])} ${mo} ${m[1]}` : `${mo} ${m[1]}`; };
// any stored date ("2027-03-15", "2026-07", "2026") in the one house style; other text passes through
const fmtD = (v) => { const t = String(v ?? '').trim(); return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(t) ? (t.length === 4 ? t : fmtDate(t)) : t; };
// notes about how the research was done (tool limits, search budgets, the researcher's own voice) are not facts about the company
const PROCESS_RE = /\b(this run|research limit|search budget|web[- ]?search|fetch tool|web[- ]?fetch|\bcurl\b|could not be (read|fetched|opened|retrieved)|truncat|HTTP \d{3}|bot[- ]check|cloudflare|rate[- ]limit|time ?box|in this pass|this pass|not opened in|my (reading|calculation|estimate|count|own)|\bI (read|could|did|was|have|checked|found)\b|the agent|token limit|full-text search|second pass|refused|unavailable|rate-limited|would not load|not checked|snippet|403|404|not entered as rows|unconfirmed leads|needs? a (second|further) pass|to be (checked|confirmed) in|next pass|was not (opened|fetched|run)|not (re-)?run)\b/i;
const GAP_ORDER = [/\bland\b(?! bank)/i, /treasur|\bCFO\b|financ/i, /\bregion/i, /land[- ]bank|lot[- ]option|option/i, /\bdebt|\bnotes\b|credit|maturit|revolver/i];
const gapRank = (g) => { const i = GAP_ORDER.findIndex((re) => re.test(g)); return i < 0 ? 9 : i; };
// keep the finding, drop only the sentences about the research process
const realGaps = (arr) => (arr || []).map((g) => String(g).split(/(?<=[.;])\s+(?=[A-Z])/).filter((t) => !PROCESS_RE.test(t)).join(' ').trim()).filter((g) => g.length > 25).map((g, i) => [g, gapRank(g), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
// lead with the fact: drop a research label that opens a description ("Closing date. ", "Announcement date; ")
const factFirst = (t) => String(t || '').replace(/^(Closing|Announcement|Announced|Completion|Signing|Report|Effective)\s+date[.;:]\s*(Date is the [a-z ]+date\.\s*)?/i, '').replace(/^Date is the [a-z ]+date\.\s*/i, '').replace(/^./, (c) => c.toUpperCase());
// a maturity as precisely as the record states it: "2027", "Mar 2027" or "15 Mar 2027"; never an invented day
const dueText = (m) => { if (!m) return ''; const raw = String(m.maturity || '').trim(); if (/^\d{4}$/.test(raw)) return raw; if (/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) return fmtDate(raw); return raw ? trunc(raw, 28) : fmtDate(String(m.maturity_key || '').slice(0, 4)); };
// the name executives use, where the ranking prints the legal name
const DISPLAY_NAME = { 'k-hovnanian': 'K. Hovnanian' };
const dname = (b) => DISPLAY_NAME[b.builder_id] || b.name;
// first sentence only; the rest sits behind "more" (no long paragraphs on screen)
const ABBR = /(?:^|[\s(])(?:[A-Z]|[A-Z]\.[A-Z]|U\.S|Inc|Corp|Co|Cos|Ltd|L\.P|LLC|St|No|Nos|Jr|Sr|Mr|Ms|Mrs|Dr|vs|approx|est|incl|Dept|Ft|Mt|Bros|Assn|Ave|Blvd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|e\.g|i\.e)$/;
const firstSentence = (s, max = 190) => {
  s = String(s || '').trim();
  let f = s;
  const re = /[.!?](?=\s+[A-Z("']|\s*$)/g; let m;
  while ((m = re.exec(s))) { if (m.index < 30) continue; if (s[m.index] === '.' && ABBR.test(s.slice(0, m.index))) continue; f = s.slice(0, m.index + 1); break; }
  if (f.length <= max) return f;
  const cut = f.slice(0, max); return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[,;:(]$/, '') + '…';
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const humanDates = (t) => String(t || '').replace(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, (m, y, mo, d) => `${Number(d)} ${MON[Number(mo) - 1]} ${y}`).replace(/\b(20\d{2})-(0[1-9]|1[0-2])\b(?![-\d])/g, (m, y, mo) => `${MON[Number(mo) - 1]} ${y}`);
function short(text, max = 190) {
  const s = humanDates(String(text || '').trim());
  if (!s) return '';
  const f = firstSentence(s, max);
  return f.length >= s.length ? `<span>${esc(s)}</span>` : `<details class="moretxt"><summary><span class="fs">${esc(f)}</span> <span class="mt-more">more</span></summary><div class="mt-full">${esc(s)}</div></details>`;
}
// confidence mark + source link + dates: the standard way every fact is shown
let TBL_UNIFORM = null; // set while a table whose rows all share one confidence is rendering: the mark is stated once above it
function src(row, retrieved) {
  if (!row) return '';
  const r = row.retrieved || retrieved || D?.retrieved || '';
  const link = /^https?:\/\//.test(row.source_url || '') ? ext(row.source_url, trunc(humanDates(row.source_title || host(row.source_url)), 44)) : '<span class="muted">no link</span>';
  const date = row.source_date || row.as_of || '';
  return `<span class="src">${TBL_UNIFORM ? '' : conf(row.confidence)} ${link}<span class="when">${date ? ` dated ${esc(fmtD(date))} ·` : ''}${r ? ` retrieved ${esc(fmtD(r))}` : ''}</span></span>`;
}
const tierTag = (t) => (t ? `<span class="tag ${t === 'Top 25' ? 't25' : t === 'Top 50' ? 't50' : 't100'}">${esc(t)}</span>` : '');
const builderById = (id) => D.builders.find((x) => x.builder_id === id);
const bLink = (id, name) => { const b = builderById(id); return b || name ? `<a href="#/builder/${esc(id)}">${esc(name || (b ? (DISPLAY_NAME[b.builder_id] || b.name) : id))}</a>` : esc(id); };
const competitorByName = (name) => { const n = String(name || '').toLowerCase(); return D.competitors.find((c) => (c.name || '').toLowerCase() === n || c.competitor_id === n.replace(/[^a-z0-9]+/g, '-') || (n.length > 4 && (c.name || '').toLowerCase().includes(n)) || ((c.name || '').length > 4 && n.includes((c.name || '').toLowerCase()))); };
const options = (vals, cur, all = 'All') => `<option value="">${esc(all)}</option>` + vals.map((v) => { const [val, label] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${String(cur) === String(val) ? ' selected' : ''}>${esc(label)}</option>`; }).join('');
const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ''))];
const dayLabel = (iso) => { const d = new Date(iso + 'T12:00:00'); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }); };
const dayShort = (iso) => { const d = new Date(iso + 'T12:00:00'); return Number.isNaN(d.getTime()) ? iso : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${fmtDate(iso)}`; };
const weekStart = (iso) => { const d = new Date(iso + 'T12:00:00Z'); if (Number.isNaN(d.getTime())) return iso; const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); };
const ownerLine = (b) => (b.ownership_group === 'Public' ? `Public${b.ticker ? ' · ' + b.ticker : ''}` : b.ownership_group === 'Subsidiary' ? `Owned by ${trunc(String(b.parent || 'a larger group').replace(/\s*\(.*$/, ''), 38)}` : 'Private');
const seg = (name, opts, cur, cls = '') => `<span class="seg ${cls}" role="tablist">${opts.map(([v, l]) => `<button data-seg="${name}" data-val="${esc(v)}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
const chips = (name, opts, cur) => opts.map(([v, l, n]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-chip="${name}" data-val="${esc(v)}">${l}${n != null ? `<span class="n">${num(n)}</span>` : ''}</button>`).join('');
const scoreBadge = (n, cls = '') => `<span class="score ${n >= 90 ? 's90' : n >= 70 ? 's70' : n >= 40 ? 's40' : ''} ${cls}" title="Relevance to Domain, 0 to 100">${n}</span>`;
const tile = (k, v, s, href) => `<${href ? `a href="${href}"` : 'div'} class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s || ''}</div></${href ? 'a' : 'div'}>`;

// ---------- source popover: hover, focus or click any sourced number to see where it came from ----------
const SRC_REG = [];
const cutWords = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), n - 30)).replace(/[,;:(]$/, '') + '…'; };
const srcKind = (u) => { const h = host(u); return /(^|\.)sec\.gov$/.test(h) ? 'SEC filing' : /legistar|\.gov$|\.us$/.test(h) ? 'Public record' : /businesswire|prnewswire|globenewswire/.test(h) ? 'Press release' : h; };
// any data row -> what the card shows. o overrides: summary, label, amount, date, title, retrieved, confidence
let SRC_TITLES = null;
const titleOf = (url) => { if (!SRC_TITLES) { SRC_TITLES = new Map(); for (const x of D?.sources || []) if (x.url && x.title) SRC_TITLES.set(x.url, x.title); } return SRC_TITLES.get(url) || ''; };
function srcRow(r, o = {}) {
  if (!r) return null;
  const url = /^https?:\/\//.test(r.source_url || '') ? r.source_url : '';
  const text = o.summary ?? r.description ?? r.relationship ?? r.what ?? r.fact ?? r.reason ?? r.read ?? r.basis ?? r.note ?? r.instrument ?? '';
  return { label: o.label || '', amount: o.amount !== undefined ? o.amount : (r.amount_usd_m ?? r.principal_usd_m ?? null), date: o.date || r.source_date || r.as_of || r.date || '', retrieved: r.retrieved || o.retrieved || D?.retrieved || '', confidence: r.confidence || o.confidence || '', title: r.source_title || o.title || (url ? titleOf(url) : ''), url, summary: cutWords(humanDates(text), 200) };
}
// wrap html so that hovering, focusing or clicking it shows its source card. rows: one srcRow or several (an aggregate)
function hs(html, rows, head = '') {
  rows = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!rows.length || html == null || html === '') return html ?? '';
  SRC_REG.push({ head, rows });
  return `<span class="hs" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Show the source for this figure" data-src="${SRC_REG.length - 1}">${html}</span>`;
}
function srcCardHtml(p) {
  const multi = p.rows.length > 1;
  const one = (r) => `<div class="sp-row">
    ${multi ? `<div class="sp-fig">${r.amount != null ? `<b>${usd(r.amount)}</b>` : ''}${r.date ? `<span>${esc(fmtD(r.date))}</span>` : ''}${conf(r.confidence)}</div>` : `<div class="sp-top">${conf(r.confidence)}</div><div class="sp-title">${esc(cutWords(humanDates(r.title || (r.url ? host(r.url) : 'Source not recorded')), 110))}</div>`}
    ${r.summary ? `<div class="sp-sum">${esc(multi ? cutWords(r.summary, 150) : r.summary)}</div>` : ''}
    <div class="sp-meta">${[multi && r.title ? esc(cutWords(humanDates(r.title), 70)) : '', r.url ? esc(srcKind(r.url)) : '', !multi && r.date ? `document dated ${esc(fmtD(r.date))}` : '', r.retrieved ? `retrieved ${esc(fmtD(r.retrieved))}` : ''].filter(Boolean).join(' · ')}</div>
    ${r.url ? `<a class="sp-open" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open original document ${icon('ext')}</a>` : '<div class="sp-none">Source not recorded</div>'}
  </div>`;
  return `${p.head ? `<div class="sp-head">${esc(p.head)}</div>` : ''}${p.rows.slice(0, 4).map(one).join('')}${p.rows.length > 4 ? `<div class="sp-more">+ ${p.rows.length - 4} more record${p.rows.length - 4 === 1 ? '' : 's'}, each with its source, in the full list (Builder-financier links, or the builder's Financing tab).</div>` : ''}`;
}
let SP_EL = null, SP_ANCHOR = null, SP_TIMER = 0, SP_PINNED = false;
function hideSrc() { clearTimeout(SP_TIMER); if (SP_EL) SP_EL.hidden = true; if (SP_ANCHOR) SP_ANCHOR.classList.remove('hs-on'); SP_ANCHOR = null; SP_PINNED = false; }
function showSrc(a, pin = false) {
  const p = SRC_REG[Number(a.dataset.src)];
  if (!p) return;
  clearTimeout(SP_TIMER);
  if (!SP_EL) { SP_EL = document.createElement('div'); SP_EL.id = 'srcpop'; SP_EL.setAttribute('role', 'dialog'); SP_EL.setAttribute('aria-label', 'Source'); document.body.appendChild(SP_EL); }
  if (SP_ANCHOR && SP_ANCHOR !== a) SP_ANCHOR.classList.remove('hs-on');
  SP_ANCHOR = a; SP_PINNED = pin; a.classList.add('hs-on');
  SP_EL.innerHTML = srcCardHtml(p); SP_EL.hidden = false;
  // place it beside the figure, never on top of it, and keep it on screen
  SP_EL.style.left = '0px'; SP_EL.style.top = '0px';
  const r = a.getBoundingClientRect(), w = SP_EL.offsetWidth, h = SP_EL.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let left = Math.min(Math.max(8, r.left), vw - w - 8), top = r.bottom + 8;
  if (top + h > vh - 8) top = r.top - h - 8;
  if (top < 8) { top = Math.max(8, Math.min(r.top, vh - h - 8)); left = r.right + 10 + w <= vw - 8 ? r.right + 10 : Math.max(8, r.left - w - 10); }
  SP_EL.style.left = left + 'px'; SP_EL.style.top = top + 'px';
}
const laterHide = () => { if (SP_PINNED) return; clearTimeout(SP_TIMER); SP_TIMER = setTimeout(hideSrc, 220); };
document.addEventListener('mouseover', (e) => { const a = e.target.closest?.('[data-src]'); if (a) { if (a !== SP_ANCHOR) showSrc(a); else clearTimeout(SP_TIMER); } else if (e.target.closest?.('#srcpop')) clearTimeout(SP_TIMER); });
document.addEventListener('mouseout', (e) => { if (!e.target.closest?.('[data-src], #srcpop')) return; if (e.relatedTarget?.closest?.('[data-src], #srcpop')) return; laterHide(); });
document.addEventListener('focusin', (e) => { const a = e.target.closest?.('[data-src]'); if (a && a !== SP_ANCHOR) showSrc(a); });
document.addEventListener('focusout', (e) => { if (e.target.closest?.('[data-src], #srcpop') && !e.relatedTarget?.closest?.('[data-src], #srcpop')) laterHide(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-src]');
  if (a && !e.target.closest('a[href], summary, details')) { if (SP_ANCHOR === a && SP_PINNED) hideSrc(); else showSrc(a, true); return; }
  if (!e.target.closest?.('#srcpop')) hideSrc();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSrc(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-src]')) { e.preventDefault(); if (SP_ANCHOR === e.target && SP_PINNED) hideSrc(); else showSrc(e.target, true); } });
window.addEventListener('scroll', () => { if (SP_EL && !SP_EL.hidden) hideSrc(); }, true);
window.addEventListener('resize', hideSrc);

// ---------- generic sortable table ----------
// Columns marked x:true are hidden until "Full table" is switched on. When every row shares one confidence it is stated once above the table.
const TABLES = {}, SORT = {}, SHOWALL = {}, FULL = {};
function table(id, cols, rows, opts = {}) {
  cols = cols.filter((c) => !c.hideIfEmpty || rows.some((r) => { const v = c.get ? c.get(r) : r[c.key]; return v != null && v !== ''; }));
  TABLES[id] = { cols, rows, opts };
  return `<div class="tablewrap" id="tbl-${id}">${tableInner(id)}</div>`;
}
function tableInner(id) {
  const { cols: all, rows, opts } = TABLES[id];
  if (!rows.length) return `<div class="empty">${esc(opts.empty || 'Nothing here yet.')}</div>`;
  const hasExtra = all.some((c) => c.x);
  const cols = FULL[id] ? all : all.filter((c) => !c.x);
  const confs = uniq(rows.map((r) => r.confidence));
  const uniform = rows.length > 2 && confs.length === 1 && all.some((c) => c.key === 'src') ? confs[0] : null;
  const s = SORT[id] || opts.sort;
  let rs = rows;
  if (s) {
    const col = all.find((c) => c.key === s.key);
    if (col) {
      const get = col.sortVal || col.get || ((r) => r[col.key]);
      rs = rows.slice().sort((a, b) => {
        const x = get(a), y = get(b);
        const xe = x == null || x === '', ye = y == null || y === '';
        if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
        return s.dir === 'desc' ? -c : c;
      });
    }
  }
  const limit = opts.limit && !SHOWALL[id] ? opts.limit : Infinity;
  const shown = rs.slice(0, limit);
  const head = cols.map((c) => `<th class="${c.nosort ? '' : 'sortable'}${c.num ? ' num' : ''}" data-table="${id}" data-key="${esc(c.key)}" title="${esc(c.title || (c.nosort ? '' : 'Click to sort'))}"${c.w ? ` style="min-width:${c.w}px"` : ''}>${esc(c.label)}${s && s.key === c.key ? ` ${s.dir === 'desc' ? '▼' : '▲'}` : ''}</th>`).join('');
  TBL_UNIFORM = uniform;
  // a figure in a row that carries a source gets the source card; a column can also supply its own (c.hs as a function)
  const NO_SRC = ['rank', 'priority', 'months_away', 'score', 'links', 'instruments', 'people', 'facts', 'bankers_count'];
  const cell = (c, r) => {
    const html = c.render ? c.render(r) : esc(humanDates((c.get ? c.get(r) : r[c.key]) ?? ''));
    if (html === '' || html == null) return '';
    if (typeof c.hs === 'function') { const pay = c.hs(r); return pay ? hs(html, pay.rows || pay, pay.head || '') : html; }
    const sourced = typeof r.source_url === 'string' && r.source_url;
    if ((c.hs === true || (c.num && c.hs !== false && !NO_SRC.includes(c.key))) && (sourced || c.hs === true)) return hs(html, srcRow(r, { retrieved: opts.retrieved }));
    return html;
  };
  const body = shown.map((r) => `<tr class="${!uniform && opts.rowClass ? esc(opts.rowClass(r)) : ''}">${cols.map((c) => `<td class="${c.num ? 'num' : ''}${c.cls ? ' ' + c.cls : ''}">${cell(c, r)}</td>`).join('')}</tr>`).join('');
  TBL_UNIFORM = null;
  const csvBtn = rows.length > 3 && !opts.nocsv ? `<button data-csv="${id}" title="Download these ${rows.length} rows, every column, as a spreadsheet file">${icon('download')} Download CSV</button>` : '';
  const tools = hasExtra || uniform || csvBtn ? `<div class="tbl-tools">${uniform ? `<span>All ${rows.length} rows: ${conf(uniform)}</span>` : ''}<span style="flex:1"></span>${csvBtn}${hasExtra ? `<button data-full="${id}">${icon('table')} ${FULL[id] ? 'Fewer columns' : `Full table (${all.length} columns)`}</button>` : ''}</div>` : '';
  const more = rs.length > shown.length ? `<div class="tbl-more"><button data-showall="${id}">Show all ${num(rs.length)} rows</button> <span class="muted small">showing the first ${shown.length}</span></div>` : '';
  return `${tools}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${more}`;
}
document.addEventListener('click', (e) => {
  const th = e.target.closest('th.sortable');
  if (th) {
    const id = th.dataset.table, key = th.dataset.key;
    const cur = SORT[id] || TABLES[id].opts.sort;
    const col = TABLES[id].cols.find((c) => c.key === key);
    SORT[id] = { key, dir: cur && cur.key === key ? (cur.dir === 'asc' ? 'desc' : 'asc') : (col.num ? 'desc' : 'asc') };
    $('#tbl-' + id).innerHTML = tableInner(id);
    return;
  }
  const sa = e.target.closest('[data-showall]');
  if (sa) { SHOWALL[sa.dataset.showall] = true; $('#tbl-' + sa.dataset.showall).innerHTML = tableInner(sa.dataset.showall); return; }
  const cs = e.target.closest('[data-csv]');
  if (cs) { const t = TABLES[cs.dataset.csv]; const cols = t.cols.filter((c) => c.key !== 'inote'); const head = cols.flatMap((c) => (c.key === 'src' ? ['Confidence', 'Source', 'Source link', 'Retrieved'] : [c.label])); downloadCsv(`domain-${cs.dataset.csv}-${t.rows.length}.csv`, head, t.rows.map((r) => cols.flatMap((c) => (c.key === 'src' ? [r.confidence, r.source_title, r.source_url, r.retrieved] : [c.get ? c.get(r) : r[c.key]])))); return; }
  const fu = e.target.closest('[data-full]');
  if (fu) { FULL[fu.dataset.full] = !FULL[fu.dataset.full]; $('#tbl-' + fu.dataset.full).innerHTML = tableInner(fu.dataset.full); }
});

function downloadCsv(name, head, rows) {
  const cell = (v) => { const t = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const csv = '\ufeff' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- notes (Domain internal) ----------
const noteText = (kind, id) => (kind === 'builder' ? NOTES.builders[id]?.text : NOTES.people[id]?.text) || '';
const noteTimers = {};
function saveNote(el) {
  const kind = el.dataset.noteKind, id = el.dataset.noteId, text = el.value;
  const bucket = kind === 'builder' ? NOTES.builders : NOTES.people;
  if (text.trim()) bucket[id] = { text, ts: new Date().toISOString() }; else delete bucket[id];
  const tag = el.parentElement.querySelector('.saved');
  fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, text }) })
    .then((r) => r.json()).then((j) => { if (tag) { tag.textContent = j.ok ? 'Saved' : 'Not saved'; setTimeout(() => { tag.textContent = ''; }, 2500); } })
    .catch(() => { if (tag) tag.textContent = 'Not saved (server unreachable)'; });
}
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-note-kind]');
  if (!el) return;
  const k = el.dataset.noteKind + ':' + el.dataset.noteId;
  clearTimeout(noteTimers[k]);
  noteTimers[k] = setTimeout(() => saveNote(el), 600);
});
const personNoteInput = (p) => `<span><input class="pnote" data-note-kind="person" data-note-id="${esc(p.person_id)}" value="${esc(noteText('person', p.person_id))}" placeholder="Add a note"><span class="saved"></span></span>`;

// ---------- load ----------
async function load() {
  const [d, v, n] = await Promise.all([fetch('/api/data').then((r) => r.json()), fetch('/api/votes').then((r) => r.json()), fetch('/api/notes').then((r) => r.json())]);
  D = d; VOTES = v || {}; NOTES = { builders: n.builders || {}, people: n.people || {} };
  const g = D.generated ? new Date(D.generated) : null;
  $('#built').textContent = g ? `Updated ${g.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'No data built yet';
  fetch('/api/meta').then((r) => r.json()).then((m) => { $('#xlsx').hidden = !m.workbook; $('#rebuild').hidden = !m.can_rebuild; }).catch(() => {});
}
async function reloadIfRebuilt() {
  try { const m = await fetch('/api/meta').then((r) => r.json()); if (m.generated && D && m.generated !== D.generated) { await load(); return true; } } catch { /* offline */ }
  return false;
}

// ---------- person card and drawer ----------
const pubEmail = (p) => (p.email && p.email_confidence !== 'Inferred' ? p.email : '');
const personById = (id) => D.people.find((p) => p.person_id === id);
const gtag = (p) => (p.priority_group === 'Land' ? `<span class="tag land">${icon('pin')}Land</span>` : p.priority_group === 'Finance' ? `<span class="tag fin">${icon('bank')}Finance</span>` : '');
// research labels carry caveats in brackets; show the plain label, keep the full text in a tooltip or the drawer
const clean = (t) => String(t || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*;.*$/, '').replace(/\s+(per|as shown in|label from|from|according to)\s+(a\s+)?(third-party|aggregator|yahoo|stockanalysis|stocknear|comparably|directory)\b.*$/i, '').replace(/\s+/g, ' ').trim();
const vague = (g) => !g || /not stated|not disclosed|not public|unknown|unclear/i.test(g);
// o.builder: show the builder name; o.map: tile map of the states this person covers; o.label: override the title line
function pcard(p, o = {}) {
  const geo = !o.nogeo && !vague(p.geography) && (p.level !== 'Corporate' ? true : !!o.covers && statesIn(p.geography).size > 0) ? p.geography : ''; // a corporate person's "geography" is shown only when it names real territory
  const map = o.map && geo ? usMap(statesIn(`${p.geography} ${p.title}`), 'sm') : '';
  return `<button class="person c-${esc(p.confidence)} g-${esc(String(p.priority_group).replace(/[^A-Za-z]/g, ''))} ${o.cls || ''}" data-person="${esc(p.person_id)}" title="${esc(p.confidence)}. Click for source, reporting line, contact and notes">
    ${map ? `<span class="pmap">${map}</span>` : ''}
    <span class="n">${esc(p.name)} ${o.notag ? '' : gtag(p)}${p.confidence === 'Inferred' ? '<span class="tag inf" title="Inferred: derived or unconfirmed. Confirm before relying on it.">lead to confirm</span>' : ''}${noteText('person', p.person_id) ? `<span class="tag note" title="Has a Domain internal note">${icon('pencil')}note</span>` : ''}</span>
    <span class="t">${esc(trunc(clean(o.label || p.title) || p.title, 90))}</span>
    ${geo ? `<span class="g" title="${esc(geo)}">${icon('map')}${o.covers ? '<i>Covers</i> ' : ''}${esc(trunc(clean(geo) || geo, 80))}</span>` : o.nogeoNote ? `<span class="g muted">${icon('map')}Territory not public</span>` : ''}
    ${o.builder ? `<span class="bn">${esc(p.builder_name)}${p.rank != null ? ` · #${p.rank}` : ''}</span>` : ''}
  </button>`;
}
const pLink = (p, text) => `<button type="button" class="plink" data-person="${esc(p.person_id)}" title="Open ${esc(p.name)}: source, reporting line, contact, notes">${esc(text || p.name)}</button>`;
function openDrawer(id) {
  const p = personById(id);
  if (!p) return;
  const b = builderById(p.builder_id);
  const boss = p.reports_to_id ? personById(p.reports_to_id) : null;
  const reports = (b?.people || []).filter((x) => x.reports_to_id === p.person_id);
  let el = $('#drawer');
  if (!el) { const sc = document.createElement('div'); sc.id = 'scrim'; sc.dataset.dclose = '1'; document.body.appendChild(sc); el = document.createElement('aside'); el.id = 'drawer'; el.setAttribute('aria-label', 'Person details'); document.body.appendChild(el); }
  const sec = (k, html) => `<div class="dsec"><div class="k">${k}</div>${html}</div>`;
  const map = !vague(p.geography) ? usMap(statesIn(`${p.geography} ${p.level === 'Corporate' ? '' : p.title}`)) : '';
  el.innerHTML = `<button class="dclose" data-dclose="1" title="Close (Esc)" aria-label="Close">${icon('x')}</button>
    <div class="role"><span class="tag">${icon(GROUP_ICON[p.priority_group] || 'person')}${esc(p.priority_group === 'Regional' ? 'Regional head' : p.priority_group)}</span><span class="tag">${esc(p.level || '')}</span></div>
    <h2>${esc(p.name)}</h2>
    <p class="ttl">${esc(p.title)}</p>
    <p><a href="#/builder/${esc(p.builder_id)}"><b>${esc(p.builder_name)}</b></a> ${p.rank != null ? `<span class="muted">#${p.rank}</span>` : ''} ${tierTag(p.tier)}</p>
    ${p.geography ? sec('Covers', `<div class="dmap">${map}<div class="big">${esc(p.geography)}</div></div>`) : ''}
    ${sec('Reports to', p.reports_to ? `<div class="big">${boss ? pLink(boss) : esc(p.reports_to)}</div><div class="src">Reporting line: ${conf(p.reports_to_confidence || 'Inferred')}</div>` : '<span class="muted">Not stated publicly</span>')}
    ${reports.length ? sec(`Direct reports (${reports.length})`, reports.map((r) => `<span class="rep">${pLink(r)} <span class="muted small">${esc(trunc(r.title, 50))}</span></span>`).join('')) : ''}
    ${pubEmail(p) || p.phone ? sec('Published contact', `${pubEmail(p) ? `<div class="big">${icon('mail')} ${esc(p.email)} ${conf(p.email_confidence)}</div>` : ''}${p.phone ? `<div class="big">${icon('phone')} ${esc(p.phone)}</div>` : ''}`) : ''}
    ${p.email && !pubEmail(p) ? sec('Likely email (pattern, not published)', `<div class="muted">${icon('mail')} ${esc(p.email)} <span class="small">guessed from the company's email pattern; confirm before use</span></div>`) : ''}
    ${p.in_role_since || p.prior_role ? sec('Background', `${p.in_role_since ? `<div>In role since ${esc(p.in_role_since)}</div>` : ''}${p.prior_role ? `<div class="muted">Before: ${esc(p.prior_role)}</div>` : ''}`) : ''}
    ${sec('Source', `${src(p)}${p.also_listed?.length ? `<div class="small muted">Also listed: ${p.also_listed.map((o) => `${esc(o.title || '')} ${ext(o.source_url, host(o.source_url))}`).join('; ')}</div>` : ''}${p.note && !PROCESS_RE.test(p.note) ? `<div class="small" style="margin-top:.4rem">${short(p.note, 160)}</div>` : ''}`)}
    ${sec(`${icon('pencil')} Domain internal notes`, `<span><textarea class="note" data-note-kind="person" data-note-id="${esc(p.person_id)}" placeholder="What Domain knows about this person…">${esc(noteText('person', p.person_id))}</textarea><span class="saved"></span></span>`)}`;
  el.hidden = false; $('#scrim').hidden = false;
  document.querySelectorAll('.sel, .rel').forEach((x) => x.classList.remove('sel', 'rel'));
  document.querySelectorAll(`.org [data-person="${CSS.escape(id)}"]`).forEach((x) => x.classList.add('sel'));
  for (const r of [boss, ...reports].filter(Boolean)) document.querySelectorAll(`.org [data-person="${CSS.escape(r.person_id)}"]`).forEach((x) => x.classList.add('rel'));
}
const closeDrawer = () => { const el = $('#drawer'); if (el) { el.hidden = true; $('#scrim').hidden = true; } document.querySelectorAll('.sel, .rel').forEach((x) => x.classList.remove('sel', 'rel')); };
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-dclose]')) return closeDrawer();
  if (e.target.closest('#drawer a[href^="#/"]')) closeDrawer();
  const pe = e.target.closest('[data-person]');
  if (pe && !e.target.closest('input, textarea, a[href]')) { e.preventDefault(); openDrawer(pe.dataset.person); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); document.querySelectorAll('.qres').forEach((x) => { x.hidden = true; }); if (e.target.matches?.('input[type=search]')) e.target.blur(); }
  if (e.key === 'Enter' && e.target.matches?.('a[data-person]')) openDrawer(e.target.dataset.person);
  if (e.key === '/' && !e.target.matches?.('input, textarea, select')) { e.preventDefault(); const big = $('#hq') || $('#q'); big.focus(); big.select(); }
});

// ---------- search (top bar and home share it) ----------
function searchAll(q, limB = 100, limP = 400) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return { builders: [], people: [], competitors: [] };
  const hit = (t) => terms.every((x) => t.includes(x));
  const nameFirst = (arr, name) => arr.sort((a, b) => (hit(name(b).toLowerCase()) ? 1 : 0) - (hit(name(a).toLowerCase()) ? 1 : 0));
  return {
    builders: nameFirst(D.builders.filter((b) => hit([b.name, DISPLAY_NAME[b.builder_id], b.profile?.legal_name, (b.profile?.brand_names || []).join(' '), b.parent, b.ticker, b.hq, b.states.join(' '), (b.profile?.markets || []).join(' '), b.ownership].join(' ').toLowerCase())), (b) => b.name).slice(0, limB),
    people: (() => {
      const all = nameFirst(D.people.filter((p) => hit([p.name, p.title, p.geography, p.role_category, p.builder_name].join(' ').toLowerCase())), (p) => p.name);
      const named = D.builders.filter((b) => hit([b.name, DISPLAY_NAME[b.builder_id] || ''].join(' ').toLowerCase())).slice(0, 2);
      if (!named.length) return all.slice(0, limP);
      const order = ['CEO', 'CFO', 'Chair/Founder', 'President/COO', 'Land Acquisition', 'Land Development', 'Land (other)', 'Treasury/Capital Markets', 'Regional President'];
      const key = named.flatMap((b) => b.people.filter((p) => order.includes(p.role_category) && (p.level === 'Corporate' || p.role_category === 'Regional President')).sort((x, y) => order.indexOf(x.role_category) - order.indexOf(y.role_category)));
      const seen = new Set(key.map((p) => p.person_id));
      return [...key, ...all.filter((p) => !seen.has(p.person_id))].slice(0, limP);
    })(),
    competitors: D.competitors.filter((c) => hit([c.name, c.type, c.manager_or_parent].join(' ').toLowerCase())),
  };
}
function bindSearch(input, res) {
  let timer;
  const run = () => {
    const q = input.value.trim();
    if (q.length < 2 || !D) { res.hidden = true; return; }
    const r = searchAll(q, 5, 8);
    res.innerHTML = (r.builders.length ? `<div class="qh">Builders</div>${r.builders.map((b) => `<a href="#/builder/${esc(b.builder_id)}"><b>${esc(dname(b))}</b> <span class="muted">#${b.rank ?? ''}</span><small>${esc(ownerLine(b))} · ${esc(b.hq || '')} · ${b.derived.people_count} people mapped</small></a>`).join('')}` : '')
      + (r.people.length ? `<div class="qh">People</div>${r.people.map((p) => `<div class="qi" data-person="${esc(p.person_id)}"><b>${esc(p.name)}</b> <span class="muted">${esc(p.builder_name)}</span><small>${esc(trunc(p.title, 70))}${!vague(p.geography) && p.level !== 'Corporate' ? ' · ' + esc(trunc(p.geography, 40)) : ''}</small></div>`).join('')}` : '')
      + (r.competitors.length ? `<div class="qh">Competitors</div>${r.competitors.map((c) => `<a href="#/competitor/${esc(c.competitor_id)}"><b>${esc(c.name)}</b><small>${esc(c.type || '')}</small></a>`).join('')}` : '')
      + (r.builders.length + r.people.length + r.competitors.length ? `<a href="#/search/${encodeURIComponent(q)}"><b>See every result for "${esc(q)}"</b> <span class="muted">press Enter</span></a>` : `<div class="qh">Nothing matched "${esc(q)}". Try a surname, a title such as "land", or a state such as "TX".</div>`);
    res.hidden = false;
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener('focus', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { res.hidden = true; location.hash = '#/search/' + encodeURIComponent(input.value.trim()); } });
}
bindSearch($('#q'), $('#qres'));
document.addEventListener('click', (e) => { if (!e.target.closest('.search') || e.target.closest('.qres a, .qres .qi')) document.querySelectorAll('.qres').forEach((x) => { x.hidden = true; }); });

// ---------- Home ----------
function viewHome() {
  const T = D.totals;
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const ranked = rankFeed(D.feed.articles, VOTES);
  const week = ranked.filter((a) => (a.published || '') >= weekAgo && (a.published || '') <= today);
  const week70 = week.filter((a) => a.adj.adjusted >= 70);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const recent = week70.length >= 4 ? week70 : ranked.filter((a) => (a.published || '') >= monthAgo && a.adj.adjusted >= 70);
  const top = recent.sort((a, b) => b.adj.adjusted - a.adj.adjusted || String(b.published).localeCompare(String(a.published))).slice(0, 5);
  const words = (t, n) => { t = String(t || ''); if (t.length <= n) return t; const cut = t.slice(0, n); return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…'; };
  const cs = D.extras.find((e) => e.id === 'call-sheet');
  main.innerHTML = `<section class="hero two">
   <div>
    <h1>Who runs every top-100 homebuilder, and what changed this week</h1>
    <div class="search"><input id="hq" class="bigsearch" type="search" placeholder="Search a builder or a person: Lennar, a surname, land, Florida…" autocomplete="off" aria-label="Search builders and people"><div id="hqres" class="qres" hidden></div></div>
    <div class="quick"><span class="muted">Jump to</span>
      <a class="chip" href="#/people/regional">${icon('map')} Regional heads</a><a class="chip" href="#/people/land">${icon('pin')} Land heads</a><a class="chip" href="#/people/finance">${icon('bank')} Finance heads</a><a class="chip" href="#/insights/debt-maturity-watch">${icon('cal')} Debt coming due</a><a class="chip" href="#/insights/competitor-builder-matrix">${icon('target')} Who banks whom</a>${newsletterBtn('chip nlchip', 'Create newsletter')}</div>
   </div>
   <div class="home-states" data-go="#/states" title="Browse by state: who builds there, who to call"><div class="hs-h">${icon('map')} <b>Browse by state</b><a href="#/states">open the map ${icon('chev')}</a></div><div id="home-map"></div><div class="hs-f">Darker = more of the top 100 build there. Click a state.</div></div>
  </section>
  <div class="tiles">
    ${tile(`${icon('building')} Builders mapped`, `${hs(String(T.builders_with_people), srcRow({ source_url: D.ranking?.list_url, confidence: 'Reported', source_title: `${D.ranking?.year || ''} ${D.ranking?.name || ''}` }, { summary: `The list of ${T.builders_in_ranking} builders is the ${D.ranking?.year || ''} ${D.ranking?.name || ''}, ranked by ${D.ranking?.data_year || ''} closings. People and financing for each were researched from public sources.`, date: String(D.ranking?.year || '') }))} <small>of ${T.builders_in_ranking}</small>`, `the ${esc(D.ranking?.year || '')} ${esc(D.ranking?.name || 'ranking')}, by closings`, '#/builders')}
    ${tile(`${icon('users')} People`, num(T.people_mapped), `${num(T.people_by_group?.Land)} in land · ${num(T.people_by_group?.Finance)} in finance`, '#/people')}
    ${tile(`${icon('map')} Regional heads`, num(T.regional_heads_found), `named at ${T.builders_with_regional_heads} builders, each with what they cover`, '#/people/regional')}
    ${tile(`${icon('news')} Stories scoring 70+`, ranked.filter((a) => a.adj.adjusted >= 70).length, `in the last ${esc(D.feed.window_days)} days · ${week70.length} this week, of ${week.length} read`, '#/feed')}
  </div>
  <div class="home2">
    <div>
      <div class="sec-h"><h2>${week70.length >= 4 ? 'Top stories this week' : 'Top stories, last 30 days'} <small class="muted">most relevant first</small></h2><a href="#/feed">All news ${icon('chev')}</a></div>
      ${top.length ? top.map((a) => `<a class="mini" href="#/feed/${esc(a.id)}">${scoreBadge(a.adj.adjusted, 'sm')}<div><div class="why">${esc(a.title)}</div>${a.summary ? `<div class="rs">${esc(words(firstSentence(humanDates(a.summary), 400), 170))}</div>` : ''}<div class="meta">${esc(a.publisher || host(a.url))} · ${esc(fmtDate(a.published))}</div></div></a>`).join('') : '<div class="empty">No stories scored yet.</div>'}
    </div>
    <div>
      <div class="sec-h"><h2>Call sheet: who to call now</h2>${cs ? `<a href="#/insights/call-sheet">Full call sheet ${icon('chev')}</a>` : ''}</div>
      ${cs ? cs.rows.slice(0, 5).map((r) => { const b = builderById(r.builder); const p = b?.people.find((x) => x.name === r.person); return `<div class="mini call"><span class="num">${esc(r.priority)}</span><div><div class="why"><a href="#/builder/${esc(r.builder)}">${esc(b?.name || r.builder)}</a></div><div class="cfacts">${[r.due_24m ? `<span>${icon('cal')}${hs(`<b>${usd(r.due_24m)}</b>`, srcRow(r, { summary: r.reason, amount: null, date: '' }))} due by ${esc(fmtD((String(r.reason || '').match(/due by (\d{4}-\d{2})/) || [])[1] || monthsAhead(24).slice(0, 7)))}${r.next_amount && r.next_maturity ? (r.next_amount < r.due_24m ? ` · first ${usd(r.next_amount)} in ${esc(fmtD(String(r.next_maturity).slice(0, 7)))}` : ` · all in ${esc(fmtD(String(r.next_maturity).slice(0, 7)))}`) : ''}</span>` : '', r.recent_deal ? `<span>${icon('merge')}${esc(words(String(r.recent_deal).replace(/^./, (c) => c.toUpperCase()).replace(/\s*\([^)]*\)\s*$/, ''), 44))}</span>` : '', r.pct_optioned != null ? `<span>${icon('lots')}<b>${pct(r.pct_optioned)}</b> of lots optioned</span>` : r.land_light === 'Yes' ? `<span>${icon('lots')}Land-light strategy</span>` : '', r.new_exec ? `<span>${icon('person')}New: ${esc(words(String(r.new_exec).split(',')[0], 30))}</span>` : ''].filter(Boolean).slice(0, 3).join('')}</div>${r.person ? `<div class="who">${icon('person')} ${p ? pLink(p) : esc(r.person)} <span class="muted">${esc(trunc(r.title, 44))}</span></div>` : ''}</div></div>`; }).join('') : '<div class="empty">The call sheet has not been built yet.</div>'}
    </div>
  </div>`;
  bindSearch($('#hq'), $('#hqres'));
  // large entry point to Browse by state: a live map shaded by how many top-100 builders build in each state
  import('./usmap.js').then(({ usMap: bigMap, buildStateIndex }) => {
    const host = $('#home-map'); if (!host) return;
    const idx = buildStateIndex(D);
    const values = Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, v.builders.length]));
    host.appendChild(bigMap({ values, size: 460, interactive: true, onState: (c) => { location.hash = '#/states/' + c; }, title: 'Top-100 builders active in each state' }));
  }).catch(() => { const c = $('.home-states'); if (c) c.hidden = true; });
}

// ---------- By state (component: stateview.js) ----------
let STATEVIEW = null;
async function viewStates(code) {
  main.innerHTML = '<div id="sv" class="sv-host"><p class="muted">Loading the map…</p></div>';
  const { renderStateBrowser } = await import('./stateview.js');
  if (STATEVIEW?.destroy) { try { STATEVIEW.destroy(); } catch { /* already gone */ } }
  const el = $('#sv'); el.innerHTML = '';
  STATEVIEW = renderStateBrowser(el, D, {
    initialState: /^[A-Za-z]{2}$/.test(code || '') ? code.toUpperCase() : undefined,
    onBuilder: (b, ev) => { ev?.preventDefault?.(); location.hash = '#/builder/' + b.builder_id; },
    onPerson: (p, b, ev) => { ev?.preventDefault?.(); openDrawer(p.person_id); },
    onStateChange: (c) => history.replaceState(null, '', c ? '#/states/' + c : '#/states'),
  });
}

// ---------- Builders ----------
const lbText = (dv) => [...dv.land_bankers, ...(dv.land_bankers_unnamed ? ['unnamed land banker(s)'] : [])].join(', ');
const FB = { tier: '', own: '', state: '', lb: '', opt: '', mat: '', q: '', sort: 'rank', mode: 'rows', open: new Set() };
const monthsAhead = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
// land-banker links as the build states them: firm, how sure, date, what, source
const allLinks = (b) => (b.derived.land_banker_links && b.derived.land_banker_links.length ? b.derived.land_banker_links : b.derived.land_bankers.map((firm) => ({ firm, confidence: (b.derived.named_firm_confidence || {})[firm] || '' })));
// a link dated more than 24 months ago always shows its year, so an old deal is never read as current
const oldYear = (d) => { const m = String(d || '').match(/^(\d{4})(?:-(\d{2}))?/); if (!m) return ''; const t = new Date(); const months = (t.getFullYear() - Number(m[1])) * 12 + (t.getMonth() + 1 - Number(m[2] || 12)); return months > 24 ? m[1] : ''; };
const lbLinks = (b) => allLinks(b);
const shortFirm = (n) => String(n).replace(/\s+(Real Estate Partners|Properties|Real Estate Capital)$/i, '');
const lbHtml = (b, max = 2, withSrc = false) => { const ls = lbLinks(b); const wrap = (l, h) => (withSrc ? hs(h, srcRow(l, { summary: l.what })) : h); return ls.slice(0, max).map((l) => wrap(l, `<span class="lbk" title="${esc(l.firm)}: ${esc(l.confidence || 'confidence not stated')}${l.date ? ', ' + esc(fmtD(l.date)) : ''}">${l.confidence ? conf(l.confidence, false) : ''}<span class="${oldYear(l.date) ? 'oldlink' : ''}">${esc(shortFirm(l.firm))}${oldYear(l.date) ? ` · ${oldYear(l.date)}` : ''}</span>${l.confidence && l.confidence !== 'Verified' ? ` <small>(${esc(l.confidence)})</small>` : ''}</span>`)).join('') + (ls.length > max ? ` <span class="muted">+${ls.length - max}</span>` : ''); };
const hasFirm = (b, rx) => lbLinks(b).some((l) => rx.test(l.firm));
const FB_KEYS = ['tier', 'own', 'state', 'lb', 'opt', 'mat', 'sort', 'mode'];
const fbHash = () => { const q = FB_KEYS.filter((k) => FB[k] && !(k === 'sort' && FB[k] === 'rank') && !(k === 'mode' && FB[k] === 'rows')).map((k) => `${k}=${encodeURIComponent(FB[k])}`).join('&'); return '#/builders' + (q ? '?' + q : ''); };
function builderRows() {
  const q = FB.q.toLowerCase();
  const rows = D.builders.filter((b) => (!FB.tier || (b.rank != null && b.rank <= Number(FB.tier))) && (!FB.own || b.ownership_group === FB.own) && (!FB.state || b.states.includes(FB.state))
    && (!FB.lb || (FB.lb === 'yes' ? lbLinks(b).length > 0 : FB.lb === 'unnamed' ? lbLinks(b).length === 0 && b.derived.land_bankers_unnamed : FB.lb === 'no' ? b.derived.has_financing && lbLinks(b).length === 0 && !b.derived.land_bankers_unnamed : FB.lb === 'domain' ? hasFirm(b, /Domain Real Estate/i) : FB.lb === 'millrose' ? hasFirm(b, /Millrose/i) : FB.lb === 'kl' ? hasFirm(b, /Kennedy[\s-]*Lewis/i) : hasFirm(b, /Angelo[\s,]*Gordon|\bTPG\b/i)))
    && (!FB.opt || (b.derived.pct_optioned != null && (FB.opt === 'lt50' ? b.derived.pct_optioned < 50 : b.derived.pct_optioned >= Number(FB.opt))))
    && (!FB.mat || (b.derived.next_maturity && b.derived.next_maturity.maturity_key <= monthsAhead(Number(FB.mat))))
    && (!q || [b.name, b.parent, b.hq, b.ticker, b.profile?.legal_name].join(' ').toLowerCase().includes(q)));
  const by = { rank: (b) => b.rank ?? 999, optioned: (b) => -(b.derived.pct_optioned ?? -1), maturity: (b) => b.derived.next_maturity?.maturity_key || '9999', people: (b) => -b.derived.people_count, heads: (b) => -b.derived.regional_heads }[FB.sort];
  return rows.sort((a, b) => { const x = by(a), y = by(b); return x < y ? -1 : x > y ? 1 : (a.rank ?? 999) - (b.rank ?? 999); });
}
function builderRow(b) {
  const dv = b.derived, open = FB.open.has(b.builder_id), m = dv.next_maturity;
  const lb = lbLinks(b);
  return `<div class="brow ${open ? 'open' : ''}" id="br-${esc(b.builder_id)}">
    <button class="brow-main" data-bexp="${esc(b.builder_id)}" aria-expanded="${open}" title="${open ? 'Hide' : 'Show'} who runs ${esc(b.name)}">
      <span class="rk">${b.rank ?? ''}</span>
      <span class="bname"><b>${esc(dname(b))}</b><small>${esc(ownerLine(b))}${dv.acquired_after_ranking ? ` · acquired ${esc(fmtDate(dv.acquired_after_ranking.date))}` : ''}${b.hq ? ' · ' + esc(b.hq) : ''}</small></span>
      <span class="bfact"><em>${num(b.closings) || '<span class="none">n/a</span>'}</em></span>
      <span class="bfact">${dv.pct_optioned != null ? `<em>${pct(dv.pct_optioned)}</em><span class="pbar"><i style="width:${Math.min(100, dv.pct_optioned)}%"></i></span>` : '<span class="none">not public</span>'}</span>
      <span class="bfact lbcol">${lb.length ? lbHtml(b, 2) : dv.land_bankers_unnamed ? '<span class="muted">uses one, not named</span>' : '<span class="none">none public</span>'}</span>
      <span class="bfact">${m ? `<em>${esc(dueText(m))}</em>${m.principal_usd_m != null ? `<small>${usd(m.principal_usd_m)}</small>` : ''}` : '<span class="none">none on record</span>'}</span>
      <span class="chev">${icon('chev')}</span>
    </button>
    ${open ? builderPreview(b) : ''}
  </div>`;
}
// preview under a builder row: CEO, CFO, land head, every regional head with geography
function builderPreview(b) {
  const dv = b.derived, m = orgModel(b);
  const heads = [...m.bands.flatMap((x) => x.cards), ...m.top].filter((c) => c.heads.length).flatMap((c) => c.heads.map((h) => ({ h, c })));
  const unnamed = m.top.filter((c) => !c.heads.length);
  const cfo = b.people.filter((p) => p.role_category === 'CFO');
  const fin = cfo.length ? cfo : m.finCorp.slice(0, 1);
  const none = (t) => `<div class="person empty-p"><span class="t">${t}</span></div>`;
  const slot = (ic, label, html) => `<div class="pv-slot"><h4>${icon(ic)} ${label}</h4><div class="ostack">${html}</div></div>`;
  return `<div class="bprev">
    
    ${!b.people.length ? '<div class="empty">No people mapped yet.</div>' : `<div class="pv-grid">
      ${slot('star', 'Chief executive', m.root ? pcard(m.root, { notag: true }) : none('Not mapped'))}
      ${slot('bank', 'Chief financial officer', fin.length ? fin.map((p) => pcard(p, { notag: true })).join('') : none('Not public'))}
      ${slot('pin', `Head${m.landCorp.length > 1 ? 's' : ''} of land`, m.landCorp.length ? m.landCorp.slice(0, 3).map((p) => pcard(p, { notag: true })).join('') + (m.landCorp.length > 3 ? `<span class="muted small">+ ${m.landCorp.length - 3} more on the org map</span>` : '') : none(`No corporate land head is public${dv.land_count ? `; ${dv.land_count} land contact${dv.land_count === 1 ? '' : 's'} in the regions` : ''}`))}
    </div>
    <div class="pv-heads"><h4>${icon('map')} Regional heads (${heads.length})${unnamed.length ? ` <span class="lc">· ${unnamed.length} region${unnamed.length === 1 ? '' : 's'} with no public head: ${esc(trunc(unnamed.map((c) => clean(c.name) || c.name).join(', '), 120))}</span>` : ''}</h4>
      ${heads.length ? `<div class="pgrid">${heads.map(({ h, c }) => pcard(h, { map: true, covers: true, label: c.name === 'Region not stated' ? h.title : clean(c.name) || c.name })).join('')}</div>` : `<p class="muted">${unnamed.length ? 'The company names its regions but not who runs them.' : 'No regional structure is public for this builder.'}</p>`}
    </div>`}
    <div class="pv-foot"><a class="btn" href="#/builder/${esc(b.builder_id)}">Open ${esc(dname(b))} ${icon('chev')}</a>${usMap(b.states) ? `<span class="pv-map" title="Builds in ${b.states.length} state${b.states.length === 1 ? '' : 's'}">${usMap(b.states, 'sm')}</span>` : ''}<span class="muted">${b.states.length ? `${b.states.length} state${b.states.length === 1 ? '' : 's'} · ` : ''}${dv.people_count} people mapped · ${dv.debt_count || 0} debt instruments · ${dv.ma_count || 0} deals · ${dv.news_count || 0} stories</span></div>
  </div>`;
}
function viewBuilders(query) {
  if (query != null) { const q = new URLSearchParams(query); for (const k of FB_KEYS) if (q.has(k)) FB[k] = q.get(k); }
  if (location.hash.startsWith('#/builders') && location.hash !== fbHash()) history.replaceState(null, '', fbHash()); // the address always shows the filters in force
  const states = uniq(D.builders.flatMap((b) => b.states)).sort();
  const cnt = (f) => D.builders.filter(f).length;
  const extraOn = [FB.state, FB.opt, FB.mat, FB.q].filter(Boolean).length;
  main.innerHTML = `<h1>The top ${D.totals.builders_in_ranking || D.builders.length} US homebuilders</h1>
  <p class="lead">Ranked by ${esc(D.ranking?.data_year || '')} closings (${D.ranking ? ext(D.ranking.list_url, `${D.ranking.year} ${D.ranking.name}`) : ''}). Click a builder to see who runs it.</p>
  <div class="chips"><span class="lbl">Rank</span>${chips('tier', [['', 'All 100'], ['25', 'Top 25'], ['50', 'Top 50']], FB.tier)}
    <span class="lbl" style="margin-left:1.2rem;min-width:0">Ownership</span>${chips('own', [['', 'All'], ['Public', 'Public', cnt((b) => b.ownership_group === 'Public')], ['Private', 'Private', cnt((b) => b.ownership_group === 'Private')], ['Subsidiary', 'Owned by a larger group', cnt((b) => b.ownership_group === 'Subsidiary')]], FB.own)}</div>
  <div class="chips"><span class="lbl">Land banker</span>${chips('lb', [['', 'Any'], ['domain', 'Domain', cnt((b) => hasFirm(b, /Domain Real Estate/i))], ['millrose', 'Millrose', cnt((b) => hasFirm(b, /Millrose/i))], ['kl', 'Kennedy Lewis', cnt((b) => hasFirm(b, /Kennedy[\s-]*Lewis/i))], ['tpg', 'TPG Angelo Gordon', cnt((b) => hasFirm(b, /Angelo[\s,]*Gordon|\bTPG\b/i))], ['yes', 'Any named', cnt((b) => lbLinks(b).length > 0)], ['no', 'None named', cnt((b) => b.derived.has_financing && lbLinks(b).length === 0 && !b.derived.land_bankers_unnamed)]], FB.lb)}</div>
  <details class="more" ${extraOn ? 'open' : ''}><summary>More filters${extraOn ? ` (${extraOn} on)` : ''}</summary><div class="filters">
    <label>Builds in state <select id="fb-state">${options(states, FB.state)}</select></label>
    <label>Share of lots optioned <select id="fb-opt">${options([['25', '25% or more'], ['50', '50% or more'], ['75', '75% or more'], ['lt50', 'Under 50% (owns most of its land)']], FB.opt)}</select></label>
    <label>Debt coming due <select id="fb-mat">${options([['12', 'Within 12 months'], ['24', 'Within 24 months'], ['36', 'Within 36 months']], FB.mat)}</select></label>
    <label>Name, parent or HQ <input type="text" id="fb-q" placeholder="Type to filter" value="${esc(FB.q)}"></label>
  </div></details>
  <div class="bar-row"><b id="fb-count"></b><span class="grow"></span>
    <label class="muted">Sort by <select id="fb-sort">${[['rank', 'Rank'], ['optioned', 'Share of lots optioned'], ['maturity', 'Next debt due'], ['heads', 'Regional heads named'], ['people', 'People mapped']].map(([v, l]) => `<option value="${v}"${FB.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn ghost" id="fb-csv">${icon('download')} Download these as CSV</button>
    ${seg('bmode', [['rows', 'Simple list'], ['table', `${icon('table')} Full table`]], FB.mode)}</div>
  <div id="list"></div>`;
  const render = () => {
    const rows = builderRows();
    const soft = ['domain', 'millrose', 'kl', 'tpg', 'yes'].includes(FB.lb) ? rows.filter((b) => lbLinks(b).some((l) => l.confidence && l.confidence !== 'Verified' && (FB.lb === 'yes' || { domain: /Domain Real Estate/i, millrose: /Millrose/i, kl: /Kennedy/i, tpg: /Angelo|TPG/i }[FB.lb].test(l.firm)))).length : 0;
    $('#fb-count').textContent = `${rows.length} builder${rows.length === 1 ? '' : 's'}${soft ? ` · ${soft} of these links ${soft === 1 ? 'is' : 'are'} Reported or Inferred, not Verified (marked on each row; old links show their year)` : ''}`;
    if (FB.mode === 'rows') {
      $('#list').innerHTML = rows.length ? `<div class="bl-head"><span>Rank</span><span>Builder</span><span>Closings</span><span>Lots optioned</span><span>Known land bankers</span><span>Next debt due</span><span></span></div>${rows.map(builderRow).join('')}` : '<div class="empty">No builders match these filters.</div>';
      return;
    }
    $('#list').innerHTML = table('builders', [
      { key: 'rank', label: 'Rank', num: true, get: (b) => b.rank },
      { key: 'name', label: 'Builder', render: (b) => `<a href="#/builder/${esc(b.builder_id)}"><b>${esc(b.name)}</b></a>`, get: (b) => b.name },
      { key: 'closings', label: 'Closings', num: true, get: (b) => b.closings, render: (b) => num(b.closings) },
      { key: 'revenue', label: 'Revenue', num: true, get: (b) => b.revenue_usd_m, render: (b) => usd(b.revenue_usd_m) },
      { key: 'own', label: 'Ownership', get: (b) => b.ownership, render: (b) => esc(b.ownership) + (b.ticker ? ` <span class="muted">(${esc(b.ticker)})</span>` : '') },
      { key: 'parent', label: 'Parent', get: (b) => b.parent || '', render: (b) => `<span title="${esc(b.parent || '')}">${esc(trunc(b.parent || '', 46))}</span>` },
      { key: 'hq', label: 'Headquarters', get: (b) => b.hq || '' },
      { key: 'pctopt', label: 'Lots optioned', num: true, get: (b) => b.derived.pct_optioned, render: (b) => pct(b.derived.pct_optioned) },
      { key: 'lots', label: 'Lots controlled', num: true, get: (b) => b.derived.lots_total, render: (b) => num(b.derived.lots_total) },
      { key: 'lb', label: 'Known land bankers', get: (b) => lbLinks(b).map((l) => l.firm + (oldYear(l.date) ? ` · ${oldYear(l.date)}` : '') + (l.confidence && l.confidence !== 'Verified' ? ` (${l.confidence})` : '')).join(', '), render: (b) => lbHtml(b, 4) + (b.derived.land_bankers_unnamed ? ' <span class="muted small">+ unnamed</span>' : '') },
      { key: 'mat', label: 'Next debt due', get: (b) => b.derived.next_maturity?.maturity_key || '', render: (b) => { const m = b.derived.next_maturity; return m ? `<span class="nowrap">${esc(dueText(m))}</span> <span class="muted small">${esc(trunc(m.instrument, 34))}${m.principal_usd_m != null ? ' · ' + usd(m.principal_usd_m) : ''}</span>` : ''; } },
      { key: 'people', label: 'People', num: true, get: (b) => b.derived.people_count },
      { key: 'rheads', label: 'Regional heads', num: true, get: (b) => b.derived.regional_heads, render: (b) => `${b.derived.regional_heads}${b.derived.regions_listed ? ` <span class="muted small">/ ${b.derived.regions_listed} regions</span>` : ''}` },
      { key: 'landfin', label: 'Land / finance', num: true, get: (b) => b.derived.land_count + b.derived.finance_count, render: (b) => `${b.derived.land_count} / ${b.derived.finance_count}` },
    ], rows, { sort: { key: 'rank', dir: 'asc' } });
  };
  $('#fb-csv').addEventListener('click', () => { const rows = builderRows(); downloadCsv(`domain-builders-${rows.length}.csv`, ['Rank', 'Builder', 'Tier', 'Closings', 'Revenue ($M)', 'Ownership', 'Ticker', 'Parent', 'Headquarters', 'States', 'Lots optioned (%)', 'Lots controlled', 'Known land bankers', 'Next debt due', 'Next debt amount ($M)', 'Next debt instrument', 'People mapped', 'Regional heads', 'Land contacts', 'Finance contacts'], rows.map((b) => [b.rank, dname(b), b.tier, b.closings, b.revenue_usd_m, b.ownership, b.ticker, b.parent, b.hq, b.states.join(' '), b.derived.pct_optioned, b.derived.lots_total, lbLinks(b).map((l) => l.firm + (oldYear(l.date) ? ` · ${oldYear(l.date)}` : '') + (l.confidence && l.confidence !== 'Verified' ? ` (${l.confidence})` : '')).join('; ') + (b.derived.land_bankers_unnamed ? '; unnamed land banker(s)' : ''), b.derived.next_maturity?.maturity, b.derived.next_maturity?.principal_usd_m, b.derived.next_maturity?.instrument, b.derived.people_count, b.derived.regional_heads, b.derived.land_count, b.derived.finance_count])); });
  const bind = (id, key, ev = 'change') => $(id).addEventListener(ev, (e) => { FB[key] = e.target.value; history.replaceState(null, '', fbHash()); render(); });
  bind('#fb-state', 'state'); bind('#fb-opt', 'opt'); bind('#fb-mat', 'mat'); bind('#fb-q', 'q', 'input'); bind('#fb-sort', 'sort');
  VIEW_SET = (name, val) => { if (name === 'tier' || name === 'own' || name === 'lb') { FB[name] = val; history.replaceState(null, '', fbHash()); viewBuilders(); } if (name === 'bmode') { FB.mode = val; history.replaceState(null, '', fbHash()); viewBuilders(); } };
  render();
}
document.addEventListener('click', (e) => {
  const ex = e.target.closest('[data-bexp]');
  if (!ex) return;
  const id = ex.dataset.bexp;
  if (FB.open.has(id)) FB.open.delete(id); else FB.open.add(id);
  const row = document.getElementById('br-' + id);
  if (row) row.outerHTML = builderRow(builderById(id));
});
document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g && !e.target.closest('svg, a, button')) location.hash = g.dataset.go; });
// chips and segmented controls report to the current view
let VIEW_SET = null;
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-chip], [data-seg]');
  if (c && VIEW_SET) VIEW_SET(c.dataset.chip || c.dataset.seg, c.dataset.val, c);
});

// ---------- org map ----------
let ORG_VIEW = 'all';   // all | heads | landfin
let ORG_MODE = 'chart'; // chart (orgmap.js, the default; falls back to the built-in grid if the module is missing) | diagram (all regions grid) | function | tree
const mrow = (m) => `<button class="mrow c-${esc(m.p.confidence)} g-${esc(String(m.p.priority_group).replace(/[^A-Za-z]/g, ''))} ${m.via === 'geo' ? 'geo-placed' : ''}" data-person="${esc(m.p.person_id)}" title="${m.via === 'geo' ? 'Placed in this region by geography (inferred): no reporting line is published' : `Reports to ${esc(m.p.reports_to || '')} (${esc(m.p.reports_to_confidence || 'Inferred')})`}"><b>${esc(m.p.name)}</b> ${gtag(m.p)}<span class="t">${esc(trunc(clean(m.p.title) || m.p.title, 60))}${!vague(m.p.geography) && clean(m.p.geography) ? ' · ' + esc(trunc(clean(m.p.geography), 40)) : ''}</span></button>`;
function regionCard(c, segment) {
  const n = c.members.length;
  const lf = c.members.filter((m) => ['Land', 'Finance'].includes(m.p.priority_group)).length;
  const named = c.name !== 'Region not stated';
  const map = usMap(c.states);
  return `<div class="region ${c.heads.length ? '' : 'nohead'} ${lf ? '' : 'no-lf'}">
    <div class="rtop"><div>${typeof segment === 'string' && segment ? `<div class="segtag">${esc(segment)} segment</div>` : ''}<div class="rn" title="${esc(c.name)}">${named ? esc(clean(c.name) || c.name) : 'Territory not public'}</div>${addsInfo(c.name, c.geography) ? `<div class="geo" title="${esc(c.geography)}">${esc(trunc(clean(c.geography), 90))}</div>` : ''}</div>${map}</div>
    <div class="head">${c.heads.length ? c.heads.map((h) => pcard(h, { notag: true, nogeo: true })).join('') : `<div class="nohead-t">${c.leaderName ? `<b>${esc(c.leaderName)}</b> (named by the company; no sourced record yet)` : 'Head not publicly named'}</div>`}</div>
    ${n ? `<details ${n <= 4 ? 'open' : ''}><summary>${n} ${n === 1 ? 'person' : 'people'} in this region${lf ? ` <small>${lf} in land or finance</small>` : ''}</summary>${c.members.map(mrow).join('')}</details>` : ''}
  </div>`;
}
// a regional head whose territory is not public and who has nobody placed under them
const wordsOf = (t) => new Set(clean(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['and', 'the', 'markets', 'market', 'region', 'area', 'division', 'divisions'].includes(w)));
const addsInfo = (name, geo) => { const g = wordsOf(geo), n = wordsOf(name); return g.size > 0 && [...g].some((w) => !n.has(w)); };
const isEmpty = (c) => !c.heads.length && !c.members.length && !c.leaderName;
const isBare = (c) => c.name === 'Region not stated' && c.heads.length && !c.members.length;
function orgDiagram(b) {
  const m = orgModel(b);
  const nHeads = m.heads.length;
  const regionCount = m.top.length + m.bands.reduce((s, x) => s + x.cards.length, 0);
  const grp = (cls, ic, label, why, people, open = true) => (people.length ? `<details class="ogrp ${cls}" ${open ? 'open' : ''}><summary>${icon(ic)} ${esc(label)} <small>${people.length} · ${esc(why)}</small></summary><div class="ostack">${people.map((p) => pcard(p, { notag: true })).join('')}</div></details>` : '');
  const small = m.landCorp.length + m.finCorp.length + m.otherLeaders.length <= 6; // a small builder shows its corporate team open
  const corp = grp('land', 'pin', 'Land', 'who Domain calls first', m.landCorp, small || m.landCorp.length <= 2) + grp('fin', 'bank', 'Finance and treasury', 'who decides how land is paid for', m.finCorp, small) + grp('lead', 'star', 'Other leadership', 'chair, president, operations', m.otherLeaders, small) + grp('other', 'person', 'Other corporate', 'legal, sales, board', m.otherCorp, false);
  const regions = m.bands.map((x) => x.cards.length === 1 ? regionCard(x.cards[0], clean(x.segment.name)) : `<div class="segband ${x.cards.some((c) => c.members.some((mm) => ['Land', 'Finance'].includes(mm.p.priority_group))) ? '' : 'no-lf'}"><div class="ol">${esc(clean(x.segment.name) || x.segment.name)} <small>${esc(trunc(clean(x.segment.geography), 90))} · company segment, head not public</small></div><div class="inner">${x.cards.map((c) => regionCard(c)).join('')}</div></div>`).join('') + m.top.filter((c) => !isBare(c) && !isEmpty(c)).map((c) => regionCard(c)).join('');
  const emptyRegions = m.top.filter(isEmpty);
  const bare = m.top.filter(isBare).flatMap((c) => c.heads);
  return `<div class="org v-${esc(ORG_VIEW)}">
    <div class="orglegend"><span>Left edge of each card:</span><span><i class="edge" style="background:var(--ver)"></i>Verified</span><span><i class="edge" style="background:var(--rep)"></i>Reported</span><span><i class="edge" style="background:var(--inf)"></i>Inferred</span><span class="tag land">${icon('pin')}Land</span><span class="tag fin">${icon('bank')}Finance</span><span>Dashed edge: placed by geography, no published reporting line</span><span class="cnt">${b.derived.people_count} people · ${nHeads} regional heads · ${b.derived.land_count} land · ${b.derived.finance_count} finance</span></div>
    <div class="t-root">${m.root ? pcard(m.root, { cls: 'big', notag: true }) : '<div class="person empty-p big"><span class="n">Chief executive</span><span class="t">not yet mapped</span></div>'}</div>
    ${corp ? `<div class="trunk"></div><div class="t-corp">${corp}</div>` : ''}
    ${!m.landCorp.length ? '<div class="hint">No corporate head of land is public for this builder: land roles sit in the regions below.</div>' : ''}
    <div class="trunk"></div>
    <div class="tierlabel">${icon('map')} Regional heads <small>${b.derived.regional_heads} named${b.derived.regions_listed ? ` · ${b.derived.regions_listed} regions listed` : ''}</small></div>
    ${regions || bare.length ? `<div class="regions">${regions}${bare.length ? `<div class="segband bareheads no-lf"><div class="ol">${bare.length} more regional head${bare.length === 1 ? '' : 's'} <small>named in company records, territory not public</small></div><div class="pgrid">${bare.map((h) => pcard(h, { notag: true, nogeo: true })).join('')}</div></div>` : ''}</div>` : emptyRegions.length ? '' : '<div class="hint" style="margin-top:1rem">No regional structure is public or mapped for this builder.</div>'}
    ${emptyRegions.length ? `<div class="hint emptyreg">${icon('map')} ${emptyRegions.length} region${emptyRegions.length === 1 ? '' : 's'} with no publicly named head: <b>${emptyRegions.map((c) => `<span title="${esc(c.geography || c.name)}">${esc(clean(c.name) || c.name)}</span>`).join(' · ')}</b></div>` : ''}
    ${m.loose.length ? `<details class="unplaced" ${m.loose.length <= 8 ? 'open' : ''}><summary>${m.loose.length} more regional and division people <small class="muted">no published reporting line, and no region matches their geography</small></summary><div class="pgrid">${m.loose.map((p) => pcard(p, { covers: true })).join('')}</div></details>` : ''}
  </div>`;
}
function personCols(showBuilder = false) {
  return [
    { key: 'name', label: 'Name', w: 150, render: (p) => pLink(p), get: (p) => p.name },
    { key: 'title', label: 'Title', w: 220, get: (p) => p.title },
    ...(showBuilder ? [{ key: 'builder', label: 'Builder', get: (p) => p.builder_name, render: (p) => bLink(p.builder_id, p.builder_name) }] : []),
    { key: 'geo', label: 'Covers', w: 150, hideIfEmpty: true, get: (p) => (vague(p.geography) ? '' : trunc(p.geography, 90)) },
    { key: 'reports', label: 'Reports to', w: 120, hideIfEmpty: true, get: (p) => p.reports_to },
    { key: 'contact', label: 'Published contact', nosort: true, hideIfEmpty: true, get: (p) => pubEmail(p) || p.phone, render: (p) => [esc(pubEmail(p)), esc(p.phone)].filter(Boolean).join('<br>') },
    { key: 'likely', label: 'Likely email (pattern)', x: true, hideIfEmpty: true, get: (p) => (p.email && !pubEmail(p) ? p.email : ''), render: (p) => (p.email && !pubEmail(p) ? `<span class="muted">${esc(p.email)}</span>` : '') },
    { key: 'src', label: 'Source', w: 240, get: (p) => p.confidence, render: (p) => src(p) },
    { key: 'level', label: 'Level', x: true, get: (p) => p.level },
    { key: 'role', label: 'Role', x: true, get: (p) => p.role_category },
    { key: 'since', label: 'In role since', x: true, get: (p) => p.in_role_since || p.prior_role, render: (p) => esc(p.in_role_since) + (p.prior_role ? `<div class="muted small">Before: ${esc(trunc(p.prior_role, 110))}</div>` : '') },
    { key: 'pnote', label: 'Research note', x: true, w: 260, nosort: true, render: (p) => `<span class="small muted">${esc(p.note || '')}</span>` },
    { key: 'inote', label: 'Domain internal notes', w: 170, nosort: true, render: (p) => personNoteInput(p) },
  ];
}
function orgTree(b) {
  const kids = new Map();
  for (const p of b.people) { const k = p.reports_to_id || ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(p); }
  if (!b.people.some((p) => p.reports_to_id)) return '<div class="empty">No reporting lines are published for this builder. Use the diagram or the list by role.</div>';
  const seen = new Set();
  const node = (p) => { if (seen.has(p.person_id)) return ''; seen.add(p.person_id); const ch = kids.get(p.person_id) || []; return `<li>${pLink(p)} ${gtag(p)} <span class="muted">${esc(trunc(p.title, 70))}${!vague(p.geography) ? ' · ' + esc(trunc(p.geography, 50)) : ''}</span> ${p.reports_to_id ? conf(p.reports_to_confidence, false) : ''}${ch.length ? `<ul>${ch.map(node).join('')}</ul>` : ''}</li>`; };
  const roots = (kids.get('') || []).filter((p) => (kids.get(p.person_id) || []).length);
  const loose = (kids.get('') || []).filter((p) => !(kids.get(p.person_id) || []).length);
  return `<div class="panel"><ul class="tree">${roots.map(node).join('')}</ul><p class="muted small">The mark after each name is how sure the reporting line is.${loose.length ? ` ${loose.length} other people have no reporting line on record.` : ''}</p></div>`;
}
// The showpiece diagram is the component orgmap.js; the built-in diagram above is the fallback if it fails to load.
let ORGMAP = null, ORG_INST = null;
function mountOrg() {
  const host = $('#orgmap-host');
  if (!host || !ORGMAP || host.dataset.done || !host.offsetParent) return;
  const b = builderById(host.dataset.b);
  if (!b) return;
  try { ORG_INST?.destroy?.(); } catch { /* already gone */ }
  try { ORG_INST = ORGMAP.renderOrgMap(host, b, { onPerson: (p) => openDrawer(p.person_id), view: ORG_VIEW }); host.dataset.done = '1'; }
  catch (err) { console.error('org map', err); ORGMAP = null; $('#orgwrap').innerHTML = orgSection(b); }
}
import('./orgmap.js').then((m) => { ORGMAP = m; const w = $('#orgwrap'); if (w && location.hash.startsWith('#/builder/')) { const b = builderById(decodeURIComponent(location.hash.split('/')[2] || '')); if (b && b.people.length) { w.innerHTML = orgSection(b); mountOrg(); } } }).catch((err) => console.warn('orgmap.js not loaded: the connected chart is not offered', err));
function orgSection(b) {
  if (!b.people.length) return '<div class="empty">No people mapped yet for this builder.</div>';
  const dv = b.derived;
  const groups = GROUPS.map((g) => ({ g, rows: b.people.filter((x) => x.priority_group === g) })).filter((x) => x.rows.length);
  return `<div class="orgbar noprint">
    ${ORG_MODE === 'diagram' || (ORG_MODE === 'chart' && !ORGMAP) ? `${seg('orgview', [['all', 'Everyone'], ['heads', `${icon('map')} Regional heads only`], ['landfin', `${icon('pin')} Land and finance only`]], ORG_VIEW)}<span><button class="btn ghost sm" data-orgopen="1">Expand all</button> <button class="btn ghost sm" data-orgopen="0">Collapse all</button></span>` : ''}
    <span class="grow"></span>
    ${seg('orgmode', [...(ORGMAP ? [['chart', 'Org chart']] : []), ['diagram', 'Regions grid'], ['function', 'List by role'], ['tree', 'Reporting lines']], ORG_MODE === 'chart' && !ORGMAP ? 'diagram' : ORG_MODE)}
  </div>
  ${ORG_MODE === 'chart' && ORGMAP ? `<div id="orgmap-host" data-b="${esc(b.builder_id)}"></div>` : ORG_MODE === 'diagram' || ORG_MODE === 'chart' ? orgDiagram(b) : ORG_MODE === 'tree' ? orgTree(b) : groups.map(({ g, rows }) => `<h3>${icon(GROUP_ICON[g])} ${esc(g === 'Regional' ? 'Regional heads and leaders' : g)} (${rows.length})</h3>${table('org-' + g, personCols(), rows, { rowClass: (r) => 'c-' + r.confidence })}`).join('')}`;
}
document.addEventListener('click', (e) => {
  const oo = e.target.closest('[data-orgopen]');
  if (oo) document.querySelectorAll('.org details').forEach((d) => { d.open = oo.dataset.orgopen === '1'; });
});

// ---------- Builder page ----------
let BTAB = 'org';
function finTable(id, rows, cols, empty, limit) { return table(id, [...cols, { key: 'src', label: 'Source', w: 230, get: (r) => r.confidence, render: (r) => src(r) }, { key: 'rnote', label: 'Research note', x: true, w: 260, hideIfEmpty: true, get: (r) => r.note || '', render: (r) => `<span class="small muted">${esc(r.note || '')}</span>` }], rows, { rowClass: (r) => 'c-' + (r.confidence || ''), empty, limit }); }
const NEWSLISTS = {}; let NSORT = 'rel';
const heldScore = (a) => (typeof FF !== 'undefined' && FF.pinned.has(a.id) ? a.adj.adjusted - a.adj.direct : a.adj.adjusted);
const sortNews = (news) => news.slice().sort((a, b) => (NSORT === 'rel' ? heldScore(b) - heldScore(a) || String(b.published).localeCompare(String(a.published)) : String(b.published).localeCompare(String(a.published)) || heldScore(b) - heldScore(a)));
function newsBlock(id, news, empty, limit = 12) {
  NEWSLISTS[id] = { news, empty, limit };
  return `<div id="nl-${id}">${newsBlockInner(id)}</div>`;
}
function newsBlockInner(id) {
  const { news, empty, limit } = NEWSLISTS[id];
  const rows = sortNews(news);
  return `${news.length > 1 ? `<div class="bar-row" style="margin-top:0"><span class="muted">${news.length} stories</span><span class="grow"></span>${seg('nsort', [['rel', 'Most relevant'], ['new', 'Newest']], NSORT)}</div>` : ''}${newsList(rows.slice(0, NEWSLISTS[id].all ? rows.length : limit), empty)}${rows.length > limit && !NEWSLISTS[id].all ? `<button class="btn ghost" data-nlall="${id}">Show all ${rows.length} stories</button>` : ''}`;
}
document.addEventListener('click', (e) => {
  const sg = e.target.closest('[data-seg="nsort"]');
  if (sg) { NSORT = sg.dataset.val; for (const id of Object.keys(NEWSLISTS)) { const el = document.getElementById('nl-' + id); if (el) el.innerHTML = newsBlockInner(id); } if (FEED_RENDER && location.hash.startsWith('#/feed')) { document.querySelectorAll('[data-seg="nsort"]').forEach((x) => x.classList.toggle('on', x.dataset.val === NSORT)); FEED_RENDER(); } return; }
  const all = e.target.closest('[data-nlall]');
  if (all) { NEWSLISTS[all.dataset.nlall].all = true; document.getElementById('nl-' + all.dataset.nlall).innerHTML = newsBlockInner(all.dataset.nlall); }
});
function newsList(news, empty) {
  return news.length ? news.map((a) => `<div class="mini"><span title="${a.adj.delta ? `base ${a.adj.base}, your votes ${a.adj.delta > 0 ? '+' : ''}${a.adj.delta}` : 'base score'}">${scoreBadge(a.adj.adjusted, 'sm')}</span><div><div class="why">${ext(a.url, a.title)}</div>${a.summary ? `<div class="rs">${esc(firstSentence(humanDates(a.summary), 220))}</div>` : ''}<div class="meta">${esc(a.publisher || '')} · ${esc(fmtDate(a.published))}</div></div></div>`).join('') : `<div class="empty">${empty}</div>`;
}
// the printed pre-call brief: one page, no navigation (shown only in print)
function builderBrief(b, news) {
  const dv = b.derived, m = orgModel(b), f = b.financing;
  const cfo = b.people.filter((x) => x.role_category === 'CFO');
  const fin = cfo.length ? cfo : m.finCorp.slice(0, 2);
  const heads = [...m.bands.flatMap((x) => x.cards), ...m.top].flatMap((c) => c.heads.map((h) => ({ h, c })));
  const noHead = m.top.filter((c) => !c.heads.length).map((c) => clean(c.name) || c.name);
  const who = (px, extra) => `<li><b>${esc(px.name)}</b>, ${esc(trunc(clean(px.title) || px.title, 70))}${extra ? ` <span class="bm">${esc(extra)}</span>` : ''}${px.confidence !== 'Verified' ? ` <i>(${esc(px.confidence)})</i>` : ''}${pubEmail(px) || px.phone ? ` <span class="bm">${esc([pubEmail(px), px.phone].filter(Boolean).join(' · '))}</span>` : ''}</li>`;
  const mat = dv.next_maturity;
  const top3 = (news || []).slice().sort((x, y) => y.adj.adjusted - x.adj.adjusted || String(y.published).localeCompare(String(x.published))).slice(0, 3);
  const srcs = D.sources.filter((x) => x.builder_ids.includes(b.builder_id)).sort((x, y) => (y.facts || 0) - (x.facts || 0)).slice(0, 5);
  const fact = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<section class="brief" aria-hidden="true">
    <div class="br-h"><div><div class="br-k">Pre-call brief · Domain builder map · ${esc(fmtD(D.retrieved || ''))}</div><h1>#${b.rank ?? ''} ${esc(dname(b))}</h1><div class="bm">${esc(ownerLine(b))}${b.hq ? ' · ' + esc(b.hq) : ''}${b.states.length ? ` · ${b.states.length} states` : ''}</div></div></div>
    <div class="br-facts">
      ${fact(`Closings ${esc(D.ranking?.data_year || '')}`, num(b.closings) || 'not public')}
      ${fact('Lots optioned', dv.pct_optioned != null ? `${pct(dv.pct_optioned)}${dv.lots_total ? ` of ${num(dv.lots_total)}` : ''}` : 'not public')}
      ${fact('Next debt due', mat ? `${esc(dueText(mat))}${mat.principal_usd_m != null ? ' · ' + usd(mat.principal_usd_m) : ''}` : 'none on record')}
      ${fact('Regional heads', `${dv.regional_heads}${dv.regions_listed ? ` · ${dv.regions_listed} regions listed` : ''}`)}
    </div>
    <div class="br-cols"><div>
      <h3>Who to call</h3>
      <ul>${m.root ? who(m.root) : ''}${fin.map((x) => who(x)).join('')}${m.landCorp.slice(0, 4).map((x) => who(x)).join('') || '<li class="bm">No corporate head of land is public.</li>'}</ul>
      <h3>Known land bankers</h3>
      <ul>${lbLinks(b).length ? lbLinks(b).map((l) => `<li><b>${esc(l.firm)}</b>${oldYear(l.date) ? ` · ${oldYear(l.date)}` : l.date ? ` · ${esc(fmtD(l.date))}` : ''} <i>(${esc(l.confidence || 'confidence not stated')})</i>${l.amount_usd_m ? ` · ${usd(l.amount_usd_m)}` : ''}</li>`).join('') : `<li class="bm">${dv.land_bankers_unnamed ? 'Uses land banking; no banker is named publicly.' : 'None public.'}</li>`}</ul>
      <h3>Most relevant recent stories</h3>
      <ul>${top3.length ? top3.map((a) => `<li><b>${a.adj.adjusted}</b> ${esc(trunc(a.title, 95))} <span class="bm">${esc(a.publisher || '')} · ${esc(fmtDate(a.published))}</span></li>`).join('') : '<li class="bm">No stories tagged to this builder.</li>'}</ul>
    </div><div>
      <h3>Regional heads and what they cover (${heads.length})</h3>
      <ul>${heads.length ? heads.slice(0, 14).map(({ h, c }) => who(h, c.name === 'Region not stated' ? 'territory not public' : clean(c.name) || c.name)).join('') : '<li class="bm">No regional head is publicly named.</li>'}${heads.length > 14 ? `<li class="bm">+ ${heads.length - 14} more in the portal</li>` : ''}${noHead.length ? `<li class="bm">No public head: ${esc(trunc(noHead.join(', '), 160))}</li>` : ''}</ul>
      <h3>Sources</h3>
      <ul class="br-src">${srcs.map((x) => `<li>${esc(trunc(humanDates(x.title || host(x.url)), 70))} <span class="bm">${esc(host(x.url))}</span></li>`).join('') || '<li class="bm">See the portal.</li>'}</ul>
    </div></div>
    <div class="br-foot">Confidence: unmarked = Verified from a primary source; (Reported) = trade press or news; (Inferred) = a lead to confirm. Every fact and its source link are in the portal.</div>
  </section>`;
}
// who answers the phone: chief executive, CFO, head of land, every regional head (N-09)
function keyPeople(b) {
  if (!b.people.length) return '<span class="muted">No people mapped yet.</span>';
  const m = orgModel(b);
  const cfo = b.people.filter((x) => x.role_category === 'CFO');
  const fin = cfo.length ? cfo.slice(0, 1) : m.finCorp.slice(0, 1);
  const heads = [...m.bands.flatMap((x) => x.cards), ...m.top].flatMap((c) => c.heads.map((h) => ({ h, c })));
  const chip = (px, sub) => `<button class="kchip c-${esc(px.confidence)}" data-person="${esc(px.person_id)}" title="${esc(px.title)}"><b>${esc(px.name)}</b>${sub || px.confidence === 'Inferred' ? `<small>${esc(trunc(sub || '', 34))}${px.confidence === 'Inferred' ? `${sub ? ' · ' : ''}<i>lead to confirm</i>` : ''}</small>` : ''}</button>`;
  const row = (ic, label, html) => `<div class="kp-row"><span class="kp-l">${icon(ic)} ${label}</span><span class="kp-v">${html}</span></div>`;
  const none = (t) => `<span class="muted">${t}</span>`;
  return row('star', 'Chief executive', m.root ? chip(m.root) : none('not mapped'))
    + row('bank', 'Finance', fin.length ? fin.map((x) => chip(x, x.role_category === 'CFO' ? 'CFO' : x.title)).join('') : none('not public'))
    + row('pin', 'Land', m.landCorp.length ? m.landCorp.slice(0, 3).map((x) => chip(x, clean(x.title))).join('') + (m.landCorp.length > 3 ? none(`+ ${m.landCorp.length - 3} more`) : '') : none(`no corporate head of land is public${b.derived.land_count ? `; ${b.derived.land_count} land contact${b.derived.land_count === 1 ? '' : 's'} sit in the regions` : ''}`))
    + row('map', `Regional heads (${heads.length})`, heads.length ? heads.slice(0, 8).map(({ h, c }) => chip(h, c.name === 'Region not stated' ? '' : clean(c.name))).join('') + (heads.length > 8 ? `<button class="linkbtn" data-jumpheads="1">+ ${heads.length - 8} more on the org map</button>` : '') : none(m.top.length ? 'regions are listed, heads are not publicly named' : 'none public'));
}
document.addEventListener('click', (e) => { const j = e.target.closest('[data-jump]'); if (j) { const el = document.getElementById(j.dataset.jump); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' }); } });
document.addEventListener('click', (e) => { if (e.target.closest('[data-jumpheads]')) { document.querySelector('[data-btab="org"]')?.click(); document.querySelector('.tierlabel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
function viewBuilder(id, tab) {
  const b = builderById(id);
  if (!b) { main.innerHTML = `<p>No builder with id "${esc(id)}". <a href="#/builders">Back to the list</a>.</p>`; return; }
  BTAB = tab || 'org'; // a builder always opens on its org map unless the address names a tab
  const p = b.profile, f = b.financing, dv = b.derived;
  const news = rankFeed(D.feed.articles.filter((a) => b.news_ids.includes(a.id)), VOTES).sort((x, y) => String(y.published).localeCompare(String(x.published)));
  const lots = f?.lots;
  const firms = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
  const firmCell = (name) => {
    const rx = name.startsWith('Domain') ? /domain real estate|dw partners/i : name.startsWith('Millrose') ? /millrose/i : name.startsWith('Kennedy') ? /kennedy[\s-]*lewis/i : /angelo[\s,]*gordon|\btpg\b|essential housing/i;
    const link = lbLinks(b).find((l) => rx.test(l.firm));
    const note = (f?.no_link_notes || []).find((n) => rx.test(n.firm));
    if (link) return `<div class="firm yes"><b>${esc(name)}</b><span class="tag ${oldYear(link.date) ? 'inf' : 'land'}">${oldYear(link.date) ? `Public link from ${oldYear(link.date)}` : 'Public link'}</span> ${conf(link.confidence)}${link.date ? ` <span class="muted small">${esc(fmtD(link.date))}</span>` : ''}${link.amount_usd_m ? ` <span class="muted small">· ${usd(link.amount_usd_m)}</span>` : ''}<div>${short(link.what, 120)}</div><div class="small">${src({ confidence: '', source_url: link.source_url, source_title: link.source_title }, f?.retrieved)}</div>${oldYear(link.date) ? `<div class="small muted">Dated ${esc(fmtD(link.date))}, more than two years ago: not evidence of a current relationship.</div>` : link.confidence !== 'Verified' ? `<div class="small muted">${link.confidence === 'Inferred' ? 'A lead to confirm: the source is indirect or derived.' : 'From trade press or a secondary source.'}</div>` : ''}${note ? `<div class="small muted">Latest check: ${short(note.text, 80)}</div>` : ''}</div>`;
    if (note) return `<div class="firm"><b>${esc(name)}</b><span class="muted">No public link found</span><div class="small">${short(note.text, 110)}</div>${note.other_evidence ? `<div class="small muted">Older evidence (${esc(note.other_evidence.confidence || 'Inferred')}${note.other_evidence.date ? ', ' + esc(fmtD(note.other_evidence.date)) : ''}): ${short(note.other_evidence.text, 90)} ${ext(note.other_evidence.source_url, 'source')}</div>` : ''}</div>`;
    return `<div class="firm"><b>${esc(name)}</b><span class="muted">${f ? 'No public link found' : 'Financing not yet mapped'}</span></div>`;
  };
  const lbRows = f ? [...f.land_banking, ...b.competitor_relationships.map((r) => ({ counterparty: r.financier || r.competitor_name, counterparty_type: r.is_scan ? 'Financier (from the new-entrant scan)' : 'Land banker', description: r.description, amount_usd_m: r.amount_usd_m, lots: r.lots, date: r.date, confidence: r.confidence, source_url: r.source_url, source_title: r.source_title, note: `From the ${r.competitor_name} profile`, _cid: r.competitor_id }))] : [];
  const maRows = [...b.ma, ...b.industry_deals.map((d) => ({ date: d.date, role: d.acquirer_builder_id === id ? 'Acquirer' : 'Target', counterparty: d.acquirer_builder_id === id ? d.target : d.acquirer, description: d.description, status: d.status, after_ranking: d.after_ranking, map_impact: d.map_impact, confidence: d.confidence, source_url: d.source_url, source_title: d.source_title, note: 'From the industry deals list' }))];
  const km = f?.key_metrics || {};
  const kmSummary = [km.total_debt_usd_m != null ? `Total debt ${usd(km.total_debt_usd_m)}` : '', km.cash_usd_m != null ? `cash ${usd(km.cash_usd_m)}` : '', km.liquidity_usd_m != null ? `liquidity ${usd(km.liquidity_usd_m)}` : '', km.net_debt_to_capital_pct != null ? `net debt to capital ${pct(km.net_debt_to_capital_pct)}` : '', km.credit_ratings ? `ratings ${km.credit_ratings}` : ''].filter(Boolean).join('; ') + (km.note ? `. ${km.note}` : '');
  const gaps = realGaps(b.gaps);
  const lotsSummary = lots ? `${[lots.owned != null ? `${num(lots.owned)} lots owned` : '', lots.optioned != null ? `${num(lots.optioned)} optioned or controlled` : '', lots.pct_optioned != null ? `${pct(lots.pct_optioned)} optioned` : '', lots.total_controlled ? `${num(lots.total_controlled)} in all` : ''].filter(Boolean).join(', ')}. ${lots.note || ''}` : '';
  const debtLive = (f?.debt || []).filter((r) => r.status !== 'Redeemed'), debtDone = (f?.debt || []).filter((r) => r.status === 'Redeemed');
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextDue = debtLive.filter((r) => r.status === 'Outstanding' && r.maturity_key && r.maturity_key >= todayIso).sort((a, b) => a.maturity_key.localeCompare(b.maturity_key))[0];
  const m = dv.next_maturity;
  const g = (k, v, s, cls = '') => `<div><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="s">${s || ''}</div></div>`;
  const none = '<span class="muted">not public</span>';
  const tabs = [['org', 'users', 'Org map', dv.people_count], ['financing', 'bank', 'Financing', (f?.debt.length || 0) + lbRows.length], ['news', 'news', 'News', news.length], ['deals', 'merge', 'Deals', maRows.length], ['profile', 'building', 'Profile and gaps', null]];
  if (!tabs.some((t) => t[0] === BTAB)) BTAB = 'org';
  const panel = (key, title, html) => `<section class="tabpanel ${BTAB === key ? 'on' : ''}" id="tp-${key}" data-title="${esc(title)}">${html}</section>`;
  main.innerHTML = `
  <div class="crumb"><a href="#/builders">Builders</a> › ${esc(dname(b))}</div>
  <div class="bhead"><span class="rank">#${b.rank ?? ''}</span><h1>${esc(dname(b))}${dname(b) !== b.name ? ` <small class="legal">${esc(b.name)}</small>` : ''}</h1>${tierTag(b.tier)}<span class="tag">${esc(ownerLine(b))}</span>${dv.acquired_after_ranking ? `<span class="tag note">Acquired by ${esc(trunc(dv.acquired_after_ranking.by, 36))}, ${esc(fmtDate(dv.acquired_after_ranking.date))}</span>` : ''}${b.in_progress ? '<span class="tag note">Research in progress</span>' : ''}
    <span class="sp"></span><button class="btn ghost noprint" onclick="window.print()" title="Print or save as PDF: a one-page brief for this builder">${icon('print')} Print pre-call brief</button></div>
  ${p?.summary ? `<p class="bsum">${short(p.summary, 200)}</p>` : ''}
  <div class="glance">
    ${g(`${icon('home')} Closings ${esc(D.ranking?.data_year || '')}`, b.closings ? hs(num(b.closings), srcRow({ source_url: b.spine?.source_url, confidence: b.spine?.confidence, retrieved: b.spine?.retrieved, source_title: `${D.ranking?.year || ''} ${D.ranking?.name || 'ranking'} (by ${D.ranking?.data_year || ''} closings)` }, { summary: `${dname(b)}: ${num(b.closings)} closings in ${D.ranking?.data_year || ''}${b.revenue_usd_m ? `, ${usd(b.revenue_usd_m)} revenue` : ''}; ranked #${b.rank}. ${b.spine?.note || ''}`, date: String(D.ranking?.year || '') })) : none, b.revenue_usd_m ? `${usd(b.revenue_usd_m)} revenue` : '')}
    ${g(`${icon('lots')} Lots optioned`, dv.pct_optioned != null ? hs(pct(dv.pct_optioned), srcRow(lots || { source_url: '' }, { summary: lotsSummary })) : none, dv.lots_total ? `of ${num(dv.lots_total)} lots controlled` : 'owned versus optioned split not public', dv.pct_optioned != null ? '' : 'txt')}
    ${g(`${icon('bank')} Known land bankers`, lbLinks(b).length ? `<span class="lbstack">${lbHtml(b, 3, true)}</span>` : dv.land_bankers_unnamed ? 'Uses one, not named' : '<span class="muted">None public</span>', '', 'txt')}
    ${g(`${icon('cal')} Next debt due`, m ? hs(esc(dueText(m)), srcRow(debtLive.find((r) => r.instrument === m.instrument && r.maturity_key === m.maturity_key) || m, { summary: `${m.instrument}: ${m.principal_usd_m != null ? usd(m.principal_usd_m) + ', ' : ''}due ${dueText(m)}. ${m.status || ''}`, amount: m.principal_usd_m ?? null })) : '<span class="muted">None on record</span>', m ? `${m.principal_usd_m != null ? usd(m.principal_usd_m) + ' · ' : ''}${esc(trunc(m.instrument, 40))}${nextDue && nextDue.maturity_key < m.maturity_key ? `<br>Notes and loans only. ${esc(/warehouse/i.test(nextDue.type + nextDue.instrument) ? 'Mortgage credit line' : 'A credit line')} renews ${esc(dueText(nextDue))}` : ''}` : '', m ? '' : 'txt')}
    ${g(`${icon('map')} Regional heads`, dv.regional_heads || '<span class="muted">0</span>', `${dv.regions_listed ? `${dv.regions_listed} regions listed · ` : ''}${dv.people_count} people mapped`)}
    <a class="gmap" href="#/states" title="Browse by state: who else builds in these states">${usMap(b.states) || ''}<div class="s">${b.hq ? `HQ ${esc(b.hq)} · ` : ''}${b.states.length ? `${b.states.length} state${b.states.length === 1 ? '' : 's'}` : ''}</div></a>
  </div>
  <div class="about">
    <div class="panel keyp"><div class="k">${icon('users')} Key people <span class="lc">click a name for source and contact</span></div>${keyPeople(b)}</div>
    <div class="panel notes"><label class="k" for="bnote">${icon('pencil')} Domain internal notes</label><span><textarea id="bnote" class="note" data-note-kind="builder" data-note-id="${esc(id)}" placeholder="What Domain knows about this builder (saved as you type)…">${esc(noteText('builder', id))}</textarea><span class="saved"></span></span></div>
  </div>
  ${builderBrief(b, news)}
  <div class="tabs noprint" role="tablist">${tabs.map(([k, ic, l, n]) => `<button data-btab="${k}" class="${BTAB === k ? 'on' : ''}">${icon(ic)} ${l}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>

  ${panel('org', 'Org map', `<div id="orgwrap">${orgSection(b)}</div>`)}

  ${panel('financing', 'Financing', !f ? '<div class="empty">Financing not yet mapped for this builder.</div>' : `
    <div class="jumps noprint">${nextDue ? `<span class="nd">${icon('cal')} <b>Next due: ${esc(dueText(nextDue))}</b>${nextDue.principal_usd_m != null ? ` · ${usd(nextDue.principal_usd_m)}` : ''} · ${esc(trunc(nextDue.instrument, 60))}</span>` : '<span class="nd muted">No dated debt on record</span>'}<span class="grow"></span><span class="muted">Jump to</span>${[['fin-lots', 'Lots'], ['fin-links', 'Domain and competitors'], ['fin-lb', `Land banking (${lbRows.length})`], ['fin-debt', `Debt (${debtLive.length})`], ['fin-cap', 'Capital events']].map(([i2, l]) => `<button class="chip sm" data-jump="${i2}">${l}</button>`).join('')}</div>
    <div class="panel" id="fin-lots">${f.land_strategy ? `<div class="lbl-row"><b>Land strategy</b> ${short(f.land_strategy, 200)}</div>` : f.summary ? short(f.summary, 200) : ''}
      ${lots ? `<div class="lotbar" title="owned / optioned">${lots.owned != null && lots.optioned != null && lots.owned + lots.optioned > 0 ? `<div class="owned" style="width:${(100 * lots.owned) / (lots.owned + lots.optioned)}%"></div><div class="opt" style="width:${(100 * lots.optioned) / (lots.owned + lots.optioned)}%"></div>` : lots.pct_optioned != null ? `<div class="owned" style="width:${100 - lots.pct_optioned}%"></div><div class="opt" style="width:${lots.pct_optioned}%"></div>` : ''}</div>
      <div class="facts">${lots.owned != null ? `<span>${hs(`<b>${num(lots.owned)}</b>`, srcRow(lots, { summary: lotsSummary }))} lots owned</span>` : ''}${lots.optioned != null ? `<span class="optc">${hs(`<b>${num(lots.optioned)}</b>`, srcRow(lots, { summary: lotsSummary }))} optioned or controlled${lots.pct_optioned != null ? ` (${pct(lots.pct_optioned)})` : ''}</span>` : lots.pct_optioned != null ? `<span class="optc"><b>${pct(lots.pct_optioned)}</b> of lots optioned or controlled</span>` : ''}${lots.owned == null && lots.optioned == null && (lots.total_controlled || dv.lots_total) ? `<span><b>${num(lots.total_controlled || dv.lots_total)}</b> lots in all</span>` : ''}${lots.years_supply != null ? `<span><b>${num(lots.years_supply)}</b> years of supply</span>` : ''}<span>${src(lots, f.retrieved)}</span></div>` : '<p class="muted">Owned versus optioned lots: not publicly disclosed.</p>'}
      ${km.total_debt_usd_m != null || km.cash_usd_m != null || km.liquidity_usd_m != null || km.credit_ratings ? `<div class="facts">${[km.total_debt_usd_m != null ? `<span>${hs(`<b>${usd(km.total_debt_usd_m)}</b>`, srcRow(km, { summary: kmSummary, amount: null }))} total debt</span>` : '', km.cash_usd_m != null ? `<span>${hs(`<b>${usd(km.cash_usd_m)}</b>`, srcRow(km, { summary: kmSummary, amount: null }))} cash</span>` : '', km.liquidity_usd_m != null ? `<span>${hs(`<b>${usd(km.liquidity_usd_m)}</b>`, srcRow(km, { summary: kmSummary, amount: null }))} liquidity</span>` : '', km.net_debt_to_capital_pct != null ? `<span><b>${pct(km.net_debt_to_capital_pct)}</b> net debt to capital</span>` : '', km.credit_ratings ? `<span title="${esc(km.credit_ratings)}">Ratings <b style="font-size:1.05rem">${esc(trunc(clean(km.credit_ratings), 48))}</b></span>` : ''].filter(Boolean).join('')}<span>${src(km, f.retrieved)}</span></div>` : ''}
    </div>
    <h3 id="fin-links">${icon('target')} Public links to Domain and its closest competitors</h3><div class="firms">${firms.map(firmCell).join('')}</div>
    <h3 id="fin-lb">${icon('bank')} Land banking and lot-option relationships (${lbRows.length})</h3>
    ${finTable('lb', lbRows, [
      { key: 'counterparty', label: 'Who', render: (r) => (r._cid ? `<a href="#/competitor/${esc(r._cid)}"><b>${esc(r.counterparty)}</b></a>` : (competitorByName(r.counterparty) ? `<a href="#/competitor/${esc(competitorByName(r.counterparty).competitor_id)}"><b>${esc(r.counterparty)}</b></a>` : `<b>${esc(r.counterparty)}</b>`)), get: (r) => r.counterparty },
      { key: 'description', label: 'Arrangement', w: 300, render: (r) => short(r.description, 150) },
      { key: 'amount_usd_m', label: 'Amount', num: true, hideIfEmpty: true, render: (r) => usd(r.amount_usd_m) }, { key: 'lots', label: 'Lots', num: true, hideIfEmpty: true, render: (r) => num(r.lots) }, { key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }, { key: 'counterparty_type', label: 'Type', x: true }], 'No land-banking relationship is public.')}
    <h3 id="fin-debt">${icon('cal')} Debt, soonest first (${debtLive.length}${dv.debt_outstanding_usd_m ? ` · ${usd(dv.debt_outstanding_usd_m)} outstanding` : ''})</h3>
    ${nextDue ? `<div class="callout nextdue">${icon('cal')} <b>Next to come due: ${esc(dueText(nextDue))}</b>${nextDue.principal_usd_m != null ? ` · ${usd(nextDue.principal_usd_m)}` : ''} · ${esc(trunc(nextDue.instrument, 80))}${m && m.maturity_key !== nextDue.maturity_key ? ` <span class="muted">· next notes or loans: ${esc(dueText(m))}${m.principal_usd_m != null ? `, ${usd(m.principal_usd_m)}` : ''}</span>` : ''}</div>` : ''}
    ${finTable('debt', debtLive, [
      { key: 'maturity', label: 'Due', hs: true, sortVal: (r) => r.maturity_key, render: (r) => `<b class="nowrap">${esc(dueText(r))}</b>` },
      { key: 'instrument', label: 'What', w: 220 }, { key: 'principal_usd_m', label: 'Amount', num: true, render: (r) => usd(r.principal_usd_m) }, { key: 'rate', label: 'Rate' },
      { key: 'lenders_agent', label: 'Lenders / agent', render: (r) => esc(trunc(r.lenders_agent, 70)) }, { key: 'type', label: 'Type', x: true }, { key: 'secured', label: 'Secured', x: true }, { key: 'status', label: 'Status', x: true }, { key: 'as_of', label: 'As of', x: true, render: (r) => esc(fmtD(r.as_of)) }], 'No debt instruments on record.')}
    ${debtDone.length ? `<details class="more"><summary>Show ${debtDone.length} redeemed or repaid</summary>${finTable('debtdone', debtDone, [{ key: 'maturity', label: 'Was due', sortVal: (r) => r.maturity_key, render: (r) => esc(dueText(r)) }, { key: 'instrument', label: 'What', w: 220 }, { key: 'principal_usd_m', label: 'Amount', num: true, render: (r) => usd(r.principal_usd_m) }, { key: 'status', label: 'Status' }], '')}</details>` : ''}
    <h3 id="fin-cap">Capital events (${f.capital_events.length})</h3>
    ${finTable('cev', f.capital_events, [{ key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }, { key: 'type', label: 'Type' }, { key: 'description', label: 'What happened', w: 320, render: (r) => short(r.description, 150) }, { key: 'amount_usd_m', label: 'Amount', num: true, hideIfEmpty: true, render: (r) => usd(r.amount_usd_m) }], 'No capital events recorded.', 8)}
    <h3>Joint ventures (${f.joint_ventures.length})</h3>
    ${finTable('jv', f.joint_ventures, [{ key: 'partner', label: 'Partner' }, { key: 'description', label: 'Description', w: 320, render: (r) => short(r.description, 150) }, { key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }], 'No joint ventures recorded.', 8)}`)}

  ${panel('news', 'News', `${b.suggested_updates.length ? b.suggested_updates.map((u) => `<div class="upd"><b>Suggested update to this map:</b> ${short(u.text, 180)} <span class="src">${ext(u.url, trunc(u.title, 60))} · ${esc(fmtDate(u.published))}</span></div>`).join('') : ''}${newsBlock('bnews', news, 'No stories in the feed are tagged to this builder yet.')}`)}

  ${panel('deals', 'Deals', finTable('ma', maRows, [
    { key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }, { key: 'role', label: 'Role' }, { key: 'counterparty', label: 'With' }, { key: 'description', label: 'Deal', w: 300, render: (r) => short(factFirst(r.description), 150) }, { key: 'status', label: 'Status' },
    { key: 'after_ranking', label: 'Timing', x: true, render: (r) => (r.after_ranking ? 'After the 2026 ranking' : 'Before') }, { key: 'map_impact', label: 'What it changes in the map', x: true, w: 260 }], 'No deals recorded for 2025 to date.'))}

  ${panel('profile', 'Profile and gaps', `<div class="about" style="grid-template-columns:1fr 1fr"><div class="panel"><h3>${icon('building')} Company facts</h3>
      <dl class="kv">
        ${p?.legal_name ? `<dt>Legal name</dt><dd>${esc(p.legal_name)}</dd>` : ''}
        ${p?.brand_names?.length ? `<dt>Brands</dt><dd>${esc(p.brand_names.join(', '))}</dd>` : ''}
        ${b.parent ? `<dt>Parent</dt><dd>${esc(b.parent)}</dd>` : ''}
        ${b.hq ? `<dt>Headquarters</dt><dd>${esc(b.hq)}</dd>` : ''}
        ${p?.website ? `<dt>Website</dt><dd>${ext(p.website, host(p.website))}</dd>` : ''}
        ${p?.main_phone ? `<dt>Main phone</dt><dd>${esc(p.main_phone)}</dd>` : ''}
        <dt>Ranking</dt><dd>#${b.rank ?? ''}, ${num(b.closings) || 'n/a'} closings${b.rank_prev != null ? ` (was #${b.rank_prev})` : ''} ${b.spine ? src({ confidence: b.spine.confidence, source_url: b.spine.source_url, source_title: `${D.ranking?.year || ''} ${D.ranking?.name || 'ranking'}`, retrieved: b.spine.retrieved }) : ''}</dd>
        ${b.housing_giants_rank != null ? `<dt>Pro Builder rank</dt><dd>#${b.housing_giants_rank}${b.housing_giants_revenue_usd_m != null ? ` (${usd(b.housing_giants_revenue_usd_m)} revenue)` : ''}</dd>` : ''}
        ${b.states.length ? `<dt>States (${b.states.length})</dt><dd>${esc(b.states.join(', '))}</dd>` : ''}
        ${p?.markets?.length ? `<dt>Markets</dt><dd>${short(p.markets.join(', '), 160)}</dd>` : ''}
        ${p?.email_pattern ? `<dt>Email pattern</dt><dd>${esc(p.email_pattern)} ${conf('Inferred')}</dd>` : ''}
        ${p?.org_note ? `<dt>How it is organised</dt><dd>${short(p.org_note, 160)}</dd>` : ''}
      </dl>${p ? src(p, b.retrieved) : ''}</div>
    <div class="panel"><h3>What is not public (${gaps.length})</h3>${gaps.length ? `<ul class="gap-list">${gaps.slice(0, 5).map((x) => `<li>${short(x, 150)}</li>`).join('')}</ul>${gaps.length > 5 ? `<details class="more"><summary>Show all ${gaps.length}</summary><ul class="gap-list">${gaps.slice(5).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}` : '<span class="muted">No gaps recorded.</span>'}</div></div>
    ${p?.regions?.length ? `<h3>${icon('map')} Regions as the company describes them</h3>${table('regions', [{ key: 'name', label: 'Region' }, { key: 'geography', label: 'Covers' }, { key: 'leader', label: 'Leader', render: (r) => (r.leader ? esc(r.leader) : '<span class="muted">not publicly named</span>') }], p.regions)}` : ''}`)}`;
  VIEW_SET = (name, val) => {
    if (name === 'orgview') { ORG_VIEW = val; const o = $('.org'); const bar = $('.orgbar'); const stuck = bar && bar.getBoundingClientRect().top <= 70; if (o) { o.className = 'org v-' + val; if (val === 'landfin') o.querySelectorAll('details').forEach((d) => { if (d.querySelector('.g-Land, .g-Finance')) d.open = true; }); } document.querySelectorAll('[data-seg="orgview"]').forEach((x) => x.classList.toggle('on', x.dataset.val === val)); if (stuck && o) window.scrollTo({ top: o.getBoundingClientRect().top + window.scrollY - 130 }); }
    if (name === 'orgmode') { ORG_MODE = val; $('#orgwrap').innerHTML = orgSection(b); mountOrg(); }
  };
  mountOrg();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-btab]');
  if (!t) return;
  BTAB = t.dataset.btab;
  document.querySelectorAll('[data-btab]').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('.tabpanel').forEach((x) => x.classList.toggle('on', x.id === 'tp-' + BTAB));
  if (BTAB === 'org') mountOrg();
  const id = location.hash.split('/')[2];
  history.replaceState(null, '', `#/builder/${id}/${BTAB}`);
});

// ---------- People ----------
const ROLE_CHIPS = { all: {}, land: { group: 'Land' }, finance: { group: 'Finance' }, regional: { role: 'Regional President' }, division: { group: 'Division' }, csuite: { group: 'C-suite' } };
const US_REGIONS = { Southeast: ['FL', 'GA', 'NC', 'SC', 'AL', 'TN', 'MS', 'LA', 'AR', 'KY'], Texas: ['TX', 'OK'], Southwest: ['AZ', 'NV', 'NM', 'CO', 'UT', 'ID', 'MT', 'WY'], West: ['CA', 'OR', 'WA', 'HI', 'AK'], Midwest: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'ND', 'SD'], 'Mid-Atlantic and Northeast': ['VA', 'MD', 'DE', 'DC', 'WV', 'PA', 'NJ', 'NY', 'CT', 'MA', 'RI', 'NH', 'VT', 'ME'] };
const FP = { region: '', q: '', chip: 'all', level: '', tier: '', own: '', state: '', builder: '', conf: '', contact: '', mode: 'cards', shown: 48 };
function peopleRows() {
  const q = FP.q.toLowerCase().split(/\s+/).filter(Boolean);
  const c = ROLE_CHIPS[FP.chip] || {};
  const stRe = FP.state ? new RegExp('\\b' + FP.state + '\\b') : null;
  const rows = D.people.filter((p) => (!c.group || p.priority_group === c.group) && (!c.role || p.role_category === c.role) && (!FP.level || p.level === FP.level)
    && (!FP.tier || (p.rank != null && p.rank <= Number(FP.tier))) && (!FP.own || p.ownership_group === FP.own) && (!FP.builder || p.builder_id === FP.builder) && (!FP.conf || p.confidence === FP.conf)
    && (!FP.state || (p.geography ? stRe.test(p.geography) || statesIn(p.geography).has(FP.state) : p.builder_states.includes(FP.state)))
    && (!FP.region || [...statesIn(`${p.geography} ${p.level === 'Corporate' ? '' : p.title}`)].some((st) => US_REGIONS[FP.region].includes(st)))
    && (!FP.contact || (FP.contact === 'email' ? pubEmail(p) : FP.contact === 'phone' ? p.phone : pubEmail(p) || p.phone))
    && (!q.length || q.every((t) => [p.name, p.title, p.geography, p.builder_name, p.role_category].join(' ').toLowerCase().includes(t))));
  // regional heads: the ones whose territory is known come first
  return FP.chip === 'regional' ? rows.sort((x, y) => (vague(x.geography) ? 1 : 0) - (vague(y.geography) ? 1 : 0) || (x.rank ?? 999) - (y.rank ?? 999)) : rows;
}
const peopleHash = () => { const q = [FP.region ? `region=${encodeURIComponent(FP.region)}` : '', FP.q ? `q=${encodeURIComponent(FP.q)}` : '', FP.builder ? `builder=${encodeURIComponent(FP.builder)}` : '', FP.state ? `state=${FP.state}` : '', FP.tier ? `tier=${FP.tier}` : ''].filter(Boolean).join('&'); return `#/people${FP.chip !== 'all' ? '/' + FP.chip : ''}${q ? '?' + q : ''}`; };
function viewPeople(chip, query) {
  if (chip && ROLE_CHIPS[chip]) { FP.chip = chip; FP.shown = 48; }
  if (query) { const q = new URLSearchParams(query); if (q.has('region') && US_REGIONS[q.get('region')]) FP.region = q.get('region'); if (q.has('q')) FP.q = q.get('q'); if (q.has('builder')) FP.builder = q.get('builder'); if (q.has('state')) FP.state = q.get('state'); if (q.has('tier')) FP.tier = q.get('tier'); }
  const states = uniq(D.builders.flatMap((b) => b.states)).sort();
  const blds = D.builders.filter((b) => b.derived.people_count).map((b) => [b.builder_id, `#${b.rank} ${b.name} (${b.derived.people_count})`]);
  const G = D.totals.people_by_group || {};
  const extraOn = [FP.level, FP.tier, FP.own, FP.state, FP.builder, FP.conf, FP.contact].filter(Boolean).length;
  main.innerHTML = `<h1>${FP.chip === 'regional' ? 'Regional heads: who they are and what they cover' : 'People: who does what at every builder'}</h1>
  <div class="search" style="max-width:52rem;margin:.8rem 0"><input id="fp-q" class="bigsearch" type="search" placeholder="Name, title, market or builder" value="${esc(FP.q)}" autocomplete="off"></div>
  <div class="chips">${chips('prole', [['all', 'Everyone', D.people.length], ['land', `${icon('pin')} Land`, G.Land], ['finance', `${icon('bank')} Finance`, G.Finance], ['regional', `${icon('map')} Regional heads`, D.totals.regional_heads_found], ['division', `${icon('grid')} Division`, G.Division], ['csuite', `${icon('star')} C-suite`, G['C-suite']]], FP.chip)}</div>
  ${FP.chip === 'all' || FP.chip === 'csuite' || FP.chip === 'finance' ? '' : `<div class="chips"><span class="lbl">Covers</span>${chips('pregion', [['', 'Anywhere'], ...Object.keys(US_REGIONS).map((r) => [r, r])], FP.region)}</div>`}
  <details class="more" ${extraOn ? 'open' : ''}><summary>More filters${extraOn ? ` (${extraOn} on)` : ''}</summary><div class="filters">
    <label>Builder <select id="fp-builder">${options(blds, FP.builder)}</select></label>
    <label>Builder rank <select id="fp-tier">${options([['25', 'Top 25'], ['50', 'Top 50']], FP.tier)}</select></label>
    <label>State <select id="fp-state">${options(states, FP.state)}</select></label>
    <label>Level <select id="fp-level">${options(['Corporate', 'Regional', 'Division'], FP.level)}</select></label>
    <label>Ownership <select id="fp-own">${options(['Public', 'Private', 'Subsidiary'], FP.own)}</select></label>
    <label>Confidence <select id="fp-conf">${options(['Verified', 'Reported', 'Inferred'], FP.conf)}</select></label>
    <label>Contact <select id="fp-contact">${options([['any', 'Has a published email or phone'], ['email', 'Has a published email'], ['phone', 'Has a phone']], FP.contact)}</select></label>
    <button class="btn ghost sm" id="fp-clear">Clear filters</button>
  </div></details>
  <div id="fp-filtered"></div>
  <div class="bar-row"><b id="fp-count"></b><span class="grow"></span><button class="btn ghost" id="fp-csv">${icon('download')} Download these as CSV</button>${seg('pmode', [['cards', 'Cards'], ['table', `${icon('table')} Full table`]], FP.mode)}</div>
  <div id="list"></div>`;
  const render = () => {
    const rows = peopleRows();
    const CH = { land: 'Land', finance: 'Finance', regional: 'Regional heads', division: 'Division', csuite: 'C-suite' };
    const act = [CH[FP.chip], FP.region ? `covers ${FP.region}` : '', FP.q ? `"${FP.q}"` : '', FP.builder ? (builderById(FP.builder) ? dname(builderById(FP.builder)) : FP.builder) : '', FP.state, FP.tier ? `Top ${FP.tier}` : '', FP.level, FP.own, FP.conf, FP.contact ? 'has contact' : ''].filter(Boolean);
    $('#fp-filtered').innerHTML = act.length ? `<div class="filtered" role="status"><b>Filtered:</b> ${act.map(esc).join(' · ')} <button class="btn ghost sm" id="fp-clearall">${icon('x')} Clear</button></div>` : '';
    const ca = $('#fp-clearall'); if (ca) ca.addEventListener('click', () => { Object.assign(FP, { chip: 'all', region: '', q: '', level: '', tier: '', own: '', state: '', builder: '', conf: '', contact: '', shown: 48 }); history.replaceState(null, '', peopleHash()); viewPeople(); });
    if (location.hash.startsWith('#/people')) history.replaceState(null, '', peopleHash());
    $('#fp-count').textContent = `${num(rows.length)} ${rows.length === 1 ? 'person' : 'people'}`;
    if (!rows.length) { $('#list').innerHTML = '<div class="empty">No one matches. Try fewer filters or a different spelling.</div>'; return; }
    if (FP.mode === 'cards') {
      const regional = FP.chip === 'regional';
      if (regional) {
        const byB = new Map();
        for (const p of rows) { if (!byB.has(p.builder_id)) byB.set(p.builder_id, []); byB.get(p.builder_id).push(p); }
        const groups = [...byB.entries()].sort((a, b) => (a[1][0].rank ?? 999) - (b[1][0].rank ?? 999));
        const nShow = Math.max(8, Math.round(FP.shown / 6));
        $('#list').innerHTML = groups.slice(0, nShow).map(([bid, ps]) => `<section class="bgroup"><div class="bg-h"><span class="rk">${ps[0].rank ?? ''}</span><a href="#/builder/${esc(bid)}/org"><b>${esc(ps[0].builder_name)}</b></a><span class="muted">${ps.length} regional head${ps.length === 1 ? '' : 's'}${ps.filter((p) => vague(p.geography)).length ? ` · ${ps.filter((p) => vague(p.geography)).length} with territory not public` : ''}</span></div><div class="pgrid wide">${ps.filter((p) => !vague(p.geography)).map((p) => pcard(p, { covers: true, map: true, notag: true })).join('')}${ps.filter((p) => vague(p.geography)).map((p) => pcard(p, { notag: true, cls: 'dim', nogeoNote: true })).join('')}</div></section>`).join('') + (groups.length > nShow ? `<p style="margin-top:1rem"><button class="btn ghost" id="fp-more">Show ${groups.length - nShow} more builders</button></p>` : '');
        const more = $('#fp-more'); if (more) more.addEventListener('click', () => { FP.shown += 96; render(); });
        return;
      }
      $('#list').innerHTML = `<div class="pgrid ${regional ? 'wide' : ''}">${rows.slice(0, FP.shown).map((p) => pcard(p, { builder: true, covers: true, map: regional || p.level !== 'Corporate' })).join('')}</div>${rows.length > FP.shown ? `<p style="margin-top:1rem"><button class="btn ghost" id="fp-more">Show ${Math.min(96, rows.length - FP.shown)} more</button> <span class="muted">showing ${FP.shown} of ${num(rows.length)}</span></p>` : ''}`;
      const more = $('#fp-more'); if (more) more.addEventListener('click', () => { FP.shown += 96; render(); });
    } else {
      $('#list').innerHTML = table('people', personCols(true), rows, { limit: 150, rowClass: (r) => 'c-' + r.confidence });
    }
  };
  const map = { '#fp-level': 'level', '#fp-tier': 'tier', '#fp-own': 'own', '#fp-state': 'state', '#fp-builder': 'builder', '#fp-conf': 'conf', '#fp-contact': 'contact' };
  for (const [sel, key] of Object.entries(map)) $(sel).addEventListener('change', (e) => { FP[key] = e.target.value; FP.shown = 48; render(); });
  $('#fp-q').addEventListener('input', (e) => { FP.q = e.target.value; FP.shown = 48; render(); });
  $('#fp-clear').addEventListener('click', () => { Object.assign(FP, { region: '', q: '', level: '', tier: '', own: '', state: '', builder: '', conf: '', contact: '' }); viewPeople(); });
  VIEW_SET = (name, val) => { if (name === 'pregion') { FP.region = val; FP.shown = 48; viewPeople(); } if (name === 'prole') { FP.chip = val; if (['all', 'csuite', 'finance'].includes(val)) FP.region = ''; FP.shown = 48; history.replaceState(null, '', peopleHash()); viewPeople(); } if (name === 'pmode') { FP.mode = val; viewPeople(); } };
  $('#fp-csv').addEventListener('click', () => {
    const cols = [['name', 'Name'], ['title', 'Title'], ['priority_group', 'Role group'], ['role_category', 'Role'], ['level', 'Level'], ['geography', 'Covers'], ['builder_name', 'Builder'], ['rank', 'Builder rank'], ['tier', 'Tier'], ['ownership', 'Ownership'], ['reports_to', 'Reports to'], ['reports_to_confidence', 'Reports to (how sure)'], ['email', 'Email'], ['email_confidence', 'Email (how sure; Inferred = pattern guess)'], ['phone', 'Phone'], ['in_role_since', 'In role since'], ['prior_role', 'Before'], ['confidence', 'Confidence'], ['source_title', 'Source'], ['source_url', 'Source link'], ['source_date', 'Source date'], ['retrieved', 'Retrieved'], ['note', 'Research note']];
    const rows = peopleRows();
    downloadCsv(`domain-people-${FP.chip}-${rows.length}.csv`, [...cols.map((c) => c[1]), 'Internal notes'], rows.map((p) => [...cols.map(([k]) => p[k]), noteText('person', p.person_id)]));
  });
  render();
}

// ---------- newsletter (component: newsletter.js; its routes exist only behind the gate, so the buttons stay hidden elsewhere) ----------
let NEWSLETTER = null;
import('./newsletter.js').then(async (m) => { if (await m.newsletterAvailable()) { NEWSLETTER = m; document.querySelectorAll('[data-newsletter]').forEach((b) => { b.hidden = false; }); } }).catch(() => {});
document.addEventListener('click', (e) => { const b = e.target.closest('[data-newsletter]'); if (b && NEWSLETTER) { b.focus(); NEWSLETTER.openNewsletter({ minScore: location.hash.startsWith('#/feed') ? FF.cutoff : 70 }); } }); // focus first so Escape returns to this button
const newsletterBtn = (cls, label) => `<button class="${/chip/.test(cls) ? '' : 'btn '}${cls}" data-newsletter ${NEWSLETTER ? '' : 'hidden'} title="Get the most relevant stories by email, daily or weekly">${icon('mail')} ${label}</button>`;

// ---------- News feed ----------
const FF = { interval: 'week', cutoff: 70, cat: '', per: 10, shown: 3, more: {}, pinned: new Set(), notice: null };
const aboveIds = () => new Set(rankFeed(D.feed.articles, VOTES).filter((a) => (!FF.cat || a.category === FF.cat) && a.adj.adjusted >= FF.cutoff).map((a) => a.id));
let FEED_RENDER = null;
function storyHtml(a) {
  const adj = a.adj, v = VOTES[a.id] || {};
  const parts = adj.parts.map((p) => `${p.kind} "${p.kind === 'builder' ? (builderById(p.value)?.name || p.value) : p.value}" ${p.weight > 0 ? '+' : ''}${p.weight}`);
  const moved = adj.delta !== 0 || adj.direct !== 0 || adj.learned !== 0;
  const subs = Object.entries(SUB_LABELS).map(([k, [label, max]]) => { const val = Number(a.subscores?.[k]) || 0; return `<span>${esc(label)}</span><span class="t"><i style="width:${Math.min(100, (100 * val) / max)}%"></i></span><span>${val} / ${max}</span>`; }).join('');
  const below = adj.adjusted < FF.cutoff;
  return `<article class="story ${v.vote ? 'voted' : ''} ${below ? 'below' : ''}" id="st-${esc(a.id)}">
    <div class="sc">${scoreBadge(adj.adjusted)}<div class="adj" title="${esc([adj.direct ? `your vote on this story ${adj.direct > 0 ? '+' : ''}${adj.direct}` : '', ...parts].filter(Boolean).join('; '))}">${moved ? `base ${adj.base}<br><b>your votes ${adj.delta >= 0 ? '+' : ''}${adj.delta}</b>` : ''}</div></div>
    <div class="body">
      <div class="why hl">${ext(a.url, a.title)}</div>
      ${a.summary ? `<div class="fact">${esc(humanDates(a.summary))}</div>` : ''}
      <div class="meta"><span>${esc(a.publisher || host(a.url))}</span><span>${esc(fmtDate(a.published))}</span><span>${esc(a.category || '')}</span></div>
      <div class="tags">${(a.builder_ids || []).map((id) => `<a class="tag" href="#/builder/${esc(id)}">${icon('building')}${esc(builderById(id)?.name || id)}</a>`).join('')}${(a.competitors || []).map((c) => { const cp = competitorByName(c); return cp ? `<a class="tag comp" href="#/competitor/${esc(cp.competitor_id)}">${icon('target')}${esc(c)}</a>` : `<span class="tag comp">${icon('target')}${esc(c)}</span>`; }).join('')}${(a.people || []).slice(0, 3).map((n) => `<a class="tag" href="#/search/${encodeURIComponent(n)}">${icon('person')}${esc(n)}</a>`).join('')}</div>
      <details><summary>How it scored</summary>
        ${a.why_it_matters ? `<p><b>Why it scored this way:</b> ${esc(a.why_it_matters)}</p>` : ''}
        ${a.suggested_update ? `<div class="upd"><b>Suggested update to the map:</b> ${esc(a.suggested_update.text || '')}${a.suggested_update.builder_id ? ` → ${bLink(a.suggested_update.builder_id)}` : ''}</div>` : ''}
        <div class="subs">${subs}</div>
        ${adj.parts.length || adj.direct ? `<div class="muted small">Your votes: ${[adj.direct ? `this story ${adj.direct > 0 ? '+' : ''}${adj.direct}` : '', ...parts].filter(Boolean).map(esc).join(' · ')}${adj.learned !== adj.learned_uncapped ? ` (learned part capped at ±${LEARN_CAP})` : ''}</div>` : ''}
      </details>
    </div>
    <div class="votes">
      <div class="vb"><button class="up ${v.vote === 1 ? 'on' : ''}" data-vote="1" data-id="${esc(a.id)}" title="Useful: show more like this" aria-label="Thumbs up">${icon('up')}</button><button class="down ${v.vote === -1 ? 'on' : ''}" data-vote="-1" data-id="${esc(a.id)}" title="Not useful: show fewer like this" aria-label="Thumbs down">${icon('down')}</button></div>
      <input data-vnote="${esc(a.id)}" value="${esc(v.note || '')}" placeholder="Why? (optional)" aria-label="Optional note on this story">
      <span class="saved"></span>
      ${v.vote ? `<span class="vstate">You voted this ${v.vote > 0 ? 'up' : 'down'}${below ? `; it now scores under ${FF.cutoff}` : ''}. <button class="linkbtn" data-undo="${esc(a.id)}">Undo</button></span>` : ''}
    </div>
  </article>`;
}
const feedHash = () => { const q = [FF.cutoff !== 70 ? `cut=${FF.cutoff}` : '', NSORT !== 'rel' ? `sort=${NSORT}` : '', FF.interval !== 'week' ? `int=${FF.interval}` : '', FF.cat ? `topic=${encodeURIComponent(FF.cat)}` : ''].filter(Boolean).join('&'); return '#/feed' + (q ? '?' + q : ''); };
function viewFeed(focusId, query) {
  if (query) { const q = new URLSearchParams(query); if (q.has('cut')) FF.cutoff = Math.max(0, Math.min(100, Number(q.get('cut')) || 0)); if (q.has('sort')) NSORT = q.get('sort') === 'new' ? 'new' : 'rel'; if (q.has('int')) FF.interval = q.get('int') === 'day' ? 'day' : 'week'; if (q.has('topic')) FF.cat = q.get('topic'); }
  const cats = uniq(D.feed.articles.map((a) => a.category)).sort();
  const nVotes = Object.values(VOTES).filter((v) => v.vote).length;
  if (focusId) { const a = D.feed.articles.find((x) => x.id === focusId); if (a) { FF.pinned.add(focusId); FF.focus = focusId; FF.flat = 9999; } } else if (FF.flat > 100) FF.flat = 10;
  main.innerHTML = `<div class="bhead"><h1>News: builders, financing and land banking</h1><span class="sp"></span>${newsletterBtn('', 'Create newsletter')}</div>
  <p class="lead">Scored 0 to 100 for relevance to a land banker, best first. ${num(D.feed.articles.length)} stories read in the last ${esc(D.feed.window_days)} days.</p>
  <div class="bar-row">
    <div class="cut"><span class="muted">Show</span>${seg('cut', [['0', 'All'], ['70', '70+'], ['90', '90+']], [0, 70, 90].includes(FF.cutoff) ? FF.cutoff : '', 'big')}
      <input type="range" id="ff-slider" min="0" max="100" step="5" value="${FF.cutoff}" aria-label="Score cutoff"><b><span id="ff-cutval">${FF.cutoff}</span>+</b></div>
    <span class="grow"></span>
    ${seg('nsort', [['rel', 'Most relevant'], ['new', 'Newest']], NSORT)}
    ${seg('int', [['day', 'Daily'], ['week', 'Weekly']], FF.interval)}
    <select id="ff-cat" aria-label="Topic">${options(cats, FF.cat, 'All topics')}</select>
  </div>
  <div class="bar-row" style="margin-top:0"><span id="ff-count" class="muted"></span><span class="grow"></span><span class="muted small">90+ act today · 70 to 89 read this week · under 40 is noise</span></div>
  <details class="more"><summary>How votes change the ranking <span id="ff-tune" class="muted">${nVotes ? `(${nVotes} vote${nVotes === 1 ? '' : 's'} so far)` : ''}</span></summary><div class="callout">A thumbs up or down moves that story by ${DIRECT} points straight away, and nudges other stories that share its topic, builder, competitor or publisher (by ${LEARN_CAP} points at most). Each score shows its working: "base 72, your votes +8". Votes and notes are saved and used to tune the scoring at the next refresh. <a href="/api/tuning-examples?download=1">Download the tuning examples</a><div id="ff-weights"></div></div></details>
  <div id="list"></div>`;
  const render = () => {
    const ranked = rankFeed(D.feed.articles, VOTES).filter((a) => !FF.cat || a.category === FF.cat);
    const above = ranked.filter((a) => a.adj.adjusted >= FF.cutoff || FF.pinned.has(a.id));
    const keyOf = (a) => (FF.interval === 'day' ? (a.published || 'undated') : weekStart(a.published || 'undated'));
    const groups = new Map();
    for (const a of above) { const k = keyOf(a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
    const keys = [...groups.keys()].sort().reverse();
    $('#ff-count').textContent = FF.cutoff <= 0 ? `All ${num(ranked.length)} stories` : `${above.length} of ${num(ranked.length)} stories score ${FF.cutoff}+`;
    const intSeg = document.querySelector('[data-seg="int"]')?.parentElement; if (intSeg) { intSeg.classList.toggle('dim', NSORT === 'rel'); intSeg.title = NSORT === 'rel' ? 'Most relevant is one list, best first. Choose Newest to group by day or week.' : ''; }
    if (!FF.focus && location.hash.startsWith('#/feed')) history.replaceState(null, '', feedHash());
    $('#ff-cutval').textContent = FF.cutoff;
    const w = learnedWeights(D.feed.articles, VOTES).slice(0, 6);
    $('#ff-weights').innerHTML = w.length ? `<br>Learned so far: ${w.map((x) => `${esc(x.kind)} "${esc(x.kind === 'builder' ? (builderById(x.value)?.name || x.value) : x.value)}" ${x.weight > 0 ? '+' : ''}${x.weight}`).join(' · ')}` : '';
    if (!D.feed.articles.length) { $('#list').innerHTML = '<div class="empty">No scored stories yet.</div>'; return; }
    const notice = FF.notice ? `<div class="callout notice" role="status">${esc(FF.notice.text)} <button class="btn ghost sm" data-undo="${esc(FF.notice.id)}">Undo</button> <button class="linkbtn" data-notice-x="1">Dismiss</button></div>` : '';
    if (NSORT === 'rel' && D.feed.articles.length) {
      // one flat list, best first, ten at a time; the date is on each card
      const flat = sortNews(above); const lim = FF.flat || 10;
      $('#list').innerHTML = notice + (flat.length ? `<div class="interval"><h2>The ${Math.min(lim, flat.length)} most relevant <small>of ${flat.length} at ${FF.cutoff}+, last ${esc(D.feed.window_days)} days</small></h2>${flat.slice(0, lim).map(storyHtml).join('')}${flat.length > lim ? `<button class="btn ghost" id="ff-flatmore">Show ${Math.min(10, flat.length - lim)} more</button>` : ''}</div>` : '<div class="empty">No stories score this high. Lower the cutoff to see more.</div>');
      return;
    }
    // show enough periods to fill the page with about ten stories
    let nPer = FF.shown, cum = 0;
    for (let i = 0; i < keys.length; i++) { cum += Math.min(FF.per, groups.get(keys[i]).length); if (cum >= 10) { nPer = Math.max(nPer, i + 1); break; } if (i === keys.length - 1) nPer = keys.length; }
    FF.shown = nPer;
    $('#list').innerHTML = notice + keys.slice(0, FF.shown).map((k) => {
      const all = sortNews(groups.get(k));
      const lim = FF.more[k] ? all.length : FF.per;
      return `<div class="interval"><h2>${FF.interval === 'day' ? esc(dayShort(k)) : 'Week of ' + esc(fmtDate(k))} <small>${all.length > lim ? `top ${lim} of ${all.length}` : `${all.length} ${all.length === 1 ? 'story' : 'stories'}`}</small></h2>${all.slice(0, lim).map(storyHtml).join('')}${all.length > lim ? `<button class="btn ghost" data-more="${esc(k)}">Show ${all.length - lim} more from this ${FF.interval}</button>` : ''}</div>`;
    }).join('') + (keys.length > FF.shown ? `<p style="margin-top:1.2rem"><button class="btn ghost" id="ff-earlier">Show earlier ${FF.interval === 'day' ? 'days' : 'weeks'} (${keys.length - FF.shown} more)</button></p>` : '') + (!keys.length ? '<div class="empty">No stories score this high. Lower the cutoff to see more.</div>' : '');
  };
  FEED_RENDER = render;
  const setCut = (c) => { FF.cutoff = c; document.querySelectorAll('[data-seg="cut"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.val) === c)); $('#ff-slider').value = c; render(); };
  VIEW_SET = (name, val) => { if (name === 'cut') { FF.notice = null; FF.pinned.clear(); setCut(Number(val)); } if (name === 'int') { FF.interval = val; FF.shown = val === 'day' ? 5 : 3; FF.more = {}; viewFeed(); } };
  $('#ff-slider').addEventListener('input', (e) => { FF.pinned.clear(); FF.notice = null; setCut(Number(e.target.value)); });
  $('#ff-cat').addEventListener('change', (e) => { FF.cat = e.target.value; FF.pinned.clear(); FF.notice = null; render(); });
  render();
  if (FF.focus) { FF.shown = 99; FF.more = new Proxy({}, { get: () => true }); render(); const el = document.getElementById('st-' + FF.focus); if (el) { el.classList.add('focus'); setTimeout(() => el.scrollIntoView({ block: 'center' }), 30); } FF.focus = null; FF.shown = 3; FF.more = {}; }
}
async function postVote(id, body) {
  const r = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).then((x) => x.json());
  if (r.votes) VOTES = r.votes;
  return r;
}
document.addEventListener('click', async (e) => {
  const vb = e.target.closest('[data-vote]');
  if (vb) {
    const id = vb.dataset.id, val = Number(vb.dataset.vote);
    const cur = VOTES[id]?.vote || 0;
    const noteEl = document.querySelector(`[data-vnote="${CSS.escape(id)}"]`);
    const before = aboveIds();
    const next = cur === val ? 0 : val;
    await postVote(id, { vote: next, note: noteEl ? noteEl.value : undefined });
    const after = aboveIds();
    const dropped = [...before].filter((x) => x !== id && !after.has(x)).length, added = [...after].filter((x) => x !== id && !before.has(x)).length;
    if (next) { FF.pinned.add(id); FF.notice = { id, text: `Thumbs ${next > 0 ? 'up' : 'down'} saved: this story moved ${next > 0 ? 'up' : 'down'} ${DIRECT} points.${dropped ? ` ${dropped} similar ${dropped === 1 ? 'story' : 'stories'} dropped below ${FF.cutoff} and ${dropped === 1 ? 'is' : 'are'} now hidden.` : ''}${added ? ` ${added} similar ${added === 1 ? 'story' : 'stories'} rose above ${FF.cutoff}.` : ''}` }; } else { FF.notice = null; }
    const n = Object.values(VOTES).filter((v) => v.vote).length;
    const t = $('#ff-tune'); if (t) t.textContent = n ? `(${n} vote${n === 1 ? '' : 's'} so far)` : '';
    if (FEED_RENDER && location.hash.startsWith('#/feed')) { FEED_RENDER(); const el = document.getElementById('st-' + id); if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'nearest' }); } }
    return;
  }
  const undo = e.target.closest('[data-undo]');
  if (undo) { await postVote(undo.dataset.undo, { vote: 0 }); FF.notice = null; FEED_RENDER && FEED_RENDER(); return; }
  if (e.target.closest('[data-notice-x]')) { FF.notice = null; FEED_RENDER && FEED_RENDER(); return; }
  const more = e.target.closest('[data-more]');
  if (more) { FF.more[more.dataset.more] = true; FEED_RENDER && FEED_RENDER(); return; }
  if (e.target.id === 'ff-earlier') { FF.shown += 4; FEED_RENDER && FEED_RENDER(); }
  if (e.target.id === 'ff-flatmore') { FF.flat = (FF.flat || 10) + 10; FEED_RENDER && FEED_RENDER(); }
});
document.addEventListener('change', async (e) => {
  const n = e.target.closest('[data-vnote]');
  if (!n) return;
  await postVote(n.dataset.vnote, { note: n.value });
  const tag = n.parentElement.querySelector('.saved'); if (tag) { tag.textContent = 'Note saved'; setTimeout(() => { tag.textContent = ''; }, 2500); }
});

// ---------- Competitors ----------
const relRows = () => D.competitors.flatMap((c) => c.builder_relationships.map((r) => { const scan = c.competitor_id === 'new-entrants' || /scan|new entrants/i.test(c.name || ''); const lead = String(r.description || '').match(/^([^:.]{3,60}):\s/); return { ...r, _c: c, _fin: scan ? (lead ? lead[1] : 'Other financier') : c.name }; }));
const TOPIC_ORDER = ['Pricing', 'Terms', 'Capital', 'Portfolio', 'Strategy', 'People', 'Other'];
const cFacts = (c) => c.facts.filter((f) => !PROCESS_RE.test(String(f.fact)));
// the one fact worth a tile for a topic: latest, Verified first, and carrying a number
function keyFact(c, topic, must) {
  const fs = cFacts(c).filter((f) => f.topic === topic && (!must || must.test(f.fact)));
  return fs.sort((a, b) => (b.confidence === 'Verified') - (a.confidence === 'Verified') || String(b.as_of || '').localeCompare(String(a.as_of || '')))[0];
}
// first dollar amount in a sentence, in $M ("$9,245.4M", "$4.5 billion", "$1.2bn")
const moneyIn = (t) => { const m = String(t || '').match(/\$\s?([\d,]+(?:\.\d+)?)\s?(million|billion|bn|B|M)?\b/); if (!m) return null; const n = Number(m[1].replace(/,/g, '')); const u = (m[2] || '').toLowerCase(); return u === 'billion' || u === 'bn' || u === 'b' ? n * 1000 : u ? n : n >= 1e6 ? n / 1e6 : null; };
const pctsIn = (t) => [...String(t || '').matchAll(/(\d+(?:\.\d+)?)%(?:\s+(?:on|for|to)\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2}))?/g)].map((m) => `${m[1]}%${m[2] ? ' ' + m[2].replace(/\s+(Master Program|Agreements|capital)$/i, '') : ''}`);
const pickFact = (c, topics, re) => cFacts(c).filter((f) => topics.includes(f.topic) && re.test(f.fact)).sort((a, b) => (b.confidence === 'Verified') - (a.confidence === 'Verified') || String(b.as_of || '').localeCompare(String(a.as_of || '')))[0];
const biggestRel = (c) => c.builder_relationships.filter((r) => r.amount_usd_m).sort((a, b) => b.amount_usd_m - a.amount_usd_m)[0];
const isDomain = (c) => /^domain/i.test(c.competitor_id);
function viewCompetitors() {
  const list = D.competitors.slice().sort((a, b) => isDomain(a) - isDomain(b) || b.builder_relationships.length - a.builder_relationships.length);
  main.innerHTML = `<h1>Competitors: who else banks land for builders</h1>
  <p class="lead">Built from public filings and releases. Open one for its pricing, terms, builder relationships, debt and people.</p>
  ${list.length ? `<div class="cgrid">${list.map((c) => { const big = biggestRel(c); const named = financedBy(c).length; return `<a class="ccard" href="#/competitor/${esc(c.competitor_id)}">${isDomain(c) ? '<div class="segtag">How Domain looks from outside</div>' : ''}<h3>${esc(String(c.name || c.competitor_id).replace(/\s*\(scan\)/, '').replace(/,? Inc\.?\s*\(.*\)$/, ''))}</h3><p>${esc(firstSentence(c.summary, 150))}</p><div class="st"><span><b>${named}</b>builders financed</span>${big ? `<span><b>${usd(big.amount_usd_m)}</b>largest public deal${big.builder_name ? `: ${esc(trunc(big.builder_name, 22))}` : ''}</span>` : ''}</div></a>`; }).join('')}</div>` : '<div class="empty">No competitor profiles yet.</div>'}
  ${D.competitors.length ? `<h2>Who finances whom</h2>${table('comprel', [
    { key: 'competitor', label: 'Financier', get: (r) => r._fin, render: (r) => `<a href="#/competitor/${esc(r._c.competitor_id)}"><b>${esc(r._fin)}</b></a>` },
    { key: 'builder', label: 'Builder', get: (r) => r.builder_name, render: (r) => (r.builder_id && builderById(r.builder_id) ? bLink(r.builder_id, r.builder_name || undefined) : esc(r.builder_name)) },
    { key: 'rank', label: 'Rank', num: true, get: (r) => builderById(r.builder_id)?.rank ?? null },
    { key: 'description', label: 'Relationship', w: 320, render: (r) => short(r.description, 140) }, { key: 'amount_usd_m', label: 'Amount', num: true, render: (r) => usd(r.amount_usd_m) }, { key: 'lots', label: 'Lots', num: true, x: true, render: (r) => num(r.lots) }, { key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) },
    { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, r._c.retrieved) },
  ], relRows(), { rowClass: (r) => 'c-' + r.confidence, limit: 25, sort: { key: 'rank', dir: 'asc' }, empty: 'No builder relationships recorded yet.' })}` : ''}`;
}
const CONF_RANK = { Verified: 0, Reported: 1, Inferred: 2 };
function financedBy(c) {
  const groups = new Map();
  for (const r of c.builder_relationships) {
    const b = r.builder_id ? builderById(r.builder_id) : null;
    const raw = String(r.builder_name || '');
    const name = b ? dname(b) : (raw.split(':')[0].replace(/\s*\([^)]*\)?.*$/, '').replace(/,? (LLC|Inc\.?|L\.P\.)$/i, '').trim() || raw);
    const label = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : (!raw.includes('/') && (raw.match(/\(([^)]*)\)\s*$/) || [])[1]) || '';
    const key = b ? b.builder_id : name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, b, name, rank: b?.rank ?? null, amount: null, date: '', confidence: 'Inferred', n: 0, rows: [] });
    const g = groups.get(key);
    g.n += 1; g.rows.push({ ...r, _name: name, _label: label });
    if (r.amount_usd_m != null && (g.amount == null || r.amount_usd_m > g.amount)) g.amount = r.amount_usd_m;
    if (String(r.date || '') > g.date) g.date = String(r.date || '');
    if ((CONF_RANK[r.confidence] ?? 3) < (CONF_RANK[g.confidence] ?? 3)) g.confidence = r.confidence;
  }
  return [...groups.values()].sort((a, b2) => (b2.amount ?? -1) - (a.amount ?? -1) || (a.rank ?? 999) - (b2.rank ?? 999));
}
let CTOPIC = '';
function viewCompetitor(id) {
  const c = D.competitors.find((x) => x.competitor_id === id);
  if (!c) { main.innerHTML = `<p>No competitor "${esc(id)}". <a href="#/competitors">Back</a>.</p>`; return; }
  const news = rankFeed(D.feed.articles.filter((a) => (a.competitors || []).some((n) => competitorByName(n)?.competitor_id === id)), VOTES);
  const facts = cFacts(c);
  const topics = TOPIC_ORDER.filter((t) => facts.some((f) => f.topic === t)).concat(uniq(facts.map((f) => f.topic)).filter((t) => !TOPIC_ORDER.includes(t)));
  if (!topics.includes(CTOPIC)) CTOPIC = topics[0] || '';
  // Numbers in large type only where the record states exactly that number; anything looser stays in the table below.
  const scan = c.competitor_id === 'new-entrants' || /scan/i.test(c.name || '');
  const notProxy = (f) => f && !/proxy|podcast|deposit/i.test(f.fact) ? f : null;
  const fPrice = scan ? null : notProxy(pickFact(c, ['Pricing'], /weighted[- ]average[^.]*yield/i));
  const fBook = scan ? null : pickFact(c, ['Portfolio', 'Capital'], /total invested capital/i);
  const fAum = scan || fBook ? null : pickFact(c, ['Portfolio', 'Capital', 'Strategy'], /assets under management|\bAUM\b/i);
  const kf = [fPrice && { label: 'Yield it earns from builders', value: pctsIn(fPrice.fact).slice(0, 2).join(' · ') || '', f: fPrice }, fBook && { label: 'Invested in land', value: moneyIn(fBook.fact) ? usd(moneyIn(fBook.fact)) : '', f: fBook }, fAum && { label: 'Assets under management', value: moneyIn(fAum.fact) ? usd(moneyIn(fAum.fact)) : '', f: fAum }].filter((x) => x && x.value);
  const big = biggestRel(c), gaps = realGaps(c.gaps);
  const fin = financedBy(c);
  const named = fin.map((g) => g.name);
  const terms = /millrose/i.test(c.competitor_id) ? D.extras.find((e) => e.id === 'millrose-pricing-and-terms') : null;
  const debtRow = terms ? terms.rows.find((r) => /cost of debt/i.test(r.item)) : null;
  const debtPct = debtRow ? (String(debtRow.lennar).match(/less about (\d+(?:\.\d+)?)%/) || [])[1] : null;
  const factsTable = () => table('cfacts', [{ key: 'fact', label: 'Fact', w: 420, render: (r) => short(r.fact, 190) }, { key: 'as_of', label: 'As of', cls: 'nowrap', render: (r) => esc(fmtD(r.as_of)) }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, c.retrieved) }], facts.filter((f) => f.topic === CTOPIC), { rowClass: (r) => 'c-' + r.confidence, sort: { key: 'as_of', dir: 'desc' }, limit: 10 });
  main.innerHTML = `<div class="crumb"><a href="#/competitors">Competitors</a> › ${esc(c.name)}</div>
  <div class="bhead"><h1>${esc(c.name)}</h1>${isDomain(c) ? '<span class="tag note">How Domain looks from outside</span>' : ''}</div>
  <p class="bsum">${short(c.summary, 210)}</p>
  <div class="glance" style="grid-template-columns:1.5fr ${Array(kf.length + (debtPct ? 1 : 0)).fill('1fr').join(' ')}">
    <div><div class="k">${icon('building')} Builders it finances</div><div class="v">${hs(String(fin.length), fin.slice(0, 6).map((g) => { const r0 = g.rows.slice().sort((a, b2) => (b2.amount_usd_m ?? -1) - (a.amount_usd_m ?? -1))[0]; return srcRow(r0, { summary: `${g.name}: ${factFirst(r0.description)}`, retrieved: c.retrieved }); }), `${fin.length} builders with a public record, largest disclosed amount first. Amounts are disclosed figures, not current balances.`)}</div><div class="s">${fin.slice(0, 4).map((g) => `${esc(g.name)}${g.amount != null ? ' ' + usd(g.amount) : ''}`).join(' · ')}${fin.length > 4 ? ` · +${fin.length - 4}` : ''}</div></div>
    ${debtPct ? `<div><div class="k">${icon('cal')} Its own cost of debt</div><div class="v">${hs(`about ${esc(debtPct)}%`, srcRow({ source_url: debtRow.source_url, confidence: debtRow.confidence, as_of: debtRow.as_of }, { summary: `An estimate, not a filed figure. Lennar: ${debtRow.lennar} Other builders: ${debtRow.others}`, retrieved: c.retrieved }))}</div><div class="s">${conf(debtRow.confidence, false)} ${debtRow.as_of ? 'as of ' + esc(fmtD(debtRow.as_of)) + ' · ' : ''}${short(`Lennar: ${debtRow.lennar} Other builders: ${debtRow.others}`, 50)}</div></div>` : ''}
    ${kf.map(({ label, value, f }) => `<div><div class="k">${esc(label)}</div><div class="v ${value.length > 14 ? 'txt' : ''}">${hs(esc(value), srcRow(f, { summary: f.fact, retrieved: c.retrieved, amount: null }))}</div><div class="s">${conf(f.confidence, false)} ${f.as_of ? 'as of ' + esc(fmtD(f.as_of)) + ' · ' : ''}${short(f.fact, 60)}</div></div>`).join('')}
  </div>
  <div class="jumps noprint"><span class="muted">Jump to</span>${[['c-rels', `Who it finances (${fin.length})`], ...(terms ? [['c-terms', 'Pricing and terms']] : []), ['c-facts', terms ? 'Everything on record' : 'Pricing, terms and capital'], ['c-debt', `Debt (${c.debt.length})`], ['c-people', `People (${c.people.length})`], ['c-news', `News (${news.length})`]].map(([i2, l]) => `<button class="chip sm" data-jump="${i2}">${l}</button>`).join('')}</div>
  <h2 id="c-rels">${icon('building')} Who it finances (${fin.length})</h2>
  ${table('cfin', [
    { key: 'name', label: 'Builder', get: (g) => g.name, render: (g) => (g.b ? `<b>${bLink(g.b.builder_id, g.name)}</b>` : `<b>${esc(g.name)}</b>`) },
    { key: 'rank', label: 'Rank', num: true, get: (g) => g.rank },
    { key: 'amount', label: 'Largest public amount', num: true, hs: (g) => ({ rows: g.rows.slice().sort((a, b2) => (b2.amount_usd_m ?? -1) - (a.amount_usd_m ?? -1)).map((r) => srcRow(r, { summary: factFirst(r.description), retrieved: c.retrieved })), head: `${g.name}: ${g.n} public record${g.n === 1 ? '' : 's'}. The figure shown is the largest disclosed amount, not a current balance.` }), get: (g) => g.amount, render: (g) => (g.amount != null ? `<b>${usd(g.amount)}</b>` : '<span class="muted">not stated</span>') },
    { key: 'date', label: 'Latest', cls: 'nowrap', get: (g) => g.date, render: (g) => esc(fmtD(g.date)) },
    { key: 'confidence', label: 'How sure', get: (g) => g.confidence, render: (g) => conf(g.confidence) },
    { key: 'what', label: 'What', w: 300, nosort: true, get: (g) => g.rows[0]._label || g.rows[0].description, render: (g) => { const r0 = g.rows.slice().sort((a, b2) => (b2.amount_usd_m ?? -1) - (a.amount_usd_m ?? -1))[0]; return `${short(r0._label ? r0._label.replace(/^./, (ch) => ch.toUpperCase()) : factFirst(r0.description), 90)}${g.n > 1 ? ` <span class="muted small">+ ${g.n - 1} more record${g.n === 2 ? '' : 's'}</span>` : ''}`; } },
  ], fin, { limit: 10, sort: { key: 'amount', dir: 'desc' }, empty: 'No builder relationships on record.' })}
  <details class="more"><summary>Show every record with its source (${c.builder_relationships.length})</summary>
  ${table('crels', [{ key: 'builder', label: 'Builder', get: (r) => r._name, render: (r) => (r.builder_id && builderById(r.builder_id) ? `<b>${bLink(r.builder_id, r._name)}</b>` : `<b>${esc(r._name)}</b>`) }, { key: 'description', label: 'Relationship', w: 340, render: (r) => short(`${r._label ? r._label.replace(/^./, (ch) => ch.toUpperCase()) + '. ' : ''}${factFirst(r.description)}`, 150) }, { key: 'amount_usd_m', label: 'Amount', num: true, render: (r) => usd(r.amount_usd_m) }, { key: 'lots', label: 'Lots', num: true, hideIfEmpty: true, render: (r) => num(r.lots) }, { key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, c.retrieved) }], fin.flatMap((g) => g.rows), { rowClass: (r) => 'c-' + r.confidence, limit: 25, sort: { key: 'amount_usd_m', dir: 'desc' } })}
  </details>
  ${terms ? `<h2 id="c-terms">${icon('bank')} Pricing and terms: Lennar versus other builders</h2>
  ${table('cterms', [
    { key: 'item', label: 'Term', hs: (r) => ({ rows: [srcRow({ source_url: r.source_url, confidence: r.confidence, as_of: r.as_of }, { summary: `Lennar: ${r.lennar}. Other builders: ${r.others}`, retrieved: c.retrieved }), ...(r.source_url_2 ? [srcRow({ source_url: r.source_url_2, confidence: r.confidence, as_of: r.as_of }, { summary: 'Second source for the same term.', retrieved: c.retrieved })] : [])] }), render: (r) => `<b>${esc(r.item)}</b>` },
    { key: 'lennar', label: 'Lennar', w: 300, render: (r) => short(r.lennar, 95) },
    { key: 'others', label: 'Other builders', w: 300, render: (r) => short(r.others, 95) },
    { key: 'as_of', label: 'As of', cls: 'nowrap', render: (r) => esc(fmtD(r.as_of)) },
    { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src({ confidence: r.confidence, source_url: r.source_url }, c.retrieved) },
    { key: 'read', label: 'How to read it', x: true, w: 280, render: (r) => `<span class="small muted">${esc(r.read || '')}</span>` },
  ], terms.rows, { rowClass: (r) => 'c-' + r.confidence, limit: 8 })}` : ''}
  <h2 id="c-facts">What is known</h2>
  <div class="chips">${chips('ctopic', topics.map((t) => [t, t === 'Other' ? 'Other' : t, facts.filter((f) => f.topic === t).length]), CTOPIC)}</div>
  <div id="cfacts-wrap">${factsTable()}</div>
  <h2 id="c-debt">${icon('cal')} Debt and capital (${c.debt.length})</h2>
  ${table('cdebt', [{ key: 'maturity', label: 'Due', sortVal: (r) => r.maturity_key || r.maturity, render: (r) => esc(dueText(r)) }, { key: 'instrument', label: 'What' }, { key: 'principal_usd_m', label: 'Amount', num: true, render: (r) => usd(r.principal_usd_m) }, { key: 'rate', label: 'Rate' }, { key: 'lenders_agent', label: 'Lenders / agent', render: (r) => esc(trunc(r.lenders_agent, 70)) }, { key: 'type', label: 'Type', x: true }, { key: 'status', label: 'Status', x: true }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, c.retrieved) }], c.debt.filter((x) => x && typeof x === 'object'), { rowClass: (r) => 'c-' + r.confidence, empty: 'No debt on record.', limit: 10 })}
  <h2 id="c-people">${icon('users')} People (${c.people.length})</h2>
  ${table('cpeople', [{ key: 'name', label: 'Name', render: (p) => `<b>${esc(p.name)}</b>` }, { key: 'title', label: 'Title' }, { key: 'role_category', label: 'Role', x: true }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, c.retrieved) }], c.people.filter((x) => x && typeof x === 'object'), { rowClass: (r) => 'c-' + r.confidence, empty: 'No people on record.', limit: 10 })}
  <h2 id="c-news">${icon('news')} In the news (${news.length})</h2>
  ${newsBlock('cnews', news, 'No stories tagged to this competitor yet.', 6)}
  ${gaps.length ? `<h2>What is not public (${gaps.length})</h2><ul class="gap-list">${gaps.slice(0, 5).map((x) => `<li>${short(x, 150)}</li>`).join('')}</ul>${gaps.length > 5 ? `<details class="more"><summary>Show all ${gaps.length}</summary><ul class="gap-list">${gaps.slice(5).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}` : ''}`;
  VIEW_SET = (name, val) => { if (name === 'ctopic') { CTOPIC = val; document.querySelectorAll('[data-chip="ctopic"]').forEach((x) => x.classList.toggle('on', x.dataset.val === val)); delete SORT.cfacts; delete SHOWALL.cfacts; $('#cfacts-wrap').innerHTML = factsTable(); } };
}

// ---------- Deals ----------
function viewMA() {
  const deals = D.ma_industry.deals || [];
  const own = D.builders.flatMap((b) => b.ma.map((m) => ({ ...m, _b: b })));
  const after = deals.filter((d) => d.after_ranking).length;
  main.innerHTML = `<h1>Deals: who bought whom</h1>
  <p class="lead">${deals.length} industry deals since 2025. ${after} came after the ${esc(D.ranking?.year || '')} ranking was published, so the list already looks different.</p>
  <h2>Industry deals (${deals.length})</h2>
  ${table('maind', [{ key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) },
    { key: 'acquirer', label: 'Buyer', render: (d) => (d.acquirer_builder_id && builderById(d.acquirer_builder_id) ? bLink(d.acquirer_builder_id, d.acquirer) : esc(d.acquirer)) },
    { key: 'target', label: 'Bought', render: (d) => (d.target_builder_id && builderById(d.target_builder_id) ? bLink(d.target_builder_id, d.target) : esc(d.target)) },
    { key: 'description', label: 'Deal', w: 320, render: (r) => short(factFirst(r.description), 150) }, { key: 'status', label: 'Status' }, { key: 'after_ranking', label: 'Timing', render: (r) => (r.after_ranking ? '<span class="tag note">After the ranking</span>' : '<span class="muted">Before</span>') },
    { key: 'map_impact', label: 'What it changes in the map', x: true, w: 260 }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, D.ma_industry.retrieved) }], deals, { sort: { key: 'date', dir: 'desc' }, rowClass: (r) => 'c-' + r.confidence, limit: 20, empty: 'No industry deals recorded yet.' })}
  <h2>Deals recorded on builder pages (${own.length})</h2>
  ${table('maown', [{ key: 'date', label: 'Date', cls: 'nowrap', render: (r) => esc(fmtD(r.date)) }, { key: 'builder', label: 'Builder', get: (m) => m._b.name, render: (m) => bLink(m._b.builder_id, m._b.name) }, { key: 'role', label: 'Role' }, { key: 'counterparty', label: 'With' }, { key: 'description', label: 'Deal', w: 320, render: (r) => short(factFirst(r.description), 150) }, { key: 'status', label: 'Status' }, { key: 'after_ranking', label: 'Timing', x: true, render: (r) => (r.after_ranking ? 'After the ranking' : 'Before') }, { key: 'map_impact', label: 'What it changes in the map', x: true, w: 260 }, { key: 'src', label: 'Source', get: (r) => r.confidence, render: (r) => src(r, r._b.retrieved) }], own, { sort: { key: 'date', dir: 'desc' }, rowClass: (r) => 'c-' + r.confidence, limit: 20, empty: 'No builder-level deals recorded yet.' })}`;
}

// ---------- Insights ----------
const ESSENTIAL = {
  'call-sheet': ['priority', 'builder', 'reason', 'person', 'title', 'contact_details', 'score'],
  'mandate-screen': ['rank', 'builder', 'tier', 'closings', 'owner', 'changed_hands', 'watch'],
  'competitor-builder-matrix': ['rank', 'builder', 'pct_optioned', 'domain', 'millrose', 'kennedy_lewis', 'tpg_ag', 'others', 'white_space'],
  'competitor-builder-links': ['rank', 'builder', 'financier', 'what', 'amount_usd_m', 'date', 'source_url'],
  'millrose-pricing-and-terms': ['item', 'lennar', 'others', 'read', 'source_url'],
  'debt-maturity-watch': ['maturity', 'months_away', 'builder', 'instrument', 'principal', 'rate', 'source_url'],
  'debt-maturity-ladder': ['rank', 'builder', 'outstanding', 'due_3y_pct', 'y2026', 'y2027', 'y2028', 'next_maturity', 'pct_optioned'],
};
function insightCell(col, row, x) {
  const v = row[col.key];
  if (v == null || v === '') return '';
  switch (col.type) {
    case 'builder_link': return builderById(v) ? `<b>${bLink(v)}</b>` : esc(v);
    case 'number': return typeof v === 'number' ? num(v) : esc(v);
    case 'pct': return typeof v === 'number' ? pct(v) : esc(v);
    case 'usd_m': return typeof v === 'number' ? usd(v) : esc(v);
    case 'confidence': return conf(v);
    case 'date': return `<span class="nowrap">${esc(fmtD(v))}</span>`;
    case 'url': return ext(v, host(v) || 'link');
    case 'person': { const bcol = x.columns.find((c) => c.type === 'builder_link'); const p = bcol ? builderById(row[bcol.key])?.people.find((q) => q.name === v) : null; return p ? pLink(p) : `<a href="#/search/${encodeURIComponent(v)}">${esc(v)}</a>`; }
    default: {
      // "Yes (Verified, up to $1,250m, 2026-10)" becomes a confidence mark and the amount; the full text is the tooltip
      const y = typeof v === 'string' && v.match(/^(Yes|Land banking|Other financing only)(?: \((Verified|Reported|Inferred)(?:, up to \$([\d,.]+)m)?(?:, ([\d-]+))?\))?$/);
      if (y) { const other = /^Other/.test(y[1]); const oy = oldYear(y[4]); return `<span class="ycell ${oy ? 'old' : ''}" title="${esc(v)}${oy ? ' (more than two years old)' : ''}">${y[2] ? conf(y[2], false) : icon('verified')} <b>${y[3] ? usd(Number(y[3].replace(/,/g, ''))) : other ? 'Loan' : y[2] === 'Inferred' ? 'Lead' : 'Yes'}</b>${other ? ' <small>not land banking</small>' : ''}${y[4] ? ` <small>source: ${esc(fmtD(y[4]))}</small>` : ''}</span>`; }
      return Array.isArray(v) ? esc(v.join(', ')) : String(v).length > 150 ? short(v, 140) : esc(humanDates(v));
    }
  }
}
// two tables that answer one question share a tab and a switch
const INSIGHT_PAIRS = [
  { ids: ['debt-maturity-watch', 'debt-maturity-ladder'], tab: 'Debt coming due', labels: ['By instrument', 'By year'] },
  { ids: ['competitor-builder-matrix', 'competitor-builder-links'], tab: 'Who banks whom', labels: ['Grid by builder', 'Every link with its source'] },
];
const MATRIX_FIRM = { domain: [/domain real estate|dw partners/i, 'Domain Real Estate Partners'], millrose: [/millrose/i, 'Millrose Properties'], kennedy_lewis: [/kennedy[\s-]*lewis/i, 'Kennedy Lewis'], tpg_ag: [/angelo[\s,]*gordon|\btpg\b|essential housing/i, 'TPG Angelo Gordon'] };
// every public record behind one cell of the who-banks-whom grid, largest first
function matrixSources(row, key) {
  const [rx, firm] = MATRIX_FIRM[key];
  const b = builderById(row.builder);
  const links = (D.extras.find((e) => e.id === 'competitor-builder-links')?.rows || []).filter((l) => l.builder === row.builder && rx.test(l.financier || ''));
  let rows = links.slice().sort((x, y) => (y.amount_usd_m ?? -1) - (x.amount_usd_m ?? -1) || String(y.date || '').localeCompare(String(x.date || ''))).map((l) => srcRow(l, { summary: l.what }));
  if (!rows.length && b) rows = allLinks(b).filter((l) => rx.test(l.firm)).map((l) => srcRow(l, { summary: l.what }));
  if (!rows.length) rows = [srcRow({ confidence: '', source_url: '' }, { summary: String(row[key] || '') })];
  const old = rows[0] && oldYear(rows[0].date);
  return { rows, head: `${b ? dname(b) : row.builder} and ${firm}: ${rows.length} public record${rows.length === 1 ? '' : 's'}. The figure in the grid is the largest disclosed amount${old ? ` (from ${old}, so historical)` : ''}, not a current balance; the date is that source's date.` };
}
function viewInsights(id) {
  if (!D.extras.length) { main.innerHTML = '<h1>Insights</h1><div class="empty">No insight tables yet.</div>'; return; }
  const x = D.extras.find((e) => e.id === id) || D.extras.find((e) => e.id === 'call-sheet') || D.extras[0];
  const numTypes = ['number', 'pct', 'usd_m'];
  const ess = ESSENTIAL[x.id] || x.columns.slice(0, 7).map((c) => c.key);
  const shortTitle = (t) => String(t).split(':')[0];
  const confCol = x.columns.find((c) => c.type === 'confidence' && c.key === 'confidence');
  main.innerHTML = `<h1>Insights</h1>
  <div class="tabs">${D.extras.filter((e) => !INSIGHT_PAIRS.some((g) => g.ids[1] === e.id && D.extras.some((y) => y.id === g.ids[0]))).map((e) => { const g = INSIGHT_PAIRS.find((q) => q.ids[0] === e.id && D.extras.some((y) => y.id === q.ids[1])); const on = e.id === x.id || (g && g.ids.includes(x.id)); return `<a href="#/insights/${esc(e.id)}" class="${on ? 'on' : ''}" title="${esc(e.title)}">${esc(g ? g.tab : shortTitle(e.title))}</a>`; }).join('')}</div>
  ${(() => { const g = INSIGHT_PAIRS.find((q) => q.ids.includes(x.id) && q.ids.every((i2) => D.extras.some((y) => y.id === i2))); return g ? `<div class="bar-row" style="margin:.2rem 0 .4rem"><span class="muted">Show</span><span class="seg">${g.ids.map((i2, k) => `<a class="segl ${i2 === x.id ? 'on' : ''}" href="#/insights/${esc(i2)}">${esc(g.labels[k])}</a>`).join('')}</span></div>` : ''; })()}
  <h2 style="margin-top:.4rem">${esc(x.title)} ${x.is_estimate ? '<span class="tag note">Estimate</span>' : ''}</h2>
  ${x.subtitle ? `<p class="takeaway">${esc(humanDates(x.subtitle))}</p>` : ''}
  ${x.method ? `<details class="more"><summary>How this was worked out${x.is_estimate ? ' (an estimate; the inputs are columns in the full table)' : ''}</summary><div class="callout">${esc(humanDates(x.method))}${x.generated ? ` <span class="muted">Generated ${esc(String(x.generated).slice(0, 16).replace('T', ' '))}.</span>` : ''}</div></details>` : ''}
  ${table('ins-' + x.id, x.columns.map((c) => ({ key: c.key === 'confidence' ? 'conf_' : c.key, label: String(c.label || c.key).replace(/\s*\(\$M\)/, '').replace(/ %$/, ''), num: numTypes.includes(c.type), x: !ess.includes(c.key), w: x.id === 'competitor-builder-matrix' ? (c.key === 'others' ? 130 : 0) : c.type === 'text' && x.rows.some((r) => String(r[c.key] || '').length > 80) ? 260 : 0, hs: x.id === 'competitor-builder-matrix' && MATRIX_FIRM[c.key] ? (r) => (r[c.key] ? matrixSources(r, c.key) : null) : !x.columns.some((k) => k.key === 'source_url') ? undefined : (c.type === 'date' && c.key !== 'as_of') || (x.id === 'call-sheet' && c.key === 'reason') || (x.id === 'millrose-pricing-and-terms' && c.key === 'item') ? (r) => (r.source_url ? srcRow(r, { summary: x.id === 'millrose-pricing-and-terms' ? `Lennar: ${r.lennar}. Other builders: ${r.others}` : undefined }) : null) : undefined,
    get: (r) => (c.type === 'builder_link' ? (builderById(r[c.key])?.name || r[c.key]) : r[c.key]), render: (r) => insightCell(c, r, x) })), x.rows, { limit: 30, sort: x.columns.some((c) => c.key === 'score') ? { key: 'score', dir: 'desc' } : undefined, rowClass: (r) => (confCol ? 'c-' + r.confidence : '') })}`;
}

// ---------- Coverage ----------
async function viewCoverage() {
  const cov = await fetch('/api/coverage').then((r) => r.json());
  const T = cov.totals || {};
  const ppb = T.people_per_builder || {};
  const pc = T.people_confidence || {}, fc = T.all_facts_confidence || {};
  main.innerHTML = `<h1>Coverage: how far the map got</h1>
  <p class="lead">Counted from the data${cov.generated ? ` at ${esc(new Date(cov.generated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}` : ''}. What is not public is recorded as a gap, never guessed.</p>
  <div class="tiles">
    ${tile('Builders covered', `${T.builders_covered ?? 0} <small>of ${T.builders_in_ranking || 0}</small>`, `${T.builders_with_people ?? 0} with people · ${T.builders_with_financing ?? 0} with financing`, '#/builders')}
    ${tile('People mapped', num(T.people_mapped ?? 0), `${pct(pc.verified_pct ?? 0)} Verified from a primary source`, '#/people')}
    ${tile('Regional heads', num(T.regional_heads_found ?? 0), `at ${T.builders_with_regional_heads ?? 0} builders · ${T.regions_with_named_leader ?? 0} of ${T.regions_listed ?? 0} listed regions have a named leader`, '#/people/regional')}
    ${tile('Facts with a source', num(fc.total ?? 0), `${pct(fc.verified_pct ?? 0)} Verified · ${pct(fc.reported_pct ?? 0)} Reported · ${pct(fc.inferred_pct ?? 0)} Inferred`)}
  </div>
  <div class="tiles sm">
    ${tile('Land heads', T.land_heads_found ?? 0, `builders with a corporate land head; ${T.builders_with_any_land_contact ?? 0} with any land contact`)}
    ${tile('Finance heads', T.finance_heads_found ?? 0, 'builders with a CFO, treasurer or capital-markets head')}
    ${tile('Named land banker', T.builders_with_named_land_banker ?? 0, `builders · ${T.land_banking_relationships ?? 0} relationships on record`)}
    ${tile('Lots split known', T.builders_with_lots_split ?? 0, 'builders with owned versus optioned lots')}
    ${tile('Debt instruments', num(T.debt_instruments ?? 0), `at ${T.builders_with_debt ?? 0} builders`)}
    ${tile('Deals', (T.ma_deals_builder ?? 0) + (T.ma_deals_industry ?? 0), `${T.ma_deals_industry ?? 0} industry-wide`)}
    ${tile('Stories scored', num(T.feed_articles ?? 0), `${T.feed_articles_70_plus ?? 0} at 70+ · ${T.feed_articles_90_plus ?? 0} at 90+`)}
    ${tile('People per public builder', ppb.Public?.avg_people_per_builder ?? 0, `private ${ppb.Private?.avg_people_per_builder ?? 0} · subsidiaries ${ppb.Subsidiary?.avg_people_per_builder ?? 0}`)}
    ${tile('Sources', num(T.unique_sources ?? 0), `${num(T.gaps_recorded ?? 0)} "not public" gaps recorded`)}
    ${tile('Still in progress', T.builders_in_progress ?? 0, `builders · ${T.rows_left_out_by_validation ?? 0} rows held back`)}
  </div>
  <h2>Builder by builder</h2>
  ${table('covb', [
    { key: 'rank', label: 'Rank', num: true }, { key: 'name', label: 'Builder', render: (b) => `<b>${bLink(b.builder_id, b.name)}</b>` }, { key: 'ownership_group', label: 'Ownership' },
    { key: 'people', label: 'People', num: true }, { key: 'regional_heads', label: 'Regional heads', num: true },
    { key: 'land_head_found', label: 'Land head', render: (b) => (b.land_head_found ? 'Yes' : '<span class="muted">no</span>') }, { key: 'finance_head_found', label: 'Finance head', render: (b) => (b.finance_head_found ? 'Yes' : '<span class="muted">no</span>') },
    { key: 'land_bankers', label: 'Land bankers', num: true }, { key: 'debt_instruments', label: 'Debt', num: true }, { key: 'gaps', label: 'Gaps', num: true },
    { key: 'status', label: 'Status', x: true }, { key: 'verified', label: 'Verified', num: true, x: true }, { key: 'reported', label: 'Reported', num: true, x: true }, { key: 'inferred', label: 'Inferred', num: true, x: true },
    { key: 'land', label: 'Land', num: true, x: true }, { key: 'finance', label: 'Finance', num: true, x: true }, { key: 'csuite', label: 'C-suite', num: true, x: true }, { key: 'regional', label: 'Regional', num: true, x: true }, { key: 'division', label: 'Division', num: true, x: true },
    { key: 'regions_named', label: 'Regions with named leader', x: true, get: (b) => (b.regions_listed ? b.regions_with_named_leader / b.regions_listed : null), render: (b) => (b.regions_listed ? `${b.regions_with_named_leader} / ${b.regions_listed}` : '') },
    { key: 'lots_split_known', label: 'Lots split', x: true, render: (b) => (b.lots_split_known ? 'Yes' : '') }, { key: 'ma', label: 'Deals', num: true, x: true }, { key: 'news', label: 'News', num: true, x: true },
  ], cov.builders || [], { sort: { key: 'rank', dir: 'asc' }, limit: 25 })}
  ${(cov.validation_issues || []).length ? `<h2>Research files still being written (${cov.validation_issues.length})</h2>${table('covi', [{ key: 'file', label: 'File' }, { key: 'status', label: 'What the build did' }, { key: 'errors', label: 'First errors', render: (i) => esc((i.errors || []).slice(0, 3).join(' | ')) }, { key: 'rows_dropped', label: 'Rows left out', num: true }], cov.validation_issues)}` : ''}`;
}

function viewSearch(q) {
  const r = searchAll(q);
  $('#q').value = q;
  main.innerHTML = `<h1>Results for "${esc(q)}"</h1><p class="lead">${r.builders.length} builder${r.builders.length === 1 ? '' : 's'} · ${r.people.length} ${r.people.length === 1 ? 'person' : 'people'} · ${r.competitors.length} competitor${r.competitors.length === 1 ? '' : 's'}</p>
  ${r.builders.length ? `<h2>${icon('building')} Builders</h2>${r.builders.slice(0, 12).map(builderRow).join('')}` : ''}
  ${r.competitors.length ? `<h2>${icon('target')} Competitors</h2><div class="chips">${r.competitors.map((c) => `<a class="chip" href="#/competitor/${esc(c.competitor_id)}">${esc(c.name)}</a>`).join('')}</div>` : ''}
  ${r.people.length ? `<h2>${icon('users')} People</h2><div class="pgrid">${r.people.slice(0, 60).map((p) => pcard(p, { builder: true, covers: true })).join('')}</div>${r.people.length > 60 ? `<p class="muted">Showing 60 of ${r.people.length}. Add a word to narrow it down, or use <a href="#/people">People</a>.</p>` : ''}` : ''}
  ${!r.builders.length && !r.people.length && !r.competitors.length ? '<div class="empty">Nothing matched. Try a surname, a title such as "land", or a state such as "TX".</div>' : ''}`;
}

$('#rebuild').addEventListener('click', async (e) => {
  const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Refreshing…';
  try {
    const r = await fetch('/api/rebuild', { method: 'POST' }).then((x) => x.json());
    if (r.ok) { await load(); await route(); btn.textContent = 'Refresh data'; } else { btn.textContent = 'Refresh failed'; btn.title = r.error || ''; }
  } catch { btn.textContent = 'Refresh failed'; }
  btn.disabled = false;
});

// ---------- view modules (contract: MODULES.md) ----------
// A module registered in views/index.js replaces the built-in view for that route. Built-ins stay as the fallback.
let OVERRIDES = {};
import('./views/index.js').then((m) => { OVERRIDES = m.default || {}; if (Object.keys(OVERRIDES).length) route(); }).catch(() => {});
const UI = { esc, num, usd, pct, trunc, fmtD, fmtDate, dueText, firstSentence, short, conf, src, ext, tile, chips, seg, scoreBadge, tierTag, table, pcard, pLink, bLink, dname, ownerLine, newsBlock, downloadCsv, realGaps, clean };
const viewCtx = (arg, arg2, query) => ({
  domain: D, votes: VOTES, notes: NOTES, arg, arg2, query,
  api: (path, opts) => fetch(path, opts).then((r) => r.json()),
  navigate: (hash) => { location.hash = hash; },
  openPerson: (id) => openDrawer(typeof id === 'string' ? id : id?.person_id),
  openBuilder: (id, tab) => { location.hash = `#/builder/${typeof id === 'string' ? id : id?.builder_id}${tab ? '/' + tab : ''}`; },
  onControl: (fn) => { VIEW_SET = fn; }, // chips() and seg() clicks arrive here as fn(name, value, element)
  ui: UI, icon, usMap, rankFeed, orgModel, statesIn,
});

// ---------- router ----------
const hideMapTip = () => document.querySelectorAll('.usmap-tip').forEach((t) => t.classList.remove('show'));
document.addEventListener('click', hideMapTip, true);
async function route() {
  if (!D) return;
  closeDrawer(); hideMapTip(); hideSrc(); SRC_REG.length = 0;
  VIEW_SET = null;
  const [hp, hq = ''] = (location.hash.replace(/^#\/?/, '') || 'home').split('?');
  const h = hp;
  const [view, ...rest] = h.split('/');
  const arg = decodeURIComponent(rest[0] || '');
  const arg2 = decodeURIComponent(rest[1] || '');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (view === 'builder' ? 'builders' : view === 'competitor' ? 'competitors' : view)));
  $('#topsearch').style.visibility = view === 'home' ? 'hidden' : '';
  if (OVERRIDES[view]) {
    try { main.innerHTML = ''; await OVERRIDES[view](main, viewCtx(arg, arg2, hq)); return; }
    catch (err) { console.error(`view module "${view}" failed; showing the built-in view`, err); }
  }
  try {
    if (view === 'home') viewHome();
    else if (view === 'builders') viewBuilders(hq);
    else if (view === 'states') await viewStates(arg);
    else if (view === 'builder') viewBuilder(arg, arg2);
    else if (view === 'people') viewPeople(arg, hq);
    else if (view === 'feed') viewFeed(arg, hq);
    else if (view === 'competitors') viewCompetitors();
    else if (view === 'competitor') viewCompetitor(arg);
    else if (view === 'ma') viewMA();
    else if (view === 'insights') viewInsights(arg);
    else if (view === 'coverage') await viewCoverage();
    else if (view === 'search') viewSearch(decodeURIComponent(rest.join('/')));
    else viewHome();
  } catch (err) { console.error(err); main.innerHTML = `<p>Something went wrong showing this view: ${esc(err.message)}. <a href="#/home">Back to the start</a>.</p>`; }
}
// the legend's marks come from the same icon set
document.querySelectorAll('#legend .cf').forEach((el) => { const c = ['Verified', 'Reported', 'Inferred'].find((x) => el.classList.contains(x)); const i = el.querySelector('i'); if (i) i.outerHTML = icon(CF_ICON[c]); });
document.querySelectorAll('#nav a').forEach((a) => { const ic = { home: 'home', states: 'map', builders: 'building', people: 'users', feed: 'news', competitors: 'target', ma: 'merge', insights: 'chart' }[a.dataset.tab]; a.innerHTML = icon(ic) + a.textContent; });
window.addEventListener('hashchange', async () => { await reloadIfRebuilt(); await route(); window.scrollTo(0, 0); });
load().then(route).catch((err) => { main.innerHTML = `<p>Could not load data: ${esc(err.message)}. Run <code>npm run build</code> in the project folder, then refresh.</p>`; });
