# ux-qa status (updated 12:52 ET, machine clock)

## FINAL
- State: DONE and stopped. The FINAL section is at the top of `status/ux-issues.md`. Last check at 12:52: `app/public/` unchanged since swap 25 (12:41:07); after the final data build (12:46) a 15-route sweep at 1440 x 900 is clean.
- Build tested: the designer's final swap 25 on http://localhost:4173 (app.js and style.css 12:41:07), plus the newsletter through the gate at http://localhost:4175. The ten-task pass ran on swap 24 (12:33 to 12:38); swap 25's three fixes were re-tested and the route sweep repeated (28 routes at 1440, 14 at 1280, all clean). Laptop sizes only (D16).
- Counts: 57 app issues filed over 16 rounds, all 57 verified fixed (High 12, Medium 29, Polish 16). Component findings: 7 filed, 5 verified, 1 never seen in the app (M-02), 1 Polish open (M-07).
- Done test from the brief ("every Blocker and High issue is Verified fixed on the swapped-in build"): met at 1440 x 900. Sweeps found no sideways scroll at 1280, 1440 or 1680 and no broken text; not every High fix was individually re-clicked at all three sizes.

## What remains and why
- Small leftovers, not worth a swap: one raw date in D.R. Horton's summary; one harmless 404 console line per page load on 4173 for the newsletter options; M-07 (small maps hard to read at about 60 px).
- Not tested, so not claimed: a real printer (the one-page brief was measured by applying the print rules on screen); a real email (sending is off); a slow connection (the server now sends an ETag, but a first visit still downloads the whole 2 MB file); phone, tablet and 1920 (dropped by D16); the hosted copy.
- Data problems for the orchestrator: at the bottom of the issue file, three most important first.

## Decisions I made
- Per D17 the round 1 findings (old app) became a re-test checklist, not issues. Per D16 only laptop sizes were tested.
- Every round started with a hard reload, after one issue (N-14) was filed from a tab still running an older swap.
- N-50 was re-scoped from High to Medium when the orchestrator confirmed the 2015 K. Hovnanian link is real and should stay as a dated historic link.
- The print brief (N-52) was verified by emulating the print stylesheet at letter width; I did not open the print dialog.
- Test data: every test vote, note and newsletter subscription I created was removed; `data/local/votes.json`, `notes.json` and `subscriptions.json` hold none of my entries.
