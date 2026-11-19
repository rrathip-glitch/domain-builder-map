#!/usr/bin/env node
// Validates builder part files against SCHEMA.md. Usage: node scripts/validate.mjs file [file...]
// Exit code 1 if any file has errors. Warnings do not fail.
import fs from 'node:fs';
import path from 'node:path';

const CONF = ['Verified', 'Reported', 'Inferred'];
const OWN = ['Public', 'Private', 'Subsidiary of public company', 'Subsidiary of foreign company', 'Subsidiary of private company'];
const ROLE = ['CEO', 'Chair/Founder', 'President/COO', 'CFO', 'Treasury/Capital Markets', 'Finance (other)', 'Land Acquisition', 'Land Development', 'Land (other)', 'Regional President', 'Division President', 'Legal/GC', 'Operations (other)', 'Sales/Marketing', 'Board', 'Other'];
const LEVEL = ['Corporate', 'Regional', 'Division'];
const CPTYPE = ['Land banker', 'Developer', 'JV partner', 'Investor', 'Affiliate', 'Unknown'];
const DEBT = ['Senior notes', 'Revolver', 'Term loan', 'Mortgage warehouse', 'Project debt', 'Convertible', 'Preferred', 'Other'];
const DSTAT = ['Outstanding', 'Undrawn', 'Redeemed', 'Announced'];
const CEV = ['Debt issuance', 'Redemption', 'Facility amendment', 'Equity', 'Rating action', 'Land-bank deal', 'JV', 'Buyback', 'Other'];
const MROLE = ['Acquirer', 'Target', 'Merger', 'Divestiture'];
const MSTAT = ['Announced', 'Closed', 'Terminated', 'Rumored'];

export function validateFile(file) {
  const errs = [], warns = [];
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { errs: ['invalid JSON: ' + e.message], warns }; }
  const base = path.basename(file);
  const E = (m) => errs.push(m), W = (m) => warns.push(m);
  const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
  const src = (row, where, { allowSnippet = true } = {}) => {
    if (!CONF.includes(row.confidence)) E(`${where}: confidence must be one of ${CONF.join('|')} (got ${JSON.stringify(row.confidence)})`);
    if (typeof row.source_url === 'string' && /linkedin\.com/i.test(row.source_url)) E(`${where}: linkedin.com may not be a source_url`);
    if (!isUrl(row.source_url)) {
      if (row.confidence === 'Inferred' && allowSnippet && row.note) W(`${where}: Inferred with no source_url (note explains)`);
      else E(`${where}: source_url missing or not http(s)`);
    }
  };
  const en = (v, list, where, optional = false) => { if (optional && (v === '' || v == null)) return; if (!list.includes(v)) E(`${where}: ${JSON.stringify(v)} not in [${list.join(' | ')}]`); };
  const num = (v, where) => { if (v != null && typeof v !== 'number') E(`${where}: must be a number or null (got ${JSON.stringify(v)})`); };
  if (!d.builder_id || typeof d.builder_id !== 'string') E('builder_id missing');
  else if (!base.startsWith(d.builder_id + '.')) E(`file name ${base} does not start with builder_id ${d.builder_id}`);
  if (d.part === 'people' || d.part === 'people_extra') {
    const p = d.profile;
    if (d.part === 'people_extra') { /* extra people file (e.g. <id>.divisions.json): no profile needed */ }
    else if (!p) E('profile missing'); else {
      for (const k of ['legal_name', 'summary']) if (!p[k]) E(`profile.${k} missing`);
      en(p.ownership, OWN, 'profile.ownership');
      src(p, 'profile', { allowSnippet: false });
      for (const k of ['brand_names', 'states', 'markets', 'regions']) if (!Array.isArray(p[k])) E(`profile.${k} must be an array`);
    }
    if (!Array.isArray(d.people)) E('people must be an array'); else {
      const seen = new Set();
      d.people.forEach((x, i) => {
        const w = `people[${i}] ${x.name || ''}`;
        if (!x.name) E(`${w}: name missing`);
        if (!x.title) E(`${w}: title missing`);
        en(x.role_category, ROLE, `${w}.role_category`);
        en(x.level, LEVEL, `${w}.level`);
        src(x, w);
        en(x.reports_to_confidence, CONF, `${w}.reports_to_confidence`, true);
        en(x.email_confidence, CONF, `${w}.email_confidence`, true);
        if (x.email && !x.email_confidence) E(`${w}: email needs email_confidence`);
        if (x.reports_to && !x.reports_to_confidence) E(`${w}: reports_to needs reports_to_confidence`);
        if (x.domain_internal_notes) E(`${w}: domain_internal_notes must stay empty`);
        const key = (x.name || '').toLowerCase() + '|' + (x.title || '').toLowerCase();
        if (seen.has(key)) W(`${w}: duplicate name+title`); seen.add(key);
      });
      if (d.people.length === 0) W('people is empty');
    }
  } else if (d.part === 'financing') {
    const f = d.financing;
    if (!f) E('financing missing'); else {
      if (!f.summary) E('financing.summary missing');
      if (f.lots && (f.lots.total_controlled != null || f.lots.owned != null || f.lots.optioned != null)) { src(f.lots, 'financing.lots', { allowSnippet: false }); for (const k of ['total_controlled', 'owned', 'optioned', 'pct_optioned', 'years_supply']) num(f.lots[k], `financing.lots.${k}`); }
      for (const k of ['land_banking', 'debt', 'capital_events', 'joint_ventures', 'competitor_links']) if (!Array.isArray(f[k])) E(`financing.${k} must be an array`);
      (f.land_banking || []).forEach((x, i) => { const w = `land_banking[${i}]`; if (!x.counterparty) E(`${w}: counterparty missing`); en(x.counterparty_type, CPTYPE, `${w}.counterparty_type`); num(x.amount_usd_m, `${w}.amount_usd_m`); num(x.lots, `${w}.lots`); src(x, w, { allowSnippet: false }); });
      (f.debt || []).forEach((x, i) => { const w = `debt[${i}]`; if (!x.instrument) E(`${w}: instrument missing`); en(x.type, DEBT, `${w}.type`); en(x.status, DSTAT, `${w}.status`); num(x.principal_usd_m, `${w}.principal_usd_m`); src(x, w, { allowSnippet: false }); });
      (f.capital_events || []).forEach((x, i) => { const w = `capital_events[${i}]`; en(x.type, CEV, `${w}.type`); num(x.amount_usd_m, `${w}.amount_usd_m`); if (!x.description) E(`${w}: description missing`); src(x, w, { allowSnippet: false }); });
      (f.joint_ventures || []).forEach((x, i) => { const w = `joint_ventures[${i}]`; if (!x.description) E(`${w}: description missing`); src(x, w, { allowSnippet: false }); });
      (f.competitor_links || []).forEach((x, i) => { const w = `competitor_links[${i}]`; if (!x.firm) E(`${w}: firm missing`); if (!x.relationship) E(`${w}: relationship missing`); src(x, w, { allowSnippet: false }); });
      const km = f.key_metrics; if (km && (km.total_debt_usd_m != null || km.cash_usd_m != null || km.liquidity_usd_m != null || km.credit_ratings)) { src(km, 'financing.key_metrics', { allowSnippet: false }); for (const k of ['total_debt_usd_m', 'cash_usd_m', 'liquidity_usd_m', 'net_debt_to_capital_pct']) num(km[k], `key_metrics.${k}`); }
    }
    if (!Array.isArray(d.ma)) E('ma must be an array');
    (d.ma || []).forEach((x, i) => { const w = `ma[${i}]`; en(x.role, MROLE, `${w}.role`); en(x.status, MSTAT, `${w}.status`); if (!x.counterparty) E(`${w}: counterparty missing`); if (!x.description) E(`${w}: description missing`); if (typeof x.after_ranking !== 'boolean') E(`${w}: after_ranking must be true/false`); src(x, w, { allowSnippet: false }); });
  } else E(`part must be "people" or "financing" (got ${JSON.stringify(d.part)})`);
  if (!Array.isArray(d.gaps)) E('gaps must be an array (may be empty)');
  if (!Array.isArray(d.sources_consulted)) E('sources_consulted must be an array');
  if (JSON.stringify(d).match(/linkedin\.com\/(in|company)\//i)) W('a linkedin.com profile URL appears somewhere in the file; make sure it is not used as a source');
  return { errs, warns };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/validate.mjs file [file...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const { errs, warns } = validateFile(f);
    if (errs.length) { bad++; console.log(`FAIL ${f}`); errs.forEach((e) => console.log('  ERROR ' + e)); }
    else console.log(`OK   ${f}`);
    warns.forEach((w) => console.log('  warn  ' + w));
  }
  process.exit(bad ? 1 : 0);
}
