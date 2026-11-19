/* icons.js: the portal's one inline-SVG icon set.
 *
 * Interface
 *   icon(name, { size = 18, title } = {})      -> SVGSVGElement (aria-hidden unless title is given)
 *   iconHTML(name, { size = 18, title } = {})  -> the same icon as an HTML string, for template strings
 *   ICON_NAMES                                 -> string[] of every canonical name
 *
 * Rules: 24 x 24 viewBox, one 1.75 stroke weight, round caps and joins, no fills,
 * colour inherits from the text (currentColor). Always pair an icon with a text label
 * or pass `title` so it has an accessible name. Unknown names fall back to "info".
 * No dependencies, nothing touches the document until icon() is called.
 */

const P = {
  // Role groups
  // land: a staked plot of ground (flag on a flat parcel)
  land: '<path d="M12 12.6 20.5 17 12 21.4 3.5 17 12 12.6z"/><path d="M12 17V3.5"/><path d="M12 4l6 2.4-6 2.4"/>',
  // finance: a bank (pediment, columns, base)
  finance: '<path d="M3.5 9.5 12 4l8.5 5.5h-17z"/><path d="M6.5 13v4M10.2 13v4M13.8 13v4M17.5 13v4"/><path d="M4 20.2h16"/>',
  // ceo / c-suite: a crown
  ceo: '<path d="M4.5 18.5 3 8l5.2 4L12 5.5l3.8 6.5L21 8l-1.5 10.5h-15z"/><path d="M8 15.2h8"/>',
  // regional: a folded map
  regional: '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13l-5.5 2-6-2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  // division: a local office building
  division: '<path d="M5 20.5V5a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1v15.5"/><path d="M14.5 10.5H18a1 1 0 0 1 1 1v9"/><path d="M3 20.5h18"/><path d="M8.3 8h3M8.3 11.8h3M8.3 15.6h3"/>',
  // legal: scales
  legal: '<path d="M12 4v16M7.5 20h9M5.5 7h13"/><path d="M5.5 7 3 13.2a2.7 2.7 0 0 0 5 0L5.5 7zM18.5 7 16 13.2a2.7 2.7 0 0 0 5 0L18.5 7z"/>',
  // board: three people
  board: '<circle cx="12" cy="8.2" r="3"/><path d="M6.5 19.5v-.8a5.5 5.5 0 0 1 11 0v.8"/><circle cx="4.8" cy="10" r="1.9"/><circle cx="19.2" cy="10" r="1.9"/><path d="M2 18.2v-.4a3 3 0 0 1 2.2-2.9M22 18.2v-.4a3 3 0 0 0-2.2-2.9"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20v-.6a7 7 0 0 1 14 0v.6"/>',
  // builder: a house
  builder: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.6 9.6V20h12.8V9.6"/><path d="M10 20v-5.6h4V20"/>',

  // Fact types
  // lots: a subdivision plat
  lots: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/><path d="M3.5 12h17M9.2 4.5v15M14.8 12v7.5"/>',
  // debt: a percent sign in a coin
  debt: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 15.2l6.4-6.4"/><circle cx="9.2" cy="9.2" r="1.1"/><circle cx="14.8" cy="14.8" r="1.1"/>',
  // landbanker: a safe
  landbanker: '<rect x="3.5" y="4" width="17" height="14.5" rx="2"/><circle cx="12" cy="11.2" r="3.2"/><path d="M12 11.2l1.6-1.6"/><path d="M7 18.5v2M17 18.5v2"/><path d="M17.3 8.2v6"/>',
  // deal: two companies combining
  deal: '<circle cx="8.8" cy="12" r="5.8"/><circle cx="15.2" cy="12" r="5.8"/>',
  news: '<path d="M4 5.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V18a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5.5z"/><path d="M17 9h2.5a.5.5 0 0 1 .5.5V18a1 1 0 0 1-1 1"/><path d="M7.5 8.5h6M7.5 12h6M7.5 15.5h3.5"/>',
  // source: an external link
  source: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  phone: '<path d="M8.6 4.2 6.9 3.9a1.8 1.8 0 0 0-2 1.2C3.6 9 5 13.300 7.900 16.200s7.100 4.300 11 3a1.800 1.800 0 0 0 1.200-2l-.3-1.700a1.800 1.800 0 0 0-1.300-1.400l-2.300-.6a1.800 1.800 0 0 0-1.800.5l-.9 1a9.300 9.300 0 0 1-4.400-4.400l1-.9a1.800 1.800 0 0 0 .5-1.800L10 5.500a1.800 1.800 0 0 0-1.400-1.300z"/>',
  email: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.6 7.6 12 13.5l8.4-5.9"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10.2h16M8.5 3.5v4M15.5 3.5v4"/>',

  // Actions
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  filter: '<path d="M4 5.5h16l-6.2 7.300v6.200l-3.600-2v-4.200L4 5.500z"/>',
  download: '<path d="M12 4v11"/><path d="M7.500 10.800 12 15.300l4.500-4.500"/><path d="M5 19.500h14"/>',
  note: '<path d="M5 4.500h14a.5.5 0 0 1 .5.5v9.500l-5 5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5z"/><path d="M19.500 14.500H15a.5.5 0 0 0-.5.5v4.500"/><path d="M8 9h8M8 12.500h4"/>',
  'thumbs-up': '<path d="M7.500 10.500 11 3.500a2.300 2.300 0 0 1 2.600 2.300v3.700h4.700a2 2 0 0 1 2 2.300l-1 6.500a2 2 0 0 1-2 1.700H7.500v-9.500z"/><path d="M7.500 20H5a1.500 1.500 0 0 1-1.500-1.500V12A1.500 1.500 0 0 1 5 10.500h2.500"/>',
  'thumbs-down': '<path d="M16.500 13.500 13 20.500a2.300 2.300 0 0 1-2.600-2.300v-3.700H5.700a2 2 0 0 1-2-2.300l1-6.500a2 2 0 0 1 2-1.700h9.800v9.500z"/><path d="M16.500 4H19a1.500 1.500 0 0 1 1.500 1.500V12a1.500 1.500 0 0 1-1.500 1.500h-2.500"/>',

  // Confidence marks: check (primary source), lines of print (secondary source), dashed ring with a wave (derived)
  verified: '<circle cx="12" cy="12" r="8.800"/><path d="M8 12.300l2.800 2.800L16 9.400"/>',
  reported: '<circle cx="12" cy="12" r="8.800"/><path d="M8.300 10h7.400M8.300 14h4.600"/>',
  inferred: '<circle cx="12" cy="12" r="8.800" stroke-dasharray="2.300 3.230"/><path d="M8 12.600c1.300-1.800 2.700-1.800 4 0s2.700 1.800 4 0"/>',

  // Navigation and status
  'map-pin': '<path d="M12 21s-6.500-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.400"/>',
  'chevron-right': '<path d="M9.500 5.500 16 12l-6.500 6.500"/>',
  'chevron-down': '<path d="M5.500 9.500 12 16l6.500-6.500"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="8.800"/><path d="M12 11.200v5.300M12 7.700v.01"/>',
  warning: '<path d="M12 4.200 21 19.500H3L12 4.200z"/><path d="M12 10v4.300M12 16.900v.01"/>',
  star: '<path d="M12 3.800l2.500 5.200 5.700.8-4.100 4 1 5.700-5.100-2.700-5.100 2.700 1-5.700-4.100-4 5.700-.8L12 3.800z"/>',
  expand: '<path d="M14.500 4.500h5v5M19.500 4.500l-6 6M9.500 19.500h-5v-5M4.500 19.500l6-6"/>',
  collapse: '<path d="M19.500 4.500l-6 6M13.500 5.500v5h5M4.500 19.500l6-6M10.500 18.500v-5h-5"/>',
};

const ALIAS = { 'c-suite': 'ceo', csuite: 'ceo', 'm&a': 'deal', ma: 'deal', deals: 'deal', external: 'source', link: 'source', pin: 'map-pin', mail: 'email', 'land-banker': 'landbanker', bank: 'finance', map: 'regional' };

export const ICON_NAMES = Object.keys(P);

const resolve = (name) => { const k = String(name || '').toLowerCase(); return P[k] ? k : P[ALIAS[k]] ? ALIAS[k] : 'info'; };
const escText = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The icon as an HTML string (for template-string rendering). */
export function iconHTML(name, { size = 18, title } = {}) {
  const k = resolve(name);
  const a11y = title ? `role="img" aria-label="${escText(title)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ico ico-${k}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y} style="flex:none;vertical-align:-0.18em">${title ? `<title>${escText(title)}</title>` : ''}${P[k]}</svg>`;
}

/** The icon as an SVG element. */
export function icon(name, { size = 18, title } = {}) {
  const k = resolve(name);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const set = (o) => { for (const [a, v] of Object.entries(o)) svg.setAttribute(a, v); };
  set({ class: `ico ico-${k}`, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  svg.style.flex = 'none';
  svg.style.verticalAlign = '-0.18em';
  if (title) set({ role: 'img', 'aria-label': title }); else set({ 'aria-hidden': 'true', focusable: 'false' });
  svg.innerHTML = (title ? `<title>${escText(title)}</title>` : '') + P[k];
  return svg;
}
