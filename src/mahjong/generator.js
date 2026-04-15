import { tileId, SUITS, NUMBERS, sortTiles, shuffle, countTiles } from './tiles.js';

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
