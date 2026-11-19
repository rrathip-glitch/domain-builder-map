export const meta = {
  name: 'builder-research',
  description: 'Research swarm: map homebuilders (people, divisions, financing) into domain-intel/data/builders',
  phases: [{ title: 'Research', detail: 'one agent per builder part' }],
}
const ROOT = '/Users/rathiprajakumar/Desktop/RWorks/domain-intel'
const builders = args.builders
const items = []
for (const b of builders) {
  const parts = b.parts || ['people', 'fin']
  for (const part of parts) items.push({ b, part })
}
function prompt(it) {
  const b = it.b
  const head = `You are one research agent in a swarm mapping the top 100 US homebuilders for a land-banking firm. Today is 2026-11-19.

FIRST read these three files in full (they are your complete instructions; you know nothing else about the project):
1. ${ROOT}/BUILDER-BRIEF.md
2. ${ROOT}/SCHEMA.md
3. ${ROOT}/TIPS.md  (shared tips from other agents; append one line when you learn a reusable trick, as the file explains)

YOUR BUILDER: ${b.name}   builder_id: ${b.id}
${b.note ? 'Leads from the orchestrator (unverified memory, confirm everything, never cite as a source): ' + b.note : ''}
Use WebFetch on direct URLs for almost everything and curl for SEC EDGAR; WebSearch is one small budget shared by hundreds of agents, so spend it only on finding names of land and finance heads and land-banking counterparties (see TIPS.md for search-free routes). Never open linkedin.com.
${args.resume ? `RESUME MODE: an earlier agent on this exact part was interrupted. If your output file already exists, READ IT FIRST, keep every valid row, do not redo work that is already there, and spend your effort on what is missing: unfinished required fields (for example profile.summary, org_note, regions), roles not yet covered, and thin sections. If the file does not exist, start fresh.\n` : ''}`
  if (it.part === 'people') return head + `
YOUR PART: PEOPLE. Write ${ROOT}/data/builders/${b.id}.people.json (profile + people) exactly per SCHEMA.md. Another agent is covering financing and M&A for this builder${(b.parts || []).includes('divisions') ? ', and a third is sweeping division presidents, so you focus on: the profile, all executive officers, every land head and every finance / treasury / capital-markets head you can source, regional and area presidents with geography, and reporting lines. Add division presidents only when you come across them' : '. You cover the profile and everyone: executives, land and finance heads first, then regional and division presidents'}.
Priority: land acquisition / land development heads and finance / treasury / capital-markets heads come first, because those are the people a land banker calls. Confirm each person is current (2025 or 2026 source or the live company page).
Run the validator on your file and fix every ERROR before you finish. Return the short summary the brief asks for.`
  if (it.part === 'both') return head + `
YOUR PART: EVERYTHING FOR THIS BUILDER (it is a smaller or private company, so one agent covers it). Write BOTH files exactly per SCHEMA.md:
- ${ROOT}/data/builders/${b.id}.people.json (profile + people): owner / CEO, president, CFO, every land head (VP or Director of Land, Land Acquisition, Land Development) and finance head, division or market leaders with geography, reporting lines where stated or safely inferable. Land and finance roles first.
- ${ROOT}/data/builders/${b.id}.fin.json (financing + ma): land strategy, any public lot counts, any named land banker, lot-option or capital partner, lenders or facilities named in press or filings, parent-company funding, JVs, and M&A in 2025-2026 with what it changes. For a private company most financing is not public: record what is, list the rest in gaps as "not publicly disclosed", and move on.
If this organisation is not a conventional for-sale homebuilder (a nonprofit, a build-to-rent operator, a retirement-community developer), say so plainly in profile.summary and in financing.summary, including whether it is a plausible land-banking customer, and keep the people list to the leadership.
Write the people file first, early. Run the validator on both files and fix every ERROR before you finish. Return the short summary the brief asks for.`
  if (it.part === 'regional') return head + `
YOUR PART: REGIONAL HEADS AND THE CORPORATE LAND HEAD (a targeted second pass; the client's CEO stressed knowing every regional head and what each covers). First-pass files already exist: read ${ROOT}/data/builders/${b.id}.people.json and, if present, ${b.id}.divisions.json, so you know what is already mapped. Then:
1. Establish the regional structure: the builder's regions / areas / groups / segments and which states, metros or divisions each one covers (10-K segment note and Item 1, proxy, investor deck, company site, press).
2. For EVERY region, name the current leader (Region / Area / Group / Regional President or the builder's equivalent), with the geography covered and who they report to. Confirm each is current with a 2025 or 2026 source. Search by region and by title variants.
3. Name the corporate head(s) of land (Chief Land Officer, EVP or SVP Land, National VP Land Acquisition, President of Land, Chief Investment Officer where that role runs land) and the treasurer / capital-markets head, if the file does not already have them.
4. Update ${b.id}.people.json IN PLACE: fill profile.regions (name, geography, leader) and profile.org_note (one or two sentences: how regions map to divisions and who decides land deals), add new person rows (level "Regional", geography filled, reports_to and its confidence), and correct existing rows only when a newer source contradicts them. Never delete a sourced row. Where a region's leader is not public, leave leader null and add "Regional president for <region>: not publicly disclosed" to gaps.
Edit only ${b.id}.people.json. Keep it valid JSON at every save. Run the validator and fix every ERROR before you finish. Return: regions found, regions with a named leader, new people added, the corporate land head if found, and what is not public.`
  if (it.part === 'divisions') return head + `
YOUR PART: DIVISION AND REGIONAL LEADERS SWEEP. Another agent is writing the corporate leadership file; do not write ${b.id}.people.json. You write ${ROOT}/data/builders/${b.id}.divisions.json with this shape:
{ "builder_id": "${b.id}", "part": "people_extra", "retrieved": "2026-11-19", "people": [ ...person rows exactly as in SCHEMA.md... ], "gaps": [], "sources_consulted": [] }
Goal: find as many CURRENT division presidents, area/regional presidents, city/market presidents, and division- or region-level land leaders (VP/Director of Land Acquisition, Land Development, Land Entitlement) as public sources name, each with its geography (metro or state) and, where stated or safely inferable, who they report to (tag the reporting line Verified / Reported / Inferred). Work market by market: first get the list of this builder's divisions/markets (10-K, company site "where we build"), then search each one (company division pages, press releases "names/promotes ... division president", local business journals, HBA/BIA boards, conference speaker lists). For brands or subsidiaries inside this builder, capture each brand's president. Drop anyone you cannot place in the role as of 2025 or 2026, or keep them as Inferred with a note that says why. Aim for breadth with accuracy: 20 to 60 well-sourced rows for a national builder is realistic.
Run the validator on your file and fix every ERROR before you finish. Return: file path, count by level (Regional / Division), count of land leaders, share Verified, markets where you found no one.`
  return head + `
YOUR PART: FINANCING AND M&A. Write ${ROOT}/data/builders/${b.id}.fin.json (financing + ma) exactly per SCHEMA.md. Another agent is covering people. Cover: land strategy and the owned vs optioned lots table (latest quarter); every land-banking / lot-option financing relationship and counterparty you can source (search the filings and press for "land bank", "land banking", "option contracts", "finished lot option", "Millrose", "Kennedy Lewis", "Angelo Gordon", "Domain Real Estate", "DW Partners", "Essential Housing", "IHP Capital", "Brookfield", "Värde", "Oaktree", "GTIS", "Hearthstone", "Walton", "Forestar"); every outstanding notes series with coupon, principal and maturity; revolver and term loans with size, maturity and agent bank; JVs; ratings; cash, debt and liquidity; capital events in 2025 and 2026; and M&A in 2025 and 2026 with what each deal changes in the map. For a private company record what is public and list the rest in gaps as "not publicly disclosed".
Run the validator on your file and fix every ERROR before you finish. Return the short summary the brief asks for.`
}
phase('Research')
const results = await parallel(items.map((it) => () =>
  agent(prompt(it), { label: `${it.b.id}:${it.part}`, phase: 'Research', agentType: 'general-purpose', model: (args.model || 'opus') })
    .then((r) => ({ id: it.b.id, part: it.part, summary: typeof r === 'string' ? r.slice(0, 1500) : r }))
))
return results.map((r, i) => r || { id: items[i].b.id, part: items[i].part, summary: 'FAILED (agent returned null)' })
