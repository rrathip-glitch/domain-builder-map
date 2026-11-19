// One-off generator: bakes app/public-next/usstates-paths.js from us-atlas (states-albers-10m.json).
// us-atlas is ISC licensed and derived from US Census Bureau cartographic boundary files (public domain).
// Run:  cd scripts/mapgen && npm install && node build-usstates.mjs
// The page never loads us-atlas: the output is a plain ES module with SVG path strings.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const topo = JSON.parse(readFileSync(resolve(here, 'node_modules/us-atlas/states-albers-10m.json'), 'utf8'));
const OUT = resolve(here, '../../app/public-next/usstates-paths.js');

const FIPS = { '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', 10: 'DE', 11: 'DC', 12: 'FL', 13: 'GA', 15: 'HI', 16: 'ID', 17: 'IL', 18: 'IN', 19: 'IA', 20: 'KS', 21: 'KY', 22: 'LA', 23: 'ME', 24: 'MD', 25: 'MA', 26: 'MI', 27: 'MN', 28: 'MS', 29: 'MO', 30: 'MT', 31: 'NE', 32: 'NV', 33: 'NH', 34: 'NJ', 35: 'NM', 36: 'NY', 37: 'NC', 38: 'ND', 39: 'OH', 40: 'OK', 41: 'OR', 42: 'PA', 44: 'RI', 45: 'SC', 46: 'SD', 47: 'TN', 48: 'TX', 49: 'UT', 50: 'VT', 51: 'VA', 53: 'WA', 54: 'WV', 55: 'WI', 56: 'WY' };

// 1. Decode the delta-encoded, quantised arcs to absolute coordinates.
const { scale: [kx, ky], translate: [dx, dy] } = topo.transform;
const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([ax, ay]) => { x += ax; y += ay; return [x * kx + dx, y * ky + dy]; }); });

// 2. Simplify each arc once (Douglas-Peucker), so the border two states share stays identical for both.
function dp(points, eps) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = points[a], [x2, y2] = points[b];
    const lx = x2 - x1, ly = y2 - y1, len = Math.hypot(lx, ly) || 1e-9;
    let worst = -1, wd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = len < 1e-6 ? Math.hypot(points[i][0] - x1, points[i][1] - y1) : Math.abs(ly * points[i][0] - lx * points[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const closed = (a) => a.length > 3 && a[0][0] === a[a.length - 1][0] && a[0][1] === a[a.length - 1][1];
function simplifyArc(arc, eps) {
  if (closed(arc)) { // an island: split in two so the ring keeps its shape
    const mid = arc.length >> 1;
    return [...dp(arc.slice(0, mid + 1), eps), ...dp(arc.slice(mid), eps).slice(1)];
  }
  return dp(arc, eps);
}

const ringArea = (r) => { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n]; s += x1 * y2 - x2 * y1; } return s / 2; };
function centroid(r) { let a = 0, cx = 0, cy = 0; for (let i = 0, n = r.length; i < n; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n]; const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; } return a ? [cx / (3 * a), cy / (3 * a)] : r[0]; }

function build(eps, minIsland, q = 1) {
  // q = coordinate steps per unit: 1 keeps integers, 2 keeps halves (finer coastlines on the large map)
  const rnd = (v) => Math.round(v * q) / q;
  const num = (v) => String(Math.round(v * q) / q);
  const simple = arcs.map((a) => simplifyArc(a, eps).map(([x, y]) => [rnd(x), rnd(y)]));
  const out = {};
  for (const g of topo.objects.states.geometries) {
    const code = FIPS[g.id] || FIPS[Number(g.id)];
    const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    let rings = [];
    for (const poly of polys) for (const ringArcs of poly) {
      const ring = [];
      for (const idx of ringArcs) {
        const pts = idx >= 0 ? simple[idx] : simple[~idx].slice().reverse();
        for (const p of pts) { const last = ring[ring.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) ring.push(p); }
      }
      if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
      if (ring.length >= 3) rings.push(ring);
    }
    rings.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
    rings = rings.filter((r, i) => i === 0 || Math.abs(ringArea(r)) >= minIsland);
    const d = rings.map((r) => { let s = `M${r[0][0]},${r[0][1]}`; let cmd = 'l'; for (let i = 1; i < r.length; i++) { const ddx = num(r[i][0] - r[i - 1][0]), ddy = num(r[i][1] - r[i - 1][1]); s += `${cmd}${ddx}${ddy[0] === '-' ? '' : ','}${ddy}`; cmd = ' '; } return `${s}z`; }).join('').replace(/ -/g, '-');
    const all = rings.flat();
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const [cx, cy] = centroid(rings[0]);
    out[code] = { name: g.properties.name, d, cx: Math.round(cx), cy: Math.round(cy), bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], area: Math.round(rings.reduce((s, r) => s + Math.abs(ringArea(r)), 0)) };
  }
  return out;
}

const detail = build(0.3, 3, 2);   // the large map
const small = build(2.4, 60);    // region markers at 64 to 120 px wide

// Label anchors: the centroid sits badly on a few odd shapes, so nudge those by hand (viewBox units).
const NUDGE = { FL: [16, 4], LA: [-9, -6], MI: [12, 22], ID: [-3, 18], CA: [-8, 4], MD: [2, -4], KY: [6, 2], NY: [8, 2], HI: [22, 14], AK: [4, -6], MA: [-2, -1], OK: [14, 0], TN: [2, 0], VA: [8, 4], WV: [-5, 4], NJ: [1, 2], MN: [-6, 4], NH: [0, 8], VT: [-1, -5], TX: [6, -4], NC: [6, -2], IL: [0, 2], DE: [1, 2] };

const states = {};
for (const code of Object.keys(detail).sort()) {
  const a = detail[code], b = small[code], n = NUDGE[code] || [0, 0];
  states[code] = { name: a.name, d: a.d, s: b.d, cx: a.cx + n[0], cy: a.cy + n[1], bb: a.bb, area: a.area };
}

const header = `/* usstates-paths.js: US state outlines, Albers USA projection with Alaska and Hawaii inset.
 * GENERATED by scripts/mapgen/build-usstates.mjs from us-atlas (ISC licence; US Census Bureau
 * cartographic boundaries, public domain). Do not edit by hand; re-run the script instead.
 *
 * viewBox: the coordinate frame every path is drawn in.
 * states[CODE] = { name, d (detailed path), s (simplified path for small maps),
 *                  cx, cy (label anchor), bb [x0, y0, x1, y1], area (square units) }
 */
`;
const body = `export const viewBox = '0 0 975 610';\nexport const states = ${JSON.stringify(states)};\nexport default { viewBox, states };\n`;
writeFileSync(OUT, header + body);
const tot = (k) => Object.values(states).reduce((s, x) => s + x[k].length, 0);
console.log(`wrote ${OUT}: ${(header.length + body.length) / 1024 | 0} KB (detailed ${tot('d') / 1024 | 0} KB, small ${tot('s') / 1024 | 0} KB), ${Object.keys(states).length} states`);
