// Org diagram model: turns a builder's people rows and profile.regions into
// leadership -> corporate land and finance -> regions (head prominent) -> divisions.
// Placement is by stated or inferred reporting line first, then by geography (shown dashed, as an inference).
const STATE_NAMES = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' };
const METROS = { Phoenix: 'AZ', Scottsdale: 'AZ', Tucson: 'AZ', Houston: 'TX', Dallas: 'TX', 'Fort Worth': 'TX', DFW: 'TX', Austin: 'TX', 'San Antonio': 'TX', Atlanta: 'GA', Savannah: 'GA', Charlotte: 'NC', Raleigh: 'NC', Triad: 'NC', Wilmington: 'NC', Charleston: 'SC', Greenville: 'SC', 'Myrtle Beach': 'SC', Orlando: 'FL', Tampa: 'FL', Jacksonville: 'FL', Miami: 'FL', 'Fort Myers': 'FL', Naples: 'FL', Sarasota: 'FL', 'Palm Beach': 'FL', Denver: 'CO', 'Colorado Springs': 'CO', 'Las Vegas': 'NV', Reno: 'NV', Nashville: 'TN', Knoxville: 'TN', Memphis: 'TN', Seattle: 'WA', 'Puget Sound': 'WA', Spokane: 'WA', Sacramento: 'CA', 'Bay Area': 'CA', 'Los Angeles': 'CA', 'San Diego': 'CA', 'Inland Empire': 'CA', 'Orange County': 'CA', 'Central Valley': 'CA', Chicago: 'IL', Minneapolis: 'MN', 'Twin Cities': 'MN', Indianapolis: 'IN', Columbus: 'OH', Cincinnati: 'OH', Cleveland: 'OH', Detroit: 'MI', 'Salt Lake': 'UT', Boise: 'ID', Albuquerque: 'NM', Richmond: 'VA', Baltimore: 'MD', Philadelphia: 'PA', Pittsburgh: 'PA', Birmingham: 'AL', Huntsville: 'AL', 'Oklahoma City': 'OK', Tulsa: 'OK', 'Kansas City': 'MO', 'St. Louis': 'MO', Louisville: 'KY', 'Baton Rouge': 'LA', 'New Orleans': 'LA', Omaha: 'NE', 'Des Moines': 'IA' };
const CODES = new Set(Object.values(STATE_NAMES));
const NAME_RE = new RegExp('\\b(' + Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'g');
const METRO_RE = new RegExp('\\b(' + Object.keys(METROS).sort((a, b) => b.length - a.length).map((m) => m.replace('.', '\\.')).join('|') + ')\\b', 'g');
export function statesIn(text) {
  const t = String(text || '');
  const out = new Set();
  for (const m of t.match(/\b[A-Z]{2}\b/g) || []) if (CODES.has(m)) out.add(m);
  // "West Virginia" must not also count as Virginia: take longest names first and blank them out
  let rest = t.replace(NAME_RE, (m) => { out.add(STATE_NAMES[m]); return ' '; });
  rest.replace(METRO_RE, (m) => { out.add(METROS[m]); return ' '; });
  return out;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((x) => x.length > 1 && !['jr', 'sr', 'ii', 'iii'].includes(x)).join(' ');
const subset = (a, b) => a.size > 0 && [...a].every((x) => b.has(x));
// true when the head's own geography or title names this company region ("Southeast: FL, GA" / "West Region President"),
// not merely contains the word ("North Florida" is not the "North" segment)
function namesRegion(regionName, h) {
  const n = String(regionName || '').toLowerCase().trim();
  if (n.length < 4) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc + '\\s*([:,;(.]|$|region|area|division|segment|group)').test(String(h.geography || '').toLowerCase().trim())
    || new RegExp('\\b' + esc + '\\s+(region|area|division|segment|group)\\b|president[, ]+(of the )?' + esc + '\\b').test(String(h.title || '').toLowerCase());
}
const GROUP_ORDER = ['Land', 'Finance', 'Regional', 'Division', 'Other', 'C-suite'];

export function orgModel(b) {
  const P = b.people || [];
  const byId = new Map(P.map((p) => [p.person_id, p]));
  const chainHas = (p, headId) => { let cur = p, n = 0; while (cur && cur.reports_to_id && n++ < 8) { if (cur.reports_to_id === headId) return true; cur = byId.get(cur.reports_to_id); } return false; };
  const leaders = P.filter((p) => p.priority_group === 'C-suite');
  // root of the tree: the CEO, else the chair / founder (owner), else the president
  const root = leaders.find((p) => p.role_category === 'CEO') || leaders.find((p) => p.role_category === 'Chair/Founder') || leaders[0] || null;
  const otherLeaders = leaders.filter((p) => p !== root);
  const heads = P.filter((p) => p.role_category === 'Regional President');
  const headIds = new Set(heads.map((h) => h.person_id));
  const finCorp = P.filter((p) => p.priority_group === 'Finance' && p.level === 'Corporate');
  const landCorp = P.filter((p) => p.priority_group === 'Land' && p.level === 'Corporate');
  const taken = new Set([...leaders, ...heads, ...finCorp, ...landCorp].map((p) => p.person_id));

  // region cards: one per profile region and one per regional head, joined where they match
  const cards = (b.profile?.regions || []).map((r) => ({ name: r.name || '', geography: r.geography || '', leaderName: r.leader || '', heads: [], members: [], states: statesIn(`${r.name} ${r.geography}`), fromProfile: true, band: null }));
  for (const h of heads) {
    const hay = `${h.geography} ${h.title}`.toLowerCase();
    let c = cards.find((x) => x.leaderName && norm(x.leaderName) === norm(h.name))
      || cards.find((x) => x.fromProfile && !x.leaderName && !x.heads.length && namesRegion(x.name, h));
    if (!c) {
      const lead = String(h.geography || '').split(/[:.;(]/)[0].trim();
      const vague = !lead || /not stated|not disclosed|not public|unknown|unclear/i.test(lead);
      c = { name: vague ? 'Region not stated' : lead.slice(0, 70), geography: vague ? '' : (h.geography || ''), leaderName: h.name, heads: [], members: [], states: new Set(), fromProfile: false, band: null };
      cards.push(c);
    }
    c.heads.push(h);
    for (const s of statesIn(`${h.geography} ${h.title}`)) c.states.add(s);
  }
  // a head's own card that sits inside a head-less company segment (Toll: "North: CT, DE, MA..." over state group presidents) is grouped under it
  const segments = cards.filter((c) => c.fromProfile && !c.heads.length);
  for (const c of cards.filter((x) => !x.fromProfile)) {
    const fits = segments.filter((s) => subset(c.states, s.states));
    if (fits.length === 1) c.band = fits[0];
  }
  const bands = segments.filter((s) => cards.some((c) => c.band === s));
  const place = (p) => {
    for (const c of cards) for (const h of c.heads) if (chainHas(p, h.person_id)) return { c, via: 'line' };
    const ps = statesIn(`${p.geography} ${p.level === 'Corporate' ? '' : p.title}`);
    const targets = cards.filter((c) => !bands.includes(c));
    let fits = targets.filter((c) => subset(ps, c.states));
    if (fits.length > 1) { const withHead = fits.filter((c) => c.heads.length); if (withHead.length === 1) fits = withHead; }
    if (fits.length === 1) return { c: fits[0], via: 'geo' };
    const g = `${p.geography} ${p.title}`.toLowerCase();
    const byName = targets.filter((c) => c.name.length >= 5 && g.includes(c.name.toLowerCase()));
    if (byName.length === 1) return { c: byName[0], via: 'geo' };
    return null;
  };
  const loose = [], otherCorp = [];
  for (const p of P) {
    if (taken.has(p.person_id)) continue;
    const corporate = p.level === 'Corporate' || !p.level;
    const hit = corporate ? (cards.some((c) => c.heads.some((h) => chainHas(p, h.person_id))) ? place(p) : null) : place(p);
    if (hit) hit.c.members.push({ p, via: hit.via });
    else if (corporate) otherCorp.push(p);
    else loose.push(p);
  }
  for (const c of cards) c.members.sort((x, y) => GROUP_ORDER.indexOf(x.p.priority_group) - GROUP_ORDER.indexOf(y.p.priority_group) || x.p.name.localeCompare(y.p.name));
  loose.sort((x, y) => GROUP_ORDER.indexOf(x.priority_group) - GROUP_ORDER.indexOf(y.priority_group) || String(x.geography).localeCompare(String(y.geography)));
  const top = cards.filter((c) => !c.band && !bands.includes(c));
  // regions with a named head first, then by size
  top.sort((x, y) => (y.heads.length ? 1 : 0) - (x.heads.length ? 1 : 0) || y.members.length - x.members.length);
  return { root, otherLeaders, leaders, finCorp, landCorp, otherCorp, heads, headIds, cards, top, bands: bands.map((s) => ({ segment: s, cards: cards.filter((c) => c.band === s) })), loose, byId, linesKnown: P.filter((p) => p.reports_to_id).length };
}
