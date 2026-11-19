/* stateview.js: the "Browse by state" view. One page, top to bottom: a large clickable US map, then the
 * content for the selected state (or the national view when no state is chosen). Styles are in usmap.css.
 *
 * Interface
 *   renderStateBrowser(container, domain, {
 *     onBuilder(builder, event), onPerson(person, builder, event),   // clicks on a builder or a person
 *     initialState,              // 'TX' to open on a state (deep link); omit for the national view
 *     onStateChange(code|null),  // fires whenever the selection changes, so the host can keep the URL in sync
 *     initialMeasure = 'builders', onMeasureChange(key),
 *     stickyTop,                 // px offset for the sticky bar; default: the height of a sticky `.top` header if present
 *   } = {})  -> { select(code|null), setMeasure(key), state, measure, destroy() }
 *
 * Measures (what the map shading and the "Top states" ranking show)
 *   builders   Builders active: top-100 builders whose footprint (profile.states) includes the state.
 *   top25      Top 25 active: the same, counting only builders in the Top 25 tier.
 *   openfield  No land banker named: builders active there flagged in the "competitor-builder-matrix" extra
 *              (no land banker publicly named AND 50%+ of lots optioned, or land-light, or uses a banker it does not name).
 *   people     People mapped: regional heads, division leaders and land leaders whose own territory covers the state
 *              (company-wide land heads are not counted here; they are offered separately under "Who to call").
 */
import { usMap, usMapScale, buildStateIndex, builderStates, openFieldBuilderIds, STATE_NAMES, STATE_CODES } from './usmap.js';
import { iconHTML } from './icons.js';

const MEASURES = [
  { key: 'builders', label: 'Builders active', icon: 'builder', unit: ['builder', 'builders'], def: 'How many of the top 100 builders build in each state.' },
  { key: 'top25', label: 'Top 25 active', icon: 'star', unit: ['top-25 builder', 'top-25 builders'], def: 'How many of the 25 largest builders build in each state.' },
  { key: 'openfield', label: 'No land banker named', icon: 'landbanker', unit: ['builder with no land banker named', 'builders with no land banker named'], def: 'Option-heavy or land-light builders with no land banker publicly named.' },
  { key: 'people', label: 'People mapped', icon: 'person', unit: ['leader', 'leaders'], def: 'Regional heads, division leaders and land leaders whose territory covers the state.' },
];
const GROUP_LABEL = { land: 'Land leader', regional: 'Regional head', division: 'Division leader' };
const GROUP_ICON = { land: 'land', regional: 'regional', division: 'division' };
const CONF = { Verified: 0, Reported: 1, Inferred: 2 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
const shortFirm = (s) => String(s).replace(/\s+(Real Estate Partners|Properties|Partners|Group|Real Estate Capital|Capital)$/i, '');
const dot = (conf) => `<i class="sv-dot ${esc(conf || 'Inferred')}" role="img" aria-label="${esc(conf || 'Inferred')}" title="${esc(conf || 'Inferred')}"></i>`;

export function renderStateBrowser(container, domain, { onBuilder, onPerson, initialState, onStateChange, initialMeasure = 'builders', onMeasureChange, stickyTop } = {}) {
  const index = buildStateIndex(domain);
  const total = (domain.builders || []).length;
  const openIds = openFieldBuilderIds(domain);
  const people = new Map(); // person key -> { person, builder }
  const builders = new Map();
  for (const b of domain.builders || []) builders.set(String(b.builder_id), b);
  const pkey = (it) => it.person.person_id || `${it.builder.builder_id}--${it.person.name}`;
  for (const e of Object.values(index)) for (const it of e.people) people.set(pkey(it), it);

  const local = (e) => e.people.filter((x) => !x.companyWide);
  const valueOf = { builders: (e) => e.builders.length, top25: (e) => e.top25.length, openfield: (e) => e.openField.length, people: (e) => local(e).length };
  const valuesFor = (key) => Object.fromEntries(STATE_CODES.map((c) => [c, valueOf[key](index[c])]));

  const S = { state: STATE_NAMES[initialState] ? initialState : null, measure: MEASURES.some((m) => m.key === initialMeasure) ? initialMeasure : 'builders', sort: { key: 'rank', dir: 1 }, role: 'all', more: {} };
  const measure = () => MEASURES.find((m) => m.key === S.measure);

  /* ---------------------------------------------------------- skeleton */
  container.innerHTML = `
  <section class="sv" aria-label="Browse by state">
    <div class="sv-mapcard">
      <div class="sv-maptop">
        <div class="sv-seg" role="group" aria-label="What the map shows" data-seg></div>
        <p class="sv-def" data-def></p>
      </div>
      <div class="sv-mapwrap"><div data-map></div><div class="sv-legend" data-legend aria-hidden="true"></div></div>
    </div>
    <div class="sv-sentinel" data-sentinel></div>
    <div class="sv-bar" data-bar>
      <div class="sv-bar-title"><h2 data-title tabindex="-1"></h2><span class="sv-bar-sub" data-sub></span></div>
      <div class="sv-bar-actions">
        <div class="sv-strip sv-not-stuck" data-strip hidden></div>
        <div class="sv-seg sv-seg-sm sv-when-stuck" role="group" aria-label="What the map shows" data-seg></div>
        <button type="button" class="sv-btn sv-when-stuck" data-back>${iconHTML('expand', { size: 16 })}<span>Back to map</span></button>
        <button type="button" class="sv-btn" data-clear hidden>${iconHTML('close', { size: 16 })}<span>All states</span></button>
      </div>
    </div>
    <div class="sv-body" data-body aria-live="polite"></div>
  </section>`;
  const root = container.querySelector('.sv');
  const $ = (sel) => root.querySelector(sel);
  const mapWrap = $('[data-map]'), body = $('[data-body]'), bar = $('[data-bar]'), strip = $('[data-strip]');

  // sticky offset: under the host's sticky header when there is one
  let top = Number.isFinite(stickyTop) ? stickyTop : 0;
  if (!Number.isFinite(stickyTop)) { const h = document.querySelector('.top'); if (h && /sticky|fixed/.test(getComputedStyle(h).position)) top = h.offsetHeight; }
  root.style.setProperty('--sv-top', `${top}px`);

  /* --------------------------------------------------------------- map */
  const tipNode = (code) => {
    const e = index[code]; const d = document.createElement('div'); d.className = 'sv-tip';
    d.innerHTML = `<b>${esc(e.name)}</b>${MEASURES.map((m) => `<span class="${m.key === S.measure ? 'cur' : ''}"><em>${esc(m.label)}</em><i>${valueOf[m.key](e)}</i></span>`).join('')}`;
    return d;
  };
  const mapSize = () => { const h = Math.max(300, Math.min(600, Math.round(window.innerHeight * 0.41))); const w = Math.min(mapWrap.clientWidth || 900, Math.round((h * 975) / 610)); return Math.max(420, w); };
  let map = null;
  const drawMap = () => {
    map = usMap({ size: mapSize(), interactive: true, labels: true, steps: 5, values: valuesFor(S.measure), selected: S.state, title: `${measure().label} by state`, tooltip: tipNode, onState: (code) => select(code === S.state ? S.state : code) });
    mapWrap.replaceChildren(map);
  };
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (map && Math.abs(Number(map.getAttribute('width')) - mapSize()) > 24) drawMap(); }, 150); };
  window.addEventListener('resize', onResize);

  /* ---------------------------------------------------------- measures */
  const ranked = (key = S.measure) => STATE_CODES.map((c) => ({ code: c, name: STATE_NAMES[c], v: valueOf[key](index[c]) })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));
  const drawMeasureChrome = () => {
    for (const seg of root.querySelectorAll('[data-seg]')) seg.innerHTML = MEASURES.map((m) => `<button type="button" data-measure="${m.key}" aria-pressed="${m.key === S.measure}" class="${m.key === S.measure ? 'on' : ''}" title="${esc(m.def)}">${iconHTML(m.icon, { size: 16 })}<span>${esc(m.label)}</span></button>`).join('');
    $('[data-def]').textContent = measure().def;
    const sc = usMapScale(valuesFor(S.measure), 5);
    $('[data-legend]').innerHTML = `<b>${esc(measure().label)}</b><span class="sv-lg"><i class="usm-sw v0"></i>None</span>${sc.ranges.map((r) => `<span class="sv-lg"><i class="usm-sw v${r.step}"></i>${esc(r.label)}</span>`).join('')}`;
  };

  /* ------------------------------------------------------------ pieces */
  const personBtn = (it, cls = '') => `<button type="button" class="sv-plink ${cls}" data-person="${esc(pkey(it))}" title="${esc(it.person.title || '')}">${esc(it.person.name)}</button>`;

  // Who runs the state for a builder: the regional head with the tightest territory, else a division leader.
  const runsFor = (e, b) => {
    const mine = local(e).filter((x) => x.builder === b);
    const byConf = (a, c) => (CONF[a.person.confidence] ?? 3) - (CONF[c.person.confidence] ?? 3) || a.states.length - c.states.length;
    const reg = mine.filter((x) => x.group === 'regional').sort((a, c) => a.states.length - c.states.length || byConf(a, c));
    const div = mine.filter((x) => x.group === 'division').sort(byConf);
    const land = mine.filter((x) => x.group === 'land').sort(byConf);
    const cw = e.people.filter((x) => x.builder === b && x.companyWide);
    return { reg, div, land, cw, runs: reg.length ? reg : div, runsKind: reg.length ? 'Regional head' : div.length ? 'Division leader' : '' };
  };
  const cellPeople = (list, kind) => {
    if (!list.length) return '<span class="sv-none">Not public</span>';
    const it = list[0];
    return `<span class="sv-cellp">${dot(it.person.confidence)}<span>${personBtn(it)}${list.length > 1 ? ` <span class="sv-more-n" title="${esc(list.slice(1).map((x) => x.person.name).join(', '))}">+${list.length - 1}</span>` : ''}${kind ? `<small>${esc(kind)}</small>` : ''}</span></span>`;
  };
  const bankersCell = (b) => {
    const dv = b.derived || {}; const lb = dv.land_bankers || [];
    const yr = (n) => { const l = (dv.land_banker_links || []).find((x) => x.firm === n); const m = String(l?.date || '').match(/^(\d{4})(?:-(\d{2}))?/); if (!m) return ''; const t = new Date(); return (t.getFullYear() - Number(m[1])) * 12 + (t.getMonth() + 1 - Number(m[2] || 12)) > 24 ? m[1] : ''; };
    const nfc = dv.named_firm_confidence || {}; const how = (n) => { const l = (dv.land_banker_links || []).find((x) => x.firm === n); return (l && l.confidence) || nfc[n] || ''; };
    if (lb.length) return `<span title="${esc((dv.land_bankers_display || lb).join(', '))}">${lb.slice(0, 2).map((n) => `${esc(shortFirm(n))}${yr(n) ? ` · ${yr(n)}` : ''}${how(n) && how(n) !== 'Verified' ? ` <small class="sv-none">(${esc(how(n))})</small>` : ''}`).join(', ')}${lb.length > 2 ? ` <span class="sv-more-n">+${lb.length - 2}</span>` : ''}</span>`;
    const open = openIds.has(b.builder_id) ? '<span class="sv-flag" title="Leans on optioned lots or runs land-light, and no land banker is publicly named">No land banker named</span>' : '';
    return `${open}<span class="sv-none">${dv.land_bankers_unnamed ? 'Uses one, not named' : open ? '' : 'Not public'}</span>`;
  };
  const pctCell = (b) => { const p = b.derived?.pct_optioned; return p == null ? '<span class="sv-none">Not public</span>' : `<span class="sv-pct"><b>${Math.round(p)}%</b><span class="sv-pbar"><i style="width:${Math.max(2, Math.min(100, p))}%"></i></span></span>`; };

  // each sort: [value (null = missing, always last), first-click direction]
  const SORTS = {
    rank: [(r) => r.b.rank ?? null, 1],
    builder: [(r) => String(r.b.name).toLowerCase(), 1],
    runs: [(r) => r.who.runs[0]?.person.name.toLowerCase() ?? null, 1],
    land: [(r) => (r.who.land[0] || r.who.cw[0])?.person.name.toLowerCase() ?? null, 1],
    bankers: [(r) => ((r.b.derived?.land_bankers || []).length * 2 + (r.b.derived?.land_bankers_unnamed ? 1 : 0)) || null, -1],
    pct: [(r) => r.b.derived?.pct_optioned ?? null, -1],
  };
  const moreBtn = (key, shown, all, noun) => (all > shown || S.more[key] ? `<button type="button" class="sv-morebtn" data-more="${key}">${S.more[key] ? 'Show fewer' : `Show all ${all} ${noun}`}${iconHTML('chevron-down', { size: 16 })}</button>` : '');

  const buildersTable = (e) => {
    const rows = e.builders.map((b) => ({ b, who: runsFor(e, b) }));
    const f = (SORTS[S.sort.key] || SORTS.rank)[0];
    rows.sort((a, c) => { const x = f(a), y = f(c); if ((x == null) !== (y == null)) return x == null ? 1 : -1; return (x < y ? -1 : x > y ? 1 : 0) * S.sort.dir || (a.b.rank ?? 9999) - (c.b.rank ?? 9999); });
    const cap = S.more.builders ? rows.length : 12;
    const th = (key, label, cls = '') => `<th scope="col" class="${cls}" aria-sort="${S.sort.key === key ? (S.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${key}">${esc(label)}<span class="sv-sortmark" aria-hidden="true">${S.sort.key === key ? (S.sort.dir > 0 ? '▲' : '▼') : ''}</span></button></th>`;
    return `<div class="sv-tablewrap"><table class="sv-table">
      <thead><tr>${th('rank', 'Rank', 'num')}${th('builder', 'Builder')}${th('runs', `Runs ${e.name}`)}${th('land', 'Land leader here')}${th('bankers', 'Land bankers named')}${th('pct', 'Lots optioned')}</tr></thead>
      <tbody>${rows.slice(0, cap).map(({ b, who }) => `<tr>
        <td class="num sv-rank">${b.rank ?? ''}</td>
        <td><button type="button" class="sv-blink" data-builder="${esc(b.builder_id)}">${esc(b.name)}</button></td>
        <td>${cellPeople(who.runs, who.runsKind)}</td>
        <td>${who.land.length ? cellPeople(who.land, '') : who.cw.length ? cellPeople(who.cw, 'Company-wide') : '<span class="sv-none">Not public</span>'}</td>
        <td>${bankersCell(b)}</td>
        <td>${pctCell(b)}</td></tr>`).join('')}</tbody></table></div>${moreBtn('builders', Math.min(cap, rows.length), rows.length, 'builders')}`;
  };

  const headRows = (e) => {
    const heads = local(e).filter((x) => x.group === 'regional');
    if (!heads.length) return `<div class="sv-empty">No regional head is mapped to ${esc(e.name)} yet.</div>`;
    const cap = S.more.heads ? heads.length : 6;
    return `<ol class="sv-heads">${heads.slice(0, cap).map((it) => `<li><button type="button" class="sv-head" data-person="${esc(pkey(it))}">
        <span class="sv-rank">${it.builder.rank ?? ''}</span>
        <span class="sv-head-main"><b>${esc(it.person.name)}</b><small>${esc(it.builder.name)}</small></span>
        <span class="sv-head-title" title="${esc(it.person.title || '')}">${esc(it.person.title || '')}</span>
        <span class="sv-head-map" data-minimap="${esc(it.states.join(','))}"></span>
        <span class="sv-head-n">${it.states.length === 1 ? `${esc(e.name)} only` : `${it.states.length} states`}</span>
        ${dot(it.person.confidence)}</button></li>`).join('')}</ol>${moreBtn('heads', Math.min(cap, heads.length), heads.length, 'regional heads')}`;
  };

  const callCards = (e) => {
    const all = e.people;
    const count = { land: 0, regional: 0, division: 0, cw: 0 };
    for (const x of all) { if (x.companyWide) count.cw++; else count[x.group]++; }
    const ROLES = [['all', 'All', count.land + count.regional + count.division, 'person'], ['land', 'Land leaders', count.land, 'land'], ['regional', 'Regional heads', count.regional, 'regional'], ['division', 'Division leaders', count.division, 'division'], ['cw', 'Company-wide land heads', count.cw, 'ceo']];
    const order = { land: 0, regional: 1, division: 2 };
    const hasContact = (x) => (x.person.phone || x.person.email ? 0 : 1);
    let list = all.filter((x) => (S.role === 'cw' ? x.companyWide : !x.companyWide && (S.role === 'all' || x.group === S.role)));
    list = [...list].sort((a, c) => order[a.group] - order[c.group] || hasContact(a) - hasContact(c) || (a.builder.rank ?? 9999) - (c.builder.rank ?? 9999));
    const cap = S.more.call ? list.length : 12;
    const chips = `<div class="sv-chips" role="group" aria-label="Filter by role">${ROLES.filter((r) => r[2] > 0 || r[0] === 'all').map(([k, l, n, ic]) => `<button type="button" class="sv-chip${S.role === k ? ' on' : ''}" aria-pressed="${S.role === k}" data-role="${k}">${iconHTML(ic, { size: 16 })}<span>${l}</span><span class="n">${n}</span></button>`).join('')}</div>`;
    if (!list.length) return `${chips}<div class="sv-empty">No one in this role is mapped to ${esc(e.name)} yet.</div>`;
    return `${chips}<div class="sv-cards">${list.slice(0, cap).map((it) => `<button type="button" class="sv-card ${esc(it.person.confidence || 'Inferred')}" data-person="${esc(pkey(it))}">
        <span class="sv-card-top"><span class="sv-role ${it.group}">${iconHTML(GROUP_ICON[it.group], { size: 15 })}${it.companyWide ? 'Company-wide land' : GROUP_LABEL[it.group]}</span><span class="sv-contact">${it.person.phone ? iconHTML('phone', { size: 16, title: 'Phone published' }) : ''}${it.person.email ? iconHTML('email', { size: 16, title: 'Email published' }) : ''}</span></span>
        <b>${esc(it.person.name)}</b>
        <span class="sv-card-title" title="${esc(it.person.title || '')}">${esc(it.person.title || '')}</span>
        <span class="sv-card-b">${dot(it.person.confidence)}<span>${esc(it.builder.name)}</span><span class="sv-card-rank">#${it.builder.rank ?? ''}</span></span></button>`).join('')}</div>${moreBtn('call', Math.min(cap, list.length), list.length, 'people')}`;
  };

  const tile = (ic, label, value, sub) => `<div class="sv-tile"><span class="k">${iconHTML(ic, { size: 17 })}${esc(label)}</span><span class="v">${value}</span><span class="s" title="${sub}">${sub}</span></div>`;

  const rankList = (rows, max, { cols = 2 } = {}) => `<ol class="sv-rankl" style="--cols:${cols};--rows:${Math.ceil(rows.length / cols)}" data-ranklist>${rows.map((r, i) => `<li><button type="button" class="sv-rankrow${r.code === S.state ? ' on' : ''}" data-state="${r.code}">
      <span class="sv-rank">${i + 1}</span><span class="nm">${esc(r.name)}</span><span class="sv-hbar"><i style="width:${Math.max(1.5, (100 * r.v) / max)}%"></i></span><b>${r.v}</b></button></li>`).join('')}</ol>`;

  /* ------------------------------------------------------------- views */
  const stateView = (e) => {
    const lp = local(e); const heads = lp.filter((x) => x.group === 'regional'); const land = lp.filter((x) => x.group === 'land'); const cw = e.people.filter((x) => x.companyWide);
    const lb = e.landBankers;
    if (!e.builders.length && !e.people.length) return `<div class="sv-empty sv-empty-big">${iconHTML('info', { size: 22 })}<b>No top-100 builder is mapped here.</b><span>${esc(e.name)} has no builder from the 2026 Builder 100 on record. Pick another state on the map.</span></div>`;
    return `
    <div class="sv-tiles">
      ${tile('builder', 'Builders active', e.builders.length, `${e.top25.length} in the top 25`)}
      ${tile('regional', 'Regional heads covering it', heads.length, heads.length ? `at ${plural(new Set(heads.map((x) => x.builder)).size, ['builder', 'builders'])}` : 'Not public')}
      ${tile('land', 'Land leaders mapped', land.length, cw.length ? `plus ${cw.length} company-wide land heads` : 'with this state in their territory')}
      ${tile('landbanker', 'Land bankers linked here', lb.length, lb.length ? `${esc(lb.slice(0, 3).map((x) => `${shortFirm(x.name)} (${x.builders.length})`).join(', '))}${lb.length > 3 ? ` +${lb.length - 3}` : ''}` : 'Not public')}
    </div>
    <div class="sv-sec">
      <div class="sv-h"><h3>${iconHTML('builder', { size: 20 })}Builders in ${esc(e.name)}</h3><span class="sv-note">${iconHTML('info', { size: 15 })}State-level closings are not public, so the order is national rank.</span></div>
      ${e.builders.length ? buildersTable(e) : '<div class="sv-empty">No top-100 builder is mapped here.</div>'}
    </div>
    <div class="sv-sec">
      <div class="sv-h"><h3>${iconHTML('regional', { size: 20 })}Regional heads covering ${esc(e.name)}</h3><span class="sv-note">Ordered by the builder's national rank. The map shows each head's whole territory.</span></div>
      ${headRows(e)}
    </div>
    <div class="sv-sec">
      <div class="sv-h"><h3>${iconHTML('phone', { size: 20 })}Who to call in ${esc(e.name)}</h3></div>
      ${callCards(e)}
    </div>`;
  };

  const nationalView = () => {
    const withState = (domain.builders || []).filter((b) => builderStates(b).length).length;
    const statesWith = STATE_CODES.filter((c) => index[c].builders.length).length;
    const placed = new Map(); for (const e of Object.values(index)) for (const it of local(e)) placed.set(pkey(it), it.group);
    const g = { land: 0, regional: 0, division: 0 }; for (const v of placed.values()) g[v]++;
    const rows = ranked(); const max = rows[0]?.v || 1; const cap = S.more.states ? rows.length : 10;
    return `
    <div class="sv-tiles">
      ${tile('builder', 'Top-100 builders mapped', withState, `of ${total} in the 2026 Builder 100`)}
      ${tile('map-pin', 'States with a top-100 builder', statesWith, 'of 51 (50 states and DC)')}
      ${tile('person', 'Leaders placed on the map', placed.size, `${g.regional} regional, ${g.division} division, ${g.land} land`)}
      ${tile('landbanker', 'No land banker named', openIds.size, 'option-heavy or land-light builders')}
    </div>
    <div class="sv-sec">
      <div class="sv-h"><h3>${iconHTML(measure().icon, { size: 20 })}Top states: ${esc(measure().label.toLowerCase())}</h3><span class="sv-note">${esc(measure().def)} Click a state to open it.</span></div>
      ${rows.length ? rankList(rows.slice(0, cap), max) : '<div class="sv-empty">Nothing to rank for this measure.</div>'}
      ${moreBtn('states', Math.min(cap, rows.length), rows.length, 'states')}
    </div>`;
  };

  const drawStrip = () => {
    if (!S.state) { strip.hidden = true; strip.innerHTML = ''; return; }
    const rows = ranked().slice(0, 8);
    strip.hidden = false;
    strip.innerHTML = `<span class="sv-strip-l">Top states</span><div class="sv-strip-chips" data-ranklist>${rows.map((r) => `<button type="button" class="sv-schip${r.code === S.state ? ' on' : ''}" data-state="${r.code}" title="${esc(r.name)}">${r.code}<b>${r.v}</b></button>`).join('')}</div>`;
  };

  const drawBody = () => {
    const e = S.state ? index[S.state] : null;
    $('[data-title]').textContent = e ? e.name : 'United States';
    $('[data-sub]').textContent = e ? (e.builders.length ? `${e.builders.length} of the top ${total} builders build here` : 'No top-100 builder is mapped here') : 'Click any state on the map';
    $('[data-clear]').hidden = !e;
    body.innerHTML = e ? stateView(e) : nationalView();
    body.classList.remove('sv-in'); void body.offsetWidth; body.classList.add('sv-in');
    for (const slot of body.querySelectorAll('[data-minimap]')) slot.replaceChildren(usMap({ highlight: slot.dataset.minimap.split(','), size: 92 }));
  };

  /* ----------------------------------------------------------- actions */
  function select(code, { silent = false } = {}) {
    const next = code && STATE_NAMES[code] ? code : null;
    const changed = next !== S.state;
    S.state = next;
    if (changed) { S.more = {}; S.role = 'all'; S.sort = { key: 'rank', dir: 1 }; }
    map.setSelected(next);
    drawStrip(); drawBody();
    if (changed && !silent && typeof onStateChange === 'function') onStateChange(next);
  }
  function setMeasure(key, { silent = false } = {}) {
    if (!MEASURES.some((m) => m.key === key) || key === S.measure) return;
    S.measure = key; S.more.states = false;
    map.setValues(valuesFor(key));
    map.setAttribute('aria-label', `${measure().label} by state`);
    drawMeasureChrome(); drawStrip();
    if (!S.state) drawBody();
    if (!silent && typeof onMeasureChange === 'function') onMeasureChange(key);
  }

  const onClick = (ev) => {
    const t = ev.target.closest('button'); if (!t || !root.contains(t)) return;
    const d = t.dataset;
    if (d.measure) setMeasure(d.measure);
    else if (d.state) select(d.state);
    else if ('clear' in d) { select(null); }
    else if ('back' in d) backToMap();
    else if (d.sort) { S.sort = S.sort.key === d.sort ? { key: d.sort, dir: -S.sort.dir } : { key: d.sort, dir: (SORTS[d.sort] || SORTS.rank)[1] }; drawBody(); body.querySelector(`[data-sort="${d.sort}"]`)?.focus({ preventScroll: true }); }
    else if (d.role) { S.role = d.role; S.more.call = false; drawBody(); body.querySelector(`[data-role="${d.role}"]`)?.focus({ preventScroll: true }); }
    else if (d.more) { S.more[d.more] = !S.more[d.more]; drawBody(); body.querySelector(`[data-more="${d.more}"]`)?.focus({ preventScroll: true }); }
    else if (d.builder) { const b = builders.get(d.builder); if (b && typeof onBuilder === 'function') onBuilder(b, ev); }
    else if (d.person) { const it = people.get(d.person); if (it && typeof onPerson === 'function') onPerson(it.person, it.builder, ev); }
  };
  const onKey = (ev) => {
    if (ev.key === 'Escape' && S.state && !ev.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) { select(null); return; }
    const list = ev.target.closest?.('[data-ranklist]');
    if (list && /^Arrow/.test(ev.key)) {
      const items = [...list.querySelectorAll('button[data-state]')]; const i = items.indexOf(ev.target.closest('button'));
      const step = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1 : -1;
      const to = items[Math.max(0, Math.min(items.length - 1, i + step))];
      if (to) { to.focus(); ev.preventDefault(); }
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  // the bar turns into a slim sticky header once the map has scrolled away
  const sentinel = $('[data-sentinel]');
  const checkStuck = () => bar.classList.toggle('stuck', sentinel.getBoundingClientRect().top < top - 1);
  document.addEventListener('scroll', checkStuck, { passive: true, capture: true }); // capture: works whichever element scrolls
  function backToMap() {
    const y0 = window.scrollY;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    if (smooth) setTimeout(() => { if (Math.abs(window.scrollY - y0) < 2) root.scrollIntoView({ block: 'start' }); }, 350); // in case smooth scrolling is unavailable
  }

  drawMeasureChrome(); drawMap(); drawStrip(); drawBody(); checkStuck();

  return {
    select: (code) => select(code),
    setMeasure: (key) => setMeasure(key),
    get state() { return S.state; },
    get measure() { return S.measure; },
    destroy() { window.removeEventListener('resize', onResize); document.removeEventListener('scroll', checkStuck, { capture: true }); root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); container.replaceChildren(); },
  };
}
