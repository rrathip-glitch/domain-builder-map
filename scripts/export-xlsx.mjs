#!/usr/bin/env node
// Writes exports/Domain-Builder-Map.xlsx and the same tables as CSV under exports/csv/
// from data/dist/domain.json + coverage.json (run scripts/build.mjs first, or use `npm run build`).
// Writes to a temp name and renames, so the workbook on disk is always a complete file.
//
// Layout rules for every sheet (the reader's design feedback):
//  - the columns a land banker reads come first; long text sits in clearly named "Notes: ..." columns at the far right;
//  - a column that says the same thing on every row is removed and stated once in the note above the header;
//  - a confidence or status column that is the same on at least 90% of rows shows only the rows that differ;
//  - dates are real dates shown as 15 Mar 2027; money is always $ millions shown as $1,234.5M.
// The CSV files keep every column and raw values (ISO dates, plain numbers).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { rankFeed } from '../app/lib/rank.js';
import { orgModel } from '../app/lib/org.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.DOMAIN_DATA_DIR ? path.resolve(process.env.DOMAIN_DATA_DIR) : path.join(ROOT, 'data'); // override is for tests
const DIST = path.join(DATA, 'dist');
const OUT_DIR = process.env.DOMAIN_EXPORT_DIR ? path.resolve(process.env.DOMAIN_EXPORT_DIR) : path.join(ROOT, 'exports');
const CSV_DIR = path.join(OUT_DIR, 'csv');
const OUT = path.join(OUT_DIR, 'Domain-Builder-Map.xlsx');
const QUIET = process.argv.includes('--quiet');

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const D = readJson(path.join(DIST, 'domain.json'), null);
const COV = readJson(path.join(DIST, 'coverage.json'), { totals: {}, builders: [], validation_issues: [] });
if (!D) { console.error('data/dist/domain.json not found or unreadable: run `node scripts/build.mjs` first. Workbook left unchanged.'); process.exit(1); }
const NOTES = readJson(path.join(DATA, 'local', 'notes.json'), {});
const VOTES = readJson(path.join(DATA, 'local', 'votes.json'), {});
const bNote = (id) => NOTES.builders?.[id]?.text || '';
const pNote = (id) => NOTES.people?.[id]?.text || '';

const FILL = { Verified: 'FFC6EFCE', Reported: 'FFFFE699', Inferred: 'FFD9D9D9' };
const INK = { Verified: 'FF0B5A1E', Reported: 'FF7A4D00', Inferred: 'FF404040' };
const HEADER_FILL = 'FF12355B';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const clip = (s) => { s = s == null ? '' : String(s); return s.length > 32000 ? s.slice(0, 32000) + '…' : s; };
const join = (a) => (Array.isArray(a) ? a.filter((x) => x != null && x !== '').join(', ') : a ?? '');
const byId = new Map(D.builders.map((b) => [b.builder_id, b]));
const bName = (id) => byId.get(id)?.name || id || '';
const fmtNum = (x) => Number(x || 0).toLocaleString('en-US');
// every font is explicit (Calibri 11 unless stated) so no cell falls back to a viewer's default size
const F = (o = {}) => ({ name: 'Calibri', size: 11, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) });

// "2027-03-15" -> { date, fmt: 'd mmm yyyy', text: '15 Mar 2027' }; "2027-03" -> Mar 2027; "2027" -> 2027; anything else -> null
function parseDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), fmt: 'd mmm yyyy', text: `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` };
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { date: new Date(Date.UTC(+m[1], +m[2] - 1, 1)), fmt: 'mmm yyyy', text: `${MONTHS[+m[2] - 1]} ${m[1]}` };
  m = s.match(/^(\d{4})$/);
  if (m && +m[1] > 1900 && +m[1] < 2100) return { date: new Date(Date.UTC(+m[1], 0, 1)), fmt: 'yyyy', text: m[1] };
  return null;
}
const dateText = (v) => parseDate(v)?.text || String(v ?? '');
// shorten long text for a default column: cut at a clause end where possible
function shorten(v, n) {
  const s = String(v ?? '');
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(' ('), cut.lastIndexOf(': '));
  const end = at >= n * 0.45 ? at : cut.lastIndexOf(' ');
  return cut.slice(0, end > 20 ? end : n).replace(/[\s,;:.(]+$/, '') + ' …';
}

const wb = new ExcelJS.Workbook();
wb.creator = 'Domain builder map build';
wb.created = new Date();
const sheetIndex = []; // for the Read me sheet
const csvOut = [];
const usedNames = new Set();
function sheetName(raw) {
  let n = String(raw).replace(/[\[\]:*?/\\']/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet';
  if (n.length > 31) { n = n.slice(0, 31); const sp = n.lastIndexOf(' '); if (sp > 16) n = n.slice(0, sp); n = n.replace(/[\s,;:-]+$/, ''); }
  let i = 2; const base = n;
  while (usedNames.has(n.toLowerCase())) { const suf = ` (${i++})`; n = base.slice(0, 31 - suf.length) + suf; }
  usedNames.add(n.toLowerCase());
  return n;
}

// cols: { h, w, t: text|int|num|usd|pct|url|conf|link|date, v: (row) => value, href: (row) => url for t=link,
//         keep: never remove, long: far-right "Notes: ..." column, short: n (shorten to n chars; full text goes far right),
//         dom: show only the rows that differ when one value covers >= 90% of rows, note: Domain internal notes, freeze }
function addTable(name, cols, rows, { about = '', lines = [], after = [], tabColor } = {}) {
  const ws = wb.addWorksheet(sheetName(name), tabColor ? { properties: { tabColor: { argb: tabColor } } } : {});
  const val = (c, row) => { let v; try { v = c.v(row); } catch { v = ''; } if (Array.isArray(v)) v = join(v); return v == null ? '' : v; };
  const raw = rows.map((row) => cols.map((c) => val(c, row)));

  // CSV: every column, raw values
  csvOut.push({ file: ws.name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv', rows: [cols.map((c) => c.h + (c.t === 'usd' ? ' ($M)' : '')), ...raw] });

  // working columns: { c, vals[], hrefs[] }
  let work = cols.map((c, i) => ({ c, vals: raw.map((r) => r[i]), hrefs: c.t === 'link' ? rows.map((row) => { try { return c.href ? c.href(row) : ''; } catch { return ''; } }) : null }));
  // long text shortened in place, full text in a far-right column (only for the rows that were shortened)
  const extra = [];
  for (const w of work) {
    if (!w.c.short) continue;
    const full = w.vals.slice();
    w.vals = full.map((v) => (typeof v === 'string' ? shorten(v, w.c.short) : v));
    const fullVals = full.map((v, i) => (w.vals[i] !== v ? v : ''));
    if (fullVals.some((v) => v !== '')) extra.push({ c: { h: `Notes: full ${w.c.h.toLowerCase()}`, w: 60, long: true, isFull: true }, vals: fullVals, hrefs: null });
  }
  work = [...work, ...extra];
  for (const w of work) if (w.c.long && !w.c.isFull && !/^Notes: /.test(w.c.h)) w.c = { ...w.c, h: `Notes: ${w.c.h.charAt(0).toLowerCase()}${w.c.h.slice(1)}` };

  // remove columns that say the same thing on every row; say it once above the header
  const same = [], blank = [], dominant = [];
  const show = (c, v) => (c.t === 'date' ? dateText(v) : c.t === 'usd' && typeof v === 'number' ? `$${fmtNum(v)}M` : c.t === 'pct' && typeof v === 'number' ? `${v}%` : String(v));
  if (rows.length >= 8) {
    work = work.filter((w) => {
      if (w.c.keep || w.c.note) return true;
      const filled = w.vals.filter((v) => v !== '');
      if (!filled.length) { if (!w.c.isFull) blank.push(w.c.h); return false; }
      const first = String(filled[0]);
      const allSame = filled.every((v) => String(v) === first) && (!w.hrefs || w.hrefs.every((h) => h === w.hrefs[0]));
      if (allSame && filled.length >= rows.length * 0.95) {
        same.push(`${w.c.h}: ${show(w.c, filled[0])}${w.hrefs && isUrl(w.hrefs[0]) ? ` (${w.hrefs[0]})` : ''}${filled.length < rows.length ? ` (blank on ${rows.length - filled.length} rows)` : ''}`);
        return false;
      }
      if (w.c.t === 'conf' || w.c.dom) {
        const counts = new Map(); for (const v of filled) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
        const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
        if (n >= rows.length * 0.9 && n < rows.length) {
          w.vals = w.vals.map((v) => (String(v) === top ? '' : v));
          dominant.push(`${w.c.h}: ${top} unless the cell says otherwise (${rows.length - n} rows differ)`);
        }
      }
      return true;
    });
  }
  // order: reading columns, then Domain internal notes, then long notes at the far right
  work = [...work.filter((w) => !w.c.long && !w.c.note), ...work.filter((w) => w.c.note), ...work.filter((w) => w.c.long)];

  // note rows above the header
  const pre = [];
  if (about) pre.push({ text: about, bold: true });
  if (same.length) pre.push({ text: `Same on every row, so stated here instead of in a column: ${same.join('; ')}.`, color: 'FF444444' });
  if (dominant.length) pre.push({ text: `Shown only where it differs: ${dominant.join('; ')}.`, color: 'FF444444' });
  if (blank.length) pre.push({ text: `No row has a value for: ${blank.join(', ')} (columns left out).`, color: 'FF777777' });
  for (const l of lines) pre.push(l);
  for (const line of pre) { const r = ws.addRow([clip(line.text)]); r.getCell(1).font = F({ bold: !!line.bold, size: line.size || 11, color: line.color ? { argb: line.color } : undefined }); r.getCell(1).alignment = { wrapText: false, vertical: 'top' }; }
  const headerRow = pre.length + 1;
  const hr = ws.addRow(work.map((w) => w.c.h));
  hr.eachCell((cell) => { cell.font = F({ bold: true, color: { argb: 'FFFFFFFF' } }); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }; cell.alignment = { vertical: 'middle', wrapText: true }; cell.border = { bottom: { style: 'thin', color: { argb: 'FF8899AA' } } }; });
  // header tall enough for its longest wrapped label
  hr.height = Math.min(75, Math.max(30, 15 * Math.max(...work.map((w) => Math.ceil((String(w.c.h).length * 1.15) / (w.c.w || 16))))));
  work.forEach((w, i) => { ws.getColumn(i + 1).width = w.c.w || 16; });

  for (let ri = 0; ri < rows.length; ri++) {
    const r = ws.addRow(work.map((w) => { const v = w.vals[ri]; return w.c.t === 'link' || w.c.t === 'url' || w.c.t === 'date' ? '' : typeof v === 'number' ? v : clip(v); }));
    work.forEach((w, i) => {
      const c = w.c, cell = r.getCell(i + 1), v = w.vals[ri];
      cell.alignment = { vertical: 'top' };
      if (c.t === 'url') {
        if (isUrl(v) && v.length < 2000) { cell.value = { text: v.length > 90 ? host(v) : v, hyperlink: v }; cell.font = F({ color: { argb: 'FF0B57D0' }, underline: true }); } else cell.value = clip(v);
      } else if (c.t === 'link') {
        const href = w.hrefs[ri];
        if (isUrl(href) && href.length < 2000 && v !== '') { cell.value = { text: clip(v), hyperlink: href }; cell.font = F({ color: { argb: 'FF0B57D0' }, underline: true }); } else cell.value = clip(v);
      } else if (c.t === 'date') {
        const d = parseDate(v);
        if (d) { cell.value = d.date; cell.numFmt = d.fmt; cell.alignment = { vertical: 'top', horizontal: 'left' }; } else cell.value = clip(v);
      } else if (c.t === 'conf') {
        if (FILL[v]) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[v] } }; cell.font = F({ bold: true, color: { argb: INK[v] } }); }
      } else if (c.t === 'int' && typeof v === 'number') cell.numFmt = '#,##0';
      else if (c.t === 'num' && typeof v === 'number') cell.numFmt = Number.isInteger(v) ? '#,##0' : '#,##0.0';
      else if (c.t === 'usd' && typeof v === 'number') cell.numFmt = '"$"#,##0.0"M"';
      else if (c.t === 'pct' && typeof v === 'number') cell.numFmt = '0.0"%"';
      if (c.note) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE6' } };
    });
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: work.findIndex((w) => w.c.freeze) + 1 }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: work.length } };
  if (after.length) { ws.addRow([]); for (const line of after) { const r = ws.addRow([clip(line.text)]); r.getCell(1).font = F({ bold: !!line.bold, size: line.size || 11 }); r.getCell(1).alignment = { wrapText: !!line.wrap, vertical: 'top' }; if (line.wrap) { ws.mergeCells(r.number, 1, r.number, Math.min(work.length, 6)); r.height = Math.max(15, 15 * Math.ceil(line.text.length / line.wrap)); } } }
  sheetIndex.push({ name: ws.name, rows: rows.length, about });
  return ws;
}
const srcCols = (retr = () => D.retrieved) => [
  { h: 'Confidence', w: 11, t: 'conf', v: (r) => r.confidence || '' },
  { h: 'Source', w: 40, t: 'link', v: (r) => r.source_title || host(r.source_url) || (r.source_url ? 'source' : ''), href: (r) => r.source_url },
  { h: 'Retrieved', w: 12, t: 'date', v: (r) => r.retrieved || retr(r) || '' },
];
// land bankers always carry their confidence unless Verified, so an Inferred link never reads as plain fact
const lbList = (dv) => [...(dv.land_bankers_display || dv.land_bankers), ...(dv.land_bankers_unnamed ? ['unnamed land banker(s)'] : [])].join(', ');
const FOUR_FIRMS = ['Domain Real Estate Partners', 'Millrose Properties', 'Kennedy Lewis', 'TPG Angelo Gordon'];
const fourList = (dv) => (dv.land_banker_links || []).filter((x) => FOUR_FIRMS.includes(x.firm)).map((x) => `${x.firm} (${x.confidence || 'confidence not stated'})`).join(', ');
const firmKey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const countsAsLink = (b, counterparty) => { const k = firmKey(counterparty); return (b.derived.land_bankers || []).some((f) => { const fk = firmKey(f); return k.includes(fk) || fk.includes(k) || (/millrose/.test(k) && /millrose/.test(fk)) || (/kennedy lewis/.test(k) && /kennedy lewis/.test(fk)) || (/angelo gordon|tpg|essential housing/.test(k) && /angelo gordon/.test(fk)) || (/domain real estate|dw partners/.test(k) && /domain real estate/.test(fk)); }); };
const acqText = (dv) => (dv.acquired_after_ranking ? `${dv.acquired_after_ranking.by || ''} (${dateText(dv.acquired_after_ranking.date) || 'date n/a'}, ${dv.acquired_after_ranking.status || ''})` : '');

// ---------- Read me (filled in at the end so it can list the sheets) ----------
const readme = wb.addWorksheet(sheetName('Read me'), { properties: { tabColor: { argb: 'FF12355B' } } });

// ---------- Builders ----------
addTable('Builders', [
  { h: 'Rank', w: 6, t: 'int', keep: true, v: (b) => b.rank },
  { h: 'Builder', w: 28, freeze: true, keep: true, v: (b) => b.name },
  { h: 'Rank tier', w: 9, keep: true, v: (b) => b.tier },
  { h: 'Public / private', w: 22, v: (b) => b.ownership },
  { h: 'Parent (current)', w: 26, short: 60, v: (b) => b.parent || '' },
  { h: 'HQ', w: 18, v: (b) => b.hq || '' },
  { h: 'Closings', w: 10, t: 'int', v: (b) => b.closings },
  { h: 'Revenue', w: 13, t: 'usd', v: (b) => b.revenue_usd_m },
  { h: 'Lots controlled', w: 11, t: 'int', v: (b) => b.derived.lots_total },
  { h: '% lots optioned', w: 9, t: 'pct', v: (b) => b.derived.pct_optioned },
  { h: 'Known land bankers', w: 34, short: 90, v: (b) => lbList(b.derived) },
  { h: 'Public link to Domain / Millrose / Kennedy Lewis / TPG AG (with confidence)', w: 40, short: 120, v: (b) => fourList(b.derived) },
  { h: 'Next debt maturity', w: 12, t: 'date', v: (b) => b.derived.next_maturity?.maturity || '' },
  { h: 'Next maturity: instrument', w: 34, short: 70, v: (b) => b.derived.next_maturity?.instrument || '' },
  { h: 'Next maturity: principal', w: 12, t: 'usd', v: (b) => b.derived.next_maturity?.principal_usd_m ?? '' },
  { h: 'Land heads (corporate)', w: 30, short: 90, v: (b) => b.derived.land_heads.join(', ') },
  { h: 'Finance heads (corporate)', w: 30, short: 90, v: (b) => b.derived.finance_heads.join(', ') },
  { h: 'Regional heads', w: 9, t: 'int', v: (b) => b.derived.regional_heads },
  { h: 'Regions with a named leader', w: 11, v: (b) => (b.derived.regions_listed ? `${b.derived.regions_with_named_leader} of ${b.derived.regions_listed}` : '') },
  { h: 'People mapped', w: 9, t: 'int', v: (b) => b.derived.people_count },
  { h: 'Land contacts', w: 9, t: 'int', v: (b) => b.derived.land_count },
  { h: 'Finance contacts', w: 9, t: 'int', v: (b) => b.derived.finance_count },
  { h: 'Debt instruments', w: 9, t: 'int', v: (b) => b.derived.debt_count },
  { h: 'M&A deals', w: 7, t: 'int', v: (b) => b.derived.ma_count },
  { h: 'Feed stories', w: 7, t: 'int', v: (b) => b.derived.news_count },
  { h: 'States', w: 30, short: 110, v: (b) => b.states.join(', ') },
  { h: 'Acquired after the ranking', w: 34, short: 70, v: (b) => acqText(b.derived) },
  { h: 'Ticker', w: 8, v: (b) => b.ticker || '' },
  { h: 'Prior-year rank', w: 9, t: 'int', v: (b) => b.rank_prev },
  { h: 'Pro Builder rank', w: 9, t: 'int', v: (b) => b.housing_giants_rank },
  { h: 'Website', w: 26, t: 'url', v: (b) => b.profile?.website || '' },
  { h: 'Main phone', w: 15, v: (b) => b.profile?.main_phone || '' },
  { h: 'Map status', w: 22, v: (b) => b.derived.status + (b.in_progress ? ' (research in progress)' : '') },
  { h: 'Ranking confidence', w: 11, t: 'conf', v: (b) => b.spine?.confidence || '' },
  { h: 'Ranking source', w: 22, t: 'link', v: (b) => (b.spine?.source_url ? `${D.ranking?.year || ''} ${D.ranking?.name || 'ranking'}` : ''), href: (b) => b.spine?.source_url },
  { h: 'Profile confidence', w: 11, t: 'conf', v: (b) => b.profile?.confidence || '' },
  { h: 'Profile source', w: 26, t: 'link', v: (b) => host(b.profile?.source_url), href: (b) => b.profile?.source_url },
  { h: 'Retrieved', w: 12, t: 'date', v: (b) => b.retrieved || '' },
  { h: 'Domain internal notes', w: 40, note: true, v: (b) => bNote(b.builder_id) },
  { h: 'Summary', w: 70, long: true, v: (b) => b.profile?.summary || '' },
  { h: 'How it is organised', w: 70, long: true, v: (b) => b.profile?.org_note || '' },
  { h: 'Regional heads (names)', w: 50, long: true, v: (b) => (b.derived.regional_head_names || []).join(', ') },
  { h: 'Markets', w: 50, long: true, v: (b) => join(b.profile?.markets) },
  { h: 'Gaps (not publicly disclosed)', w: 70, long: true, v: (b) => b.gaps.join(' | ') },
], D.builders, { about: 'One row per builder in the ranking: size and ownership, land position and land bankers, next debt maturity, and who to call. Long text is in the "Notes:" columns at the far right.', tabColor: 'FF2DA44E' });

// ---------- People ----------
addTable('People', [
  { h: 'Builder rank', w: 6, t: 'int', keep: true, v: (p) => p.rank },
  { h: 'Builder', w: 24, keep: true, v: (p) => p.builder_name },
  { h: 'Rank tier', w: 9, keep: true, v: (p) => p.tier },
  { h: 'Name', w: 24, freeze: true, keep: true, v: (p) => p.name },
  { h: 'Title', w: 42, short: 90, keep: true, v: (p) => p.title },
  { h: 'Function', w: 10, keep: true, v: (p) => p.priority_group },
  { h: 'Level', w: 10, keep: true, v: (p) => p.level },
  { h: 'Geography', w: 30, short: 70, v: (p) => p.geography },
  { h: 'Reports to', w: 22, v: (p) => p.reports_to },
  { h: 'Reporting line confidence', w: 11, t: 'conf', v: (p) => p.reports_to_confidence },
  ...srcCols(),
  { h: 'Phone', w: 15, v: (p) => p.phone },
  { h: 'Email (published or pattern)', w: 28, v: (p) => p.email },
  { h: 'Email confidence', w: 11, t: 'conf', v: (p) => p.email_confidence },
  { h: 'Source date', w: 12, t: 'date', v: (p) => p.source_date },
  { h: 'Role category', w: 22, v: (p) => p.role_category },
  { h: 'In role since', w: 11, t: 'date', v: (p) => p.in_role_since },
  { h: 'Public / private', w: 12, v: (p) => p.ownership_group },
  { h: 'Domain internal notes', w: 40, note: true, v: (p) => pNote(p.person_id) },
  { h: 'Prior role', w: 50, long: true, v: (p) => p.prior_role },
  { h: 'Research note', w: 60, long: true, v: (p) => p.note },
  { h: 'Also listed in', w: 40, long: true, v: (p) => (p.also_listed || []).map((o) => `${o.title || ''} (${host(o.source_url)})`).join('; ') },
], D.people, { about: 'The Rolodex: every person mapped. Filter "Function" to Land or Finance for the people Domain calls on; filter "Level" to Regional for regional heads and their staff. Each row carries its confidence and a clickable source.', tabColor: 'FF2DA44E' });

// ---------- Regions & heads (same model as the org map) ----------
const regionRows = [];
for (const b of D.builders) {
  if (!b.people.length && !(b.profile?.regions || []).length) continue;
  const m = orgModel(b);
  const emit = (c, segment) => {
    const names = (g) => c.members.filter((x) => x.p.priority_group === g).map((x) => x.p.name);
    const base = { b, region: c.name, segment: segment || '', geography: c.geography, divisions: names('Division').length, land: names('Land').length, finance: names('Finance').length, division_names: names('Division').join('; '), land_names: names('Land').join('; ') };
    if (c.heads.length) for (const h of c.heads) regionRows.push({ ...base, head: h.name, title: h.title, reports_to: h.reports_to, reports_to_confidence: h.reports_to_confidence, phone: h.phone, email: h.email, confidence: h.confidence, source_url: h.source_url, source_title: h.source_title, retrieved: h.retrieved, note: h.note, pid: h.person_id });
    else regionRows.push({ ...base, head: c.leaderName ? `${c.leaderName} (named by the company; no sourced person row)` : 'Not publicly disclosed', title: '', reports_to: '', reports_to_confidence: '', confidence: '', source_url: '', source_title: '', retrieved: b.retrieved, note: '', pid: '' });
  };
  for (const x of m.bands) for (const c of x.cards) emit(c, x.segment.name);
  for (const c of m.top) emit(c, '');
}
addTable('Regions & heads', [
  { h: 'Rank', w: 6, t: 'int', keep: true, v: (r) => r.b.rank }, { h: 'Builder', w: 26, freeze: true, keep: true, v: (r) => r.b.name }, { h: 'Rank tier', w: 9, keep: true, v: (r) => r.b.tier },
  { h: 'Region', w: 30, short: 60, keep: true, v: (r) => r.region }, { h: 'Regional head', w: 28, short: 70, keep: true, v: (r) => r.head }, { h: 'Title', w: 36, short: 80, v: (r) => r.title },
  { h: 'Geography', w: 40, short: 80, v: (r) => r.geography }, { h: 'Company segment', w: 18, short: 40, v: (r) => r.segment },
  { h: 'Reports to', w: 22, v: (r) => r.reports_to }, { h: 'Reporting line confidence', w: 11, t: 'conf', v: (r) => r.reports_to_confidence },
  { h: 'Division leaders placed here', w: 9, t: 'int', v: (r) => r.divisions }, { h: 'Land contacts here', w: 9, t: 'int', v: (r) => r.land }, { h: 'Finance contacts here', w: 9, t: 'int', v: (r) => r.finance },
  { h: 'Phone', w: 14, v: (r) => r.phone || '' }, { h: 'Email', w: 24, v: (r) => r.email || '' },
  ...srcCols((r) => r.b.retrieved),
  { h: 'Domain internal notes', w: 40, note: true, v: (r) => (r.pid ? pNote(r.pid) : '') },
  { h: 'Division leaders (names)', w: 60, long: true, v: (r) => r.division_names }, { h: 'Land contacts (names)', w: 40, long: true, v: (r) => r.land_names }, { h: 'Research note', w: 60, long: true, v: (r) => r.note },
], regionRows, { about: 'Every region of every builder with its head (regional, area or group president), what it covers, and the division and land people under it. People are placed by reporting line where one is published or inferred, otherwise by geography. "Not publicly disclosed" where the company names a region but not its leader.', tabColor: 'FF2DA44E' });

// ---------- Lots & metrics ----------
const fins = D.builders.filter((b) => b.financing);
addTable('Lots & metrics', [
  { h: 'Rank', w: 6, t: 'int', keep: true, v: (b) => b.rank }, { h: 'Builder', w: 26, freeze: true, keep: true, v: (b) => b.name }, { h: 'Rank tier', w: 9, keep: true, v: (b) => b.tier }, { h: 'Public / private', w: 12, v: (b) => b.ownership_group },
  { h: 'Lots controlled', w: 11, t: 'int', v: (b) => b.derived.lots_total },
  { h: 'Lots owned', w: 11, t: 'int', v: (b) => b.financing.lots?.owned },
  { h: 'Lots optioned', w: 11, t: 'int', v: (b) => b.financing.lots?.optioned },
  { h: '% optioned', w: 9, t: 'pct', v: (b) => b.financing.lots?.pct_optioned },
  { h: 'Years of supply', w: 8, t: 'num', v: (b) => b.financing.lots?.years_supply },
  { h: 'Lots as of', w: 12, t: 'date', v: (b) => b.financing.lots?.as_of || '' },
  { h: 'Lots confidence', w: 11, t: 'conf', v: (b) => b.financing.lots?.confidence || '' },
  { h: 'Lots source', w: 34, t: 'link', v: (b) => b.financing.lots?.source_title || host(b.financing.lots?.source_url), href: (b) => b.financing.lots?.source_url },
  { h: 'Known land bankers', w: 30, short: 90, v: (b) => lbList(b.derived) },
  { h: 'Next debt maturity', w: 12, t: 'date', v: (b) => b.derived.next_maturity?.maturity || '' },
  { h: 'Total debt', w: 12, t: 'usd', v: (b) => b.financing.key_metrics?.total_debt_usd_m },
  { h: 'Cash', w: 12, t: 'usd', v: (b) => b.financing.key_metrics?.cash_usd_m },
  { h: 'Liquidity', w: 12, t: 'usd', v: (b) => b.financing.key_metrics?.liquidity_usd_m },
  { h: 'Net debt to capital', w: 9, t: 'pct', v: (b) => b.financing.key_metrics?.net_debt_to_capital_pct },
  { h: 'Credit ratings', w: 28, short: 60, v: (b) => b.financing.key_metrics?.credit_ratings || '' },
  { h: 'Fiscal year end', w: 13, v: (b) => b.financing.key_metrics?.fiscal_year_end || '' },
  { h: 'Metrics as of', w: 12, t: 'date', v: (b) => b.financing.key_metrics?.as_of || '' },
  { h: 'Metrics confidence', w: 11, t: 'conf', v: (b) => (b.financing.key_metrics?.source_url ? b.financing.key_metrics?.confidence : '') || '' },
  { h: 'Metrics source', w: 34, t: 'link', v: (b) => b.financing.key_metrics?.source_title || host(b.financing.key_metrics?.source_url), href: (b) => b.financing.key_metrics?.source_url },
  { h: 'Retrieved', w: 12, t: 'date', v: (b) => b.financing.retrieved || b.retrieved },
  { h: 'Land strategy', w: 70, long: true, v: (b) => b.financing.land_strategy },
  { h: 'Financing summary', w: 80, long: true, v: (b) => b.financing.summary },
  { h: 'Lots note', w: 50, long: true, v: (b) => b.financing.lots?.note || '' },
], fins, { about: 'Owned versus optioned lots and balance-sheet headline numbers, one row per builder. Blank means not publicly disclosed or not found.', tabColor: 'FFD4A72C' });

const finRows = (key) => fins.flatMap((b) => b.financing[key].map((r) => ({ ...r, _b: b })));
const bCols = [{ h: 'Rank', w: 6, t: 'int', keep: true, v: (r) => r._b.rank }, { h: 'Builder', w: 26, freeze: true, keep: true, v: (r) => r._b.name }, { h: 'Rank tier', w: 9, keep: true, v: (r) => r._b.tier }];
const finRetr = (r) => r._b?.financing?.retrieved || r._b?.retrieved || D.retrieved;

// ---------- Debt ----------
addTable('Debt', [...bCols,
  { h: 'Maturity', w: 12, t: 'date', keep: true, v: (r) => r.maturity || '' },
  { h: 'Instrument', w: 46, short: 80, keep: true, v: (r) => r.instrument }, { h: 'Type', w: 16, v: (r) => r.type },
  { h: 'Principal', w: 13, t: 'usd', v: (r) => r.principal_usd_m }, { h: 'Rate', w: 18, short: 40, v: (r) => r.rate || '' },
  { h: 'Secured', w: 11, dom: true, v: (r) => r.secured || '' },
  { h: 'Lenders / agent', w: 30, short: 60, v: (r) => r.lenders_agent || '' }, { h: 'Status', w: 12, dom: true, v: (r) => r.status }, { h: 'As of', w: 12, t: 'date', v: (r) => r.as_of || '' },
  ...srcCols(finRetr), { h: 'Research note', w: 60, long: true, v: (r) => r.note || '' },
], finRows('debt').sort((a, b) => (a.maturity_key || '9999').localeCompare(b.maturity_key || '9999')), { about: 'Every debt instrument found (notes, revolvers, term loans, warehouse lines), sorted by maturity: how each builder finances itself away from land banking.', tabColor: 'FFD4A72C' });

// ---------- Land banking ----------
const lbRows = [
  ...finRows('land_banking').map((r) => ({ ...r, _kind: r.negative ? 'No relationship (negative finding)' : r.unnamed ? 'Builder disclosure, counterparty not named' : 'Builder disclosure', _counted: !r.negative && !r.unnamed && countsAsLink(r._b, r.counterparty) })),
  ...fins.flatMap((b) => b.financing.competitor_links.map((r) => ({ ...r, _b: b, counterparty: r.firm, counterparty_type: 'Named firm', description: r.relationship, _kind: 'Public link to a named financier', _counted: countsAsLink(b, r.firm) }))),
  ...D.builders.flatMap((b) => b.competitor_relationships.map((r) => ({ ...r, _b: b, counterparty: r.financier || r.competitor_name, counterparty_type: r.is_scan ? 'Financier (new-entrant scan)' : 'Land banker', _kind: `From the ${r.is_scan ? 'new-entrant scan' : (r.financier || r.competitor_name) + ' profile'}`, _counted: countsAsLink(b, r.financier || r.competitor_name) }))),
  ...fins.flatMap((b) => (b.financing.no_link_notes || []).map((r) => ({ ...r, _b: b, counterparty: r.firm, counterparty_type: 'Named firm', description: r.text + (r.other_evidence ? ` [Other evidence in the map: ${r.other_evidence.text} (${r.other_evidence.confidence})]` : ''), _kind: 'Checked: no link found (not a relationship)', _counted: false }))),
];
addTable('Land banking', [...bCols,
  { h: 'Counterparty', w: 32, short: 70, keep: true, v: (r) => r.counterparty },
  { h: 'Counted as a named land-banker link?', w: 12, keep: true, v: (r) => (r._counted ? 'Yes' : 'No') },
  { h: 'Record type', w: 34, short: 60, keep: true, v: (r) => r._kind }, { h: 'Counterparty type', w: 16, v: (r) => r.counterparty_type || '' },
  { h: 'Arrangement', w: 60, short: 120, keep: true, v: (r) => r.description || '' }, { h: 'Amount', w: 13, t: 'usd', v: (r) => r.amount_usd_m }, { h: 'Lots', w: 10, t: 'int', v: (r) => r.lots }, { h: 'Date', w: 12, t: 'date', v: (r) => r.date || '' },
  ...srcCols(finRetr), { h: 'Research note', w: 50, long: true, v: (r) => r.note || '' },
], lbRows, { about: 'Who finances whose land. "Counted as a named land-banker link?" is Yes only for rows that assert a financing relationship with a named land banker or lot-option financier. Developers, affiliates, JV partners, unnamed "land bank" arrangements and "Checked: no link found" rows are shown for context and are not counted. Read the Confidence column: several Domain and TPG links rest only on an Inferred source.', tabColor: 'FFD4A72C' });

// ---------- Capital events ----------
addTable('Capital events', [...bCols,
  { h: 'Date', w: 12, t: 'date', keep: true, v: (r) => r.date || '' }, { h: 'Type', w: 18, v: (r) => r.type }, { h: 'What happened', w: 70, short: 130, keep: true, v: (r) => r.description }, { h: 'Amount', w: 13, t: 'usd', v: (r) => r.amount_usd_m },
  ...srcCols(finRetr), { h: 'Research note', w: 50, long: true, v: (r) => r.note || '' },
], finRows('capital_events').sort((a, b) => String(b.date).localeCompare(String(a.date))), { about: 'Debt issuance, redemptions, facility amendments, equity, rating actions, land-bank deals and buybacks, newest first.', tabColor: 'FFD4A72C' });

// ---------- JVs ----------
addTable('JVs', [...bCols,
  { h: 'Partner', w: 32, short: 70, keep: true, v: (r) => r.partner || '' }, { h: 'Description', w: 70, short: 130, keep: true, v: (r) => r.description }, { h: 'Date', w: 12, t: 'date', v: (r) => r.date || '' },
  ...srcCols(finRetr), { h: 'Research note', w: 50, long: true, v: (r) => r.note || '' },
], finRows('joint_ventures'), { about: 'Joint ventures by builder.', tabColor: 'FFD4A72C' });

// ---------- M&A ----------
const maRows = [
  ...D.builders.flatMap((b) => b.ma.map((m) => ({ scope: 'Builder file', builder: b.name, rank: b.rank, date: m.date, role: m.role, acquirer: m.role === 'Target' ? m.counterparty : b.name, target: m.role === 'Target' ? b.name : m.counterparty, description: m.description, status: m.status, after_ranking: m.after_ranking, map_impact: m.map_impact, confidence: m.confidence, source_url: m.source_url, source_title: m.source_title, retrieved: b.financing?.retrieved || b.retrieved, note: m.note || '' }))),
  ...(D.ma_industry.deals || []).map((m) => ({ scope: 'Industry list', builder: bName(m.acquirer_builder_id) || bName(m.target_builder_id) || '', rank: byId.get(m.acquirer_builder_id)?.rank ?? byId.get(m.target_builder_id)?.rank ?? null, date: m.date, role: '', acquirer: m.acquirer, target: m.target, description: m.description, status: m.status, after_ranking: m.after_ranking, map_impact: m.map_impact, confidence: m.confidence, source_url: m.source_url, source_title: m.source_title, retrieved: D.ma_industry.retrieved, note: '' })),
].sort((a, b) => String(b.date).localeCompare(String(a.date)));
addTable('M&A', [
  { h: 'Date', w: 12, t: 'date', keep: true, v: (r) => r.date || '' }, { h: 'Acquirer', w: 28, short: 60, freeze: true, keep: true, v: (r) => r.acquirer || '' }, { h: 'Target', w: 28, short: 60, keep: true, v: (r) => r.target || '' },
  { h: 'Status', w: 11, v: (r) => r.status }, { h: 'After the 2026 ranking?', w: 10, v: (r) => (r.after_ranking ? 'Yes' : 'No') },
  { h: 'Ranked builder', w: 22, v: (r) => r.builder }, { h: 'Rank', w: 6, t: 'int', v: (r) => r.rank }, { h: 'Role of ranked builder', w: 12, v: (r) => r.role },
  { h: 'Deal', w: 60, short: 130, keep: true, v: (r) => r.description },
  { h: 'Listed in', w: 12, v: (r) => r.scope },
  ...srcCols(), { h: 'What it changes in the map', w: 70, long: true, v: (r) => r.map_impact || '' }, { h: 'Research note', w: 50, long: true, v: (r) => r.note },
], maRows, { about: 'Builder M&A from 2025 to date, flagged when after the 2026 ranking was published, with what each deal changes in the map. A deal can appear twice (builder file and industry list).', tabColor: 'FF8250DF' });

// ---------- Competitors ----------
const compRows = D.competitors.flatMap((c) => [
  { c, section: 'Summary', topic: c.type || '', detail: c.summary || '', builder: '', date: '', confidence: '', source_url: '', source_title: '' },
  ...c.facts.map((f) => ({ c, section: 'Fact', topic: f.topic || '', detail: f.fact || '', builder: '', date: f.as_of || '', confidence: f.confidence, source_url: f.source_url, source_title: f.source_title })),
  ...c.builder_relationships.map((r) => ({ c, section: 'Builder relationship', topic: '', detail: r.description || '', builder: r.builder_name || bName(r.builder_id), rank: byId.get(r.builder_id)?.rank ?? null, amount: r.amount_usd_m, lots: r.lots, date: r.date || '', confidence: r.confidence, source_url: r.source_url, source_title: r.source_title })),
  ...c.debt.filter((x) => x && typeof x === 'object').map((d) => ({ c, section: 'Debt and capital', topic: d.type || '', detail: [d.instrument, d.rate, d.maturity ? 'due ' + dateText(d.maturity) : '', d.lenders_agent, d.status, d.note].filter(Boolean).join(' · '), builder: '', amount: d.principal_usd_m, date: d.as_of || '', confidence: d.confidence, source_url: d.source_url, source_title: d.source_title })),
  ...c.people.filter((x) => x && typeof x === 'object').map((p) => ({ c, section: 'People', topic: p.role_category || '', detail: `${p.name}: ${p.title || ''}${p.note ? ' (' + p.note + ')' : ''}`, builder: '', date: p.source_date || '', confidence: p.confidence, source_url: p.source_url, source_title: p.source_title })),
  ...c.gaps.map((g) => ({ c, section: 'Gap', topic: '', detail: g, builder: '', date: '', confidence: '', source_url: '', source_title: '' })),
]);
addTable('Competitors', [
  { h: 'Competitor', w: 30, short: 60, freeze: true, keep: true, v: (r) => r.c.name || r.c.competitor_id }, { h: 'Section', w: 18, keep: true, v: (r) => r.section }, { h: 'Topic', w: 14, v: (r) => r.topic },
  { h: 'Detail', w: 80, short: 150, keep: true, v: (r) => r.detail },
  { h: 'Builder', w: 22, short: 50, v: (r) => r.builder }, { h: 'Builder rank', w: 6, t: 'int', v: (r) => r.rank }, { h: 'Amount', w: 13, t: 'usd', v: (r) => r.amount }, { h: 'Lots', w: 10, t: 'int', v: (r) => r.lots }, { h: 'Date / as of', w: 12, t: 'date', v: (r) => r.date },
  { h: 'Type', w: 12, v: (r) => r.c.type || '' }, { h: 'Manager / parent', w: 22, short: 50, v: (r) => r.c.manager_or_parent || '' },
  ...srcCols((r) => r.c.retrieved),
], compRows, { about: 'Millrose (public, managed by Kennedy Lewis), TPG Angelo Gordon, Domain\'s own public footprint and new entrants: facts, builder relationships, debt and people from public disclosures.', tabColor: 'FFCF222E' });

// ---------- Feed ----------
const ranked = rankFeed(D.feed.articles || [], VOTES).sort((a, b) => b.adj.adjusted - a.adj.adjusted || String(b.published).localeCompare(String(a.published)));
addTable('Feed', [
  { h: 'Score (0-100)', w: 8, t: 'int', keep: true, v: (a) => a.score }, { h: 'Published', w: 12, t: 'date', keep: true, v: (a) => a.published || '' },
  { h: 'Story', w: 60, freeze: true, keep: true, t: 'link', v: (a) => a.title, href: (a) => a.url }, { h: 'Publisher', w: 18, v: (a) => a.publisher || '' }, { h: 'Category', w: 24, v: (a) => a.category || '' },
  { h: 'Why it matters to Domain', w: 70, short: 170, keep: true, v: (a) => a.why_it_matters || '' },
  { h: 'Builders', w: 26, short: 70, v: (a) => (a.builder_ids || []).map(bName).join(', ') }, { h: 'Competitors', w: 24, short: 60, v: (a) => join(a.competitors) }, { h: 'People', w: 24, short: 60, v: (a) => join(a.people) },
  { h: 'Land banking / competitor (30)', w: 9, t: 'int', v: (a) => a.subscores?.land_banking_competitor }, { h: 'Builder customer (25)', w: 9, t: 'int', v: (a) => a.subscores?.builder_customer },
  { h: 'Financing / capital markets (25)', w: 9, t: 'int', v: (a) => a.subscores?.financing_capital_markets }, { h: 'Land and lot supply (10)', w: 9, t: 'int', v: (a) => a.subscores?.land_lot_supply }, { h: 'Materiality (10)', w: 9, t: 'int', v: (a) => a.subscores?.materiality_actionability },
  { h: 'Your vote', w: 7, v: (a) => (a.adj.vote > 0 ? 'Up' : a.adj.vote < 0 ? 'Down' : '') }, { h: 'Score after votes', w: 8, t: 'int', v: (a) => (a.adj.adjusted !== a.score ? a.adj.adjusted : '') }, { h: 'Vote note', w: 30, v: (a) => VOTES[a.id]?.note || '' },
  { h: 'Source type', w: 13, v: (a) => a.source_type || '' }, { h: 'Retrieved', w: 12, t: 'date', v: (a) => a.retrieved || '' },
  { h: 'Summary (own words)', w: 70, long: true, v: (a) => a.summary || '' },
  { h: 'Suggested map update', w: 60, long: true, v: (a) => (a.suggested_update ? `${a.suggested_update.kind || 'Update'} for ${bName(a.suggested_update.builder_id)}: ${a.suggested_update.text || ''}` : '') },
  { h: 'Found via', w: 30, long: true, v: (a) => a.collected_via || '' },
], ranked, { about: `Scored news and research over the last ${D.feed.window_days || 90} days, highest relevance first. Rubric ${D.feed.rubric_version || 'v1'}: the five sub-scores (maximum in brackets) add up to the score before caps and floors. 90+ tell Bob today, 70 to 89 read this week, 40 to 69 context, under 40 noise.`, tabColor: 'FF0969DA' });

// ---------- insight tables ----------
const humanId = (id) => String(id).replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
for (const x of D.extras) {
  const title = String(x.title || x.id);
  const head = title.split(':')[0].trim();
  const tab = title.includes(':') && head.length <= 31 ? head : title.length <= 31 ? title : humanId(x.id);
  const isLong = (c) => c.type === 'text' && (x.rows || []).some((r) => String(r[c.key] ?? '').length > 140);
  addTable(tab, (x.columns || []).map((c, i) => ({
    h: c.type === 'usd_m' ? String(c.label || c.key).replace(/\s*\(\$\s?M\)/i, '').replace(/\s*\(\$m\)/i, '') : (c.label || c.key),
    w: c.type === 'text' ? 36 : c.type === 'builder_link' || c.type === 'person' ? 26 : c.type === 'url' ? 30 : 13,
    t: { number: 'num', pct: 'pct', usd_m: 'usd', confidence: 'conf', url: 'url', date: 'date' }[c.type],
    keep: i < 2, short: isLong(c) ? 140 : undefined,
    v: (r) => { const v = r[c.key]; return c.type === 'builder_link' ? bName(v) : Array.isArray(v) ? v.join(', ') : (v != null && typeof v === 'object' ? JSON.stringify(v) : v); },
  })), x.rows || [], { about: `${title}${x.is_estimate ? '  [ESTIMATE]' : ''}${x.subtitle ? '. ' + x.subtitle : ''}`, lines: [{ text: `${x.is_estimate ? 'This is an estimate; its inputs are shown as columns. ' : ''}Method: ${x.method || 'not stated'}`, color: 'FF555555' }], tabColor: 'FF8250DF' });
}

// ---------- Sources ----------
addTable('Sources', [
  { h: 'Source', w: 60, freeze: true, keep: true, t: 'link', v: (s) => shorten(s.title || s.url, 110), href: (s) => s.url }, { h: 'Type', w: 22, v: (s) => s.type }, { h: 'Site', w: 28, v: (s) => host(s.url) },
  { h: 'Used for', w: 30, short: 70, v: (s) => s.used_for.join(', ') }, { h: 'Builders', w: 36, short: 80, v: (s) => s.builder_ids.map(bName).join(', ') }, { h: 'Facts citing it', w: 8, t: 'int', v: (s) => s.facts },
  { h: 'Best confidence', w: 11, t: 'conf', v: (s) => s.best_confidence }, { h: 'Source date', w: 12, t: 'date', v: (s) => s.source_date || '' }, { h: 'Retrieved', w: 12, t: 'date', v: (s) => s.retrieved || '' }, { h: 'URL', w: 50, t: 'url', keep: true, v: (s) => s.url }, { h: 'Research note', w: 40, long: true, v: (s) => s.note || '' },
], D.sources, { about: 'Every page cited by a fact in this workbook, plus pages consulted (those have no confidence). No LinkedIn page was opened or cited.' });

// ---------- Coverage ----------
const T = COV.totals || {};
const ppb = T.people_per_builder || {};
const pc = T.people_confidence || {}, fc = T.all_facts_confidence || {};
const t25 = T.top25 || {};
const def = T.definitions || {};
const howBuilt = COV.how_built || D.how_built || [];
const covRows = [
  ['Builders covered (people or financing mapped)', T.builders_covered, `of ${T.builders_in_ranking || T.builders_total} in the ranking; ${T.builders_with_people} with people, ${T.builders_with_financing} with financing, ${T.builders_with_both} with both`],
  ['People mapped', T.people_mapped, `${def.people_mapped || ''} ${Object.entries(T.people_by_group || {}).map(([g, n]) => `${n} ${g}`).join(', ')}`],
  ['Land people', T.people_by_group?.Land, def.land || ''],
  ['Finance people', T.people_by_group?.Finance, def.finance || ''],
  ['Regional heads: all builders', T.regional_heads_found, `${def.regional_heads_found || ''} Found at ${T.builders_with_regional_heads} builders.`],
  ['Regional heads: top 25 builders', t25.regional_heads, `Found at ${t25.builders_with_regional_heads} of the 25 largest builders.`],
  ['Regions listed: all builders', T.regions_listed, def.regions_listed || ''],
  ['Regions with a named leader: all builders', T.regions_with_named_leader, `of ${T.regions_listed} listed. ${def.regions_with_named_leader || ''}`],
  ['Regions listed: top 25 builders', t25.regions_listed, ''],
  ['Regions with a named leader: top 25 builders', t25.regions_with_named_leader, `of ${t25.regions_listed} listed at the 25 largest builders`],
  ['People per builder: public builders (average)', ppb.Public?.avg_people_per_builder, `median ${ppb.Public?.median_people_per_builder}, max ${ppb.Public?.max_people}, ${ppb.Public?.builders_with_people} of ${ppb.Public?.builders} public builders mapped`],
  ['People per builder: private builders (average)', ppb.Private?.avg_people_per_builder, `median ${ppb.Private?.median_people_per_builder}, max ${ppb.Private?.max_people}, ${ppb.Private?.builders_with_people} of ${ppb.Private?.builders} private builders mapped`],
  ['People per builder: subsidiaries of larger groups (average)', ppb.Subsidiary?.avg_people_per_builder, `median ${ppb.Subsidiary?.median_people_per_builder}, ${ppb.Subsidiary?.builders_with_people} of ${ppb.Subsidiary?.builders} mapped`],
  ['Share Verified: people rows (%)', pc.verified_pct, `${pc.Verified} Verified, ${pc.Reported} Reported (${pc.reported_pct}%), ${pc.Inferred} Inferred (${pc.inferred_pct}%)`],
  ['Share Verified: all fact rows (%)', fc.verified_pct, `${fc.total} fact rows: ${fc.Verified} Verified, ${fc.Reported} Reported, ${fc.Inferred} Inferred`],
  ['Land heads found (builders)', T.land_heads_found, `${def.land_heads_found || ''} ${T.builders_with_any_land_contact} builders have a land contact at any level.`],
  ['Finance heads found (builders)', T.finance_heads_found, `${def.finance_heads_found || ''} ${T.builders_with_any_finance_contact} builders have a finance contact at any level.`],
  ['Builders with owned vs optioned lots known', T.builders_with_lots_split, ''],
  ['Builders with a named land banker', T.builders_with_named_land_banker, `${def.builders_with_named_land_banker || ''} ${T.builders_with_named_land_banker_not_inferred} of them have at least one link better than Inferred. ${T.builders_with_unnamed_land_banking_only ?? 0} more use land banking without naming the banker.`],
  ...FOUR_FIRMS.map((f) => { const c = T.builders_linked_to_by_confidence?.[f] || {}; return [`Builders publicly linked to ${f}`, T.builders_linked_to?.[f], `by strongest source: ${c.Verified || 0} Verified, ${c.Reported || 0} Reported, ${c.Inferred || 0} Inferred. Named on the Builders sheet with the confidence in brackets.`]; }),
  ['Debt instruments', T.debt_instruments, `${def.debt_instruments || ''} Across ${T.builders_with_debt} builders.`],
  ['Capital events', T.capital_events, ''],
  ['Joint ventures', T.joint_ventures, ''],
  ['M&A deals', (T.ma_deals_builder || 0) + (T.ma_deals_industry || 0), `${T.ma_deals_builder} in builder files, ${T.ma_deals_industry} in the industry list (a deal can be in both)`],
  ['Ranked builders acquired after the ranking was published', T.builders_acquired_after_ranking, 'current parent shown on the Builders sheet'],
  ['Competitors profiled', T.competitors_profiled, ''],
  ['Feed stories scored', T.feed_articles, `${T.feed_articles_70_plus} at 70+, ${T.feed_articles_90_plus} at 90+`],
  ['Insight tables', T.insight_tables, ''],
  ['Unique sources', T.unique_sources, ''],
  ...(COV.verification ? [['Accuracy check: rows re-opened by a fresh agent', COV.verification.checked, `${COV.verification.held} held, ${COV.verification.corrected} corrected, ${COV.verification.downgraded} downgraded to Inferred, ${COV.verification.removed} removed, across ${COV.verification.builders_checked} builders. Added up by the build from the checking agents' log.`]] : []),
  ['"Not publicly disclosed" gaps recorded', T.gaps_recorded, 'What is not public is listed as a gap, not guessed'],
  ['Builders with research still in progress', T.builders_in_progress, `${T.files_in_progress} files not yet passing the schema check (included and flagged); ${T.rows_left_out_by_validation} rows left out until fixed; ${T.validation_failures} unreadable files skipped`],
  ...Object.entries(T.by_tier || {}).map(([tier, v]) => [`${tier === 'Top 25' ? 'Rank 1 to 25' : tier === 'Top 50' ? 'Rank 26 to 50' : 'Rank 51 to 100'}: builders with people`, v.with_people, `of ${v.builders}; ${v.with_financing} with financing; ${v.people} people`]),
];
const builtAt = new Date(COV.generated || Date.now()).toLocaleString('en-GB', { timeZone: 'America/New_York', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
addTable('Coverage', [{ h: 'Measure', w: 58, keep: true, v: (r) => r[0] }, { h: 'Value', w: 12, t: 'num', keep: true, v: (r) => r[1] ?? '' }, { h: 'How it is counted', w: 120, keep: true, v: (r) => r[2] }], covRows,
  { about: `How far the map got. Every number is counted by the build from the data files (${builtAt} ET). "How this was built" is below the table.`, after: [{ text: 'How this was built', bold: true, size: 13 }, ...howBuilt.map((x) => ({ text: `${x.label}: ${x.text}`, wrap: 250 }))] });
addTable('Coverage by builder', [
  { h: 'Rank', w: 6, t: 'int', keep: true, v: (b) => b.rank }, { h: 'Builder', w: 28, freeze: true, keep: true, v: (b) => b.name }, { h: 'Rank tier', w: 9, keep: true, v: (b) => b.tier }, { h: 'Public / private', w: 12, v: (b) => b.ownership_group }, { h: 'Status', w: 22, dom: true, v: (b) => b.status + (b.in_progress ? ' (in progress)' : '') },
  { h: 'People', w: 8, t: 'int', v: (b) => b.people }, { h: 'Verified', w: 8, t: 'int', v: (b) => b.verified }, { h: 'Reported', w: 8, t: 'int', v: (b) => b.reported }, { h: 'Inferred', w: 8, t: 'int', v: (b) => b.inferred },
  { h: 'Land', w: 7, t: 'int', v: (b) => b.land }, { h: 'Finance', w: 7, t: 'int', v: (b) => b.finance }, { h: 'C-suite', w: 7, t: 'int', v: (b) => b.csuite }, { h: 'Regional', w: 8, t: 'int', v: (b) => b.regional }, { h: 'Division', w: 8, t: 'int', v: (b) => b.division }, { h: 'Other', w: 7, t: 'int', v: (b) => b.other },
  { h: 'Regional heads', w: 8, t: 'int', v: (b) => b.regional_heads }, { h: 'Regions listed', w: 8, t: 'int', v: (b) => b.regions_listed }, { h: 'Regions with named leader', w: 9, t: 'int', v: (b) => b.regions_with_named_leader },
  { h: 'Land head found', w: 9, v: (b) => (b.land_head_found ? 'Yes' : 'No') }, { h: 'Finance head found', w: 9, v: (b) => (b.finance_head_found ? 'Yes' : 'No') }, { h: 'Lots split known', w: 9, v: (b) => (b.lots_split_known ? 'Yes' : 'No') },
  { h: 'Land bankers', w: 8, t: 'int', v: (b) => b.land_bankers }, { h: 'Debt instruments', w: 8, t: 'int', v: (b) => b.debt_instruments }, { h: 'M&A', w: 6, t: 'int', v: (b) => b.ma }, { h: 'Feed stories', w: 7, t: 'int', v: (b) => b.news }, { h: 'Gaps recorded', w: 7, t: 'int', v: (b) => b.gaps },
], COV.builders || [], { about: 'The per-builder tracker behind the coverage numbers. "Regional" counts everyone at regional level; "Regional heads" counts only those who lead a region, area or group.' });

// ---------- Read me ----------
{
  const ws = readme;
  ws.getColumn(1).width = 30; ws.getColumn(2).width = 10; ws.getColumn(3).width = 150;
  const line = (a, b = '', c = '', opt = {}) => { const r = ws.addRow([a, b, c]); if (opt.bold) r.font = F({ bold: true, size: opt.size || 11 }); r.getCell(3).alignment = { wrapText: true, vertical: 'top' }; r.getCell(1).alignment = { vertical: 'top', wrapText: true }; return r; };
  line('Domain builder map', '', '', { bold: true, size: 18 });
  line(`The top ${T.builders_in_ranking || D.builders.length} US homebuilders: who does what, how each finances its land and itself, M&A since the ranking, competitors, and a scored news feed.`);
  ws.mergeCells('A2:C2');
  line('');
  line('Built', '', `${builtAt} ET, from public sources retrieved ${dateText(D.retrieved)}.`);
  line('Right now', '', `${fmtNum(T.builders_covered)} builders; ${fmtNum(T.people_mapped)} people (${fmtNum(T.people_by_group?.Land)} land, ${fmtNum(T.people_by_group?.Finance)} finance, ${fmtNum(T.regional_heads_found)} regional heads); ${pc.verified_pct}% of people rows Verified; ${fmtNum(T.builders_with_named_land_banker)} builders with a publicly named land banker (${fmtNum(T.builders_with_named_land_banker_not_inferred)} on better than an Inferred source); ${fmtNum(T.debt_instruments)} debt instruments. Definitions and the full count are on the Coverage sheet.`);
  line('');
  line('How this was built', '', '', { bold: true, size: 13 });
  for (const x of howBuilt) line(x.label, '', x.text);
  line('');
  line('How to read confidence', '', '', { bold: true, size: 13 });
  const leg = [['Verified', 'A primary source was opened in this run and states the fact: an SEC filing (10-K, 10-Q, 8-K, proxy), the company\'s own website, leadership page or press release, or an official record.'], ['Reported', 'A secondary source was opened in this run and states the fact: trade press, news, published rankings, conference speaker pages, third-party directories.'], ['Inferred', 'Derived, pattern-built, seen only in a search-result snippet, or older than about 24 months with no newer confirmation. Treat as a lead to confirm, not a fact.']];
  for (const [tag, text] of leg) { const r = line(tag, '', text); r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[tag] } }; r.getCell(1).font = F({ bold: true, color: { argb: INK[tag] } }); }
  line('Every fact row', '', 'carries its confidence cell (coloured as above), a clickable source, and the date it was retrieved. Reporting lines and emails carry their own confidence because they are more often inferred than the person\'s name and title.');
  line('');
  line('How the sheets are laid out', '', '', { bold: true, size: 13 });
  line('Reading order', '', 'The columns a land banker reads come first. Long text (summaries, research notes, full versions of shortened cells) is in columns named "Notes: ..." at the far right.');
  line('Stated once', '', 'When a column would say the same thing on every row (for example the retrieval date, or "Reported" for the whole ranking), the column is removed and the value is written once in the note above that sheet\'s header. When a confidence or status is the same on at least nine rows in ten, only the rows that differ are filled in, and the note says what the blank means.');
  line('Dates and money', '', 'Dates read as 15 Mar 2027 (Mar 2027 or 2027 when the source gives only a month or a year). Money is always in millions of US dollars, shown as $1,234.5M.');
  line('Not public', '', 'When a role or number is not public after a reasonable look it is listed as a gap ("not publicly disclosed"), not guessed. Public builders are dense; private ones are thin by nature.');
  line('Domain internal notes', '', 'The yellow "Domain internal notes" column on Builders, People and Regions & heads is empty on purpose. It is for what Domain\'s own people know (for example "we are number two with this builder in the Southeast, and here is why"). Nothing in this workbook came from Domain or from contact with any builder.');
  line('');
  line('Sheets', 'Rows', 'What is on it', { bold: true, size: 13 });
  for (const s of sheetIndex) { const r = line(s.name, s.rows, s.about); r.getCell(1).value = { text: s.name, hyperlink: `#'${s.name.replace(/'/g, "''")}'!A1` }; r.getCell(1).font = F({ color: { argb: 'FF0B57D0' }, underline: true }); }
  line('');
  line('Also available', '', 'The same tables as CSV in exports/csv/ (every column, raw values), the merged data as JSON in data/dist/domain.json, and the portal (npm start, then http://localhost:4173).');
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// ---------- write (temp then rename) ----------
fs.mkdirSync(CSV_DIR, { recursive: true });
const tmp = path.join(OUT_DIR, `.Domain-Builder-Map.tmp-${process.pid}.xlsx`);
await wb.xlsx.writeFile(tmp);
fs.renameSync(tmp, OUT);
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const keep = new Set();
for (const c of csvOut) {
  const file = path.join(CSV_DIR, c.file);
  const t = file + '.tmp-' + process.pid;
  fs.writeFileSync(t, '﻿' + c.rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
  fs.renameSync(t, file);
  keep.add(c.file);
}
for (const f of fs.readdirSync(CSV_DIR)) if (f.endsWith('.csv') && !keep.has(f)) fs.unlinkSync(path.join(CSV_DIR, f)); // drop CSVs of insight tables that no longer exist
if (!QUIET) console.log(`workbook ok -> exports/Domain-Builder-Map.xlsx (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${sheetIndex.length + 1} sheets: ${sheetIndex.map((s) => `${s.name} ${s.rows}`).join(', ')}); ${csvOut.length} CSVs in exports/csv/`);
