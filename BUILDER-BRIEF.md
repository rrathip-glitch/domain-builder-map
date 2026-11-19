# Research brief: map one homebuilder for Domain

Read this whole file, then `SCHEMA.md` in the same folder, before you start. You know nothing else about this project, and you do not need to.

## Why this exists

Domain Real Estate Partners is one of the three largest US **land bankers**: it buys land and lots and options them back to homebuilders, so the builder controls lots without owning them. Its competitors are Millrose Properties (public, managed by Kennedy Lewis; spun out of Lennar) and TPG Angelo Gordon. Domain's people **call on builders' land and finance executives**. They want, for each of the top 100 US homebuilders:

1. **The map of who does what**: not just names, but who runs land acquisition, land development, finance, treasury and capital markets, who the CEO/CFO/COO are, and who the regional and division presidents are with their geography and reporting lines.
2. **How the builder finances itself away from Domain**: owned versus optioned lots, land-banking and lot-option partners and who they are, credit facilities, notes and maturities, joint ventures, recent debt issuance, and any public link to Domain, Millrose, Kennedy Lewis or TPG Angelo Gordon.
3. **M&A** since the 2026 Builder 100 ranking was published (May 2026), and 2025 to date for context.

The readers know these builders personally and will check the facts. **A wrong name costs more than a blank.** The comparison point is a ten-minute LLM pass; yours must be plainly deeper and every fact must trace to a link.

## Where to look (public, free, logged-out only)

- **SEC EDGAR** for public builders and private ones with public debt: latest 10-K (Item 1 business + land/lots table, executive officers, debt footnote), latest 10-Q, DEF 14A proxy (officers, reporting), recent 8-Ks (officer changes under Item 5.02, debt under Item 1.01/2.03), exhibit 21. EDGAR wants a declared client: use `curl -s -H "User-Agent: domain-intel-research/1.0 (research use)" <url>` at no more than 2 requests per second, or WebFetch. Useful: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=<name>&type=10-K` and `https://efts.sec.gov/LatestSearch/` full-text search. If EDGAR refuses, use the company's investor-relations site, which hosts the same filings and releases.
- **The company's own site**: leadership / about / management pages, division or "where we build" pages (division presidents are often named on division pages and in local press releases), newsroom, investor presentations, contact pages (published phone numbers).
- **Press releases** (BusinessWire, PR Newswire, GlobeNewswire): promotions and appointments ("names ... division president", "promotes ... vice president of land acquisition"), debt offerings, credit-facility amendments, acquisitions.
- **Trade and local press**: Builder / builderonline.com, Pro Builder, HousingWire, The Real Deal, Bisnow, local business journals, local HBA/BIA pages, ULI and conference speaker lists (titles), state licensing or court records where relevant.
- **Search patterns that work**: `"<builder>" "division president"`, `"<builder>" "vice president of land"`, `"<builder>" "land acquisition" named OR promoted OR appointed 2025 OR 2026`, `"<builder>" treasurer`, `"<builder>" "land banking" OR "land bank" OR "lot option"`, `"<builder>" Millrose OR "Kennedy Lewis" OR "Angelo Gordon" OR "Domain Real Estate"`, `"<builder>" "senior notes" OR "credit facility" 2026`, `"<builder>" acquires OR acquisition 2026`.

Hard rules:
- **Never open linkedin.com** (not profiles, not company pages, not via any proxy or cache). A LinkedIn line in ordinary search results is only a lead: confirm it on another site, or record the person as `Inferred` with `note: "seen in search snippet, not confirmed"` and a non-LinkedIn `source_url` if one exists (otherwise leave `source_url` empty and explain in `note`).
- Do not get around paywalls, logins, CAPTCHAs or bot blocks. If a page will not load, move to another source.
- No contact with anyone. No form submissions. Read only.
- Every row needs a `source_url` you actually opened in this run and a confidence tag per `SCHEMA.md`. Nothing from memory. Your training knowledge is a lead generator, never a source; executives change often, so confirm that each person is **current** (look for a 2025 or 2026 source, or the live company page).
- Store facts and short summaries in your own words. Do not copy article text.
- When something is not public, write it in `gaps` ("Treasurer: not publicly disclosed") and move on. Do not search endlessly: for a private builder with a thin public footprint, 15 to 25 well-sourced minutes is enough.

## Depth targets

| Builder type | People | Financing |
|---|---|---|
| Large public (top ~25) | All executive officers; every land and finance/treasury/capital-markets head you can source; all regional/area presidents with geography; as many division presidents as public sources name (often 15 to 60); reporting lines where stated or safely inferred | Full lots table (owned / optioned / % optioned / years supply); every notes series with coupon, principal, maturity; revolver size, maturity, agent; land-banking counterparties and program size; JVs; ratings; 2025 to 2026 capital events |
| Mid public / private with public debt | Officers, land and finance heads, division presidents | Same as above from filings or offering news |
| Private | Owner/CEO, president, CFO, land head(s), division or market leaders; whatever the company site and local press name | Whatever is public: land banker or capital partner announcements, lender names in press, parent-company financing, JV news; otherwise say "not publicly disclosed" |

For Japanese- or other foreign-owned builders (Sekisui House, Sumitomo Forestry, Daiwa House, Mattamy, Brookfield and so on), record the parent, the US leadership, and the parent-level financing facts that matter (who funds them).

## Output

Write the file(s) named in your assignment under `/Users/rathiprajakumar/Desktop/RWorks/domain-intel/data/builders/`, exactly in the shapes in `SCHEMA.md`:

- `<builder_id>.people.json` (profile + people)
- `<builder_id>.fin.json` (financing + M&A)

**Write early and often**: save a valid file as soon as you have the executive officers or the debt table, then keep extending it. Another process may read it at any moment, so the file on disk must always be valid JSON.

Before you finish, run:

```
node /Users/rathiprajakumar/Desktop/RWorks/domain-intel/scripts/validate.mjs /Users/rathiprajakumar/Desktop/RWorks/domain-intel/data/builders/<your file>
```

and fix every ERROR. Work only on your own file(s); do not edit anything else in the project.

## What to return

A short summary, nothing else: file path(s); counts (people total, land heads, finance heads, regional, division; debt instruments; land-banking counterparties; M&A rows); share Verified; the two or three most interesting things you found for a land banker (for example a named land-bank partner, a near-term maturity, a new land executive); and what was not publicly available.
