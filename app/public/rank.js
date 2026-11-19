// Feed re-ranking from local votes. Shared by the browser and the server (tuning export).
// Transparent on purpose: adjusted = base + direct vote (+/-15) + learned weights (capped +/-15).
export const DIRECT = 15;
export const LEARN_CAP = 15;
// points per net vote on other stories sharing the feature, and the cap per feature
export const FEATURES = {
  category: { step: 3, cap: 6, label: 'category' },
  builder: { step: 3, cap: 6, label: 'builder' },
  competitor: { step: 3, cap: 6, label: 'competitor' },
  publisher: { step: 2, cap: 4, label: 'publisher' },
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function featuresOf(a) {
  const out = [];
  if (a.category) out.push(['category', a.category]);
  for (const b of a.builder_ids || []) out.push(['builder', b]);
  for (const c of a.competitors || []) out.push(['competitor', c]);
  if (a.publisher) out.push(['publisher', a.publisher]);
  return out;
}

// net votes per feature across every voted story
export function netVotes(articles, votes) {
  const net = {};
  for (const a of articles) {
    const v = votes[a.id]?.vote || 0;
    if (!v) continue;
    for (const [kind, val] of featuresOf(a)) { const k = kind + '|' + val; net[k] = (net[k] || 0) + v; }
  }
  return net;
}

// learned weight table, for display and for the tuning export
export function learnedWeights(articles, votes) {
  const net = netVotes(articles, votes);
  return Object.entries(net).filter(([, n]) => n !== 0).map(([k, n]) => {
    const [kind, ...rest] = k.split('|');
    const f = FEATURES[kind];
    return { kind, value: rest.join('|'), net_votes: n, weight: clamp(n * f.step, -f.cap, f.cap) };
  }).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

export function adjust(a, votes, net) {
  const own = votes[a.id]?.vote || 0;
  const base = Number(a.score) || 0;
  const direct = own * DIRECT;
  const parts = [];
  let learned = 0;
  for (const [kind, val] of featuresOf(a)) {
    const f = FEATURES[kind];
    const n = (net[kind + '|' + val] || 0) - own; // a story's own vote is the direct part, not a learned one
    if (!n) continue;
    const w = clamp(n * f.step, -f.cap, f.cap);
    learned += w;
    parts.push({ kind, value: val, weight: w });
  }
  const learnedCapped = clamp(learned, -LEARN_CAP, LEARN_CAP);
  const adjusted = clamp(Math.round(base + direct + learnedCapped), 0, 100);
  return { base, direct, learned: learnedCapped, learned_uncapped: learned, parts, adjusted, delta: adjusted - base, vote: own };
}

export function rankFeed(articles, votes) {
  const net = netVotes(articles, votes);
  return articles.map((a) => ({ ...a, adj: adjust(a, votes, net) }));
}
