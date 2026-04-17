import { tileId, SUITS, NUMBERS, sortTiles, shuffle, countTiles } from './tiles.js';
import { calcAcceptance } from './solver.js';

function parseTileLocal(tile) {
  return { num: parseInt(tile[0]), suit: tile[1] };
}

// ---------------------------------------------------------------
// Build a random complete agari hand (14 tiles), shuntsu-biased
// ---------------------------------------------------------------
function buildWinningHand(deckCounts) {
  const allTiles = [];
  for (const suit of SUITS)
    for (const num of NUMBERS)
      allTiles.push(tileId(num, suit));

  const counts = { ...deckCounts };
  const jCandidates = shuffle([...allTiles]);

  for (const j of jCandidates) {
    if ((counts[j] || 0) < 2) continue;
    counts[j] -= 2;
    const hand = [j, j];
    if (buildMentsu(counts, hand, 4, allTiles)) return hand;
    counts[j] += 2;
  }
  return null;
}

// Shuntsu-first biased mentsu builder
function buildMentsu(counts, hand, remaining, allTiles) {
  if (remaining === 0) return true;
  const candidates = shuffle([...allTiles]);

  // Shuntsu pass first
  for (const t of candidates) {
    const { num, suit } = parseTileLocal(t);
    if (num > 7) continue;
    const t2 = tileId(num + 1, suit), t3 = tileId(num + 2, suit);
    if ((counts[t] || 0) >= 1 && (counts[t2] || 0) >= 1 && (counts[t3] || 0) >= 1) {
      counts[t]--; counts[t2]--; counts[t3]--;
      hand.push(t, t2, t3);
      if (buildMentsu(counts, hand, remaining - 1, allTiles)) return true;
      hand.splice(-3);
      counts[t]++; counts[t2]++; counts[t3]++;
    }
  }
  // Koutsu fallback
  for (const t of candidates) {
    if ((counts[t] || 0) >= 3) {
      counts[t] -= 3;
      hand.push(t, t, t);
      if (buildMentsu(counts, hand, remaining - 1, allTiles)) return true;
      hand.splice(-3);
      counts[t] += 3;
    }
  }
  return false;
}

function freshDeckCounts() {
  const c = {};
  for (const suit of SUITS)
    for (const num of NUMBERS)
      c[tileId(num, suit)] = 4;
  return c;
}

// ---------------------------------------------------------------
// Generate a 14-tile training hand.
//
// Method: build 14-tile agari, then "swap" N tiles with random
// tiles from the remaining deck to raise the shanten level.
//   swapCount 1 → tend toward tenpai / light iishanten
//   swapCount 2 → tend toward iishanten / ryanshanten
//   swapCount 3 → tend toward ryanshanten / sanshanten
//
// Distribution: 1×40%, 2×40%, 3×20%
// ---------------------------------------------------------------
export function generateTrainingHand() {
  const deckCounts = freshDeckCounts();

  let agari14 = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    agari14 = buildWinningHand({ ...deckCounts });
    if (agari14) break;
  }
  if (!agari14) {
    agari14 = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','1s','1s'];
  }

  // Choose disruption level (tenpai 30% / iishanten 40% / ryanshanten+ 30%)
  const roll = Math.random();
  const swapCount = roll < 0.30 ? 1 : roll < 0.70 ? 2 : 3;

  const hand = [...agari14];

  // Track remaining deck (after dealing the agari14 hand)
  const handCounts = countTiles(hand);
  const remaining = { ...deckCounts };
  for (const [t, c] of Object.entries(handCounts)) remaining[t] -= c;

  for (let i = 0; i < swapCount; i++) {
    if (hand.length === 0) break;

    // Remove a random tile from the hand
    const removeIdx = Math.floor(Math.random() * hand.length);
    const removed = hand.splice(removeIdx, 1)[0];
    remaining[removed] = (remaining[removed] || 0) + 1;

    // Add a random tile from the remaining deck
    const pool = [];
    for (const [t, c] of Object.entries(remaining))
      for (let j = 0; j < c; j++) pool.push(t);

    if (pool.length === 0) {
      // Nothing left — put it back
      hand.push(removed);
      remaining[removed]--;
      break;
    }

    const drawn = pool[Math.floor(Math.random() * pool.length)];
    hand.push(drawn);
    remaining[drawn]--;
  }

  return { hand14: sortTiles(hand) };
}

// ---------------------------------------------------------------
// Perform exactly N tile-swaps on a fresh agari hand and return it.
// ---------------------------------------------------------------
function _swapHand(swapCount) {
  const deckCounts = freshDeckCounts();
  let agari14 = null;
  for (let a = 0; a < 100; a++) {
    agari14 = buildWinningHand({ ...deckCounts });
    if (agari14) break;
  }
  if (!agari14) return null;

  const hand = [...agari14];
  const handCounts = countTiles(hand);
  const remaining = { ...deckCounts };
  for (const [t, c] of Object.entries(handCounts)) remaining[t] -= c;

  for (let i = 0; i < swapCount; i++) {
    if (hand.length === 0) break;
    const removeIdx = Math.floor(Math.random() * hand.length);
    const removed = hand.splice(removeIdx, 1)[0];
    remaining[removed] = (remaining[removed] || 0) + 1;

    const pool = [];
    for (const [t, c] of Object.entries(remaining))
      for (let j = 0; j < c; j++) pool.push(t);
    if (pool.length === 0) { hand.push(removed); remaining[removed]--; break; }

    const drawn = pool[Math.floor(Math.random() * pool.length)];
    hand.push(drawn);
    remaining[drawn]--;
  }
  return sortTiles(hand);
}

// ---------------------------------------------------------------
// Type A: Complex tenpai problem
// Requires 2+ discards that reach tenpai, where the 2nd-best
// acceptance count is >= 4 (not a trivial isolated-tile cut).
// ---------------------------------------------------------------
function _tenpaiComplexityScore(tenpaiDiscards) {
  if (tenpaiDiscards.length < 2) return 0; // reject single-path hands
  const best = tenpaiDiscards[0].count;
  const second = tenpaiDiscards[1].count;
  if (second < 4) return 0; // reject if 2nd path is nearly trivial
  const ratio = second / best; // 0-1, higher = more competitive
  return best + Math.round(ratio * 20) + tenpaiDiscards.length * 3;
}

export function generateTenpaiProblem() {
  let bestHand = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 80; attempt++) {
    // Use swapCount=0 (raw agari) 20% of the time for richer overlap
    const swapCount = Math.random() < 0.2 ? 0 : 1;
    const hand14 = _swapHand(swapCount);
    if (!hand14) continue;

    const results = calcAcceptance(hand14);
    const tenpaiDiscards = results.filter(r => r.shanten === 0);
    if (tenpaiDiscards.length < 2) continue; // quick pre-filter

    const score = _tenpaiComplexityScore(tenpaiDiscards);
    if (score > bestScore) {
      bestScore = score;
      bestHand = hand14;
      if (score >= 18) break;
    }
  }

  return {
    hand14: bestHand ?? sortTiles(['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','1s','1s']),
    type: 'tenpai',
  };
}

// ---------------------------------------------------------------
// Type B: Acceptance expansion problem
// Generates a 14-tile hand at 1/2/3-shanten (randomly chosen),
// where the task is to find the discard that maximizes acceptance.
// ---------------------------------------------------------------
export function generateAcceptanceProblem() {
  // Pick target shanten after best discard: 1, 2, or 3
  const targetShanten = Math.floor(Math.random() * 3) + 1;
  // swapCount 2→iishanten, 3→ryanshanten, 4→sanshanten (approximate)
  const swapCount = targetShanten + 1;

  for (let attempt = 0; attempt < 50; attempt++) {
    const hand14 = _swapHand(swapCount);
    if (!hand14) continue;

    const results = calcAcceptance(hand14);
    if (results.length === 0) continue;
    const actualShanten = results[0].shanten;

    if (actualShanten >= 1 && actualShanten <= 3) {
      return { hand14, type: 'acceptance', shanten: actualShanten };
    }
  }

  // Fallback: use basic generator
  const { hand14 } = generateTrainingHand();
  const results = calcAcceptance(hand14);
  const s = results[0]?.shanten ?? 1;
  return { hand14, type: 'acceptance', shanten: Math.max(1, Math.min(3, s)) };
}

// ---------------------------------------------------------------
// Main problem generator: 50/50 mix of Type A and Type B
// ---------------------------------------------------------------
export function generateProblem() {
  return Math.random() < 0.5 ? generateTenpaiProblem() : generateAcceptanceProblem();
}
