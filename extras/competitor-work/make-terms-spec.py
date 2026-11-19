#!/usr/bin/env python3
"""Writes extras/competitor-work/millrose-terms-table.json (the curated rows behind data/extras/millrose-pricing-and-terms.json).
Each cell is a short restatement of facts already in data/competitors/millrose-properties.json; sources are pulled from the
research fragments by fact index so URLs are never retyped. Re-run after editing, then run scripts/competitor-extras.mjs."""
import json, os
W = os.path.dirname(os.path.abspath(__file__))
F = {k: json.load(open(os.path.join(W, 'frag', v + '.json')))['facts'] for k, v in
     {'spin': 'mr-spin-terms', 'y26': 'mr-2026-latest', 'cap': 'mr-capital', 'y25': 'mr-2025-periodics'}.items()}
RANK = {'Verified': 3, 'Reported': 2, 'Inferred': 1}
def row(item, lennar, others, as_of, a, b=None, read='', conf=None):
    fa = F[a[0]][a[1]]; fb = F[b[0]][b[1]] if b else None
    c = conf or min([fa['confidence']] + ([fb['confidence']] if fb else []), key=lambda x: RANK[x])
    return {'item': item, 'lennar': lennar, 'others': others, 'as_of': as_of, 'read': read, 'confidence': c,
            'source_url': fa['source_url'], 'source_url_2': fb['source_url'] if fb else ''}
rows = [
 row('Yield today', '8.5% on $5,874M invested (63.5% of the book)', '10.8% on $3,371M (36.5%), including the 12% Dream Finders preferred. Blended 9.3% on $9,245M', '2026-09-30', ('y26', 4),
     read='The 230bp gap between Lennar and everyone else is the price of the founder relationship.'),
 row('Yield trend', 'Flat at 8.5% every quarter since the spin', '11.7% (Mar 2025) > 11.4% > 11.3% > 11.0% (Dec 2025) > 10.7% (Mar 2026) > 10.6% (Jun) > 10.8% (Sep); management guides to about 11% in Q4 2026', '2026-09-30', ('y25', 27), ('y26', 23),
     read='The premium over Lennar narrowed from about 320bp to about 230bp in 18 months as the book grew. Management blames lower SOFR and a tilt to stronger builders, not spread cuts. Compiled by us from the quarterly releases.'),
 row('How independent is "Other Agreements"', 'Lennar Master Program: $484.8M of 2025 option fees (85%)', 'Lennar-related ventures paid about $16.7M more, and about $303M of 12% paid-in-kind development loans in the bucket were Lennar related-party balances (Sep 2025). Builders independent of Lennar paid $69.4M, 12% of 2025 option fees', '2025-12-31', ('y25', 48), ('y25', 56),
     read='The headline "36% outside Lennar" overstates the independent book; through 2025 roughly nine-tenths of fee income was Lennar or Lennar-related.'),
 row('How the rate is set', 'Seed assets: fixed 8.5%. New Lennar deals: 3-year BBB bond index + 4.00% +/- a rating adjustment, floor 7%, cap 10%, then fixed for the project\'s life', 'Mostly floating with a floor. Deck (Feb 2025): SOFR + 600 to 900bp. Calls (2026): floors average about 10% and sit 50 to 200bp under the current rate', '2026-05-06', ('spin', 13), ('y26', 65),
     read='Floors near 10% mean non-Lennar yields cannot fall far even if SOFR does.'),
 row('Target pricing by builder type (Millrose deck, Feb 2025)', '8.5% fixed, 5% initial deposit', '"Strategic" builders: 9 to 12% with about a 10% deposit. "Third-party" builders: 10 to 13% with a 10 to 20% deposit. Deals of $10M to $100M, 6 to 60 months', '2025-02-24', ('spin', 16),
     read='Management estimates at launch. First $250M outside Lennar closed above 11% (March 2025).'),
 row('Deposit', '5% of projected land and development cost up front, plus up to 5% more that Millrose can call or that falls due on walk-away', 'About 10% today, versus roughly 20 to 25% historically for land banking (CEO, Q2 2026 call)', '2026-08-04', ('spin', 22), ('y26', 68),
     read='Millrose trades deposit for pooling. Book-wide, builder deposits were $1,003M against $9,902M of homesites under option, about 10%.'),
 row('Takedown price', 'Land cost plus the pre-set development budget. No premium or escalator: the option fee is the whole return', 'Not disclosed', '2025-03-31', ('spin', 23)),
 row('Walk-away cost and cross-termination', 'Forfeit the 5%, owe the rest of the additional 5%, finish horizontal work in the pool, and Millrose may cancel the options on every other property in that pool. Lennar\'s money at risk is capped at $50M per seed pool and $25M per new pool; 30 pools averaging 29 properties', '95 to 96% of all invested capital is in cross-termination pools (2026 calls). The prospectus warns pooling "is not guaranteed" for other customers', '2026-02-26', ('spin', 28), ('y26', 64),
     read='The cap means abandoning a whole Lennar seed pool of roughly $500M of takedown value costs at most $50M (our arithmetic: cap / 10%).'),
 row('Missed payment or no takedown', 'Not a default: the option simply ends. Millrose keeps the option money and can claim direct damages but cannot force a purchase', 'Not disclosed', '2025-02-07', ('spin', 25)),
 row('Builder flexibility', 'Up to four quarterly takedown extensions with no stated fee; up to two six-month pauses per property at half rate (trigger: 10% local home-price fall, or Lennar\'s discretion under the Founder\'s Rights Agreement); can accelerate up to 50% of a pool', 'Not disclosed', '2025-02-07', ('spin', 31), ('spin', 32),
     read='A pause halves Millrose\'s income on that property for up to a year (two with consent).'),
 row('Most-favoured rate', 'If Millrose gives any other builder a lower rate, Lennar can take that rate on its new deals for the next 180 days', 'n/a', '2025-02-07', ('spin', 20),
     read='Every cheap deal Millrose writes for a third party can reprice Lennar\'s forward flow. This puts a soft floor under its third-party pricing.'),
 row('Development funding and overruns', 'Millrose funds horizontal work up to a fixed contract sum; Lennar builds it, bears every dollar of overrun, and backs it with an unlimited parent guaranty', 'Individually negotiated through separate subsidiaries; "may resemble traditional land banking". No Lennar-style parent guaranty disclosed', '2025-03-31', ('spin', 39), ('spin', 65)),
 row('Remaining life', '3.8 years', '2.4 years (total book 3.3 years)', '2026-09-30', ('y26', 5)),
 row('Lennar\'s call on Millrose capital', 'From 2026-03-01 Lennar can reserve capital each quarter: its recycled capital plus 25% of new non-revolver debt and equity raised beyond the first $2B. While capital is reserved Millrose must buy any Lennar deal that meets the criteria', 'What Lennar does not reserve is available to others', '2025-02-07', ('spin', 41),
     read='Third-party builders are second in line for Millrose capital by contract.'),
 row('Concentration limits', 'No more than 40% of committed capital in one state. No debt beyond 1:1 debt-to-equity without Lennar\'s consent', 'No per-builder limit disclosed. Lennar is 63.5% of invested capital (about 58% pro forma for Dream Finders)', '2026-09-30', ('spin', 38), ('y26', 9)),
 row('Builder M&A financed', 'Rausch Coleman for Lennar (Feb 2025): $900M of land, 25,000 homesites', 'Landsea for New Home Co (May 2025): $700M, 4,186 homesites. Beazer for Dream Finders (Oct 2026): $580M of land on about 7,000 homesites plus a $488M preferred', '2026-10-27', ('y26', 18),
     read='Three of the largest builder deals of 2025 to 2026 used Millrose as the land buyer.'),
 row('Dream Finders package (Oct 2026)', 'n/a', 'Land bank: $580M net of deposits, about 2.5-year life, $8.0M commitment fee. Preferred: 12% cumulative, perpetual, callable by Dream Finders from year 3, convertible by Millrose from year 6, $5.25M commitment fee', '2026-10-20', ('y26', 17), ('y26', 50),
     read='First time Millrose paired a land bank with corporate capital. Commitment fees are about 1.4% of the land and about 1.05% of the $500M preferred (our arithmetic).'),
 row('Performance since inception', 'No terminations, forfeitures, delinquencies or defaults reported', 'Same. Management says no customer has asked to renegotiate (Q3 2026 call)', '2026-09-30', ('y26', 52), ('y26', 69)),
 row('Cost of debt against yield', 'Spread of about 230bp on Lennar capital (8.5% yield less about 6.2% blended debt cost); only 175 to 200bp against the new 6.50 to 6.75% bonds', 'About 460bp (10.8% less about 6.2%). The 12% Dream Finders preferred, funded with 6.50 to 6.75% bonds, carries about 525 to 550bp gross', '2026-09-30', ('cap', 43), ('cap', 31),
     read='Our estimate: Millrose does not state a weighted cost of debt. Inputs are its four bond coupons and SOFR + 1.75 to 2.25% bank debt, shown in the profile.', conf='Inferred'),
 row('Leverage and covenants', 'n/a', 'Debt-to-capitalization 36% at 2026-09-30, above the 33% maximum it stated through Q1 2026 (no target stated since). Bank covenant: net debt / capital up to 0.45x (0.50x after a large acquisition), interest cover 1.5x, tangible net worth $4.39B. No single-builder concentration cap found in the bank or bond documents', '2026-09-30', ('cap', 18), ('cap', 20),
     read='With no equity below book and 100% AFFO payout, new non-Lennar growth has to come from takedown recycling or covenant headroom.'),
 row('Manager cost', 'Kennedy Lewis is paid 1.25% a year of tangible assets ($30.3M in Q3 2026), no incentive fee; removal costs 1.5x to 3.0x the annual fee', 'Same fee on all assets', '2026-09-30', ('spin', 47), ('y26', 20),
     read='After the fee, Millrose keeps about 7.25% on Lennar capital and about 9.5% on other capital before financing costs (our arithmetic: yield minus 1.25%).'),
]
spec = {
 'title': 'Millrose pricing and terms: Lennar versus everyone else',
 'subtitle': 'What Millrose charges, what it holds as protection and what it lets the builder do, from its SEC filings and earnings calls. Lennar pays 8.5%; other builders pay about 10.8% with floors near 10% and deposits near 10%.',
 'is_estimate': False,
 'method': 'Every cell restates a fact row in the Millrose profile (data/competitors/millrose-properties.json); open that profile for the full wording and dates. Lennar terms come from the filed Master Program, Master Option and Founder\'s Rights agreements; terms for other builders are only disclosed in aggregate, through investor decks and earnings calls, so those cells are thinner and several are tagged Reported (free transcript copies of the calls). The Confidence column is the weaker tag of the two sources on the row. The "How to read it" column is ours: any arithmetic there is labelled and uses only numbers in the same row. Millrose does not publish rates, deposits or pool terms by named builder.',
 'columns': [
  {'key': 'item', 'label': 'Term', 'type': 'text'}, {'key': 'lennar', 'label': 'Lennar Master Program', 'type': 'text'}, {'key': 'others', 'label': 'Other builders', 'type': 'text'},
  {'key': 'as_of', 'label': 'As of', 'type': 'date'}, {'key': 'read', 'label': 'How to read it (ours)', 'type': 'text'}, {'key': 'confidence', 'label': 'Confidence', 'type': 'confidence'},
  {'key': 'source_url', 'label': 'Source', 'type': 'url'}, {'key': 'source_url_2', 'label': 'Second source', 'type': 'url'} ],
 'rows': rows }
json.dump(spec, open(os.path.join(W, 'millrose-terms-table.json'), 'w'), indent=2)
print(len(rows), 'rows written')
