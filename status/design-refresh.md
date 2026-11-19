# design-refresh status (updated 13:15 ET, machine clock)

## READY TO DEPLOY 13:15 (source popover + news headlines), swap 27: `app/public/` matches `app/public-next/` file for file.

## FINAL (12:41 ET): done, not done and why, and what another hour would buy

**Done** (each clicked in the browser at 1440 x 900 through the gate on http://localhost:4175; last full sweep at 12:35: 31 routes, no console errors, no "undefined", no sideways scroll, no table scrolling sideways; votes.json and notes.json empty)
- Shell: Home, Builders, By state, People, News, Competitors, Deals, Insights; one search ("/" focuses it, Escape closes); confidence legend with shape-coded marks; workbook download; Coverage. Forest-green frame, cream paper and Garamond-style titles taken as cues from Domain's public site; one colour rule in `app/DESIGN.md`.
- Home: search, quick jumps, Create newsletter, live US map into By state, four tiles, top stories by relevance, top of the call sheet with each amount beside its own date.
- Builders: rows with land bankers and how sure each link is (old links show their year), chips for rank, ownership and land banker, filters in the address, preview, CSV, full table.
- Builder page: strip, Key people, internal notes, tabs. Org map opens on the connected org chart (component `orgmap.js`; regional heads wrapped under their area heads; no sideways scroll at 1280 or 1440 on Lennar, D.R. Horton, K. Hovnanian, Toll, Pulte, DSLD, Colina; the tester confirmed it on swap 23), with Regions grid, List by role and Reporting lines one click away. Financing leads with the next debt due. "Print pre-call brief" prints a one-page brief.
- By state (component), People (role and region chips, CSV), News (flat most-relevant list or newest by day or week, cutoff, votes with Undo and visible working, filters in the address), Competitors (who each firm finances, grouped by builder and ranked; Millrose pricing and terms from its filings), Deals, Insights (six tabs, two with a switch; every table downloads as CSV), Coverage, person drawer.
- Newsletter: button on News and Home, panel with live email preview, confirmation, "You have a newsletter" on reopening, and Stop.
- Directives D12 to D23 and tester items N-01 to N-57 are addressed; the tester has verified through N-53 (N-54 to N-57 landed in swaps 24 and 25 and await a re-test).

**Not done, or only partly, and why**
- Newsletter end to end: I never posted a real subscribe or unsubscribe (calls were stubbed in the page so no subscriber was created and nothing was emailed); the tester ran real saves with a made-up address. Sending is switched off on this machine, so "First issue sent to you now" has only been seen stubbed. "You have a newsletter" is remembered per browser (local storage), not per person. Daily and Weekly preview the same 14-day first issue because `app/newsletter.mjs` builds it that way; the panel says so.
- Print brief: checked with an on-screen page-size preview (Lennar 767 px, D.R. Horton 825, Toll 915 of a 941 px letter page), not with a real printer or the browser's print dialog.
- Research-process notes are hidden by a display filter (N-28, N-35); the data files still contain them.
- Competitor pages show large pricing numbers only for Millrose. Its "own cost of debt, about 6.2%" is the research estimate from the pricing table and carries the Inferred mark. Beazer appears under Millrose at $580M with its own line saying it is not a direct option counterparty.
- One raw date remains on screen inside the component org chart (a D.R. Horton title, "from 2026-11-01"): it is in `orgmap.js`, which I did not edit at the end. M-07 (Polish, small maps on chart cards) is the component agents'.
- My two small patches inside `usmap.js` and `stateview.js` (open-field rule; banker cell with confidence and year) must be re-applied if those files are regenerated (search "the build's own list" and "named_firm_confidence").
- D21 per-view fan-out was not done (the views were live and tester-checked when it arrived); `app/public-next/MODULES.md` and `views/index.js` exist for it and no module uses the hook yet.
- Not checked: a 1920 px screen (1280, 1440 and passes at 1680 only), Safari and Firefox, the hosted copy behind the PIN (I do not deploy). Plain 4173 and 4190 log one 404 for `/newsletter/options` by design.

**With another hour**
1. Clean the research-process notes out of the data itself with `app-export`, then delete the display filter, so screen, workbook and CSV say the same thing.
2. A real print test and a second page for the brief (next three debts due, internal notes when written), and the same one-page brief for a competitor.
3. Put the newsletter's saved state on the server (token lookup by email), so "you have a newsletter" follows the person, and have the email itself state the period it covers.
4. Org chart: a "fit to one screen" view for presenting (regional heads only, compact cards), since on the largest builders the chart is two screens tall; and pass the house date and label cleaning into the component.
5. Safari, Firefox and a 1920 px shared screen pass; keyboard-only run through every screen.
6. Split `app.js` (about 1,300 lines) into the view modules the contract describes, with the tester's 54 cases written down as a checklist to re-run after each change.

**How to run / roll back**
- Preview of the working copy: `PUBLIC_DIR=app/public-next PORT=4190 node app/server.mjs` (running). Org chart default flip-back: `ORG_MODE = 'diagram'` in `app.js`. The first old front end is in `app/public-prev/`.

## Swap 27 (13:15 ET): hover-over sourcing (user request after the 1 pm stop)
**What it does.** Any sourced figure has a dotted underline. Hover it, tab to it, or click it (click pins it, so it works by tapping): a card shows the confidence mark and word, the source title, the kind of document (SEC filing, public record, press release or the site), the document date and the retrieved date, one or two lines on what the source says (never more than 200 characters), and "Open original document" (new tab). No link on record: the card says "Source not recorded". The card sits beside the figure, never over it, stays on screen at the edges, closes on Escape, on moving away, on scrolling and on a click elsewhere, and causes no layout shift (it is fixed-position).
**Aggregates.** A cell that stands for several records lists each one (amount, source date, confidence, one line, its own link), largest first, and says what the headline figure is: "Lennar Corp. and TPG Angelo Gordon: 7 public records. The figure in the grid is the largest disclosed amount, not a current balance; the date is that source's date." Old headline records add "(from 2015, so historical)". The date under each grid figure now reads "source: Mar 2026".
**Where it is on:** Who banks whom grid cells and its other figures; Builder-financier links (amounts, lots, dates); debt coming due; call sheet ("Why call now"); Millrose pricing and terms (each term, both sources where there are two); builder strip (closings, lots optioned, each land banker, next debt due); Financing tab (lots, balance-sheet figures, every amount and due date in the land banking, debt, capital events and joint-venture tables); competitor pages (builders it finances, cost of debt, yield, invested capital or assets under management, "Who it finances" amounts, every record, debt); Competitors "Who finances whom"; Home ("Builders mapped" tile, call-sheet debt amounts).
**Verified** at 1440 x 900 on the preview and again on the live files at http://localhost:4173: Lennar's TPG Angelo Gordon cell ($3.1B) shows "TPG Essential Housing Fund IV presentation to SBCERA, March 2026" first, with the sbcera.legistar.com link, then the other records; Toll Brothers' first debt row shows the Form 10-Q for the quarter ended 31 Jul 2026 with its sec.gov link; K. Hovnanian's lots figure shows the fiscal 2026 third-quarter results (8-K exhibit) with its link; Millrose's yield tile shows the Q3 2026 earnings release with its link. Also checked: one real mouse hover (screenshot), focus shows it, Escape and click-away close it, click pins it, the card never overlapped its cell and stayed on screen, 23 routes with no errors and no sideways scroll.
**Not done / limits.**
- NOT verified through the gate: http://localhost:4175 was not answering from 13:09 to 13:15 (connection refused; it is the orchestrator's process). Port 4173 serves the same `app/public/` files, so the feature is the same there; the newsletter button is the only thing 4173 cannot show.
- By state table cells do not have the card: they are drawn by the component `stateview.js`, which I did not edit for this. The Builders list rows do not have it either (each row is one button, and a control inside a button is not valid); the same builder's strip, one click in, has it.
- Insight tables with no per-row source (mandate screen, debt maturity ladder, feed versus baseline) have no card: their figures are added up by the build. Deals tables keep their Source column and have no card on the date.
- Titles for records that carry only a link are looked up in the portal's source list by URL; a record whose link is not in that list shows the site name instead of a title.
- Real keyboard focus could not be exercised in the embedded browser while it was in the background, so focus was checked with a dispatched focus event.

## Swap 26 (13:09 ET): facts-only news headlines (user request, after the 1 pm stop)
- Wherever a story is shown (News cards, Home top stories, related news on builder and competitor pages) the headline is the story's published title in full (no ellipsis), with one factual line from the summary beneath, then publisher, date and tags. The Domain-angle sentence is gone from the default view; it lives only inside "How it scored" as "Why it scored this way". Page title is "News: builders, financing and land banking".
- Verified on http://localhost:4173 (same files as the gate serves; the gate on 4175 was not answering at 13:09): 10 of 10 cards at 70+ match the published title exactly, none clipped, no "Domain will / should / a Domain land bank" text on News cards, Home, Lennar's news tab or Millrose's news list.

## Swap 25 (12:41 ET): the tester's last three, verified at 1440 and 1280 on the preview and at 1440 through the gate
- N-56: in the flat News list a story you vote down keeps its place (position 8 stayed position 8), greyed, with its note box and Undo, even when it now scores under the cutoff; it is released when the cutoff or topic changes or you leave the page. Undo restored the score and votes.json is empty.
- N-55: People shows "Filtered: Regional heads · covers Southeast  ✕ Clear" whenever any filter is on, Clear resets everything, and the filters are in the address (`#/people/regional?region=Southeast`, `#/people/land?region=Texas`).
- N-57: the Call sheet fits 1280 (1,219 px table in a 1,219 px box).
- My preview server on port 4190 had stopped; I restarted it (it is my own process, serving `app/public-next/`).

## Swap 24 (12:35 ET)
- N-54: after saving, the panel remembers the newsletter in this browser; reopening shows "You have a newsletter: daily, 70+, up to 10 stories, to <email>. Saving again updates it. Stop it", and the confirmation has "Stop this newsletter" (calls the back end's unsubscribe with the token it returned). Checked with the subscribe and unsubscribe calls stubbed.

## Swap 23 (12:32 ET): N-53, competitor pages answer "who does it finance and how does it price" at the top
- Strip: builders it finances (count, then names by size: "Lennar Corp. $6.6B · Taylor Morrison $3B · Dream Finders Homes $1.25B · Beazer Homes $580M · +4"), and for Millrose its own cost of debt, the yield it earns by counterparty type, and invested capital.
- "Who it finances": one line per builder (records grouped: Millrose's 21 records are 8 builders), largest public amount first, with latest date, confidence and a link to the builder page; every record with its source is one click down, with the builder column holding only the name.
- Millrose only: "Pricing and terms: Lennar versus other builders", the filings table as short cells (term, Lennar, other builders, date, source), eight rows then "Show all 21".
- The Competitors list cards use the same per-builder count. Checked Millrose, Kennedy Lewis, TPG Angelo Gordon, Domain and the new-entrants page on the preview: no sideways scroll, no "undefined".

## Swap 22 (12:24 ET)
- Final component files re-copied (orgmap 12:20, stateview 12:18, usmap 12:19; my two patches are intact). The connected org chart is the default Org map view; see the FINAL block for what I measured and how to flip back.

## Swap 21 (12:23 ET): the orchestrator's four polish items
- News: the why-it-matters line gets three lines at slightly smaller type; none of the top ten is cut (measured 0 of 10 clipped at 1440).
- Insights: "Debt coming due" is one tab with a switch (By instrument / By year), and "Who banks whom" is one tab with a switch (Grid by builder / Every link with its source). Six tabs instead of eight.
- Print pre-call brief: printing a builder page now gives a one-page brief (name and rank, four key facts, who to call, known land bankers with year and confidence, the three most relevant stories, regional heads with what they cover, five sources) with no navigation. Checked with an on-screen page-size preview, not a real printer: Lennar 767 px, D.R. Horton 825, Toll 915, K. Hovnanian about 630, Colina about 510, against a 941 px letter page.
- Home tile reads "Stories scoring 70+: 25, in the last 90 days · 1 this week, of 132 read".

## Swaps 19 and 20 (12:20 ET)
- One date style in running text too: dates written inside sentences, plain table cells, insight takeaways and source titles now read "15 Mar 2027" / "Nov 2028" (checked: no "2027-03-15" style date left on Home, Builders, builder tabs, By state, People, News, Competitors, Deals, every insight table, Coverage).
- Financing no longer prints "n/a lots owned · n/a optioned" when only the share is known (Lennar now reads "98% of lots optioned or controlled · 488,000 lots in all"); names in tables stay on one line; research provenance trimmed from "Covers" labels.
- Component modules re-copied at their 12:18 versions (my two patches are intact in them): the Connected chart now wraps regional heads into rows under their area heads with no sideways scroll (checked on Lennar, D.R. Horton, Toll, K. Hovnanian, Pulte, DSLD, Colina; person click still opens the drawer), and By state says "No land banker named". The default Org map view is still the wrapped "All regions" grid: the tester had not re-verified M-01 on this version when I swapped.

## Swap 18 (12:17 ET)
- Builder strip: the "Known land bankers" cell no longer runs into "Next debt due". Each cell clips to its own width, banker names wrap, and the cell is wider. Measured on Lennar, D.R. Horton, Dream Finders, K. Hovnanian, Toll, Taylor Morrison and Colina at 1280, 1440 and 1680: nothing leaves its cell, strip height 155 to 188 px.

## Swaps 16 and 17 (12:15 ET): the orchestrator's last round
- Newsletter preview: the "blank preview" was real. A sandboxed frame came up empty when created a second time (the confirmation state), and the panel's fade-in could be caught unpainted. The email now renders in an isolated container (scripts and handlers stripped, links open in a new tab), with a white page and a fixed minimum height, and the fade-in is gone (also on the person drawer). Checked through the gate: form state, 90+, back to 70+, Weekly, and the confirmation "Saved. Here is your first issue." all show the email (subscribe call stubbed; no subscriber created).
- Historic links (N-45, N-50, N-51): shown, never hidden, with the year whenever the link is more than 24 months old; who-banks-whom cells for old links are grey with their date; the K. Hovnanian row uses the name executives use; the table fits 1280 and 1440 with no sideways scroll.
- Last sweep at 1440 x 900 and 1280 x 800 through the gate: every view opens, no console errors, no "undefined", no sideways scroll; votes.json and notes.json are empty.

## Swaps 14 and 15 (12:09 ET): what is new since swap 13
- Person cards start at the top with the map in the corner; a corporate person's "Covers" line shows only when it names real territory; research wording trimmed from the small rows in region cards.
- Newsletter polish (N-48 partly, N-49): the save button reads "Save and preview the first issue" (or "Create and send the first issue" when sending is on); a line says what each issue covers; the confirmation says how to stop; the Home button is in the first row; Escape returns focus to the button that opened the panel.

## Swap 13 (12:06 ET): what is new since swap 12
- N-45 (High): a link the record itself calls "Historical" (K. Hovnanian and Domain, the 2015 announcement) no longer counts as a known land banker: gone from the strip, the Builders list, the Domain chip (now 6 builders, 5 of them marked Reported or Inferred) and By state; it stays on the Financing tab as "No current public link · Historical (Oct 2015, a lead only)". This is a display rule in the portal; the build still counts it, so the workbook and coverage may differ until `app-export` matches (request posted on the board).
- N-46 / N-18: who-banks-whom cells are short again with the confidence mark ("$6.6B Sep 2026", "Lead Apr 2024", "Loan · not land banking"); rows are 47 px and nothing scrolls sideways at 1440.
- N-47: one colour rule, written into `app/DESIGN.md`: green frames the page (top bar, titles, tier label), blue is anything you click or that carries data (links, buttons, the selected chip, bars, maps, Land), charcoal for text and the 90+ badge, and confidence keeps its own three colours.
- The Builders address always shows the filters in force.

## Swap 12 (12:05 ET): what is new since swap 11
- NEWSLETTER (D23 item 1): "Create newsletter" button on News (prominent, top right) and a smaller one on Home beside "All news". It opens a panel: email and optional name; minimum relevance 70+ / 90+ / Custom slider; Daily / Weekly; 5 / 10 / 20 stories; topic chips (all on, with All / None); builders to follow (all by default, searchable picker); a live preview of the email on the right in a sandboxed frame that updates as settings change; on create, "First issue sent to you now. Next one tomorrow at 7 am Eastern." or, while sending is switched off, "Saved. Here is your first issue." Built as `newsletter.js` + `newsletter.css` by a parallel agent, wired by me. The buttons show only when `GET /newsletter/options` answers (through the gate, port 4175 and the hosted copy); they stay hidden on plain 4173 / 4190, where that request logs one 404 in the console.
- Checked through the gate (http://localhost:4175, 1440 x 900): button on News and Home, panel opens with focus on the email field, default preview shows 2 stories at 70+, Escape closes; the agent also clicked every setting, the builder picker, email validation, and the success, saved and error states with the subscribe call stubbed. NOT done on purpose: no real subscribe was posted (no test subscriber created, no email sent), so the live confirmation path is untested end to end; sending is switched off on this machine.
- Tester batch: N-37 By state sticky bar is solid from the moment it sticks; N-38 the map's hover box is hidden on any click and page change; N-39 the Regional heads label on the Org map uses the same count as the strip; N-40 the top search box reads "Search /" and widens when focused; N-41 "Regional heads only" is four cards per row and tighter (Lennar's ten cards fit in 436 px); N-42 "Most relevant" is one flat list, best first, ten at a time, with week or day headings only under "Newest"; N-43 "All 545 stories", day headings like "Mon 16 Nov 2026", and News filters live in the address (`#/feed?cut=90&sort=new&int=day`); N-44 fixed in swap 11. Opening a story from Home no longer changes the News cutoff.
- Verified by clicking on the preview and on 4173: flat list (93 first), Show more, Newest weekly and daily, All, deep link `#/feed?cut=90`, a vote and Undo (votes.json empty again), story opened from Home, Lennar Regional heads only; every view opened; no console errors on 4175.

## Swap 11 (12:01 ET): what is new since swap 10 (D23 items 2 and 3)
- Land-banker links are honest on screen, read from the build (`derived.land_banker_links`, `land_bankers_display`, `named_firm_confidence`, `financing.no_link_notes`): the Builders list shows each firm with its confidence mark and "(Inferred)" / "(Reported)" in words; a land-banker filter says how many of the listed links are not Verified ("7 builders · 6 of these links are Reported or Inferred"); the builder strip lists each firm with its mark; the Financing tab's four firm cards show "Public link" with confidence, date, amount and source, a plain "A lead to confirm" line for Inferred, and "No public link found" notes as context (with older evidence labelled as such), never as a link; By state shows "(Inferred)" beside a firm; the full table and CSV carry the same wording.
- `usmap.js` open-field rule now uses the build's own list (`derived.land_bankers`) so an unnamed aggregate is not a named banker. I also patched the banker cell in `stateview.js`. Both are component files: if a component agent re-saves them, these two small patches need re-applying (search for "the build's own list" and "named_firm_confidence").
- Brand cues taken from Domain Real Estate Partners' public site (read in the browser: forest green #3E5539, cream #FAF9F6, EB Garamond headings, Arial body, restraint): forest-green top bar and headings, cream paper, warmer lines and greys, Garamond-style serif first in the heading stack (no font download), slightly tighter corners. The action accent stays blue because green means Verified. No logo, image or text is reused; the page still says "Domain builder map", not an official product.
- Verified by clicking: Builders filtered to Domain (7, with marks), Toll and K. Hovnanian financing cards, Toll strip, By state Texas, full table; Home, a builder page and News with the new palette; no console errors.

## Swap 10 (11:52 ET): what is new since swap 9
- Builder preview no longer shows a summary sentence (D22); the footprint map sits beside "Open".
- View-module hook and `MODULES.md`; latest component files re-copied.

## Swap 9 (11:49 ET): what is new since swap 8
- Org map default is back to "All regions" (my wrapped grid: every regional head card on the page with its map and what it covers; Lennar's nine named heads fit one screen in "Regional heads only"). The component chart `orgmap.js` is one click away as "Connected chart". Reason: the tester's M-01 (High) found the component's regional heads row scrolls sideways and hides 7 of 12 regions, and the CEO's priority is seeing every regional head. Flip the default back in one line (`ORG_MODE`) once M-01 is fixed in the module.
- Component issues M-01 to M-07 in `status/ux-issues.md` are for the component agents (`orgmap.js`, `usmap.js`, `stateview.js`); I re-copy those files from `app/public-next/` at each swap, so their fixes ship with the next one.

## Swap 8 (11:49 ET): what is new since swap 7
- N-34 the one-sentence cut no longer stops at "D.R.", "U.S.", "Inc." and similar; long sentences cut on a word boundary. N-35 "What is not public" lists land, finance, regional heads, land bankers, debt first, and the filter now also drops research to-do notes (second pass, refused, unavailable, 403, snippet, not checked). Display filter only.
- N-29 competitor tiles are numbers: Millrose shows "8.5% Lennar · 10.8% Other" (yield it earns from builders) and "$9.25B" invested in land, each with its sentence behind "more". Decision: a number goes in large type only when the record states exactly that figure (weighted-average yield; total invested capital; assets under management). For Kennedy Lewis, TPG Angelo Gordon and Domain the only such figure is assets under management; a first attempt pulled deposits and fund returns into "What it charges", which would have been quoted wrongly, so those stay in the table.
- N-33 a builder link with no tab always opens on the Org map (in swap 7).

## Swap 7 (11:47 ET): what is new since swap 6
- D19 "By state" is a top-level tab, second after Builders (`#/states`, `#/states/TX`): the component `stateview.js` mounted at full width, address kept in sync, builder clicks open the builder page, person clicks open the detail drawer. Home has a large live map entry point (darker = more of the top 100 build there; click a state). The footprint map in each builder header links to By state.
- N-19 / D17 the component org diagram `orgmap.js` is mounted as the Org map (chief executive, corporate row, regional heads row with what each covers, its own All / Regional heads only / Land and finance only switch, Expand / Collapse). A person click opens the same detail drawer. "List by role" and "Reporting lines" remain beside it. The earlier built-in diagram stays in the code as the fallback if the module fails to load. A builder now always opens on its Org map unless the address names a tab.
- N-31 every table has "Download CSV" (current rows, every column): call sheet, debt coming due, all insight tables, financing, deals, competitors; the Builders list has "Download these as CSV" for the current filter. N-32 People CSV has plain column names.
- New files in `app/public/`: `stateview.js`, `orgmap.js`, `orgmap.css`, `usmap.css` (plus `usmap.js`, `usstates-paths.js`, `icons.js` from earlier swaps). Local imports are relative, so the page works at any path.
- Verified by clicking on the preview at 1440 x 900 (and no sideways scroll at 1280 x 800): Home map, By state (clicked Texas: address became #/states/TX, 58 builders listed), Lennar org diagram (59 people; Regional heads only 11; Land and finance only 14; Expand all; person click opened the drawer; List by role; back to Diagram; tab away and back), D.R. Horton (99), Toll (60), K. Hovnanian (28), DSLD (5), Colina (1); CSV from the call sheet (30 rows), debt coming due (30), Builders filtered to Millrose (5), People land (342); every other view opened; no console errors.

## Swap 6 (11:43 ET): what is new since swap 5
- N-28 research-process notes (search budgets, tool limits, "this run", the researcher's own voice) no longer show under "What is not public" or as competitor facts. The filter works sentence by sentence, so a real finding that also mentions the process keeps its finding. It is a display filter only; the data files are unchanged (the orchestrator has the counts for a data clean-up).
- N-29 competitor pages open on the firm, not on record counts: builders linked and largest public deal, what it charges, size of the book, where its money comes from (each the latest Verified fact with a number), jump links, and "What is known" by topic with Pricing first. N-30 competitors first, Domain last and labelled "How Domain looks from outside"; the repeated tag and the fact count are gone.
- Verified by clicking: Millrose (topic chips, Capital), the other four competitor pages, NVR and D.R. Horton profile tabs (no process wording left on screen); no console errors.

## Swap 5 (11:41 ET): what is new since swap 4
- The component US map (`usmap.js`, real state outlines) is mounted everywhere the region marker appears: builder header, builder preview, region cards, regional-head cards, person drawer. (`usmap.js` and `usstates-paths.js` are now part of `app/public/`.)
- N-25 call sheet on Home pairs each amount with its own date ("$850M due by Nov 2028 · first $450M in Mar 2027"). N-27 a person tagged Inferred says "lead to confirm" in words on cards and in Key people.
- Still to mount when they land: `orgmap.js` (render function and stylesheet not there yet at 11:41) and `stateview.js` (By state tab, D19).

## Swap 4 (11:40 ET): what is new since swap 3
- Builders: Land banker chips on the first row, one firm each (Domain, Millrose, Kennedy Lewis, TPG Angelo Gordon, Any named, None named), and the filters are in the address so a filtered list can be sent (for example `#/builders?lb=millrose` lists the 5 Millrose builders). Tier pill removed from rows (N-17, N-21).
- Financing tab opens with "Next due" and jump links (Lots, Domain and competitors, Land banking, Debt, Capital events); redeemed notes are behind one click (N-14, N-15).
- One date style everywhere (15 Mar 2027, Mar 2027, 2027) and one money style ($1.25B, $350M); "($M)" dropped from column headings (N-16).
- Who banks whom: each cell is a confidence mark and the amount ("$6.6B Sep 2026"), full wording on hover; no table scrolls sideways at 1440 (N-18).
- Org map: corporate groups fold to one line each for large builders so regional heads sit right under the chief executive; the toolbar stays in view; switching views keeps your place; a one-card segment no longer spans the full width (N-19).
- People: "Covers" region chips (Southeast, Texas, Southwest, West, Midwest, Mid-Atlantic and Northeast) from the same state mapping as the maps (N-20).
- News: no "base score" label unless votes changed it; the bold line is held to two lines, full text one click down (N-23). Deals lead with the fact (N-24). Neutral loading placeholder (N-22).
- Emails tagged Inferred are shown as "Likely email (pattern, not published)" in grey, never under "Published contact" (orchestrator request 11:29).
- Verified by clicking on the preview: Millrose chip (5 builders), None named (75), Toll financing (first debt row is the 25 Nov 2026 credit line), Southeast regional heads (49), matrix cell, Deals; every view opened with no console errors and no sideways scroll.

## Swap 3 (11:37 ET): what is new since swap 2
- N-08 maturities are shown only as precisely as the record states them ("2027", "Jan 2028", "15 Mar 2027"); no invented days. N-10 the strip says "Notes and loans only" and names the mortgage credit line renewal when it comes sooner (Toll: 25 Nov 2026).
- N-09 builder page has a "Key people" panel straight under the strip: chief executive, CFO, head of land (or "not public at corporate level"), and every regional head with region, each clickable; long Finance lists in the org map fold so regional heads come sooner. The summary is one line under the title.
- N-11 search for a builder name lists that builder's chief executive, CFO, land and regional heads first. N-12 region subtitles only when they add something. N-13 "K. Hovnanian" with the legal name small beside it.
- Verified by clicking on the preview: Lennar, Toll, K. Hovnanian, D.R. Horton, Taylor Morrison, Colina, DSLD; search "Toll" and "k. hovnanian"; no console errors.

## Swap 2 (11:35 ET): what is new since swap 1
- D20: Sources page and the builder Sources tab are gone; source links stay on every fact and in the drawer.
- D18: News sorts "Most relevant" by default with "Newest" one click away (daily and weekly); builder and competitor news lists the same, with score badges; Home top stories are the most relevant of the last 30 days (headline plus one line); call sheet sorted by score.
- ux-qa list: N-01 icons are size-safe (and now come from the component set `icons.js`), N-02 a voted story stays on the page with "Undo" and a notice says how many similar stories moved across the cutoff, N-03 Home stories by relevance with headline and one line, N-04 call-sheet rows are two or three labelled facts and names are buttons, N-05 regional heads grouped by builder with "Covers" and known territories first, N-06 News opens at 70+, N-07 no icon-only links found on story cards.
- Checklist: C3 regions with no public head collapse to one line; C5 Financing calls out the next debt to come due and hides redeemed notes behind one click; C6 paragraphs cut to one sentence with "more".
- Verified on the preview by clicking: thumbs down on the top story (notice "7 similar stories dropped below 70", story stayed, Undo restored 25 at 70+ and emptied votes.json), Newest / Most relevant, Toll financing, DSLD (5 people), regional heads, every other view; no console errors, no horizontal scroll.
- D21 note: the interface is already complete in one module, so I am integrating directly rather than splitting it across per-view subagents; component modules are mounted as they land.

## What changed (swap 1)
- Home (new, the default page): one big search (builders, people, competitors), four stat tiles (builders mapped, people, regional heads, stories this week at 70+), top stories, top five of the call sheet, quick jumps (regional heads, land heads, finance heads, debt coming due, who banks whom).
- Builders: large rows (rank, name, tier, owner, closings, share of lots optioned with a bar, known land bankers, next debt due); Rank and Ownership as big chips; other filters under "More filters"; click a row for the preview (chief executive, CFO, heads of land, every regional head with region and tile map, "Open"); "Full table" keeps the old sortable table.
- Builder page: at-a-glance strip (closings, lots optioned, land bankers, next debt due, regional heads, footprint map), one-line summary with "more", internal notes box, tabs: Org map (default), Financing, News, Deals, Profile and gaps, Sources. Print still prints every tab.
- Org map: chief executive on top, corporate groups with Land (blue) and Finance (violet) distinct, a "Regional heads" tier with one card per region (name, what it covers, tile map, head, people in the region behind a count), heads whose territory is not public grouped in one block; toggles Everyone / Regional heads only / Land and finance only, Expand / Collapse all, and Diagram / List by role / Reporting lines. Click anyone for the drawer (title, covers with map, reports to, direct reports, contact, source with confidence and dates, internal notes). Escape closes.
- People: big search, role chips (Everyone, Land, Finance, Regional heads, Division, C-suite), cards or full table, CSV download of the current view. Regional heads view puts known territories first, each with its map.
- News: score badge first, the why-it-matters sentence as the headline, tags to builders and competitors, All / 70+ / 90+ buttons plus slider, daily / weekly, thumbs up / down with optional note, instant re-rank showing "base 75, your votes +15".
- Competitors (cards, then who finances whom), Deals, Insights (short tab names, takeaway in large type, method behind one click, essential columns with "Full table"), Coverage (tiles), Sources.
- D12: no long paragraphs (first sentence, "more" opens the rest); research notes moved behind "Full table"; when every row of a table has the same confidence it is stated once above the table; bracketed research caveats are trimmed from region labels (full text in the tooltip and drawer).
- D13: one inline-SVG icon set (single stroke, inherits text colour, no emoji, no network): nav, role groups, fact types, tabs, phone, email, source link, thumbs, and three confidence marks that differ in shape as well as colour.
- D14: US tile map (one shared component in `ui.js`): region cards, regional-head cards, drawer, builder preview and header. No map is drawn when no state can be derived.
- Keyboard: "/" focuses search, Escape closes the drawer and search results.

## Verified by clicking in the browser (1440 x 900; no horizontal scroll at 1280 x 800 or 1680 x 1050; no console errors)
- Searched "wheat" from Home with "/", opened Bill W. Wheat's drawer from the results, Escape closed it.
- Opened D.R. Horton (100 people, 13 region cards), Lennar (59), Hovnanian (28), Toll (60), Long Lake (4) and Colina (1 person): all render, no "undefined".
- Org map on Lennar: Regional heads only, Land and finance only, Collapse / Expand all, List by role (6 tables), Reporting lines (37 rows); every builder tab opened.
- Internal note typed on Lennar: saved to data/local/notes.json, then cleared. Vote: a 75 story went to 90 ("base 75, your votes +15") and moved up; note saved with the vote; both then removed (votes.json is back to empty).
- News cutoff: 70+ (25 stories), 90+ (1), All (493), slider at 55 (32); daily and weekly.
- People: Regional heads CSV downloaded (143 rows + header); full table (12 columns); search "florida" (19 people). Workbook link returns the .xlsx (2.2 MB).
- Every other view opened: Competitors, Millrose page, Deals, all seven insight tables, Coverage, Sources, search results.

## Decisions I made
- News opens at 70+ and weekly, and shows enough weeks to fill about ten stories (only about 1 to 3 stories a week reach 70; All and the slider reach the rest). The old 40+ button is gone: the brief asks for All / 70+ / 90+.
- Navigation in plain words: News (was Feed), Deals (was M&A). Coverage and Sources moved to the strip under the top bar, next to the confidence legend and the workbook download.
- Land uses the accent blue (the people Domain calls first); Finance uses violet. Confidence colours are used only for confidence.
- Org map wraps into a grid instead of one wide scrolling row with zoom: it stays readable on a shared screen for 90 people and for 4.
- Type scales with the window (17 px at 1280, about 18 px at 1440, up to 21 px on a large screen).
- Region labels: text in brackets and after a semicolon is hidden on cards (tooltip and drawer keep the full wording).

## Known gaps / next
- Work the ux-qa list (`status/ux-issues.md`).
- Hosted copy: votes and notes are written inside the container (unchanged behaviour).
