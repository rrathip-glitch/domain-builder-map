#!/usr/bin/env node
// Opens exports/Domain-Builder-Map.xlsx and checks it the way a reader would trip over it:
// every sheet has rows, hyperlinks are well-formed, confidence cells carry the right fill,
// nothing was clipped, dates are real dates, and prints each sheet's note rows and headers.
// Usage: node scripts/check-workbook.mjs [--brief]   (exit code 1 if any check fails)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.DOMAIN_EXPORT_DIR ? path.join(path.resolve(process.env.DOMAIN_EXPORT_DIR), 'Domain-Builder-Map.xlsx') : path.join(ROOT, 'exports', 'Domain-Builder-Map.xlsx');
const BRIEF = process.argv.includes('--brief');
const FILL = { Verified: 'FFC6EFCE', Reported: 'FFFFE699', Inferred: 'FFD9D9D9' };
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
let problems = 0;
const bad = (m) => { problems++; console.log('  PROBLEM ' + m); };
const totals = { sheets: 0, rows: 0, links: 0, conf: 0, dates: 0 };
for (const ws of wb.worksheets) {
  totals.sheets++;
  const headerRow = ws.views?.[0]?.ySplit || 1;
  const header = (ws.getRow(headerRow).values || []).slice(1).map((v) => (v && v.text) || v || '');
  const dataRows = ws.rowCount - headerRow;
  let links = 0, badLinks = 0, conf = 0, badFill = 0, clipped = 0, dates = 0, isoText = 0, maxLen = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= header.length; c++) {
      const cell = row.getCell(c), v = cell.value;
      if (v == null || v === '') continue;
      if (typeof v === 'object' && v.hyperlink) { links++; if (!/^https?:\/\/[^\s]+$/.test(v.hyperlink) && !v.hyperlink.startsWith('#')) badLinks++; if (!v.text) badLinks++; }
      else if (v instanceof Date) dates++;
      else if (typeof v === 'string') {
        if (FILL[v] && /confidence/i.test(String(header[c - 1]))) { conf++; if (cell.fill?.fgColor?.argb !== FILL[v]) badFill++; }
        if (v.length >= 32000) clipped++;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) isoText++;
        if (v.length > maxLen) maxLen = v.length;
      }
    }
  }
  totals.rows += Math.max(0, dataRows); totals.links += links; totals.conf += conf; totals.dates += dates;
  console.log(`${ws.name.padEnd(30)} rows ${String(dataRows).padStart(5)}  cols ${String(header.length).padStart(2)}  links ${String(links).padStart(5)}  conf cells ${String(conf).padStart(5)}  dates ${String(dates).padStart(5)}  longest cell ${maxLen}  filter ${ws.autoFilter ? 'yes' : 'no '}  frozen at row ${headerRow}`);
  if (ws.name !== 'Read me' && dataRows < 1) bad(`${ws.name}: no data rows`);
  if (badLinks) bad(`${ws.name}: ${badLinks} malformed hyperlinks`);
  if (badFill) bad(`${ws.name}: ${badFill} confidence cells with the wrong fill`);
  if (clipped) bad(`${ws.name}: ${clipped} cells clipped at the 32,000 character limit`);
  if (isoText) bad(`${ws.name}: ${isoText} dates left as ISO text`);
  if (ws.name !== 'Read me' && !ws.autoFilter) bad(`${ws.name}: no autofilter`);
  if (ws.name !== 'Read me' && header.some((h) => !h)) bad(`${ws.name}: empty header cell`);
  if (!BRIEF && ws.name !== 'Read me') {
    for (let r = 1; r < headerRow; r++) { const t = String(ws.getRow(r).getCell(1).value || ''); if (t) console.log('    note: ' + (t.length > 330 ? t.slice(0, 330) + ' …' : t)); }
    console.log('    columns: ' + header.join(' | '));
  }
}
console.log(`\n${totals.sheets} sheets, ${totals.rows} data rows, ${totals.links} hyperlinks, ${totals.conf} confidence cells, ${totals.dates} date cells; ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
