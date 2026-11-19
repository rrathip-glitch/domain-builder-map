# Domain builder map: data schema and confidence rules (FROZEN v1, 2026-11-19)

Everything in this project reads and writes these shapes. Do not invent fields. If you need one, put the information in a `note` field and tell the orchestrator via `BOARD.md`.

## Files

| Path | Written by | What |
|---|---|---|
| `data/spine.json` | spine agent | Builder 100 ranking rows (rank, closings, revenue, ownership, parent) |
| `data/builders/<builder_id>.people.json` | research agents | profile + people for one builder |
| `data/builders/<builder_id>.fin.json` | research agents | financing + M&A for one builder |
| `data/competitors/*.json` | competitor session | land-banker profiles (Millrose, Kennedy Lewis, TPG Angelo Gordon, new entrants) |
| `data/ma_industry.json` | competitor/M&A session | industry-wide builder M&A since the ranking |
| `data/feed/raw/*.json` | collector script | collected article candidates |
| `data/feed/articles.json` | feed session | scored articles |
| `data/local/` | the app at runtime | votes, vote notes, Domain internal notes (never overwritten by a rebuild) |
| `data/dist/domain.json`, `data/dist/coverage.json` | `scripts/build.mjs` | merged data the app and workbook read |
| `exports/Domain-Builder-Map.xlsx` | `scripts/export-xlsx.mjs` | the workbook |

`builder_id` is the slug in `data/spine.json` (lowercase, hyphenated). Rank, closings and revenue live only in the spine; the build joins them in.

## Confidence tags (every fact row carries one)

| Tag | Colour | Meaning | Examples |
|---|---|---|---|
| `Verified` | green | You opened a **primary** source in this run and the fact is stated there. | SEC filing (10-K, 10-Q, 8-K, proxy), the company's own website / leadership page / press release, an official government record |
| `Reported` | amber | You opened a **secondary** source in this run and the fact is stated there. | trade press (Builder, Pro Builder, HousingWire, BizJournals), news, published rankings, conference speaker pages, third-party directories |
| `Inferred` | grey | Derived, pattern-built, snippet-only, or stale. | email built from a company pattern; reporting line deduced from titles; a name/title seen only in a search-result snippet (incl. a LinkedIn snippet); a source older than ~24 months with no newer confirmation |

Rules:
1. **No fact from memory.** Every row has a `source_url` you actually opened in this run (or, for Inferred snippet-only items, the search query noted in `note`). If you cannot source it, leave it out and list it in `gaps`.
2. **Never fetch linkedin.com.** A LinkedIn result in an ordinary search is a lead to confirm elsewhere; unconfirmed, tag `Inferred` and write "seen in search snippet" in `note`. Never use a linkedin.com URL as `source_url`.
3. **Accuracy beats volume.** These readers know the builders personally. A wrong name costs more than a blank. If two sources conflict, keep the newer primary one and note the conflict. If a person may have left, say so in `note` and downgrade to `Inferred`.
4. **Not public = say so.** When a role or number is not public after a reasonable look, add a line to `gaps` like "Head of land acquisition: not publicly disclosed" and move on.
5. `source_date` is the date of the source document (filing date, press-release date, "page as of" date). `retrieved` is today, `2026-11-19`.
6. Contact details: include only what the company itself publishes (main phone, office phone, a published email). A pattern-built email is allowed with `email_confidence: "Inferred"` and only if you found the pattern in a public source (record it in `profile.email_pattern_source_url`).
7. `domain_internal_notes` is always `""`. It is reserved for Domain's asset managers.
8. Short facts and your own summaries only. Do not copy article text.

## `data/builders/<builder_id>.people.json`

```json
{
  "builder_id": "k-hovnanian",
  "part": "people",
  "retrieved": "2026-11-19",
  "profile": {
    "legal_name": "Hovnanian Enterprises, Inc.",
    "brand_names": ["K. Hovnanian Homes"],
    "ownership": "Public",
    "ticker": "HOV",
    "parent": null,
    "hq_city": "Matawan", "hq_state": "NJ",
    "website": "https://www.khov.com",
    "main_phone": null,
    "states": ["NJ", "TX"],
    "markets": ["Northern New Jersey", "Houston"],
    "regions": [ { "name": "Northeast", "geography": "NJ, PA, ...", "leader": "Full Name or null" } ],
    "org_note": "One or two sentences on how the company is organised (segments -> regions -> divisions) and who the land and finance decision-makers are.",
    "email_pattern": "first.last@khov.com or null",
    "email_pattern_source_url": null,
    "summary": "Two or three sentences a land banker would want: size, footprint, strategy.",
    "confidence": "Verified",
    "source_url": "https://..."
  },
  "people": [
    {
      "name": "Full Name",
      "title": "Exact title as published",
      "role_category": "CFO",
      "level": "Corporate",
      "geography": "",
      "reports_to": "Full Name or empty",
      "reports_to_confidence": "Verified|Reported|Inferred or empty",
      "email": "", "email_confidence": "",
      "phone": "",
      "in_role_since": "YYYY or YYYY-MM or empty",
      "prior_role": "",
      "confidence": "Verified",
      "source_url": "https://...",
      "source_title": "Leadership page / FY2025 10-K / press release title",
      "source_date": "YYYY-MM-DD or YYYY or empty",
      "retrieved": "2026-11-19",
      "note": "",
      "domain_internal_notes": ""
    }
  ],
  "gaps": ["Treasurer: not publicly disclosed"],
  "sources_consulted": ["https://..."],
  "domain_internal_notes": ""
}
```

Enums:
- `ownership`: `Public` | `Private` | `Subsidiary of public company` | `Subsidiary of foreign company` | `Subsidiary of private company`
- `role_category` (pick the closest): `CEO` | `Chair/Founder` | `President/COO` | `CFO` | `Treasury/Capital Markets` | `Finance (other)` | `Land Acquisition` | `Land Development` | `Land (other)` | `Regional President` | `Division President` | `Legal/GC` | `Operations (other)` | `Sales/Marketing` | `Board` | `Other`
- `level`: `Corporate` | `Regional` | `Division`
- `geography`: free text for regional/division roles ("Southeast: FL, GA, Carolinas", "Phoenix division"); empty for corporate roles.

Priority order when time is short (this is who Domain calls on): land heads and finance/treasury/capital-markets heads first, then CEO/CFO/COO, then regional presidents, then division presidents, then everyone else. Board members only if they matter to financing (e.g. a sponsor's designee).

## `data/builders/<builder_id>.fin.json`

```json
{
  "builder_id": "k-hovnanian",
  "part": "financing",
  "retrieved": "2026-11-19",
  "financing": {
    "summary": "Three to five sentences: how this builder finances land and itself, and how much room there is for a land banker.",
    "land_strategy": "Land-light / owns most / mixed, in the company's own framing, with the stated target if any.",
    "lots": { "total_controlled": null, "owned": null, "optioned": null, "pct_optioned": null, "years_supply": null,
              "as_of": "YYYY-MM-DD", "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" },
    "land_banking": [
      { "counterparty": "Millrose Properties", "counterparty_type": "Land banker",
        "description": "What the arrangement is, in one or two sentences.",
        "amount_usd_m": null, "lots": null, "date": "YYYY-MM",
        "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" }
    ],
    "debt": [
      { "instrument": "8.0% Senior Secured Notes due 2031", "type": "Senior notes",
        "principal_usd_m": 0, "rate": "8.0%", "maturity": "2031-04", "secured": "Secured|Unsecured|",
        "lenders_agent": "", "status": "Outstanding", "as_of": "YYYY-MM-DD",
        "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" }
    ],
    "capital_events": [
      { "date": "YYYY-MM-DD", "type": "Debt issuance", "description": "", "amount_usd_m": null,
        "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" }
    ],
    "joint_ventures": [
      { "partner": "", "description": "", "date": "", "confidence": "Reported", "source_url": "https://...", "source_title": "", "note": "" }
    ],
    "key_metrics": { "total_debt_usd_m": null, "cash_usd_m": null, "liquidity_usd_m": null, "net_debt_to_capital_pct": null,
                     "credit_ratings": "", "fiscal_year_end": "", "as_of": "", "confidence": "Verified", "source_url": "https://...", "source_title": "" },
    "competitor_links": [
      { "firm": "Millrose Properties", "relationship": "What is publicly known.", "date": "",
        "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" }
    ]
  },
  "ma": [
    { "date": "YYYY-MM-DD", "role": "Acquirer", "counterparty": "", "description": "", "status": "Closed",
      "after_ranking": true, "map_impact": "What this changes in the map (people, markets, rank, lots).",
      "confidence": "Verified", "source_url": "https://...", "source_title": "", "note": "" }
  ],
  "gaps": ["Credit facility terms: not publicly disclosed (private company)"],
  "sources_consulted": ["https://..."]
}
```

Enums:
- `counterparty_type`: `Land banker` | `Developer` | `JV partner` | `Investor` | `Affiliate` | `Unknown`
- debt `type`: `Senior notes` | `Revolver` | `Term loan` | `Mortgage warehouse` | `Project debt` | `Convertible` | `Preferred` | `Other`
- debt `status`: `Outstanding` | `Undrawn` | `Redeemed` | `Announced`
- capital event `type`: `Debt issuance` | `Redemption` | `Facility amendment` | `Equity` | `Rating action` | `Land-bank deal` | `JV` | `Buyback` | `Other`
- `competitor_links.firm`: `Domain Real Estate Partners` | `Millrose Properties` | `Kennedy Lewis` | `TPG Angelo Gordon` | or the name of any other land banker / lot-option financier
- M&A `role`: `Acquirer` | `Target` | `Merger` | `Divestiture`; `status`: `Announced` | `Closed` | `Terminated` | `Rumored`
- `after_ranking` is true when the deal was announced or closed after the 2026 Builder 100 was published (May 2026); include 2025 to date either way.
- Money is in millions of US dollars as numbers; unknown is `null`. Dates are ISO (`YYYY-MM-DD`, `YYYY-MM` or `YYYY`).
- Empty arrays are fine and expected for private builders. Say why in `gaps`.

## Validation

Run before you finish; fix every error it prints:

```
node /Users/rathiprajakumar/Desktop/RWorks/domain-intel/scripts/validate.mjs <path-to-your-file> [more files]
```

## Feed article: `data/feed/articles.json` = `{ "generated": "ISO", "window_days": 90, "rubric_version": "v1", "articles": [ ... ] }`

```json
{
  "id": "first 12 hex of sha1(url)",
  "url": "https://...", "title": "", "publisher": "", "published": "YYYY-MM-DD",
  "source_type": "Filing|Press release|Trade press|News|Research",
  "summary": "Own words, 40 words or fewer. Never copied text.",
  "category": "Land banking & competitors|New entrant|Builder financing|Builder M&A|Executive change|Land & lots|Capital markets & ratings|Earnings & guidance|Housing market|Other",
  "score": 0,
  "subscores": { "land_banking_competitor": 0, "builder_customer": 0, "financing_capital_markets": 0, "land_lot_supply": 0, "materiality_actionability": 0 },
  "why_it_matters": "One sentence, to Domain specifically.",
  "builder_ids": ["lennar"], "people": ["Full Name"], "competitors": ["Millrose Properties"],
  "suggested_update": null,
  "collected_via": "query or feed that found it", "retrieved": "2026-11-19", "scored_by": "llm-rubric-v1"
}
```
`suggested_update` is `null` or `{ "builder_id": "", "kind": "Executive change|Deal|Financing|Land banking", "text": "what to change on the builder record" }`.
Subscore maxima: land_banking_competitor 30, builder_customer 25, financing_capital_markets 25, land_lot_supply 10, materiality_actionability 10 (sum = score before caps). Rubric: `feed/RUBRIC.md`.
Votes are app runtime state in `data/local/votes.json`: `{ "<article id>": { "vote": 1 | -1, "note": "", "ts": "ISO" } }`.

## Competitor profile: `data/competitors/<competitor_id>.json`

```json
{
  "competitor_id": "millrose-properties", "name": "", "type": "Land banker|New entrant|Lender|Other", "manager_or_parent": "",
  "summary": "", "retrieved": "2026-11-19",
  "facts": [ { "topic": "Pricing|Portfolio|Capital|Strategy|Terms|People|Other", "fact": "", "as_of": "", "confidence": "Verified", "source_url": "", "source_title": "" } ],
  "builder_relationships": [ { "builder_id": "slug from spine or null", "builder_name": "", "description": "", "amount_usd_m": null, "lots": null, "date": "", "confidence": "Verified", "source_url": "", "source_title": "" } ],
  "debt": [ "same row shape as builder debt" ],
  "people": [ "same row shape as builder people" ],
  "gaps": [], "sources_consulted": []
}
```

## Industry M&A: `data/ma_industry.json` = `{ "retrieved": "2026-11-19", "deals": [ ... ] }`

```json
{ "date": "YYYY-MM-DD", "acquirer": "", "acquirer_builder_id": null, "target": "", "target_builder_id": null,
  "description": "", "status": "Announced|Closed|Terminated|Rumored", "after_ranking": true,
  "map_impact": "", "confidence": "Verified", "source_url": "", "source_title": "" }
```

## Insight tables (the "above and beyond" contract): `data/extras/<id>.json`

Any session can add an analytical view without touching app code. The app shows every file in `data/extras/` as a tab under **Insights**, and the workbook exports each as a sheet.

```json
{
  "id": "land-bank-need-ranking",
  "title": "Who is most likely to need land-bank capital",
  "subtitle": "One line a land banker reads first.",
  "is_estimate": true,
  "method": "Plain-language method: inputs, weights, what is missing. Readers will check the reasoning.",
  "generated": "2026-11-19T11:00:00-05:00",
  "order": 10,
  "columns": [ { "key": "builder", "label": "Builder", "type": "builder_link|text|number|pct|usd_m|date|confidence|url|person" } ],
  "rows": [ { "builder": "lennar", "...": "..." } ]
}
```
For `builder_link` the cell value is a `builder_id`. Keep each table small, finished, and honest: label estimates, show inputs as columns.
