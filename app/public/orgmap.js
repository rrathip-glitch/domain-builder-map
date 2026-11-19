// orgmap.js: the interactive org diagram for one builder (replaces org.js). Plain ES module, no libraries.
//
//   import { renderOrgMap } from './orgmap.js';        // also load orgmap.css
//   const map = renderOrgMap(container, builder, { onPerson, view: 'all' });
//   map.setView('all' | 'heads' | 'landfin');  map.expandAll();  map.collapseAll();  map.destroy();
//
// builder   one row of /api/data builders[] (or /api/builders/<id>): { name, profile: { regions[], org_note }, people[] }
// onPerson  called with the person row when a person is clicked (the host opens its drawer). Without it the module
//           shows its own compact detail card (title, covers, reports to, confidence, source and date, contact, note).
// Also exported: buildOrgModel(builder) -> the placement model (pure, no DOM), for tests and other views.
//
// Layout: chief executive -> corporate row (Land, Finance, Executive team, Other corporate) -> REGIONAL HEADS row
// (one card per region: name, what it covers, a small US map, the head) -> under each card its division and land
// leaders, collapsed to a count and opened in place, then any sub-regions stacked beneath. When regional heads report
// to a named executive (a COO, say) that executive sits between the chief executive and their regions.
// Placement: stated reporting line first (solid line when Verified or Reported, dotted when Inferred), otherwise by
// level and geography (dotted). Company regions with no named leader still show, as "Leader not publicly disclosed".
// Nobody is dropped: whoever cannot be placed is listed under "Not placed". Duplicate rows are merged into one card.
// Wide trees scroll sideways inside the diagram (the top block stays pinned); arrows and drag-to-pan are built in.
// Optional siblings, used when present: usmap.js (usMap) and icons.js (icon). Without them: no map, built-in icons.

let usmapMod = null;
let iconsMod = null;
try { usmapMod = await import('./usmap.js'); } catch { usmapMod = null; }
try { iconsMod = await import('./icons.js'); } catch { iconsMod = null; }

// ───────────────────────────── text helpers ─────────────────────────────
const STATE_NAMES = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' };
const METROS = {
  AZ: ['Phoenix', 'Scottsdale', 'Tucson', 'Prescott'],
  TX: ['Houston', 'Dallas', 'Fort Worth', 'Ft. Worth', 'Ft Worth', 'DFW', 'Austin', 'San Antonio', 'El Paso', 'Killeen', 'Waco', 'Corpus Christi', 'Lubbock', 'Amarillo', 'Permian Basin', 'Rio Grande Valley', 'College Station', 'Hill Country'],
  GA: ['Atlanta', 'Savannah', 'Augusta'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Chapel Hill', 'Triad', 'Triangle', 'Wilmington', 'Asheville', 'Greensboro', 'Winston-Salem'],
  SC: ['Charleston', 'Greenville', 'Myrtle Beach', 'Hilton Head', 'Bluffton', 'Spartanburg', 'Lowcountry', 'Low Country'],
  FL: ['Orlando', 'Tampa', 'Jacksonville', 'Miami', 'Fort Myers', 'Ft. Myers', 'Naples', 'Sarasota', 'Palm Beach', 'Fort Lauderdale', 'Port St. Lucie', 'Lakeland', 'Ocala', 'Daytona', 'Pensacola', 'Tallahassee', 'Bradenton', 'Space Coast', 'Treasure Coast', 'St. Augustine'],
  CO: ['Denver', 'Colorado Springs', 'Fort Collins', 'Front Range'],
  NV: ['Las Vegas', 'Reno'],
  TN: ['Nashville', 'Knoxville', 'Memphis', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
  WA: ['Seattle', 'Puget Sound', 'Spokane', 'Tacoma', 'Bellevue', 'Tri-Cities'],
  OR: ['Portland'],
  CA: ['Sacramento', 'Bay Area', 'Los Angeles', 'San Diego', 'Inland Empire', 'Orange County', 'Central Valley', 'Fresno', 'Bakersfield', 'San Jose', 'San Francisco', 'Temecula', 'Irvine', 'Stockton', 'East Bay', 'Coachella Valley', 'Palm Springs', 'SoCal', 'NorCal'],
  IL: ['Chicago', 'Chicagoland'],
  MN: ['Minneapolis', 'Twin Cities', 'St. Paul'],
  IN: ['Indianapolis', 'Fort Wayne'],
  OH: ['Columbus', 'Cincinnati', 'Cleveland', 'Dayton', 'Akron', 'Toledo'],
  MI: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Kalamazoo', 'Lansing'],
  UT: ['Salt Lake City', 'Salt Lake', 'St. George', 'Provo', 'Ogden', 'Wasatch'],
  ID: ['Boise', 'Treasure Valley', 'Coeur d\'Alene', 'Nampa'],
  NM: ['Albuquerque', 'Santa Fe', 'Las Cruces'],
  VA: ['Richmond', 'Hampton Roads', 'Norfolk', 'Fredericksburg', 'Williamsburg', 'Charlottesville'],
  MD: ['Baltimore', 'Annapolis'],
  PA: ['Philadelphia', 'Pittsburgh', 'Lehigh Valley', 'Harrisburg'],
  AL: ['Birmingham', 'Huntsville', 'Montgomery'],
  OK: ['Oklahoma City', 'Tulsa'],
  MO: ['Kansas City', 'St. Louis'],
  KY: ['Louisville'],
  LA: ['Baton Rouge', 'New Orleans', 'Shreveport'],
  NE: ['Omaha'],
  IA: ['Des Moines'],
  AR: ['Little Rock', 'Bentonville'],
  WI: ['Milwaukee'],
  MA: ['Boston'],
  NY: ['Long Island', 'Westchester', 'Hudson Valley'],
  HI: ['Honolulu', 'Oahu', 'Maui'],
  DC: ['Washington, D.C.', 'Washington D.C.', 'Washington, DC', 'Washington DC', 'D.C.'],
};
const CODES = new Set([...Object.values(STATE_NAMES), 'DC']);
// two-letter codes that are also ordinary words or common abbreviations: only trusted inside a list of codes
const SHAKY = new Set(['IN', 'OR', 'ME', 'OK', 'HI', 'LA', 'DE', 'CO', 'AL', 'MA', 'PA', 'MS', 'MD', 'ID', 'OH']);
const esc4re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const METRO_OF = new Map();
for (const [st, list] of Object.entries(METROS)) for (const m of list) METRO_OF.set(m, st);
const METRO_RE = new RegExp('(?<![A-Za-z])(' + [...METRO_OF.keys()].sort((a, b) => b.length - a.length).map(esc4re).join('|') + ')(?![A-Za-z])', 'g');
const NAME_RE = new RegExp('\\b(' + Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');
const STATE_WORDS = new Set(Object.keys(STATE_NAMES).flatMap((n) => n.toLowerCase().split(' ')).concat(['carolinas']));

// "(formerly Inland Empire)" must not place someone in the Inland Empire
const stripFormer = (t) => String(t || '').replace(/\((?:formerly|former|previously|ex-|until|earlier)[^)]*\)/gi, ' ');

function statesIn(text) {
  let t = stripFormer(text);
  const out = new Set();
  t = t.replace(METRO_RE, (m) => { out.add(METRO_OF.get(m)); return ' , '; });
  t = t.replace(/\bCarolinas\b/g, () => { out.add('NC'); out.add('SC'); return ' , '; });
  t = t.replace(NAME_RE, (m) => { out.add(STATE_NAMES[m]); return ' , '; });
  const codes = (t.match(/\b[A-Z]{2}\b/g) || []).filter((c) => CODES.has(c));
  const firm = codes.filter((c) => !SHAKY.has(c));
  const inList = new Set(codes).size + out.size >= 2 || t.trim().length <= 3;
  for (const c of codes) if (!SHAKY.has(c) || inList || firm.length) out.add(c);
  return out;
}

const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
const NICK = { tom: 'thomas', tommy: 'thomas', bill: 'william', billy: 'william', will: 'william', bob: 'robert', bobby: 'robert', rob: 'robert', jim: 'james', jimmy: 'james', tony: 'anthony', charlie: 'charles', chuck: 'charles', mike: 'michael', mick: 'michael', dave: 'david', joe: 'joseph', steve: 'steven', stephen: 'steven', rick: 'richard', rich: 'richard', dick: 'richard', andy: 'andrew', drew: 'andrew', ted: 'edward', ed: 'edward', jack: 'john', larry: 'lawrence', jerry: 'gerald', liz: 'elizabeth', beth: 'elizabeth', kathy: 'katherine', kate: 'katherine', katie: 'katherine', gene: 'eugene', hank: 'henry', matt: 'matthew', chris: 'christopher', dan: 'daniel', danny: 'daniel', greg: 'gregory', jeff: 'jeffrey', ken: 'kenneth', doug: 'douglas', tim: 'timothy', don: 'donald', ron: 'ronald', ben: 'benjamin', sam: 'samuel', alex: 'alexander', nick: 'nicholas', fred: 'frederick', jon: 'jonathan', pat: 'patrick', pete: 'peter', josh: 'joshua', zach: 'zachary' };
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameTokens = (s) => plain(s).replace(/\([^)]*\)/g, ' ').replace(/['’.]/g, '').replace(/[^a-z\s-]/g, ' ').split(/[\s]+/).filter((x) => x.length > 1 && !SUFFIX.has(x));
const suffixOf = (s) => (plain(s).match(/\b(jr|sr|ii|iii|iv)\b\.?/) || [])[1] || '';
const canon = (f) => NICK[f] || f;
const sameFirst = (a, b) => a === b || canon(a) === canon(b) || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
const samePerson = (A, B) => A.length >= 2 && B.length >= 2 && A[A.length - 1] === B[B.length - 1] && sameFirst(A[0], B[0]);

const CONF_RANK = { Verified: 0, Reported: 1, Inferred: 2 };
const confOf = (p) => (p && CONF_RANK[p.confidence] !== undefined ? p.confidence : 'Inferred');
const isLandP = (p) => /^Land/.test(p.role_category || '') || p.priority_group === 'Land';
const isFinP = (p) => !isLandP(p) && (['CFO', 'Treasury/Capital Markets', 'Finance (other)'].includes(p.role_category) || p.priority_group === 'Finance');
const isExecP = (p) => ['CEO', 'Chair/Founder', 'President/COO'].includes(p.role_category);
const isCorpP = (p) => p.level === 'Corporate' || (!p.level && !String(p.geography || '').trim());
const VAGUE = /not (publicly )?(stated|disclosed|public|published|specified|known|named|identified|confirmed)|unknown|unclear|undisclosed|unconfirmed|^n\/?a$|^tbd$/i;
const NATIONAL = /\b(national|nationwide|company-?wide|all (markets|regions|divisions)|enterprise)\b/i;
const NO_LEADER = /^(null|none|n\/?a|tbd|unknown|vacant|open)$|not (publicly )?(disclosed|named|stated|public|published|identified)|no (named|published|public)/i;

function seniority(title) {
  const t = plain(title);
  if (/\bchief\b|\bc[efo]o\b|\bclo\b/.test(t)) return 1;
  if (/executive vice president|\bevp\b/.test(t)) return 2;
  if (/senior vice president|sr\.? vice president|\bsvp\b|sr\.? vp\b|senior vp\b/.test(t)) return 3;
  if (/vice president|\bvp\b/.test(t)) return 4;
  if (/president|owner|founder|principal|partner/.test(t)) return 1;
  if (/treasurer|controller|head of/.test(t)) return 4;
  if (/director/.test(t)) return 5;
  if (/manager/.test(t)) return 6;
  return 7;
}
const ROLE_RANK = { 'CFO': 0, 'Treasury/Capital Markets': 1, 'Finance (other)': 2, 'Land Acquisition': 0, 'Land (other)': 0, 'Land Development': 0, 'CEO': 0, 'Chair/Founder': 1, 'President/COO': 2, 'Legal/GC': 3, 'Operations (other)': 4, 'Sales/Marketing': 5, 'Other': 6, 'Board': 7 };
const leadOf = (geo) => String(geo || '').replace(/\b(St|Ft|Mt)\.\s/g, '$1 ').split(/[:;(]|\.\s/)[0].trim();

const STOP = new Set(('division divisions region regions regional area areas group groups president vice senior executive director manager chief officer assistant secretary head title founding partner market markets metro north south east west central northern southern eastern western coast coastal county counties city greater homes homebuilding land with from that this also over under including includes based office quoted since exact stated published public state states segment segments reporting operating internal label only other names territory territories community communities corporate company named leader leaders metropolitan suburbs suburban quote release releases incl listed entity entities record source sources brand national not none evidenced confirmed development acquisition acquisitions operations sales construction finance building builder').split(' '));
// place names only: capitalised words ("Palm Atlantic", "Triangle"), never the commentary around them ("as shown in the record")
function placeTokens(text) {
  const words = (stripFormer(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z][A-Za-z'’]*/g) || []);
  const uni = new Set(), bi = new Set();
  const ok = (w) => w && /^[A-Z]/.test(w) && w.length >= 4;
  words.forEach((w, i) => {
    const lw = w.toLowerCase();
    if (!ok(w)) return;
    if (!STOP.has(lw) && !STATE_WORDS.has(lw)) uni.add(lw);
    const n = words[i + 1];
    if (ok(n) && !(STOP.has(lw) && STOP.has(n.toLowerCase())) && !(STATE_WORDS.has(lw) && STATE_WORDS.has(n.toLowerCase()))) bi.add(lw + ' ' + n.toLowerCase());
  });
  return { uni, bi };
}
const overlap = (a, b) => { let s = 0; for (const w of a.uni) if (b.uni.has(w)) s += 1; for (const w of a.bi) if (b.bi.has(w)) s += 2; return s; };
const subset = (a, b) => a.size > 0 && [...a].every((x) => b.has(x));

// true when the head's own geography or title names this company region ("Southeast: FL, GA" / "West Region President"),
// not merely contains the word ("North Florida" is not the "North" segment)
function namesRegion(regionName, p) {
  const clean = (x) => x.replace(/\b(region|area|segment|group|division)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const whole = plain(regionName).replace(/\([^)]*\)/g, ' ');
  const parts = [...new Set(whole.split('/').map(clean).filter(Boolean))];
  const n = parts.length === 1 ? parts[0] : clean(whole);
  if (n.length < 4) return false;
  const e = esc4re(n);
  return new RegExp('^' + e + '\\s*([:,;(.]|$|region|area|division|segment|group)').test(plain(p.geography).trim())
    || new RegExp('\\b' + e + '\\s+(region|area|division|segment|group)\\b|president[, ]+(of the |of |for the |, )?' + e + '\\b|\\(' + e + '\\)').test(plain(p.title));
}

// ───────────────────────────── the placement model ─────────────────────────────
export function buildOrgModel(builder) {
  const b = builder || {};
  const raw = Array.isArray(b.people) ? b.people : [];
  const profile = b.profile || {};

  // 1. de-duplicate: same id, same name, or the same person under a nickname in the same seat
  const recs = [], merged = [];
  raw.forEach((p, i) => {
    if (!p || !String(p.name || '').trim()) return;
    const toks = nameTokens(p.name);
    const rec = { p, id: String(p.person_id || `${i}-${toks.join('-')}`), toks, norm: toks.join(' '), sfx: suffixOf(p.name), also: [], place: null, line: 'dashed', kids: [] };
    const lead = (x) => new Set(plain(leadOf(x.geography)).split(/\W+/).filter((w) => w.length > 3));
    const dupe = recs.find((q) => (p.person_id && q.p.person_id === p.person_id)
      || (q.norm === rec.norm && rec.norm && !(q.sfx && rec.sfx && q.sfx !== rec.sfx))
      || (samePerson(q.toks, toks) && q.p.level === p.level && q.p.role_category === p.role_category && !isCorpP(p)
        && (!p.geography || !q.p.geography || [...lead(p)].some((w) => lead(q.p).has(w)) || [...statesIn(p.geography)].some((s) => statesIn(q.p.geography).has(s)))));
    if (!dupe) { recs.push(rec); return; }
    // keep the better-sourced row as the card, remember the other
    if ((CONF_RANK[confOf(p)] ?? 2) < (CONF_RANK[confOf(dupe.p)] ?? 2)) { dupe.also.push(dupe.p); dupe.p = p; dupe.toks = dupe.toks.length >= toks.length ? dupe.toks : toks; } else dupe.also.push(p);
    merged.push({ kept: dupe.p.name, other: p.name });
  });
  const byId = new Map(recs.map((r) => [r.id, r]));
  for (const r of recs) for (const a of r.also) if (a.person_id && !byId.has(String(a.person_id))) byId.set(String(a.person_id), r);

  const findName = (str) => {
    const out = [];
    const add = (r) => { if (r && !out.includes(r)) out.push(r); };
    const s = String(str || '').trim();
    if (!s) return out;
    const chunks = [s, s.replace(/\([^)]*\)/g, ' '), ...(s.match(/\(([^)]*)\)/g) || []).map((x) => x.slice(1, -1))];
    for (const c of [...chunks]) for (const part of c.split(/\s+(?:and|&)\s+|;|\//)) if (part.trim() && part !== c) chunks.push(part);
    for (const c of chunks) {
      const t = nameTokens(c);
      if (t.length < 2) continue;
      const exact = recs.filter((r) => r.norm === t.join(' '));
      if (exact.length) { add(exact[0]); continue; }
      const near = recs.filter((r) => samePerson(r.toks, t) && t.length <= 4);
      if (near.length === 1) add(near[0]);
    }
    if (!out.length) { // a name inside a longer phrase: "Board of Directors (Douglas C. Yearley, Jr., Executive Chairman)"
      const hay = ' ' + nameTokens(s).join(' ') + ' ';
      for (const r of recs) if (r.toks.length >= 2 && hay.includes(' ' + r.toks[0] + ' ') && hay.includes(' ' + r.toks[r.toks.length - 1] + ' ')) add(r);
    }
    return out;
  };
  const bossMemo = new Map();
  const bossOf = (r) => {
    if (bossMemo.has(r)) return bossMemo.get(r);
    let boss = null;
    if (r.p.reports_to_id && byId.has(String(r.p.reports_to_id))) boss = byId.get(String(r.p.reports_to_id));
    else if (r.p.reports_to) boss = findName(r.p.reports_to).find((x) => x !== r) || null;
    if (boss === r) boss = null;
    bossMemo.set(r, boss);
    return boss;
  };
  const lineOf = (r) => (bossOf(r) && /^(Verified|Reported)$/.test(r.p.reports_to_confidence || '') ? 'solid' : 'dashed');

  // 2. the top of the tree: the CEO, else the chair / founder / owner, else the president
  const corp = recs.filter((r) => isCorpP(r.p));
  const pickRoot = () => {
    const ceos = recs.filter((r) => r.p.role_category === 'CEO' && isCorpP(r.p));
    if (ceos.length > 1) {
      const top = ceos.filter((r) => !ceos.includes(bossOf(r)));
      const pool = top.length ? top : ceos;
      const reports = (r) => recs.filter((x) => bossOf(x) === r).length;
      return pool.slice().sort((x, y) => reports(y) - reports(x))[0];
    }
    return ceos[0] || corp.find((r) => r.p.role_category === 'Chair/Founder') || corp.find((r) => r.p.role_category === 'President/COO')
      || recs.find((r) => r.p.role_category === 'CEO') || corp.find((r) => r.p.priority_group === 'C-suite') || corp[0] || null;
  };
  const root = pickRoot();
  if (root) root.place = { where: 'root', via: 'level' };

  // 3. regions: one node per company region, one per regional head, joined where they match
  let seq = 0;
  const nodes = [];
  const mkNode = (o) => {
    const n = { id: 'n' + (seq++), kind: 'region', name: '', geography: '', tip: '', heads: [], refs: [], leaderText: '', fromProfile: false, vague: false, pooled: false, direct: false, parent: null, boss: null, line: 'dashed', children: [], members: [], states: new Set(), tok: { uni: new Set(), bi: new Set() }, ...o };
    nodes.push(n);
    return n;
  };
  const headNode = new Map(); // rec -> node it leads
  const setHead = (n, r) => { if (!n.heads.includes(r)) n.heads.push(r); headNode.set(r, n); r.place = { where: 'region', node: n, via: 'head' }; };
  for (const reg of Array.isArray(profile.regions) ? profile.regions : []) {
    if (!reg || !(reg.name || reg.geography)) continue;
    const n = mkNode({ name: String(reg.name || reg.geography || '').trim(), geography: String(reg.geography || '').trim(), fromProfile: true });
    n.states = statesIn(`${n.name} ; ${n.geography}`);
    const ls = String(reg.leader ?? '').trim();
    if (ls && !NO_LEADER.test(ls)) {
      const found = findName(ls);
      n.named = true;
      for (const r of found) { if (r === root || headNode.has(r)) n.refs.push(r); else setHead(n, r); }
      if (!found.length) { n.leaderText = ls.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || ls; n.leaderTip = ls; }
    }
  }
  const isHeadRole = (r) => r !== root && (r.p.role_category === 'Regional President' || (r.p.level === 'Regional' && ['President/COO', 'Division President'].includes(r.p.role_category)));
  for (const r of recs) {
    if (!isHeadRole(r) || headNode.has(r)) continue;
    const open = nodes.filter((n) => n.fromProfile && !n.heads.length && !n.refs.length && !n.leaderText);
    const hit = open.find((n) => namesRegion(n.name, r.p))
      || nodes.find((n) => { if (!n.fromProfile || n.named) return false; const hay = ' ' + nameTokens(n.geography + ' ' + n.name).join(' ') + ' '; return r.toks.length >= 2 && hay.includes(' ' + r.toks[0] + ' ' + r.toks[r.toks.length - 1] + ' '); });
    if (hit) { setHead(hit, r); continue; }
    // same footprint as exactly one company region that has no named leader: that is their region
    const mine = statesIn(`${r.p.geography || ''} ; ${r.p.title || ''}`);
    const same = mine.size ? open.filter((n) => n.states.size === mine.size && subset(mine, n.states)) : [];
    if (same.length === 1) { setHead(same[0], r); continue; }
    const lead = leadOf(r.p.geography);
    const vague = !lead || VAGUE.test(lead);
    const rest = String(r.p.geography || '').slice(String(r.p.geography || '').indexOf(lead) + lead.length).replace(/^[\s:;,.(]+/, '').replace(/\)\s*$/, '').trim();
    const n = mkNode({ name: vague ? 'Territory not published' : lead.slice(0, 80), geography: vague ? '' : (rest.length > 2 ? rest : ''), tip: r.p.geography || '', vague });
    setHead(n, r);
  }
  // no regional layer at all: the division presidents are the operating row
  let tier = 'regions';
  if (!nodes.length) {
    const divs = recs.filter((r) => r !== root && !isCorpP(r.p) && r.p.role_category === 'Division President');
    if (divs.length) {
      tier = 'divisions';
      for (const r of divs) {
        const lead = leadOf(r.p.geography);
        const vague = !lead || VAGUE.test(lead);
        const same = !vague && nodes.find((n) => plain(n.name) === plain(lead));
        if (same) { setHead(same, r); continue; }
        setHead(mkNode({ kind: 'division', name: vague ? 'Division not stated' : lead.slice(0, 80), geography: '', tip: r.p.geography || '', vague }), r);
      }
    }
  }
  for (const n of nodes) {
    const text = [n.name, n.geography, ...n.heads.map((h) => `${h.p.geography || ''} ${h.p.title || ''}`)].join(' ; ');
    n.states = statesIn(text);
    n.tok = placeTokens(text);
  }

  // geography match: the single region whose states contain the person's, else the best match on place names
  const isAncestor = (a, n) => { let c = n.parent, k = 0; while (c && k++ < 12) { if (c === a) return true; c = c.parent; } return false; };
  const geoPick = (text, cands) => {
    const st = statesIn(text), tk = placeTokens(text);
    // the best match on place names; when a region and its sub-region tie, the sub-region
    const best = (list) => {
      let top = 0, hits = [];
      for (const n of list) { const s = overlap(tk, n.tok); if (s > top) { top = s; hits = [n]; } else if (s === top && s > 0) hits.push(n); }
      if (hits.length <= 1) return hits[0] || null;
      const deep = hits.filter((n) => hits.every((m) => m === n || isAncestor(m, n)));
      return deep.length === 1 ? deep[0] : null;
    };
    // several regions fit and nothing tells them apart: the one that contains the others is the safe answer
    const container = (list) => {
      const c = list.filter((n) => list.every((m) => m === n || isAncestor(n, m) || (m.states.size < n.states.size && subset(m.states, n.states))));
      return c.length === 1 ? c[0] : null;
    };
    if (st.size) {
      const fits = cands.filter((n) => subset(st, n.states));
      if (fits.length === 1) return fits[0];
      if (fits.length > 1) return best(fits) || container(fits);
      const part = cands.filter((n) => [...st].some((s) => n.states.has(s)));
      if (part.length === 1) return part[0];
      if (part.length > 1) return best(part) || container(part);
      return best(cands.filter((n) => !n.states.size));
    }
    return best(cands);
  };

  // 4. nest regions: a head who reports to another head sits under that head; a named sub-region sits under its parent
  const baseName = (n) => plain(n.name).replace(/\([^)]*\)/g, ' ').replace(/\b(segment|region|group|area)\b/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const n of nodes) {
    const h = n.heads.find((x) => bossOf(x)) || null;
    const boss = h ? bossOf(h) : null;
    if (boss && headNode.has(boss) && headNode.get(boss) !== n && !isAncestor(n, headNode.get(boss))) { n.parent = headNode.get(boss); n.line = lineOf(h); continue; }
    if (boss && boss !== root && !headNode.has(boss)) { n.boss = boss; n.line = lineOf(h); continue; }
    if (boss === root) { n.line = lineOf(h); continue; }
    if (n.fromProfile) {
      const m = /\(in (?:the )?([^)]+)\)/i.exec(n.name);
      const mine = baseName(n);
      const par = nodes.find((o) => o !== n && o.fromProfile && !isAncestor(n, o) && baseName(o).length >= 4
        && ((m && baseName(o).split(' ')[0] === plain(m[1]).split(/\s+/)[0] && plain(m[1]).split(/\s+/).every((w) => plain(o.name).includes(w)))
          || (!m && (baseName(o).includes(' ') || baseName(o).length >= 9) && mine.startsWith(baseName(o) + ' ') && mine !== baseName(o))));
      if (par) { n.parent = par; n.line = 'dashed'; }
    }
  }
  for (const n of nodes) { // a led company region that lies wholly inside one leaderless company segment sits under it
    if (!n.fromProfile || n.parent || n.boss || !n.heads.length || !n.states.size) continue;
    if (n.heads.some((h) => bossOf(h))) continue;
    const segs = nodes.filter((o) => o !== n && o.fromProfile && !o.heads.length && !o.refs.length && !o.leaderText && !isAncestor(n, o) && o.states.size > n.states.size && subset(n.states, o.states));
    if (segs.length === 1) { n.parent = segs[0]; n.line = 'dashed'; }
  }
  for (const n of nodes) { // a head with no stated line and no company region of its own: under the region that contains it
    if (n.fromProfile || n.parent || n.boss || n.vague || n.kind !== 'region') continue;
    if (n.heads.some((h) => bossOf(h))) continue;
    const text = n.heads.map((h) => `${h.p.geography || ''} ; ${h.p.title || ''}`).join(' ; ');
    const par = geoPick(text, nodes.filter((o) => o !== n && o.fromProfile && !isAncestor(n, o)));
    if (par && !(subset(par.states, n.states) && par.states.size < n.states.size)) { n.parent = par; n.line = 'dashed'; }
  }
  // an executive whose only regional reports have no published territory stays in the corporate row; the card names them instead
  const realBoss = new Set(nodes.filter((n) => !n.parent && n.boss && !n.vague).map((n) => n.boss));
  for (const n of nodes) if (!n.parent && n.boss && !realBoss.has(n.boss)) { n.via = n.boss; n.boss = null; }
  // heads with no published territory share one card per parent instead of a column each
  const pools = new Map();
  for (const n of nodes.filter((x) => x.vague && !x.fromProfile)) {
    const key = (n.parent ? n.parent.id : '') + '|' + (n.boss ? n.boss.id : '') + '|' + (n.via ? n.via.id : '') + '|' + n.kind;
    if (!pools.has(key)) { pools.set(key, n); continue; }
    const keep = pools.get(key);
    keep.pooled = true;
    for (const h of n.heads) { keep.heads.push(h); headNode.set(h, keep); h.place = { where: 'region', node: keep, via: 'head' }; }
    if (n.line === 'solid') keep.line = 'solid';
    n.dead = true;
  }
  const live = nodes.filter((n) => !n.dead);
  for (const n of live) if (n.parent) n.parent.children.push(n);

  // 5. everyone else
  const spanBoss = new Set(live.filter((n) => !n.parent && n.boss).map((n) => n.boss));
  for (const r of spanBoss) if (!r.place) r.place = { where: 'boss', via: 'line' };
  const groups = { land: [], finance: [], exec: [], other: [] };
  const groupKey = (p) => (isLandP(p) ? 'land' : isFinP(p) ? 'finance' : isExecP(p) ? 'exec' : 'other');
  const directNodes = new Map();
  const directNode = (boss) => {
    if (!directNodes.has(boss)) directNodes.set(boss, mkNode({ kind: tier === 'divisions' ? 'division' : 'region', direct: true, name: 'No region published', geography: `Reporting straight to ${boss.p.name}`, boss: boss === root ? null : boss, line: 'solid' }));
    return directNodes.get(boss);
  };
  const candidates = () => nodes.filter((n) => !n.dead && !n.direct && !(n.vague && !n.fromProfile));
  const unplaced = [];
  const placing = new Set();
  const placeRec = (r) => {
    if (r.place) return r.place;
    if (placing.has(r)) return null;
    placing.add(r);
    const p = r.p, corpP = isCorpP(p);
    const boss = bossOf(r);
    let out = null;
    if (boss) {
      const geoText = `${p.geography || ''} ; ${p.title || ''}`;
      if (headNode.has(boss)) {
        // someone who leads several regions: their people go to the one that matches, else the first
        const led = nodes.filter((n) => !n.dead && (n.heads.includes(boss) || n.refs.includes(boss)));
        out = { where: 'region', node: (led.length > 1 && geoPick(geoText, led)) || headNode.get(boss), via: 'line' };
      } else if (boss === root || spanBoss.has(boss)) {
        if (!corpP) {
          // reports straight to the top: a matching region with no leader of its own is the same thing, shown in place
          const hit = geoPick(geoText, candidates());
          out = hit && !hit.heads.length && !hit.refs.length && !hit.leaderText ? { where: 'region', node: hit, via: 'line' } : { where: 'direct', boss, via: 'line' };
        }
      }
      else {
        const bp = placeRec(boss);
        if (bp && bp.where === 'region') out = { where: 'region', node: bp.node, via: 'line', under: boss };
        else if (bp && bp.where === 'group' && !corpP && (isLandP(p) || isFinP(p))) out = { where: 'group', group: groupKey(p), via: 'line', under: bp.group === groupKey(p) ? boss : null };
      }
    }
    if (!out && corpP) out = { where: 'group', group: groupKey(p), via: boss ? 'line' : 'level', under: boss && boss.place && boss.place.where === 'group' && boss.place.group === groupKey(p) ? boss : null };
    if (!out) {
      const text = `${p.geography || ''} ; ${p.title || ''}`;
      // named in a region's own description ("Tampa division (Brian Batten)")
      const named = candidates().filter((n) => { const hay = ' ' + nameTokens(n.geography).join(' ') + ' '; return r.toks.length >= 2 && hay.includes(' ' + r.toks[0] + ' ' + r.toks[r.toks.length - 1] + ' '); });
      const hit = named.length === 1 ? named[0] : geoPick(text, candidates());
      if (hit) out = { where: 'region', node: hit, via: 'geo' };
      else if ((isLandP(p) || isFinP(p)) && NATIONAL.test(p.geography || '')) out = { where: 'group', group: groupKey(p), via: 'level' };
    }
    if (out && out.where === 'direct') { const n = directNode(out.boss); out = { where: 'region', node: n, via: 'line' }; }
    placing.delete(r);
    r.place = out || { where: 'unplaced', via: 'none' };
    return r.place;
  };
  for (const r of recs) placeRec(r);
  for (const r of recs) {
    const pl = r.place;
    r.line = pl.via === 'line' ? lineOf(r) : 'dashed';
    if (pl.where === 'region' && pl.via !== 'head') pl.node.members.push(r);
    else if (pl.where === 'group') groups[pl.group].push(r);
    else if (pl.where === 'unplaced') unplaced.push(r);
  }
  for (const n of directNodes.values()) { n.states = new Set(n.members.flatMap((r) => [...statesIn(`${r.p.geography || ''} ${r.p.title || ''}`)])); }

  // order: a list reads as a small tree (boss, then the people under them)
  const cmp = (x, y) => (ROLE_RANK[x.p.role_category] ?? 6) - (ROLE_RANK[y.p.role_category] ?? 6) || seniority(x.p.title) - seniority(y.p.title) || (CONF_RANK[confOf(x.p)] - CONF_RANK[confOf(y.p)]) || x.p.name.localeCompare(y.p.name);
  const mRank = (p) => (p.role_category === 'Division President' || p.role_category === 'Regional President' ? 0 : isLandP(p) ? 1 : isFinP(p) ? 2 : 3);
  const memberCmp = (x, y) => mRank(x.p) - mRank(y.p)
    || seniority(x.p.title) - seniority(y.p.title) || String(x.p.geography || '').localeCompare(String(y.p.geography || '')) || x.p.name.localeCompare(y.p.name);
  const asTree = (list, sorter) => {
    const set = new Set(list), out = [];
    const kids = (r) => list.filter((x) => x.place.under === r || (bossOf(x) === r && set.has(r) && x !== r));
    const seen = new Set();
    const walk = (r, d) => { if (seen.has(r)) return; seen.add(r); r.depth = Math.min(d, 2); out.push(r); kids(r).sort(sorter).forEach((k) => walk(k, d + 1)); };
    list.filter((r) => !set.has(bossOf(r))).sort(sorter).forEach((r) => walk(r, 0));
    list.forEach((r) => walk(r, 0));
    return out;
  };
  for (const k of Object.keys(groups)) groups[k] = asTree(groups[k], cmp);
  for (const n of nodes) if (!n.dead) n.members = asTree(n.members, memberCmp);
  unplaced.sort(memberCmp);
  for (const r of unplaced) r.depth = 0;

  // spans: region columns grouped under the executive their heads report to
  const tops = nodes.filter((n) => !n.dead && !n.parent && !(n.direct && !n.members.length));
  // named head with a known territory first, then named heads with no published territory, then regions with no named head
  const rankTop = (n) => (n.direct ? 4 : !(n.heads.length || n.refs.length || n.leaderText) ? 3 : n.pooled || n.vague ? 2 : n.states.size ? 0 : 1);
  const spans = [];
  for (const n of tops) {
    const key = n.boss || null;
    let s = spans.find((x) => x.boss === key);
    if (!s) { s = { boss: key, nodes: [] }; spans.push(s); }
    s.nodes.push(n);
  }
  for (const s of spans) s.nodes.sort((x, y) => rankTop(x) - rankTop(y));
  // spans with real regions first (those under a named executive leading), spans that are only "territory not published" last
  const thin = (sp) => (sp.nodes.every((n) => n.vague || n.pooled || n.direct) ? 1 : 0);
  spans.sort((x, y) => thin(x) - thin(y) || (x.boss ? 0 : 1) - (y.boss ? 0 : 1));
  const sortKids = (n) => { n.children.sort((x, y) => rankTop(x) - rankTop(y)); n.children.forEach(sortKids); };
  tops.forEach(sortKids);

  const regionNodes = nodes.filter((n) => !n.dead && n.kind === 'region' && !n.direct && !(n.vague && !n.fromProfile));
  const stats = {
    people: recs.length,
    regions: regionNodes.length,
    regionsNamed: regionNodes.filter((n) => n.heads.length || n.refs.length || n.leaderText).length,
    heads: recs.filter((r) => headNode.has(r)).length,
    regionalHeads: recs.filter((r) => r.p.level === 'Regional' && (r.p.role_category === 'Regional President' || headNode.has(r))).length,
    land: recs.filter((r) => isLandP(r.p)).length,
    finance: recs.filter((r) => isFinP(r.p)).length,
    division: recs.filter((r) => r.p.level === 'Division' && !isLandP(r.p) && !isFinP(r.p)).length,
    unplaced: unplaced.length,
    merged: merged.length,
  };
  return { builder: b, root, groups, spans, unplaced, nodes: nodes.filter((n) => !n.dead), recs, merged, tier, stats, bossOf, lineOf };
}

// ───────────────────────────── drawing ─────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';
// used only if icons.js is not there
const FALLBACK_ICONS = {
  land: '<path d="M12 12.6 20.5 17 12 21.4 3.5 17 12 12.6z"/><path d="M12 17V3.5"/><path d="M12 4l6 2.4-6 2.4"/>',
  finance: '<path d="M3.5 9.5 12 4l8.5 5.5h-17z"/><path d="M6.5 13v4M10.2 13v4M13.8 13v4M17.5 13v4"/><path d="M4 20.2h16"/>',
  ceo: '<path d="M4.5 18.5 3 8l5.2 4L12 5.5l3.8 6.5L21 8l-1.5 10.5h-15z"/><path d="M8 15.2h8"/>',
  regional: '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13l-5.5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  division: '<path d="M5 20.5V5a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1v15.5"/><path d="M14.5 10.5H18a1 1 0 0 1 1 1v9"/><path d="M3 20.5h18"/><path d="M8.3 8h3M8.3 11.8h3M8.3 15.6h3"/>',
  legal: '<path d="M12 4v16M7.5 20h9M5.5 7h13"/><path d="M5.5 7 3 13.2a2.7 2.7 0 0 0 5 0L5.5 7zM18.5 7 16 13.2a2.7 2.7 0 0 0 5 0L18.5 7z"/>',
  board: '<circle cx="12" cy="8.2" r="3"/><path d="M6.5 19.5v-.8a5.5 5.5 0 0 1 11 0v.8"/><circle cx="4.8" cy="10" r="1.9"/><circle cx="19.2" cy="10" r="1.9"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20v-.6a7 7 0 0 1 14 0v.6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  source: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-down': '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  'chevron-right': '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
};
const GLYPHS = { land: '◆', finance: '$', ceo: '★', regional: '◎', division: '▪', legal: '§', board: '◌', person: '•', phone: '☎', email: '✉', source: '↗', close: '×', 'chevron-down': '▾', 'chevron-right': '▸' };
function mkIcon(name, size = 18, title) {
  try {
    if (iconsMod && typeof iconsMod.icon === 'function' && (!Array.isArray(iconsMod.ICON_NAMES) || iconsMod.ICON_NAMES.includes(name))) {
      const r = iconsMod.icon(name, { size, title });
      if (r && r.nodeType) return r;
      if (typeof r === 'string' && r.includes('<svg')) { const t = document.createElement('span'); t.innerHTML = r; if (t.firstElementChild) return t.firstElementChild; }
    }
  } catch { /* fall through to the built-in set */ }
  if (FALLBACK_ICONS[name]) {
    const svg = document.createElementNS(SVGNS, 'svg');
    for (const [a, v] of Object.entries({ class: 'ico', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': title ? 'false' : 'true' })) svg.setAttribute(a, v);
    svg.innerHTML = (title ? `<title>${String(title).replace(/[&<>]/g, '')}</title>` : '') + FALLBACK_ICONS[name];
    return svg;
  }
  const s = document.createElement('span'); s.className = 'om-glyph'; s.textContent = GLYPHS[name] || '•'; if (title) s.title = title;
  return s;
}
function mkMap(states, size, title) {
  if (!usmapMod || typeof usmapMod.usMap !== 'function' || !states || !states.length) return null;
  try {
    const r = usmapMod.usMap({ highlight: states, size, title });
    if (r && r.nodeType) return r;
    if (typeof r === 'string' && r.includes('<svg')) { const t = document.createElement('span'); t.innerHTML = r; return t.firstElementChild; }
  } catch { /* no map rather than a broken one */ }
  return null;
}
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false && c !== '') e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const roleIcon = (p) => (isLandP(p) ? 'land' : isFinP(p) ? 'finance' : isExecP(p) ? 'ceo' : p.role_category === 'Regional President' ? 'regional' : p.role_category === 'Division President' ? 'division' : p.role_category === 'Legal/GC' ? 'legal' : p.role_category === 'Board' ? 'board' : 'person');
const roleTone = (p) => (isLandP(p) ? 'land' : isFinP(p) ? 'fin' : isExecP(p) ? 'exec' : p.role_category === 'Regional President' ? 'reg' : 'other');
const hasEmail = (p) => !!String(p.email || '').trim() && p.email_confidence !== 'Inferred';
const hasPhone = (p) => !!String(p.phone || '').trim();
const cleanName = (s) => { const t = String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').replace(/[\s,;:/-]+$/, '').trim(); return t || String(s || '').trim(); };
// card titles drop research notes in brackets ("Region President (third-party profiles: ...)"); the exact title stays in the hover and the detail
const NOTE_WORDS = /\b(per|shown|record|records|snippet|profile|profiles|source|reported|unverified|unconfirmed|title|seen|aggregator|inferred|listed|formerly|former|described|styled|elected|retiring|retired|undated|since|until|as of|also|truncated|company|publishes|published)\b/i;
const cardTitle = (t) => {
  const raw = String(t || '');
  const out = raw.replace(/([A-Za-z])\[([^\]]*)\]/g, '$1$2').replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*\(([^)]*)\)?/g, (m, inner) => (!m.trim().endsWith(')') || inner.trim().split(/\s+/).length >= 4 || NOTE_WORDS.test(inner) ? '' : m))
    .replace(/\s+([,;])/g, '$1').replace(/[\s,;:-]+$/, '').trim();
  return out || raw;
};
const VIEWS = ['all', 'heads', 'landfin'];
const VIEW_LABELS = { all: 'All', heads: 'Regional heads only', landfin: 'Land and finance only' };
const GROUP_META = {
  land: { label: 'Land', icon: 'land', empty: 'No corporate land head published' },
  finance: { label: 'Finance', icon: 'finance', empty: 'No corporate finance head published' },
  exec: { label: 'Executive team', icon: 'ceo', empty: '' },
  other: { label: 'Other corporate', icon: 'person', empty: '' },
};
const CAPS = { land: 2, finance: 2, exec: 2, other: 0 };

export function renderOrgMap(container, builder, { onPerson, view = 'all' } = {}) {
  const model = buildOrgModel(builder);
  const st = model.stats;
  const small = st.people <= 14;
  let cur = VIEWS.includes(view) ? view : 'all';
  let userOpen = new Map(); // collapsible id -> open? (the user's choice; cleared when the view changes)
  let wires = [];           // { svg: 'top' | 'canvas', from, to: [{ el, line }], main }
  let cards = new Map();    // rec -> [elements]
  let selected = null;
  let raf = 0, kickUntil = 0, destroyed = false;
  const isLF = (r) => isLandP(r.p) || isFinP(r.p);
  const defaultOpen = (id) => (cur === 'landfin' ? true : small);
  const isOpen = (id) => (userOpen.has(id) ? userOpen.get(id) : defaultOpen(id));

  const el = h('div', { class: 'om' });
  container.replaceChildren(el);

  // ── header: one-line summary, controls, legend
  // headline: the build's agreed figures when the builder row carries them (builder.derived), else counted the same way
  const dv = (builder && builder.derived) || {};
  const fig = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const nRegions = fig(dv.regions_listed, st.regions), nHeads = fig(dv.regional_heads, st.regionalHeads);
  const nLand = fig(dv.land_count, st.land), nFin = fig(dv.finance_count, st.finance), nDiv = fig(dv.division_count, st.division);
  const parts = [];
  if (nRegions) parts.push(plural(nRegions, 'region'));
  else if (model.tier === 'divisions') parts.push('No regional layer published');
  if (nHeads) parts.push(plural(nHeads, 'regional head')); else if (nRegions) parts.push('regional heads not public');
  if (nLand) parts.push(plural(nLand, 'land leader'));
  if (nFin) parts.push(plural(nFin, 'finance leader'));
  if (nDiv) parts.push(plural(nDiv, 'division leader'));
  if (!nRegions && !nHeads && !nLand && !nFin) parts.unshift(plural(st.people, 'person', 'people') + ' on record');
  const seg = h('div', { class: 'om-seg', role: 'group', 'aria-label': 'Show' }, VIEWS.map((v) => h('button', { type: 'button', 'data-om-view': v, 'aria-pressed': String(v === cur), class: v === cur ? 'on' : '' }, VIEW_LABELS[v])));
  const btnExpand = h('button', { type: 'button', class: 'om-btn', 'data-om-act': 'expand' }, 'Expand all');
  const btnCollapse = h('button', { type: 'button', class: 'om-btn', 'data-om-act': 'collapse' }, 'Collapse all');
  const legend = h('div', { class: 'om-legend', 'aria-label': 'Legend' },
    h('span', { class: 'om-lg' }, h('i', { class: 'om-dot om-c-Verified' }), 'Verified'),
    h('span', { class: 'om-lg' }, h('i', { class: 'om-dot om-c-Reported' }), 'Reported'),
    h('span', { class: 'om-lg' }, h('i', { class: 'om-dot om-c-Inferred' }), 'Inferred'),
    h('span', { class: 'om-lg om-lg-gap' }, h('i', { class: 'om-ln' }), 'stated line'),
    h('span', { class: 'om-lg' }, h('i', { class: 'om-ln om-ln-d', title: 'Inferred reporting line, or placed by level and geography' }), 'inferred line'),
    h('span', { class: 'om-lg om-lg-gap' }, h('span', { class: 'om-ct' }, mkIcon('email', 15)), 'contact published'));
  const head = h('div', { class: 'om-head' }, h('p', { class: 'om-summary' }, parts.join(' · ')), h('div', { class: 'om-bar' }, seg, btnExpand, btnCollapse, legend));
  const stage = h('div', { class: 'om-stage' });
  const detail = h('div', { class: 'om-detail', hidden: true, role: 'dialog', 'aria-label': 'Person detail' });
  el.append(head, stage, detail);

  // ── pieces
  const tipFor = (p) => [p.name, p.title, p.geography ? `Covers: ${p.geography}` : '', `${confOf(p)} source`].filter(Boolean).join('\n');
  // field people read best place first: "Austin · Division President" (the exact title stays in the tooltip and the detail)
  const fieldLine = (p) => {
    const title = cardTitle(p.title || p.role_category || '');
    const lead = leadOf(p.geography).replace(/\b(division|divisions|market|metro|area)\b/gi, ' ').replace(/\s+/g, ' ').replace(/[\s,/-]+$/, '').trim();
    if (!lead || lead.length > 34 || VAGUE.test(lead) || isCorpP(p)) return title;
    if (plain(title).includes(plain(lead)) && p.role_category !== 'Division President') return title;
    if (plain(title).startsWith(plain(lead))) return title;
    if (p.role_category !== 'Division President') return `${title} · ${lead}`;
    const cut = title.replace(new RegExp('(?:[,\\s(-]+(?:in|of|for|at)?\\s*|\\s+)' + esc4re(lead) + '\\)?\\s*$', 'i'), '').trim();
    return `${lead} · ${cut || title}`;
  };
  function personEl(r, size = 'row', extra = '') {
    const p = r.p;
    const e = h('div', { class: `om-p om-p--${size} om-t-${roleTone(p)} ${extra}`.trim(), role: 'button', tabindex: '0', title: tipFor(p), 'data-om-pid': r.id },
      h('span', { class: 'om-ico' }, mkIcon(roleIcon(p), size === 'root' ? 22 : size === 'row' ? 17 : 19), h('i', { class: `om-dot om-c-${confOf(p)}`, title: `${confOf(p)} source` })),
      h('span', { class: 'om-p-txt' }, h('span', { class: 'om-p-name' }, p.name), h('span', { class: 'om-p-title' }, extra.includes('om-field') ? fieldLine(p) : cardTitle(p.title || p.role_category || ''))),
      (hasEmail(p) || hasPhone(p)) && h('span', { class: 'om-ct', title: [hasEmail(p) && 'Published email', hasPhone(p) && 'Published phone'].filter(Boolean).join(' and ') }, hasEmail(p) && mkIcon('email', 14), hasPhone(p) && mkIcon('phone', 14)));
    if (!cards.has(r)) cards.set(r, []);
    cards.get(r).push(e);
    if (selected === r) e.classList.add('om-sel');
    return e;
  }
  // a collapsible list that opens in place
  function listEl(id, rows) {
    const o = isOpen(id);
    return h('div', { class: 'om-list' + (o ? ' open' : ''), 'data-om-list': id }, h('div', { class: 'om-list-in' }, rows));
  }
  function toggleEl(id, label, cls = '', openLabel = '') {
    const o = isOpen(id);
    const b = h('button', { type: 'button', class: `om-tg ${cls}`.trim(), 'data-om-toggle': id, 'aria-expanded': String(o), 'data-om-l0': label, 'data-om-l1': openLabel || label }, h('span', { class: 'om-tg-ch' }, mkIcon('chevron-right', 15)), h('span', { class: 'om-tg-l' }, label));
    return b;
  }
  const rowsOf = (list, field) => list.map((r) => h('div', { class: `om-row om-d${r.depth || 0} om-ln-${r.line}` }, personEl(r, 'row', field ? 'om-field' : '')));

  function groupEl(key) {
    const meta = GROUP_META[key];
    const all = model.groups[key];
    const cap = small ? 99 : cur === 'landfin' ? 6 : CAPS[key];
    const first = all.slice(0, cap), rest = all.slice(cap);
    const box = h('div', { class: `om-g om-g--${key}` + (all.length ? '' : ' om-g--empty') },
      h('div', { class: 'om-g-h' }, h('span', { class: 'om-g-ic' }, mkIcon(meta.icon, 17)), h('span', { class: 'om-g-l' }, meta.label), all.length ? h('span', { class: 'om-g-n' }, String(all.length)) : null));
    if (!all.length) {
      box.append(h('div', { class: 'om-g-none' }, meta.empty));
      const elsewhere = key === 'land' ? st.land : key === 'finance' ? st.finance : 0;
      if (elsewhere && cur !== 'landfin') box.append(h('button', { type: 'button', class: 'om-link', 'data-om-view': 'landfin' }, `See ${plural(elsewhere, key === 'land' ? 'land leader' : 'finance leader')} in the field`));
      return box;
    }
    if (first.length) box.append(h('div', { class: 'om-g-list' }, rowsOf(first)));
    if (rest.length) {
      const id = 'g:' + key;
      box.append(listEl(id, rowsOf(rest)), toggleEl(id, cap ? `${rest.length} more` : plural(rest.length, 'person', 'people'), '', cap ? 'Show fewer' : ''));
    }
    return box;
  }

  const visMembers = (n) => (cur === 'heads' ? [] : cur === 'landfin' ? n.members.filter(isLF) : n.members);
  // a company region with no named head and nobody placed in it: listed in one line under the row, not a card each
  const isEmptyGap = (n) => n.fromProfile && !n.heads.length && !n.refs.length && !n.leaderText && !n.members.length && n.children.every(isEmptyGap);
  const nodeVisible = (n) => !isEmptyGap(n) && (cur === 'heads' ? !n.direct : cur === 'landfin' ? (visMembers(n).length > 0 || n.heads.some(isLF) || n.children.some(nodeVisible)) : true);
  function countLabel(n, list) {
    if (n.kind === 'division') return `${list.length} on this team`;
    const land = list.filter((r) => isLandP(r.p)).length, fin = list.filter((r) => isFinP(r.p)).length, div = list.length - land - fin;
    const bits = [];
    const field = list.filter((r) => !isLandP(r.p) && !isFinP(r.p) && r.p.level === 'Division').length;
    if (div) bits.push(plural(div, field === div ? 'division leader' : 'leader'));
    if (land) bits.push(div ? `${land} land` : plural(land, 'land leader'));
    if (fin) bits.push(div || land ? `${fin} finance` : plural(fin, 'finance leader'));
    return bits.join(' · ');
  }
  function regionCard(n, sub) {
    const list = visMembers(n);
    const named = n.heads.length || n.refs.length || n.leaderText;
    const card = h('div', { class: 'om-rc' + (sub ? ' om-rc--sub' : '') + (named || n.direct ? '' : ' om-rc--gap') + (n.direct ? ' om-rc--nolayer' : '') + (n.kind === 'division' ? ' om-rc--div' : ''), 'data-om-node': n.id });
    const states = [...n.states].sort();
    const full = [n.name, n.geography || n.tip].filter(Boolean).join('\n');
    const map = mkMap(states, 76, cleanName(n.name));
    // one short line of coverage; the full wording is in the tooltip
    const short = String(n.geography || '').replace(/^[A-Za-z-]+-stated:\s*/i, '').replace(/\b(St|Ft|Mt|incl|approx|est|vs|etc|Inc|Co|Corp|No|Jr|Sr)\.\s/g, '$1 ').split(/;|\.\s/)[0].replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[\s,:-]+$/, '').trim();
    const cover = short.length > 2 ? short : (states.length ? states.join(', ') : '');
    card.append(h('div', { class: 'om-rc-top', title: full },
      h('div', { class: 'om-rc-name' }, cleanName(n.name)),
      h('div', { class: 'om-rc-cov' + (map ? '' : ' om-rc-cov--nomap') }, map && h('span', { class: 'om-rc-map' }, map), h('span', { class: 'om-rc-geo' }, cover || (n.direct ? '' : n.via ? `Reporting to ${n.via.p.name}` : 'Coverage not published')))));
    if (!n.direct) {
      const who = h('div', { class: 'om-rc-who' });
      for (const r of n.heads) who.append(personEl(r, 'head'));
      for (const r of n.refs) who.append(personEl(r, 'head', 'om-p--ref'));
      if (!n.heads.length && !n.refs.length) {
        who.append(n.leaderText
          ? h('div', { class: 'om-p om-p--head om-p--text', title: (n.leaderTip || n.leaderText) + '\nNamed in the company profile; no person record yet' }, h('span', { class: 'om-ico' }, mkIcon('regional', 19), h('i', { class: 'om-dot om-c-Inferred' })), h('span', { class: 'om-p-txt' }, h('span', { class: 'om-p-name' }, n.leaderText), h('span', { class: 'om-p-title' }, 'Named as leader; no person record')))
          : h('div', { class: 'om-p om-p--head om-p--none' }, h('span', { class: 'om-ico' }, '?'), h('span', { class: 'om-p-txt' }, h('span', { class: 'om-p-name' }, 'Leader not publicly disclosed'))));
      }
      card.append(who);
    }
    if (list.length) card.append(toggleEl('n:' + n.id, countLabel(n, list), 'om-tg--foot'));
    return card;
  }
  // one region: its card, its people (opened in place), then its sub-regions stacked beneath so the top row stays one card per region
  function nodeEl(n, sub) {
    const list = visMembers(n);
    const kids = n.children.filter(nodeVisible);
    const card = regionCard(n, sub);
    const box = h('div', { class: sub ? `om-node om-sub om-ln-${n.line}` : 'om-node om-col' }, card);
    if (list.length) box.append(listEl('n:' + n.id, rowsOf(list, true)));
    if (kids.length) box.append(h('div', { class: 'om-subs' }, kids.map((k) => nodeEl(k, true).box)));
    return { box, card };
  }

  // ── build the diagram for the current view
  let scroll, canvas, topEl, svgTop, svgCanvas, tierEl, tierLabelEl, navL, navR, rootCard;
  let tierSpans = [], classicW = 0, needMeasure = true, lastVw = 0, wrapMode = false;
  function build() {
    const keepX = scroll ? scroll.scrollLeft : 0;
    wires = []; cards = new Map(); tierSpans = []; needMeasure = true;
    hideDetail();
    el.className = `om om-view-${cur}` + (small ? ' om-small' : '');
    for (const b of seg.children) { const on = b.getAttribute('data-om-view') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    stage.replaceChildren();
    if (!model.recs.length) { stage.append(h('div', { class: 'om-empty' }, 'No people mapped yet for this builder.')); btnExpand.disabled = btnCollapse.disabled = true; return; }

    svgCanvas = document.createElementNS(SVGNS, 'svg'); svgCanvas.setAttribute('class', 'om-wires'); svgCanvas.setAttribute('aria-hidden', 'true');
    svgTop = document.createElementNS(SVGNS, 'svg'); svgTop.setAttribute('class', 'om-wires'); svgTop.setAttribute('aria-hidden', 'true');

    // the regional (or division) row
    const spans = model.spans.map((s) => ({ boss: s.boss, nodes: s.nodes.filter(nodeVisible) })).filter((s) => s.nodes.length);
    const anyBoss = spans.some((s) => s.boss);
    tierEl = null;
    let tierLabel = null;
    const mainTargets = [];
    if (spans.length) {
      tierEl = h('div', { class: 'om-tier' });
      for (const s of spans) {
        const cols = h('div', { class: 'om-cols' });
        const tops = [];
        for (const n of s.nodes) { const c = nodeEl(n, false); cols.append(c.box); tops.push({ el: c.card, line: n.line }); }
        const sp = h('div', { class: 'om-span' + (s.boss ? ' om-span--boss' : '') });
        const rec = { boss: null, bossLine: 'dashed', tops };
        tierSpans.push(rec);
        if (anyBoss) {
          const hd = h('div', { class: 'om-span-head' });
          if (s.boss) {
            const bc = personEl(s.boss, 'boss');
            hd.append(bc);
            rec.boss = bc; rec.bossLine = model.bossOf(s.boss) === model.root ? model.lineOf(s.boss) : 'dashed';
            mainTargets.push({ el: bc, line: rec.bossLine });
            wires.push({ svg: 'canvas', tier: true, from: bc, to: tops });
          } else mainTargets.push(...tops);
          sp.append(hd);
        } else mainTargets.push(...tops);
        sp.append(cols);
        tierEl.append(sp);
      }
      const n = nRegions || model.nodes.filter((x) => x.kind === 'region' && !x.direct && !(x.vague && !x.fromProfile)).length;
      tierLabel = h('div', { class: 'om-tierlabel' }, h('span', { class: 'om-tl-in' }, h('span', { class: 'om-tl-ic' }, mkIcon(model.tier === 'divisions' ? 'division' : 'regional', 17)),
        h('span', { class: 'om-tl-t' }, model.tier === 'divisions' ? 'Division leaders' : 'Regional heads'),
        h('span', { class: 'om-tl-s' }, model.tier === 'divisions' ? 'no regional layer published' : (cur === 'landfin' ? 'regions with land or finance leaders' : `${plural(n, 'region')} and what each covers`)),
        h('span', { class: 'om-tl-more', hidden: true }, 'scroll sideways for more')));
    }

    // the top: chief executive and the corporate row
    rootCard = model.root ? personEl(model.root, 'root') : h('div', { class: 'om-p om-p--root om-p--none' }, h('span', { class: 'om-ico' }, '?'), h('span', { class: 'om-p-txt' }, h('span', { class: 'om-p-name' }, builder && builder.name ? builder.name : 'Chief executive'), h('span', { class: 'om-p-title' }, 'Chief executive not on record')));
    topEl = h('div', { class: 'om-top' }, svgTop, h('div', { class: 'om-rootrow' }, rootCard));
    let keys = cur === 'heads' ? [] : cur === 'landfin' ? ['land', 'finance'] : ['land', 'finance', ...['exec', 'other'].filter((k) => model.groups[k].length)];
    if (cur === 'all' && model.recs.length <= 1) keys = [];
    if (keys.length) {
      const boxes = keys.map((k) => ({ k, box: groupEl(k) }));
      const lineFor = (k) => { const lead = model.groups[k][0]; return lead && model.bossOf(lead) === model.root && model.lineOf(lead) === 'solid' ? 'solid' : 'dashed'; };
      let corp;
      if (tierEl) {
        const left = boxes.length > 2 ? boxes.slice(0, 2) : boxes.slice(0, 1), right = boxes.length > 2 ? boxes.slice(2) : boxes.slice(1);
        corp = h('div', { class: 'om-corp om-corp--split' }, h('div', { class: 'om-corp-l' }, left.map((x) => x.box)), h('div', { class: 'om-corp-gut' }), h('div', { class: 'om-corp-r' }, right.map((x) => x.box)));
      } else corp = h('div', { class: 'om-corp' }, boxes.map((x) => x.box));
      topEl.append(corp);
      wires.push({ svg: 'top', from: rootCard, to: boxes.map((x) => ({ el: x.box, line: lineFor(x.k) })) });
    }
    if (tierEl) wires.push({ svg: 'canvas', main: true, from: rootCard, to: mainTargets });

    canvas = h('div', { class: 'om-canvas' }, svgCanvas, topEl);
    tierLabelEl = tierLabel;
    if (tierEl) canvas.append(tierLabel, tierEl);
    const gaps = cur === 'landfin' ? [] : model.nodes.filter((n) => isEmptyGap(n) && !(n.parent && isEmptyGap(n.parent)));
    if (gaps.length) {
      const names = gaps.map((n) => cleanName(n.name)).join(', ');
      canvas.append(h('div', { class: 'om-gaps', title: names }, h('span', { class: 'om-gaps-n' }, `${plural(gaps.length, 'region')}, ${gaps.length === 1 ? 'head' : 'heads'} not public:`), ' ', names));
    }

    // not placed: never dropped
    const loose = cur === 'heads' ? [] : cur === 'landfin' ? model.unplaced.filter(isLF) : model.unplaced;
    if (loose.length) {
      const id = 'unplaced';
      const sec = h('div', { class: 'om-loose' },
        h('div', { class: 'om-loose-h' }, h('span', { class: 'om-loose-t' }, 'Not placed'), h('span', { class: 'om-loose-s' }, `${plural(loose.length, 'person', 'people')} whose region or reporting line is not published`), toggleEl(id, 'Show', 'om-tg--inline', 'Hide')),
        listEl(id, h('div', { class: 'om-loose-grid' }, loose.map((r) => personEl(r, 'row', 'om-field')))));
      canvas.append(sec);
    }
    scroll = h('div', { class: 'om-scroll' }, canvas);
    navL = h('button', { type: 'button', class: 'om-nav om-nav-l', 'aria-label': 'Scroll left', hidden: true }, mkIcon('chevron-right', 22));
    navR = h('button', { type: 'button', class: 'om-nav om-nav-r', 'aria-label': 'Scroll right', hidden: true }, mkIcon('chevron-right', 22));
    stage.append(scroll, navL, navR);
    scroll.addEventListener('scroll', onScroll, { passive: true });
    scroll.addEventListener('pointerdown', onPanStart);
    syncToggles();
    btnExpand.disabled = btnCollapse.disabled = !el.querySelector('[data-om-toggle]');
    if (ro) { ro.disconnect(); ro.observe(scroll); ro.observe(canvas); }
    layout();
    scroll.scrollLeft = keepX;
    onScroll();
  }

  function syncToggles() {
    for (const b of el.querySelectorAll('[data-om-toggle]')) {
      const id = b.getAttribute('data-om-toggle'), o = isOpen(id);
      b.setAttribute('aria-expanded', String(o));
      b.classList.toggle('open', o);
      b.querySelector('.om-tg-l').textContent = b.getAttribute(o ? 'data-om-l1' : 'data-om-l0');
    }
    for (const l of el.querySelectorAll('[data-om-list]')) l.classList.toggle('open', isOpen(l.getAttribute('data-om-list')));
  }

  // ── connector lines
  const rectIn = (node, ref) => { const a = node.getBoundingClientRect(), b = ref.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, top: a.top - b.top, bottom: a.bottom - b.top, left: a.left - b.left, right: a.right - b.left }; };
  const R = (v) => Math.round(v * 2) / 2;
  function drawWires() {
    if (!canvas || !canvas.isConnected) return;
    const dTop = { solid: [], dashed: [] }, dCan = { solid: [], dashed: [] };
    const vw = scroll.clientWidth, W = canvas.scrollWidth;
    if (wrapMode && tierEl && rootCard) {
      // wrapped rows: a spine down the left edge, a bus above each row of cards, a drop to each card
      const push = (line, d) => dCan[line === 'solid' ? 'solid' : 'dashed'].push(d);
      const rows = (tops) => { const m = new Map(); for (const t of tops) { if (!t.el.isConnected) continue; const r = rectIn(t.el, canvas); const k = Math.round(r.top); if (!m.has(k)) m.set(k, []); m.get(k).push({ ...r, line: t.line }); } return [...m.values()]; };
      const f = rectIn(rootCard, canvas), tr = rectIn(tierEl, canvas);
      const spineX = tr.left + 9;
      const turnY = (tierLabelEl ? rectIn(tierLabelEl, canvas).top : tr.top) - 8;
      let endY = turnY;
      for (const sp of tierSpans) {
        let x0 = spineX, startY = null;
        if (sp.boss && sp.boss.isConnected) {
          const b = rectIn(sp.boss, canvas), midY = (b.top + b.bottom) / 2;
          push(sp.bossLine, `M${R(spineX)} ${R(midY)}H${R(b.left)}`);
          endY = Math.max(endY, midY);
          x0 = b.left + 16; startY = b.bottom;
        }
        let last = startY;
        for (const row of rows(sp.tops)) {
          const busY = row[0].top - 14;
          dCan.solid.push(`M${R(x0)} ${R(busY)}H${R(Math.max(...row.map((c) => c.x)))}`);
          for (const c of row) push(c.line, `M${R(c.x)} ${R(busY)}V${R(c.top)}`);
          last = Math.max(last ?? busY, busY);
          if (startY === null) endY = Math.max(endY, busY);
        }
        if (startY !== null && last > startY) dCan.solid.push(`M${R(x0)} ${R(startY)}V${R(last)}`);
      }
      dCan.solid.push(`M${R(f.x)} ${R(f.bottom)}V${R(turnY)}H${R(spineX)}V${R(endY)}`);
    }
    for (const w of wires) {
      if (wrapMode && (w.main || w.tier)) continue;
      const to = w.to.filter((t) => t.el.isConnected && t.el.offsetParent !== null);
      if (!to.length || !w.from.isConnected) continue;
      if (w.main) {
        // trunk: drawn in the pinned top block, so it stays under the chief executive while the row scrolls
        const f = rectIn(w.from, topEl);
        const pts = to.map((t) => ({ ...rectIn(t.el, canvas), line: t.line }));
        const busY = Math.min(...pts.map((p) => p.top)) - 16;
        const topOff = rectIn(topEl, canvas).top;
        dTop.solid.push(`M${R(f.x)} ${R(f.bottom)}V${R(busY - topOff)}`);
        const xs = pts.map((p) => p.x);
        const x0 = Math.min(...xs, vw / 2), x1 = Math.max(...xs, W - vw / 2);
        if (x1 - x0 > 1) dCan.solid.push(`M${R(x0)} ${R(busY)}H${R(x1)}`);
        for (const p of pts) dCan[p.line === 'solid' ? 'solid' : 'dashed'].push(`M${R(p.x)} ${R(busY)}V${R(p.top)}`);
        continue;
      }
      const ref = w.svg === 'top' ? topEl : canvas, out = w.svg === 'top' ? dTop : dCan;
      const f = rectIn(w.from, ref);
      const pts = to.map((t) => ({ ...rectIn(t.el, ref), line: t.line }));
      const busY = Math.min(...pts.map((p) => p.top)) - 14;
      if (busY <= f.bottom) continue;
      out.solid.push(`M${R(f.x)} ${R(f.bottom)}V${R(busY)}`);
      const xs = pts.map((p) => p.x).concat(f.x);
      if (Math.max(...xs) - Math.min(...xs) > 1) out.solid.push(`M${R(Math.min(...xs))} ${R(busY)}H${R(Math.max(...xs))}`);
      for (const p of pts) out[p.line === 'solid' ? 'solid' : 'dashed'].push(`M${R(p.x)} ${R(busY)}V${R(p.top)}`);
    }
    const paint = (svg, d) => {
      let a = svg.querySelector('.om-w-s'), b = svg.querySelector('.om-w-d');
      if (!a) { a = document.createElementNS(SVGNS, 'path'); a.setAttribute('class', 'om-w-s'); b = document.createElementNS(SVGNS, 'path'); b.setAttribute('class', 'om-w-d'); svg.append(a, b); }
      a.setAttribute('d', d.solid.join('')); b.setAttribute('d', d.dashed.join(''));
    };
    paint(svgTop, dTop); paint(svgCanvas, dCan);
  }
  function layout() {
    if (destroyed || !scroll || !scroll.isConnected) return;
    const vw = scroll.clientWidth;
    el.style.setProperty('--om-vw', vw + 'px');
    // one row when every region fits side by side; otherwise wrap into rows so no regional head is ever off screen
    if (tierEl) {
      if (needMeasure || vw !== lastVw) { tierEl.classList.remove('om-wrap'); canvas.classList.remove('om-wrapped'); classicW = tierEl.scrollWidth; needMeasure = false; lastVw = vw; }
      wrapMode = classicW > vw + 1;
      tierEl.classList.toggle('om-wrap', wrapMode); canvas.classList.toggle('om-wrapped', wrapMode);
    } else wrapMode = false;
    // region names share one height so the heads line up across the row
    if (tierEl) {
      tierEl.style.removeProperty('--om-name-h');
      let mx = 0;
      for (const n of tierEl.querySelectorAll('.om-col > .om-rc > .om-rc-top > .om-rc-name')) mx = Math.max(mx, n.offsetHeight);
      if (mx) tierEl.style.setProperty('--om-name-h', mx + 'px');
      const first = tierEl.querySelector('.om-rc');
      if (first) { const r = rectIn(first, stage); stage.style.setProperty('--om-nav-y', Math.round(r.top + (r.bottom - r.top) / 2) + 'px'); }
    }
    drawWires();
    onScroll();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; layout(); if (performance.now() < kickUntil) schedule(); }); }
  function kick(ms = 320) { kickUntil = performance.now() + ms; schedule(); }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;
  const onWinResize = () => schedule();
  window.addEventListener('resize', onWinResize);

  function onScroll() {
    if (!scroll || !navL) return;
    const over = scroll.scrollWidth - scroll.clientWidth > 4;
    navL.hidden = !over || scroll.scrollLeft < 8;
    navR.hidden = !over || scroll.scrollLeft > scroll.scrollWidth - scroll.clientWidth - 8;
    stage.classList.toggle('om-over', over);
    stage.classList.toggle('om-over-l', over && !navL.hidden);
    stage.classList.toggle('om-over-r', over && !navR.hidden);
    const more = el.querySelector('.om-tl-more'); if (more) more.hidden = !over;
  }
  // drag the background to pan a wide tree
  let pan = null, panMoved = false;
  function onPanStart(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || scroll.scrollWidth <= scroll.clientWidth) return;
    if (e.target.closest('.om-p, .om-tg, button, a, .om-rc-top')) return;
    pan = { x: e.clientX, left: scroll.scrollLeft }; panMoved = false;
    const move = (ev) => { if (!pan) return; const dx = ev.clientX - pan.x; if (Math.abs(dx) > 3) { panMoved = true; scroll.classList.add('om-panning'); } scroll.scrollLeft = pan.left - dx; };
    const up = () => { pan = null; scroll.classList.remove('om-panning'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // ── the module's own detail card (only when the host gives no onPerson)
  function hideDetail() { detail.hidden = true; detail.replaceChildren(); }
  function showDetail(r, anchor) {
    const p = r.p, boss = model.bossOf(r);
    const fact = (label, ...v) => h('div', { class: 'om-dt-row' }, h('span', { class: 'om-dt-l' }, label), h('span', { class: 'om-dt-v' }, v));
    const src = p.source_url && /^https?:/i.test(p.source_url) ? h('a', { href: p.source_url, target: '_blank', rel: 'noopener noreferrer' }, p.source_title || 'Source') : (p.source_title || 'Source not linked');
    detail.replaceChildren(...[
      h('div', { class: 'om-dt-h' }, h('span', { class: `om-ico om-t-${roleTone(p)}` }, mkIcon(roleIcon(p), 20)), h('div', { class: 'om-dt-n' }, p.name), h('button', { type: 'button', class: 'om-dt-x', 'aria-label': 'Close', 'data-om-act': 'close' }, mkIcon('close', 18))),
      h('div', { class: 'om-dt-title' }, p.title || p.role_category || ''),
      p.geography && fact('Covers', p.geography),
      (boss || p.reports_to) && fact('Reports to', boss ? boss.p.name : p.reports_to, p.reports_to_confidence ? h('span', { class: 'om-dt-m' }, ` (${p.reports_to_confidence.toLowerCase()})`) : ''),
      fact('Confidence', h('span', { class: `om-cf om-c-${confOf(p)}` }, h('i', { class: `om-dot om-c-${confOf(p)}` }), confOf(p))),
      fact('Source', src, p.source_date ? h('span', { class: 'om-dt-m' }, ` · dated ${p.source_date}`) : ''),
      hasEmail(p) && fact('Email', h('a', { href: `mailto:${p.email}` }, p.email)),
      hasPhone(p) && fact('Phone', h('a', { href: `tel:${String(p.phone).replace(/[^+\d]/g, '')}` }, p.phone)),
      p.email && !hasEmail(p) && fact('Email', p.email, h('span', { class: 'om-dt-m' }, ' (pattern-built, inferred)')),
      r.also.length ? fact('Also listed', r.also.map((a) => `${a.name}, ${a.title || ''}`).join('; ')) : null,
      p.note && h('div', { class: 'om-dt-note' }, p.note)].filter(Boolean));
    detail.hidden = false;
    const base = el.getBoundingClientRect(), a = anchor.getBoundingClientRect(), dw = detail.offsetWidth, dh = detail.offsetHeight;
    const vwid = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = a.right + 12;
    if (left + dw > Math.min(vwid, base.right) - 8) left = a.left - dw - 12;
    if (left < Math.max(8, base.left)) left = Math.max(8, Math.min(vwid - dw - 8, a.left));
    let top = Math.min(a.top, vh - dh - 12);
    top = Math.max(top, 8);
    if (left < a.right && left + dw > a.left) top = a.bottom + 8 + dh > vh ? Math.max(8, a.top - dh - 8) : a.bottom + 8; // could not fit beside: go below or above
    detail.style.left = Math.round(left - base.left) + 'px';
    detail.style.top = Math.round(top - base.top) + 'px';
  }
  function select(r, anchor) {
    for (const list of cards.values()) for (const c of list) c.classList.remove('om-sel');
    selected = r;
    for (const c of cards.get(r) || []) c.classList.add('om-sel');
    if (typeof onPerson === 'function') { try { onPerson(r.p); } catch (err) { console.error(err); } } else showDetail(r, anchor);
  }

  // ── events
  const byId = new Map(model.recs.map((r) => [r.id, r]));
  function setOpen(id, o) {
    userOpen.set(id, o);
    syncToggles();
    kick();
  }
  function onClick(e) {
    if (panMoved) { panMoved = false; return; }
    const t = e.target.closest('[data-om-view], [data-om-act], [data-om-toggle], [data-om-pid], .om-nav');
    if (!t || !el.contains(t)) { if (!detail.hidden && !detail.contains(e.target)) hideDetail(); return; }
    if (t.hasAttribute('data-om-view')) return api.setView(t.getAttribute('data-om-view'));
    if (t.hasAttribute('data-om-act')) { const a = t.getAttribute('data-om-act'); if (a === 'expand') api.expandAll(); else if (a === 'collapse') api.collapseAll(); else hideDetail(); return; }
    if (t.hasAttribute('data-om-toggle')) { const id = t.getAttribute('data-om-toggle'); return setOpen(id, !isOpen(id)); }
    if (t.classList.contains('om-nav')) return scroll.scrollBy({ left: (t === navL ? -1 : 1) * Math.max(280, scroll.clientWidth * 0.8), behavior: 'smooth' });
    const r = byId.get(t.getAttribute('data-om-pid'));
    if (r) { e.stopPropagation(); select(r, t); }
  }
  function onKey(e) {
    if (e.key === 'Escape' && !detail.hidden) { hideDetail(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.om-p[data-om-pid]') && el.contains(e.target)) { e.preventDefault(); const r = byId.get(e.target.getAttribute('data-om-pid')); if (r) select(r, e.target); }
  }
  const onDocClick = (e) => { if (!detail.hidden && !el.contains(e.target)) hideDetail(); };
  el.addEventListener('click', onClick);
  el.addEventListener('transitionend', (e) => { if (e.propertyName === 'grid-template-rows') schedule(); });
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  const api = {
    setView(v) { if (!VIEWS.includes(v) || destroyed) return; if (v !== cur) { cur = v; userOpen = new Map(); } build(); },
    expandAll() { if (destroyed) return; for (const b of el.querySelectorAll('[data-om-toggle]')) userOpen.set(b.getAttribute('data-om-toggle'), true); syncToggles(); kick(); },
    collapseAll() { if (destroyed) return; for (const b of el.querySelectorAll('[data-om-toggle]')) userOpen.set(b.getAttribute('data-om-toggle'), false); syncToggles(); kick(); },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      el.remove();
    },
  };
  build();
  return api;
}
