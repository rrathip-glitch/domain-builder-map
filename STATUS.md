# STATUS (final, 12:50 pm ET, 2026-11-19; hard stop at 1:00 pm)

Everything below was verified by a command or a click in this run unless marked otherwise.

| Deliverable | Where | State |
|---|---|---|
| Live portal | https://portal-production-f9184d2a.up.railway.app (PIN gate) | final build deployed 12:48; data generated 12:46 |
| Local app | `npm start` then http://localhost:4173 | same build |
| Workbook | `exports/Domain-Builder-Map.xlsx` (23 sheets) | final; workbook check 0 problems |
| Roadmap slide | `exports/Domain-Roadmap-Slide.pptx` (+ .pdf, .png) | final |
| Handout: how AI was used | `exports/How-I-Used-AI.pdf` (+ .docx, .md); review notes in `extras/handout/REVIEW-NOTES.md` | final |
| Feed spec and runbook | `feed/SPEC.md`, `feed/RUNBOOK.md`, skill `refresh-feed` | final |
| Data | `data/dist/domain.json`, `data/dist/coverage.json`, `data/builders/` | final |

Final figures: 100 builders; 2,105 people (342 land, 234 finance); 140 regional heads at 38 builders; 191 of 398 listed regions with a named leader; 3,664 facts, 73.5% Verified (people rows 70.1%); 41.6 people per public builder, 15.1 per private; 22 builders with a publicly named land banker; 336 debt instruments; 545 stories scored (25 at 70+, 1 at 90+). Accuracy check (computed from `status/verification.log`): 1,299 rows re-opened, 1,199 held, 51 corrected, 39 downgraded, 10 removed. Usability: 57 items filed on the new design, 57 verified fixed.

Open at the stop
- Newsletter sending is switched off (no sender chosen); the panel saves and previews.
- Not tested: a real printer, a real newsletter email, a slow connection, phones and tablets.
- About 300 gap notes in the raw data are still written in the researcher's voice (the portal hides the wording; the workbook shows it).
- Sessions started by the orchestrator are idle and can be archived.

Per-session final notes: `status/*.md`. Coordination history: `BOARD.md` (directives D1 to D23).
