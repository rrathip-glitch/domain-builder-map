/* usmap.js: the small highlighted US map, the text-to-states parser and the state index.
 * Styles: usmap.css (every colour has a fallback, so the map also works without style.css).
 * Shapes: usstates-paths.js (baked, no network). No other dependency.
 *
 * Interface
 *   usMap({ highlight = [], size = 80, title, interactive = false, onState, values, labels = false,
 *           tiles = false, steps = 4, selected, tooltip, callouts })            -> SVGSVGElement
 *       Real state outlines by default; tiles: true draws the tile-grid version instead.
 *       highlight: state codes in the accent colour. values: { code: number } shades on a `steps`-step scale instead.
 *       interactive: states are focusable and clickable; onState(code, { name, value, event }) fires on click / Enter.
 *       tooltip(code) may return a string or a Node for the hover card (interactive maps only).
 *       The returned element also has: setValues(values), setHighlight(codes), setSelected(code | null), focusState(code).
 *   usMapHTML(opts)                         -> the same (non-interactive) map as an HTML string, for template strings
 *   usMapScale(values, steps = 4)           -> { steps, breaks, stepOf(v), ranges: [{ step, from, to, label }] }
 *   statesFromText(text, fallback = [])     -> ['TX', 'FL', ...] in the order found; [] (or fallback) when nothing is certain
 *   builderStates(builder)                  -> codes from profile.states, else derived from regions and markets
 *   personStates(person, builder)           -> codes from the person's geography, else the matching profile.regions entry, else []
 *   buildStateIndex(domain)                 -> { TX: { code, name, builders, top25, openField, people, landBankers }, ... } (cached per domain)
 *       builders: active builders sorted by rank. people: [{ person, builder, group: 'regional'|'division'|'land', states, companyWide }]
 *   openFieldBuilderIds(domain)             -> Set of builder_id flagged white space (see the function for the rule)
 *   STATE_NAMES, STATE_CODES, TILE_GRID
 */
import { viewBox as SHAPE_VIEWBOX, states as SHAPES } from './usstates-paths.js';

/* ------------------------------------------------------------------ states */

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
export const STATE_CODES = Object.keys(STATE_NAMES);

/* Tile-grid positions [column, row] on an 11 x 8 grid (the conventional newsroom layout). */
export const TILE_GRID = {
  AK: [0, 0], ME: [10, 0],
  WI: [5, 1], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], RI: [10, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

const validCodes = (list) => { const seen = new Set(); const out = []; for (const c of list || []) { const k = String(c || '').trim().toUpperCase(); if (STATE_NAMES[k] && !seen.has(k)) { seen.add(k); out.push(k); } } return out; };

/* ------------------------------------------------------------------ parser */

/* Places. `?` after the state marks a name shared with a sizeable place elsewhere: it is ignored when it only
 * elaborates a place that is already resolved ("Houston metro, TX (Cleveland, Conroe, Dayton)"). */
const PLACES = `
TX: Dallas, Fort Worth, Ft. Worth, Ft Worth, DFW, Metroplex, Houston, Austin, San Antonio, El Paso, Lubbock, Amarillo, Corpus Christi, Waco, Killeen, College Station, Midland?, Odessa?, Permian Basin, Rio Grande Valley, McAllen, Brownsville, Laredo, Tyler, Hill Country, New Braunfels, Conroe, Katy, The Woodlands, Plano, Frisco, McKinney, Round Rock, Beaumont?, Galveston, Galveston Bay, Fort Bend, Missouri City, Texas City, Iowa Colony
AZ: Phoenix, Tucson, Scottsdale, Chandler, Flagstaff, Prescott, Pinal County, Maricopa County
GA: Atlanta, Savannah, Augusta?, Alpharetta, Macon
NC: Charlotte?, Raleigh, Durham, Greensboro, Winston-Salem, Asheville, Research Triangle, Piedmont Triad, Triad, Chapel Hill, Outer Banks
SC: Charleston?, Myrtle Beach, Hilton Head, Spartanburg, Lowcountry, Low Country, Summerville, Bluffton
TN: Nashville, Memphis, Knoxville, Chattanooga, Murfreesboro, Clarksville
FL: Orlando, Tampa, Tampa Bay, Jacksonville?, Miami, Fort Lauderdale, Ft. Lauderdale, West Palm Beach, Palm Beach, Fort Myers, Ft. Myers, Naples?, Sarasota, Bradenton, Lakewood Ranch, Cape Coral, Port St. Lucie, Port Saint Lucie, Ocala, Tallahassee, Pensacola, Panama City, Daytona Beach, Daytona, Melbourne?, Palm Bay, Lakeland, Space Coast, Treasure Coast, Emerald Coast, St. Augustine, Palm Coast, Punta Gorda, Kissimmee, The Villages, Vero Beach, Port Charlotte, Biscayne Bay
CO: Denver, Colorado Springs, Fort Collins, Front Range, Boulder, Greeley
NV: Las Vegas, Reno
UT: Salt Lake City, Salt Lake, Provo, Ogden, St. George, Wasatch
WA: Seattle, Tacoma, Spokane, Puget Sound, Bellevue, Kennewick
OR: Portland?
CA: Sacramento, Inland Empire, Bay Area, San Francisco, San Jose, Oakland, East Bay, Silicon Valley, Los Angeles, San Diego, Orange County, Riverside?, San Bernardino, Fresno, Bakersfield, Stockton, Modesto, Central Valley, San Joaquin Valley, Coachella Valley, Palm Springs, Ventura, Santa Barbara, Irvine, Temecula, Redding, Visalia, San Luis Obispo, Monterey, Monterey Bay, SoCal, NorCal, Tri-Valley, Santa Clarita, Napa, Sonoma, Santa Rosa
ID: Boise, Coeur d'Alene, Coeur d’Alene, Twin Falls, Treasure Valley
NM: Albuquerque, Santa Fe, Las Cruces, Rio Rancho
MN: Minneapolis, St. Paul, Saint Paul, Twin Cities
IL: Chicago, Chicagoland, Naperville
IN: Indianapolis, Fort Wayne, South Bend, Fishers
OH: Columbus?, Cincinnati, Cleveland?, Dayton?, Akron, Toledo
MI: Detroit, Grand Rapids, Ann Arbor, Lansing, Kalamazoo
WI: Milwaukee, Green Bay
MO: St. Louis, St Louis, Saint Louis
MO+KS: Kansas City
KS: Wichita, Overland Park
NE: Omaha
IA: Des Moines, Cedar Rapids
OK: Oklahoma City, Tulsa
AR: Little Rock, Bentonville
LA: New Orleans, Baton Rouge, Shreveport, Lake Charles
MS: Gulfport, Biloxi, Hattiesburg
AL: Birmingham, Huntsville?, Tuscaloosa, Gulf Shores, Mobile Bay
KY: Louisville
VA: Richmond?, Virginia Beach, Norfolk, Hampton Roads, NoVA, Williamsburg, Charlottesville, Loudoun
DC: Washington DC, D.C., District of Columbia, Washington metro, Greater Washington, Washington area
MD: Baltimore, Annapolis
DE+MD: Delmarva
DE: Rehoboth
PA: Philadelphia, Pittsburgh, Harrisburg, Lehigh Valley, Allentown, Poconos
NJ: Jersey Shore, Princeton
NY: New York City, NYC, Long Island, Hudson Valley, Westchester, Buffalo
CT: Hartford, Stamford
MA: Boston, Worcester, Cape Cod
RI: Providence
NH: Nashua
HI: Honolulu, Oahu, Maui
AK: Anchorage
MT: Bozeman, Billings, Missoula, Kalispell
WY: Cheyenne, Jackson Hole
ND: Fargo, Bismarck
SD: Sioux Falls, Rapid City
WV: Morgantown
NC+SC: Carolinas
ND+SD: Dakotas
CT+MA+ME+NH+RI+VT: New England
WA+OR: Pacific Northwest, PNW
-: Chesapeake Bay, Delaware Valley, Delaware River, Washington Homes
`;

const norm = (s) => (/^washington,?\s*d\.?\s?c\b/i.test(s) ? 'washington dc' : s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim());
const TERMS = new Map(); // normalised phrase -> { st, amb, kind }
for (const [code, name] of Object.entries(STATE_NAMES)) if (code !== 'DC') TERMS.set(norm(name), { st: [code], kind: code === 'WA' ? 'wash' : 'name' });
for (const line of PLACES.trim().split('\n')) {
  const i = line.indexOf(':');
  const st = line.slice(0, i).trim() === '-' ? [] : line.slice(0, i).trim().split('+');
  for (let t of line.slice(i + 1).split(',')) { t = t.trim(); if (!t) continue; const amb = t.endsWith('?'); if (amb) t = t.slice(0, -1); TERMS.set(norm(t), { st, amb, kind: 'place' }); }
}
for (const [abbr, code] of [['N.C.', 'NC'], ['S.C.', 'SC'], ['Fla.', 'FL'], ['Calif.', 'CA'], ['Colo.', 'CO'], ['Ariz.', 'AZ'], ['Tenn.', 'TN']]) TERMS.set(norm(abbr), { st: [code], kind: 'name' });

const rxEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_RX = new RegExp(`(^|[^A-Za-z0-9])(${[...TERMS.keys()].sort((a, b) => b.length - a.length).map((k) => (k === 'washington dc' ? 'washington,?\\s*d\\.?\\s?c\\.?' : rxEsc(k).replace(/'/g, "['’]").replace(/ /g, '\\s+'))).join('|')})(?![A-Za-z0-9])`, 'gi');

/* Wording that makes what follows uncertain, past or excluded: cut to the end of that clause. */
const HEDGE_RX = /\b(?:presumably|possibly|likely|probably|perhaps|may also|may include|might|whether|suggests?|snippet|job posting|styled|third-party|formerly|previously|earlier|historically|also led|also runs|based in|profile location|directory location|not|excluding|except|other than|rather than)\b[^;)]*?(?=;|\)|(?<!\b(?:St|Ft|Mt|Dr|incl|Inc|Co|vs|No))\.\s|$)/gi;
const DROP_CLAUSE_RX = /\b(?:until|targets?|exited|no longer)\b/i;
const blank = (m) => ' '.repeat(m.length);

const TERRITORY = new Set(['PR', 'VI', 'GU']);
/* Codes that are also ordinary words or compass points: accepted only in a clear "this is a state code" position. */
const WORDY = new Set(['IN', 'OR', 'ME', 'HI', 'OK', 'LA', 'NE']);
const CA_CONTEXT = /California|\bCA\b|Orange County|Ventura|San Diego|Inland Empire|SoCal|San Bernardino|Riverside/;

function findCodes(text) {
  const toks = [];
  const re = /[A-Z]{2}/g; let m;
  while ((m = re.exec(text))) {
    const s = m.index, e = s + 2, prev = text[s - 1] || '', next = text[e] || '';
    if (/[A-Za-z0-9&'’.]/.test(prev) || /[A-Za-z0-9&'’]/.test(next)) { while (re.lastIndex < text.length && /[A-Za-z0-9]/.test(text[re.lastIndex])) re.lastIndex++; continue; }
    if (next === '.' && /[A-Za-z]/.test(text[e + 1] || '')) continue;
    const code = m[0];
    if (STATE_NAMES[code] || TERRITORY.has(code)) toks.push({ s, e, code, link: false, or: false });
  }
  for (let i = 1; i < toks.length; i++) {
    const between = text.slice(toks[i - 1].e, toks[i].s);
    if (/^\s*,?\s*(?:or|vs\.?)\s*$/i.test(between)) toks[i - 1].or = toks[i].or = true;
    else if (/^\s*(?:,|\/|&|\+|;|-|–|—|and|,\s*and|plus)\s*$/i.test(between)) toks[i - 1].link = toks[i].link = true;
  }
  const out = [];
  for (const t of toks) {
    if (t.or || TERRITORY.has(t.code)) continue; // "TN or IN" is a doubt, not a list
    const before = text.slice(0, t.s), after = text.slice(t.e);
    let ok;
    if (!WORDY.has(t.code)) {
      ok = !/[A-Z]{3,}\s+$/.test(before) && !/^\s+[A-Z]{3,}\b/.test(after) && !/^\.\s+[a-z]/.test(after);
    } else {
      const tail = /^\s*(?:[,;.)(\/&:-]|and\b|$)/i.test(after);
      ok = /^\s+[A-Z]/.test(after) ? false // "NE Florida", "IN PROGRESS": a compass point or a word, not a state
        : t.link
        || (/[a-z)\]]\s*,\s*$/.test(before) && tail)                         // "Portland, OR"
        || (/\(\s*$/.test(before) && /^\s*\)/.test(after))                    // "(OR)"
        || (!before.trim() && (!after.trim() || /^\s*[:(]/.test(after)))      // "OR" or "OR: Portland"
        || (/[A-Z][a-z]+\.?\s+$/.test(before) && /^\s*(?:[,;.)]|$)/.test(after)); // "Portland OR."
    }
    if (!ok) continue;
    let code = t.code;
    if (code === 'LA' && !t.link && CA_CONTEXT.test(text)) code = 'CA'; // "LA" next to California places is Los Angeles
    out.push({ s: t.s, e: t.e, st: [code], kind: 'code' });
  }
  return out;
}

const STREETISH = /^\s+(?:County|Counties|Township|River|Street|St\b|Avenue|Ave\b|Road|Rd\b|Blvd|Boulevard|Drive|Parkway|Pkwy|Highway|Hwy|Homes|LLC|Inc)\b/;
const COMPANYISH = /^\s+(?:Homes|American|Communities|Builders|Properties|Residential|LLC|Inc)\b/; // "Richmond American Homes" is a brand, not a place
const COUNTY_OK = new Set(['UT', 'OK', 'ID', 'HI', 'NY', 'AR']);

function parseStates(raw) {
  const empty = { states: [], sure: new Set(), soft: new Set(), bareWashington: false };
  if (raw == null) return empty;
  let text = String(raw);
  if (!text.trim()) return empty;
  // "Not stated; speaker at Florida events ...": when the record opens by saying the territory is not given, believe it
  const first = text.split(/;|\.\s/)[0];
  if (/\bnot (?:stated|published|publicly|disclosed|named|given|specified|listed)\b/i.test(first) && text.length > first.length && !parseStates(first).states.length) return empty;
  text = text.replace(HEDGE_RX, blank);
  text = text.replace(/[^;]+?(?:;|(?<!\b(?:St|Ft|Mt|Dr|incl|Inc|Co|vs|No))\.\s|$)/g, (clause) => (DROP_CLAUSE_RX.test(clause) ? blank(clause) : clause));

  const hits = findCodes(text);
  let bareWash = null;
  TERM_RX.lastIndex = 0;
  let m;
  while ((m = TERM_RX.exec(text))) {
    const s = m.index + m[1].length, e = s + m[2].length;
    const t = TERMS.get(norm(m[2]));
    if (!t) continue;
    if (t.kind === 'name' || t.kind === 'wash') {
      if (m[2][0] !== m[2][0].toUpperCase()) continue; // "georgia" in lower case is not a place reference we trust
      const after = text.slice(e);
      if (STREETISH.test(after) && !(COUNTY_OK.has(t.st[0]) && /^\s+Count/.test(after))) continue;
      if (t.kind === 'wash') { bareWash = { s, e }; continue; }
    } else {
      if (/^mobile/.test(m[2]) || COMPANYISH.test(text.slice(e))) continue; // the adjective; a company name
      // "Oakland, TN", "Portland, ME", "Lancaster SC": a place tagged with another state's code belongs to that state
      const tag = /^(?:\s+(?:metro|area))?(?:,\s*|\s+|\s*\()([A-Z]{2})(?![A-Za-z])/.exec(text.slice(e));
      if (tag && STATE_NAMES[tag[1]] && t.st.length && !t.st.includes(tag[1])) continue;
    }
    hits.push({ s, e, st: t.st, kind: t.kind, amb: !!t.amb });
  }
  hits.sort((a, b) => a.s - b.s);

  const sureHits = hits.filter((h) => !h.amb && h.st.length);
  const sureIn = (from, to) => sureHits.some((h) => h.s >= from && h.e <= to);
  const sure = new Set(), soft = new Set(), order = [];
  const add = (codes, set) => { for (const c of codes) { if (!sure.has(c) && !soft.has(c)) order.push(c); set.add(c); } };
  for (const h of hits) {
    if (!h.amb) { add(h.st, h.kind === 'place' ? soft : sure); continue; }
    // An ambiguous city name: skip it when it only elaborates something already resolved.
    const before = text.slice(0, h.s);
    let open = -1; { const stack = []; for (let i = 0; i < before.length; i++) { if (before[i] === '(') stack.push(i); else if (before[i] === ')') stack.pop(); } if (stack.length) open = stack[stack.length - 1]; }
    const clauseStart = Math.max(before.lastIndexOf(';'), before.search(/\.\s[^.]*$/), open) + 1;
    let elaborates = false;
    if (open >= 0) { const head = text.slice(0, open); const from = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'), head.lastIndexOf('(')) + 1; if (sureIn(from, open)) elaborates = true; }
    const colon = before.lastIndexOf(':');
    if (!elaborates && colon >= clauseStart && sureIn(clauseStart, colon)) elaborates = true;
    const incl = before.slice(clauseStart).search(/\bincl(?:\.|uding)?/i);
    if (!elaborates && incl >= 0 && sureIn(clauseStart, clauseStart + incl)) elaborates = true;
    if (!elaborates) add(h.st, soft);
  }
  // metros confirmed by a code or a state name are as good as sure
  for (const c of [...soft]) if (sure.has(c)) soft.delete(c);

  let bareWashington = false;
  if (bareWash) {
    const has = (...cs) => cs.some((c) => sure.has(c) || soft.has(c));
    const west = has('OR', 'ID', 'CA', 'AK', 'MT', 'NV') || /Seattle|Puget|Pacific|Northwest|Spokane|Tacoma/i.test(text);
    const east = has('MD', 'VA', 'DE', 'PA', 'NJ', 'WV') || /Baltimore|Mid-Atlantic|Capital/i.test(text);
    if (east && !west) add(['DC'], sure); else { add(['WA'], west ? sure : soft); bareWashington = !west; } // without western context, the footprint check decides
  }
  return { states: order, sure, soft, bareWashington };
}

/** Free text -> state codes. Returns `fallback` (default []) when nothing is certain; never guesses. */
export function statesFromText(text, fallback = []) {
  const { states } = parseStates(text);
  return states.length ? states : fallback;
}

/* --------------------------------------------------- builders and people */

const builderCache = new WeakMap();
/** The states a builder is active in: profile.states, else derived from its regions and markets. */
export function builderStates(builder) {
  if (!builder || typeof builder !== 'object') return [];
  if (builderCache.has(builder)) return builderCache.get(builder);
  let out = validCodes(builder.profile?.states);
  if (!out.length) out = validCodes(builder.states);
  if (!out.length) {
    const texts = [];
    for (const r of builder.profile?.regions || []) texts.push(r?.geography, r?.name);
    for (const mk of builder.profile?.markets || []) texts.push(mk);
    out = validCodes(texts.flatMap((t) => (typeof t === 'string' ? statesFromText(t) : [])));
  }
  builderCache.set(builder, out);
  return out;
}

/* Parse a text against a builder's footprint: place names that land outside the footprint are dropped. */
function statesWithin(text, footprint) {
  const p = parseStates(text);
  let out = p.states;
  if (footprint.length) {
    const fp = new Set(footprint);
    if (p.bareWashington && !fp.has('WA') && (fp.has('DC') || fp.has('MD') || fp.has('VA'))) out = out.map((c) => (c === 'WA' ? 'DC' : c));
    out = out.filter((c) => p.sure.has(c) || fp.has(c));
  }
  return validCodes(out);
}

const nameTokens = (s) => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !/^(jr|sr|ii|iii|iv)$/.test(t));
function leaderMatches(leader, personName) {
  if (!leader || !personName) return false;
  const lead = new Set(String(leader).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/));
  const p = nameTokens(personName);
  if (p.length < 2) return false;
  return lead.has(p[0]) && lead.has(p[p.length - 1]);
}
const regionKey = (s) => { const k = String(s || '').replace(/\([^)]*\)/g, ' ').split(/[:;.]/)[0].toLowerCase().replace(/\b(?:region|regional|area|division|segment|group|zone|reporting|operating|territory|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); return k && k.split(' ').length <= 3 ? k : ''; };

const personCache = new WeakMap();
/** The states a person covers: their geography text, else the builder's matching region (by leader or name), else []. */
export function personStates(person, builder) {
  if (!person || typeof person !== 'object') return [];
  if (personCache.has(person)) return personCache.get(person);
  const footprint = builder ? builderStates(builder) : validCodes(person.builder_states);
  let out = statesWithin(person.geography, footprint);
  if (!out.length && builder) {
    const regs = builder.profile?.regions || [];
    const gk = regionKey(person.geography);
    const hit = regs.filter((r) => leaderMatches(r?.leader, person.name));
    const pool = hit.length ? hit : gk ? regs.filter((r) => regionKey(r?.name) === gk) : [];
    const acc = [];
    for (const r of pool) { const st = statesWithin(r.geography, footprint); acc.push(...(st.length ? st : statesWithin(r.name, footprint))); }
    out = validCodes(acc);
  }
  if (!out.length && person.level && person.level !== 'Corporate' && footprint.length) {
    // a field title such as "Division President, Houston", kept only inside the builder's footprint
    const fp = new Set(footprint);
    out = validCodes(statesFromText(person.title).filter((c) => fp.has(c)));
    // a field leader at a builder that works in one state covers that state
    if (!out.length && footprint.length === 1) out = footprint.slice();
  }
  personCache.set(person, out);
  return out;
}

/** The index group a person belongs to, or null: regional heads, division leaders, land leaders. */
export function personGroup(person) {
  const rc = person?.role_category || '';
  if (/^Land/.test(rc)) return 'land';
  if (rc === 'Regional President' || (person?.level === 'Regional' && /President/.test(rc))) return 'regional';
  if (rc === 'Division President' || (person?.level === 'Division' && /President/.test(rc))) return 'division';
  return null;
}

/**
 * Builders flagged "open field" (white space): heavy optioned-lot use or a stated land-light strategy, and no publicly
 * named land banker. Uses the "competitor-builder-matrix" extra when the dataset carries it (its White space column),
 * else applies the same rule to each builder's own financing record.
 */
export function openFieldBuilderIds(domain) {
  const extras = domain?.extras ? Object.values(domain.extras) : [];
  const matrix = extras.find((x) => x && x.id === 'competitor-builder-matrix' && Array.isArray(x.rows));
  if (matrix && matrix.rows.some((r) => 'white_space' in r)) return new Set(matrix.rows.filter((r) => /^yes/i.test(String(r.white_space || ''))).map((r) => r.builder_id || r.builder));
  const out = new Set();
  for (const b of domain?.builders || []) {
    const dv = b.derived || {}; const f = b.financing || {};
    const named = (dv.land_bankers || []).length > 0; // the build's own list: unnamed aggregates and no-link notes are already excluded there
    if (named) continue;
    const pct = dv.pct_optioned ?? f.lots?.pct_optioned;
    const lightFirstLine = /land-light|asset-light/i.test(String(f.land_strategy || '').split(/\.\s/)[0]);
    if ((pct != null && pct >= 50) || lightFirstLine || dv.land_bankers_unnamed) out.add(b.builder_id);
  }
  return out;
}

const CONF_ORDER = { Verified: 0, Reported: 1, Inferred: 2 };
const indexCache = new WeakMap();
/**
 * code -> { code, name, builders (by rank), top25, openField, people, landBankers }
 * people: [{ person, builder, group, states, companyWide }] sorted by builder rank. A corporate land leader with no
 * geography of their own covers the builder's whole footprint and is marked companyWide: true.
 * landBankers: [{ name, builders }] publicly linked (at company level) to builders active in the state.
 */
export function buildStateIndex(domain) {
  if (!domain || typeof domain !== 'object') return {};
  if (indexCache.has(domain)) return indexCache.get(domain);
  const idx = {};
  for (const code of STATE_CODES) idx[code] = { code, name: STATE_NAMES[code], builders: [], top25: [], openField: [], people: [], landBankers: [] };
  const open = openFieldBuilderIds(domain);
  const rk = (b) => (b.rank == null ? 9999 : b.rank);
  const builders = [...(domain.builders || [])].sort((a, b) => rk(a) - rk(b));
  for (const b of builders) {
    const st = builderStates(b);
    for (const c of st) {
      const e = idx[c];
      e.builders.push(b);
      if (b.tier === 'Top 25' || (b.rank != null && b.rank <= 25)) e.top25.push(b);
      if (open.has(b.builder_id)) e.openField.push(b);
for (const lb of b.derived?.land_bankers || []) { let row = e.landBankers.find((x) => x.name === lb); if (!row) e.landBankers.push((row = { name: lb, builders: [] })); row.builders.push(b); }
    }
    for (const p of b.people || []) {
      const group = personGroup(p);
      if (!group) continue;
      let ps = personStates(p, b);
      let companyWide = false;
      if (!ps.length && group === 'land' && (p.level || 'Corporate') === 'Corporate') { ps = st; companyWide = true; }
      if (!ps.length) continue;
      const item = { person: p, builder: b, group, states: ps, companyWide };
      for (const c of ps) if (idx[c]) idx[c].people.push(item);
    }
  }
  for (const e of Object.values(idx)) {
    e.landBankers.sort((a, b) => b.builders.length - a.builders.length || a.name.localeCompare(b.name));
    e.people.sort((a, b) => rk(a.builder) - rk(b.builder) || (CONF_ORDER[a.person.confidence] ?? 3) - (CONF_ORDER[b.person.confidence] ?? 3) || String(a.person.name).localeCompare(String(b.person.name)));
  }
  indexCache.set(domain, idx);
  return idx;
}

/* ------------------------------------------------------------------- scale */

/** A quantile scale for shading: step 0 is "none", steps 1..n run light to dark. */
export function usMapScale(values, steps = 4) {
  const vals = Object.values(values || {}).map(Number).filter((v) => v > 0).sort((a, b) => a - b);
  let breaks = []; // upper bound of each step except the last
  if (vals.length) {
    const max = vals[vals.length - 1];
    if (Number.isInteger(max) && max <= steps && vals.every(Number.isInteger)) { for (let i = 1; i < max; i++) breaks.push(i); }
    else {
      for (let i = 1; i < steps; i++) breaks.push(vals[Math.min(vals.length - 1, Math.floor((i * vals.length) / steps))]);
      breaks = [...new Set(breaks)].filter((b) => b < max);
    }
  }
  const used = vals.length ? breaks.length + 1 : 0;
  const shade = (cls) => (used <= 1 ? steps : Math.max(1, Math.round((cls * steps) / used))); // spread fewer classes over the ramp
  const stepOf = (v) => { v = Number(v); if (!(v > 0)) return 0; let c = 1; for (const b of breaks) if (v > b) c++; return shade(c); };
  const ranges = [];
  const int = vals.every(Number.isInteger);
  for (let c = 1; c <= used; c++) {
    const from = c === 1 ? (int ? 1 : vals[0]) : int ? breaks[c - 2] + 1 : breaks[c - 2];
    const to = c <= breaks.length ? breaks[c - 1] : null;
    ranges.push({ step: shade(c), from, to, label: to == null ? (from >= vals[vals.length - 1] ? String(vals[vals.length - 1]) : `${from}+`) : from === to ? String(from) : `${from} to ${to}` });
  }
  return { steps, breaks, stepOf, ranges };
}

/* --------------------------------------------------------------------- map */

const NS = 'http://www.w3.org/2000/svg';
const FILL_OFF = '#dfe3ec', FILL_ON = '#1f4fd1', FILL_NONE = '#eceef2';
const RAMP = { 4: ['#c5d3f8', '#8eaaf0', '#4a72de', '#1a3ea8'], 5: ['#cdd9f9', '#a3b9f4', '#7092ec', '#3d66dd', '#1a3ea8'] };
const rampFor = (steps) => RAMP[steps] || RAMP[4];
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v); if (parent) parent.appendChild(n); return n; };

/* Small states that get a labelled chip off the coast on large interactive maps: [chip x, chip y] in viewBox units. */
/* Narrow New England states: a hand-placed, slightly smaller label so the three do not collide. */
const LABEL_FIX = { VT: [871, 125], NH: [895, 151], MA: [892, 171] };
const CALLOUTS = { RI: [925, 196], CT: [925, 220], NJ: [925, 244], DE: [925, 268], MD: [925, 292], DC: [925, 316] };

let tipEl = null;
function showTip(target, content) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'usm-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.replaceChildren(); tipEl.append(content);
  tipEl.style.cssText = 'position:fixed;z-index:1000;pointer-events:none;left:0;top:0;visibility:hidden';
  tipEl.classList.add('show');
  const r = target.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 10;
  if (y < 8) y = r.bottom + 10;
  x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8));
  tipEl.style.left = `${Math.round(x)}px`; tipEl.style.top = `${Math.round(y)}px`; tipEl.style.visibility = 'visible';
}
function hideTip() { if (tipEl) tipEl.classList.remove('show'); }

/**
 * A US map as inline SVG. See the header for the options. Non-interactive maps carry a <title> listing the
 * highlighted states; interactive maps make every state a focusable button.
 */
export function usMap({ highlight = [], size = 80, title, interactive = false, onState, values, labels = false, tiles = false, steps = 4, selected = null, tooltip, callouts } = {}) {
  let hi = new Set(validCodes(highlight));
  let vals = values || null;
  let scale = vals ? usMapScale(vals, steps) : null;
  let sel = selected && STATE_NAMES[selected] ? selected : null;
  const ramp = rampFor(steps);
  const big = size >= 360;
  const showLabels = labels && size >= (tiles ? 176 : 420);
  const useCallouts = !tiles && (callouts ?? (interactive && big));

  let W, H, vb, pitch = 0, gap = 0;
  if (tiles) {
    pitch = Math.max(4, Math.floor((size / 11) * 2) / 2);
    gap = pitch < 9 ? 1 : pitch < 16 ? 1.5 : pitch < 30 ? 2 : Math.round(pitch * 0.08);
    W = 11 * pitch - gap; H = 8 * pitch - gap; vb = `0 0 ${W} ${H}`;
  } else { W = size; H = Math.round((size * 610) / 975); vb = SHAPE_VIEWBOX; }

  const svg = el('svg', { class: `us-map ${tiles ? 'usm-tiles' : 'usm-shapes'}${interactive ? ' usm-interactive' : ''}${big ? ' usm-big' : ''}`, width: W, height: H, viewBox: vb, 'data-steps': steps });
  const k = tiles ? 1 : 975 / size; // viewBox units per screen pixel
  const names = () => STATE_CODES.filter((c) => hi.has(c)).map((c) => STATE_NAMES[c]);
  const describe = () => { const n = names(); const list = vals ? '' : n.length ? n.join(', ') : 'no states highlighted'; return [title, list].filter(Boolean).join(': ') || 'Map of the United States'; };
  const titleEl = el('title', {}, svg);
  const setTitle = () => { const t = describe(); titleEl.textContent = t; svg.setAttribute('aria-label', t); };
  svg.setAttribute('role', interactive ? 'group' : 'img');

  const gStates = el('g', { class: 'usm-states' }, svg);
  const gMarks = el('g', { class: 'usm-marks' }, svg);
  const overlay = tiles ? null : el('g', { class: 'usm-overlay', 'pointer-events': 'none' }, svg);
  const gLabels = el('g', { class: 'usm-labels', 'pointer-events': 'none' }, svg);
  const nodes = {}; // code -> { shape, chip, label, chipLabel, group }

  const stepFor = (c) => (vals ? scale.stepOf(vals[c]) : 0);
  const fillFor = (c) => (vals ? (stepFor(c) ? ramp[stepFor(c) - 1] : FILL_NONE) : hi.has(c) ? FILL_ON : FILL_OFF);
  const clsFor = (c) => `usm-s${vals ? ` v${stepFor(c)}` : hi.has(c) ? ' on' : ''}`;
  const darkFor = (c) => (vals ? stepFor(c) >= steps - 1 && stepFor(c) > 0 : hi.has(c));

  for (const code of STATE_CODES) {
    const n = (nodes[code] = {});
    const parent = interactive ? (n.group = el('g', { class: 'usm-st', 'data-state': code, role: 'button', tabindex: '-1' }, gStates)) : gStates;
    if (tiles) {
      const [cx, cy] = TILE_GRID[code]; const side = pitch - gap;
      n.shape = el('rect', { x: cx * pitch, y: cy * pitch, width: side, height: side, rx: Math.max(1, Math.round(side * 0.2 * 2) / 2), 'data-state': code }, parent);
      if (showLabels) n.label = el('text', { x: cx * pitch + side / 2, y: cy * pitch + side / 2, 'font-size': Math.round(side * 0.36), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gLabels);
    } else {
      const sh = SHAPES[code];
      n.shape = el('path', { d: big ? sh.d : sh.s, 'data-state': code, 'vector-effect': 'non-scaling-stroke', stroke: '#fff', 'stroke-width': big ? 1 : 0.6, 'stroke-linejoin': 'round' }, parent);
      const co = useCallouts && CALLOUTS[code];
      if (co) {
        el('path', { class: 'usm-leader', d: `M${sh.cx},${sh.cy}L${co[0] - 2},${co[1] + 9}`, fill: 'none', stroke: '#9aa3b8', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }, gMarks);
        n.chip = el('rect', { x: co[0], y: co[1], width: 34, height: 19, rx: 4, 'data-state': code, 'vector-effect': 'non-scaling-stroke', stroke: '#fff', 'stroke-width': 1 }, parent);
        if (showLabels) n.chipLabel = el('text', { x: co[0] + 17, y: co[1] + 10, 'font-size': 12, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gLabels);
      } else if (showLabels && (sh.bb[2] - sh.bb[0]) / k > 15 && (sh.bb[3] - sh.bb[1]) / k > 12) {
        const fix = LABEL_FIX[code]; const fs = Math.max(12, Math.round(11.5 * Math.min(1.25, Math.max(1, k))));
        n.label = el('text', { x: fix ? fix[0] : sh.cx, y: fix ? fix[1] : sh.cy, 'font-size': fix ? Math.round(fs * 0.86) : fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gLabels);
      }
    }
    for (const t of [n.label, n.chipLabel]) if (t) t.textContent = code;
  }

  // On small maps a highlighted state can be a sliver of a pixel: mark it with a dot so it still reads.
  const drawDots = () => {
    if (tiles || big) return;
    gMarks.replaceChildren();
    const lit = STATE_CODES.filter((code) => (vals ? stepFor(code) : hi.has(code)));
    // Minimum visible mark: when everything lit adds up to only a few screen pixels (Louisiana alone at 60 px),
    // every lit state gets a dot at its centre; a state that is itself a sliver (Delaware, DC) always gets one.
    const litPx = lit.reduce((sum, code) => sum + SHAPES[code].area, 0) / (k * k);
    const faint = litPx < 70;
    for (const code of lit) {
      const sh = SHAPES[code];
      const sliver = Math.max(sh.bb[2] - sh.bb[0], sh.bb[3] - sh.bb[1]) / k < 5;
      if (!faint && !sliver) continue;
      el('circle', { class: clsFor(code), cx: sh.cx, cy: sh.cy, r: (faint ? 3 : 2.6) * k, fill: fillFor(code), stroke: '#fff', 'stroke-width': 0.75, 'vector-effect': 'non-scaling-stroke' }, gMarks);
    }
  };

  const paint = () => {
    for (const code of STATE_CODES) {
      const n = nodes[code];
      for (const s of [n.shape, n.chip]) if (s) { s.setAttribute('class', clsFor(code)); s.setAttribute('fill', fillFor(code)); }
      for (const t of [n.label, n.chipLabel]) if (t) { t.setAttribute('class', `usm-l${darkFor(code) ? ' dark' : ''}`); t.setAttribute('fill', darkFor(code) ? '#fff' : '#14213d'); }
      if (n.group) {
        const v = vals ? Number(vals[code]) || 0 : null;
        n.group.setAttribute('aria-label', `${STATE_NAMES[code]}${v != null ? `: ${v}` : hi.has(code) ? ' (highlighted)' : ''}`);
        n.group.setAttribute('aria-pressed', sel === code ? 'true' : 'false');
        n.group.classList.toggle('sel', sel === code);
      }
    }
    drawDots();
    setTitle();
  };

  // Selected and hovered outlines are redrawn on top so neighbours never cover them.
  const outline = (cls, code) => {
    if (!overlay) return;
    overlay.querySelector(`.${cls}`)?.remove();
    if (!code) return;
    const sh = SHAPES[code]; const co = useCallouts && CALLOUTS[code];
    const g = el('g', { class: cls });
    el('path', { d: big ? sh.d : sh.s, fill: cls === 'usm-hover' ? fillFor(code) : 'none', 'vector-effect': 'non-scaling-stroke' }, g);
    if (co) el('rect', { x: co[0], y: co[1], width: 34, height: 19, rx: 4, fill: cls === 'usm-hover' ? fillFor(code) : 'none', 'vector-effect': 'non-scaling-stroke' }, g);
    if (cls === 'usm-hover') overlay.appendChild(g); else overlay.insertBefore(g, overlay.firstChild);
  };
  const paintSelected = () => {
    if (tiles) return;
    outline('usm-selected', sel);
  };

  if (interactive) {
    const fire = (code, event) => { if (typeof onState === 'function') onState(code, { name: STATE_NAMES[code], value: vals ? Number(vals[code]) || 0 : undefined, event }); };
    const codeOf = (t) => t?.closest?.('[data-state]')?.getAttribute('data-state');
    const tipFor = (code) => { const c = typeof tooltip === 'function' ? tooltip(code) : null; if (c != null && c !== '') return c; return `${STATE_NAMES[code]}${vals ? `: ${Number(vals[code]) || 0}` : ''}`; };
    const hover = (code, target) => { outline('usm-hover', code); if (code) showTip(nodes[code].chip && target === nodes[code].chip ? nodes[code].chip : nodes[code].shape, tipFor(code)); else hideTip(); };
    let roving = sel || 'TX';
    const setRoving = (code) => { nodes[roving]?.group.setAttribute('tabindex', '-1'); roving = code; nodes[code].group.setAttribute('tabindex', '0'); };
    setRoving(roving);
    const centre = (c) => (tiles ? TILE_GRID[c] : [SHAPES[c].cx, SHAPES[c].cy]);
    const move = (from, dx, dy) => {
      const [x0, y0] = centre(from); let best = null, bd = Infinity;
      for (const c of STATE_CODES) { if (c === from) continue; const [x, y] = centre(c); const ax = (x - x0) * dx + (y - y0) * dy; const off = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx); if (ax <= 0 || off > ax * 1.6) continue; const d = ax + off * 1.8; if (d < bd) { bd = d; best = c; } }
      return best;
    };
    svg.addEventListener('click', (e) => { const c = codeOf(e.target); if (c) { setRoving(c); fire(c, e); } });
    svg.addEventListener('pointerover', (e) => { const c = codeOf(e.target); hover(c || null, e.target); });
    svg.addEventListener('pointerleave', () => hover(null));
    svg.addEventListener('focusin', (e) => { const c = codeOf(e.target); if (c && e.target.matches(':focus-visible')) hover(c); });
    svg.addEventListener('focusout', () => hover(null));
    svg.addEventListener('keydown', (e) => {
      const c = codeOf(e.target); if (!c) return;
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (dir) { const to = move(c, dir[0], dir[1]); if (to) { setRoving(to); nodes[to].group.focus(); } e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { fire(c, e); e.preventDefault(); }
    });
    svg.focusState = (code) => { if (nodes[code]?.group) { setRoving(code); nodes[code].group.focus({ preventScroll: true }); } };
  }

  svg.setValues = (v) => { vals = v || null; scale = vals ? usMapScale(vals, steps) : null; paint(); paintSelected(); return svg; };
  svg.setHighlight = (codes) => { hi = new Set(validCodes(codes)); paint(); return svg; };
  svg.setSelected = (code) => { sel = code && STATE_NAMES[code] ? code : null; paint(); paintSelected(); return svg; };
  svg.getScale = () => scale;
  paint(); paintSelected();
  return svg;
}

/** A non-interactive map as an HTML string (same options as usMap). */
export function usMapHTML(opts = {}) { return usMap({ ...opts, interactive: false }).outerHTML; }
