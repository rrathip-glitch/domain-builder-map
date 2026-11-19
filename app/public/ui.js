import { iconHTML, ICON_NAMES } from './icons.js';
import { usMapHTML, STATE_NAMES } from './usmap.js';
// Shared visual pieces: the icon set and the US tile map. One stroke weight, colour inherits from the text.
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.3c2.1.8 3.5 2.8 3.5 5.7"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 16h10"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  merge: '<path d="M6 3v5c0 4 6 4 6 9v4M18 3v5c0 4-6 4-6 9"/>',
  chart: '<path d="M4 4v16h16M8 16v-5M12 16V8M16 16v-9"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  lots: '<path d="M3 9l9-5 9 5-9 5-9-5zM3 14l9 5 9-5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  up: '<path d="M7 11v9H4v-9h3zM7 11l4-7a2 2 0 012 2v4h5a2 2 0 012 2.3l-1.2 6a2 2 0 01-2 1.7H7"/>',
  down: '<g transform="rotate(180 12 12)"><path d="M7 11v9H4v-9h3zM7 11l4-7a2 2 0 012 2v4h5a2 2 0 012 2.3l-1.2 6a2 2 0 01-2 1.7H7"/></g>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  pencil: '<path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z"/>',
  print: '<path d="M7 8V4h10v4M7 17H5a1 1 0 01-1-1v-6a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1h-2M7 14h10v6H7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  // confidence marks: different shapes as well as colours
  verified: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  reported: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  inferred: '<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 3.2"/>',
};
// The component icon set (icons.js) is the source; names it lacks fall back to the paths above.
const MAP = { pin: 'land', bank: 'finance', star: 'ceo', map: 'regional', grid: 'division', cal: 'debt', ext: 'source', mail: 'email', up: 'thumbs-up', down: 'thumbs-down', chev: 'chevron-right', pencil: 'note', x: 'close', merge: 'deal' };
const own = (name, title) => `<svg class="ic ic-${name}" width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${title ? 'false' : 'true'}">${title ? `<title>${title}</title>` : ''}${P[name] || ''}</svg>`;
export const icon = (name, title = '') => { const k = MAP[name] || name; return ICON_NAMES.includes(k) ? iconHTML(k, { size: '1.1em', title: title || undefined }).replace('class="ico ', `class="ic ic-${name} ico `) : own(name, title); };
export const GROUP_ICON = { Land: 'pin', Finance: 'bank', 'C-suite': 'star', Regional: 'map', Division: 'grid', Other: 'person' };

// Region marker: the component map (usmap.js, real state outlines). One shared wrapper, cached per state set.
const MAPS = new Map();
export function usMap(states, cls = '') {
  const on = [...new Set([...(states || [])].filter((s) => STATE_NAMES[s]))].sort();
  if (!on.length) return '';
  const key = on.join(',');
  if (!MAPS.has(key)) MAPS.set(key, usMapHTML({ highlight: on, size: 120, title: `${on.length} state${on.length === 1 ? '' : 's'}: ${on.join(', ')}` }));
  return `<span class="mapw ${cls}" title="${on.length} state${on.length === 1 ? '' : 's'}: ${on.map((s) => STATE_NAMES[s]).join(', ')}">${MAPS.get(key)}</span>`;
}
