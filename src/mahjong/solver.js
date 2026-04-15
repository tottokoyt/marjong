import { tileId, parseTile, SUITS, NUMBERS, countTiles } from './tiles.js';

// ---------------------------------------------------------------
// Winning hand check (agari): 4 mentsu + 1 jantou (14 tiles)
// ---------------------------------------------------------------
export function isAgari(tiles) {
  const counts = countTiles(tiles);
  return _tryAgari(counts, 4, false);
}

function _tryAgari(counts, mentsuLeft, hasJantou) {
  const tile = _firstTile(counts);
  if (tile === null) return mentsuLeft === 0 && hasJantou;

  const { num, suit } = parseTile(tile);

  if (!hasJantou && counts[tile] >= 2) {
    counts[tile] -= 2;
    if (_tryAgari(counts, mentsuLeft, true)) { counts[tile] += 2; return true; }
    counts[tile] += 2;
  }
  if (mentsuLeft === 0) return false;

  if (counts[tile] >= 3) {
    counts[tile] -= 3;
    if (_tryAgari(counts, mentsuLeft - 1, hasJantou)) { counts[tile] += 3; return true; }
    counts[tile] += 3;
  }

  const t2 = tileId(num + 1, suit), t3 = tileId(num + 2, suit);
  if (num <= 7 && (counts[t2] || 0) >= 1 && (counts[t3] || 0) >= 1) {
    counts[tile]--; counts[t2]--; counts[t3]--;
    if (_tryAgari(counts, mentsuLeft - 1, hasJantou)) {
      counts[tile]++; counts[t2]++; counts[t3]++;
      return true;
    }
    counts[tile]++; counts[t2]++; counts[t3]++;
  }
  return false;
}

// ---------------------------------------------------------------
// Shanten number for a 13-tile hand (4 mentsu + 1 jantou form).
//    0 → tenpai
//    1 → iishanten (一向聴)
//    2 → ryanshanten (両シャンテン)
//
// Fast suit-by-suit DP: enumerate (mentsu, taatsu, jantou) configs
// for each suit independently, then combine across suits.
// ---------------------------------------------------------------
export function shantenNum(tiles13) {
  // Build per-suit count arrays (1-indexed: index 1..9)
  const sc = {};
  for (const suit of SUITS) {
    sc[suit] = new Array(11).fill(0);
  }
  for (const t of tiles13) {
    const suit = t[t.length - 1];
    const num = parseInt(t[0]);
    sc[suit][num]++;
  }

  // Enumerate all unique (m, t, j) block configs for one suit.
  // Processes tile indices 1..9 in order.
  // "Skip" at current idx means: advance to idx+1 (all remaining copies isolated).
  function enumSuit(c, idx, m, t, j, out) {
    if (idx > 9) { out.add(m * 100 + t * 10 + j); return; }
    if (c[idx] === 0) { enumSuit(c, idx + 1, m, t, j, out); return; }

    // Try jantou (pair head)
    if (!j && c[idx] >= 2) {
      c[idx] -= 2; enumSuit(c, idx, m, t, 1, out); c[idx] += 2;
    }
    // Try koutsu (triplet)
    if (c[idx] >= 3) {
      c[idx] -= 3; enumSuit(c, idx, m + 1, t, j, out); c[idx] += 3;
    }
    // Try shuntsu (sequence: idx, idx+1, idx+2)
    if (idx <= 7 && c[idx + 1] >= 1 && c[idx + 2] >= 1) {
      c[idx]--; c[idx + 1]--; c[idx + 2]--;
      enumSuit(c, idx, m + 1, t, j, out);
      c[idx]++; c[idx + 1]++; c[idx + 2]++;
    }
    // Try toitsu taatsu (pair as partial block)
    if (c[idx] >= 2) {
      c[idx] -= 2; enumSuit(c, idx, m, t + 1, j, out); c[idx] += 2;
    }
    // Try kanchan taatsu (idx, idx+2)
    if (idx <= 7 && c[idx + 2] >= 1) {
      c[idx]--; c[idx + 2]--;
      enumSuit(c, idx, m, t + 1, j, out);
      c[idx]++; c[idx + 2]++;
    }
    // Try sequential taatsu (idx, idx+1)
    if (idx <= 8 && c[idx + 1] >= 1) {
      c[idx]--; c[idx + 1]--;
      enumSuit(c, idx, m, t + 1, j, out);
      c[idx]++; c[idx + 1]++;
    }
    // Skip: all remaining copies of idx are isolated → advance
    enumSuit(c, idx + 1, m, t, j, out);
  }

  const suitSets = SUITS.map(suit => {
    const out = new Set();
    enumSuit([...sc[suit]], 1, 0, 0, 0, out);
    return [...out].map(v => [Math.floor(v / 100), Math.floor((v % 100) / 10), v % 10]);
  });

  let best = 8;
  for (const [m0, t0, j0] of suitSets[0]) {
    for (const [m1, t1, j1] of suitSets[1]) {
      if (j0 + j1 > 1) continue;
      for (const [m2, t2, j2] of suitSets[2]) {
        const j = j0 + j1 + j2;
        if (j > 1) continue;
        const m = m0 + m1 + m2;
        if (m > 4) continue;
        const t = t0 + t1 + t2;
        const s = 8 - 2 * m - Math.min(t, 4 - m) - j;
        if (s < best) best = s;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------
// Minimum shanten achievable by discarding 1 tile from a 14-tile hand
// ---------------------------------------------------------------
function minShantenAfterDiscard(hand14) {
  let min = 8;
  const seen = new Set();
  for (const t of hand14) {
    if (seen.has(t)) continue;
    seen.add(t);
    const s = shantenNum(_removeOne(hand14, t));
    if (s < min) min = s;
  }
  return min;
}

// ---------------------------------------------------------------
// Acceptance count for a 14-tile hand.
//
// For each possible discard (unique tiles):
//   after13 = hand14 - discard
//   S = shantenNum(after13)          ← shanten after this discard
//   acceptingTiles = tiles t where minShantenAfterDiscard(after13 + t) < S
//   count = Σ remaining copies of each accepting tile
//
// Special case S=0 (tenpai): shortcut via isAgari for speed.
// Returns: [{ tile, count, acceptingTiles, shanten }] sorted desc by count
// ---------------------------------------------------------------
export function calcAcceptance(hand14) {
  const results = [];
  const seen = new Set();

  for (const discard of hand14) {
    if (seen.has(discard)) continue;
    seen.add(discard);

    const after13 = _removeOne(hand14, discard);
    const S = shantenNum(after13);
    const after13Counts = countTiles(after13);

    const acceptingTiles = [];
    for (const suit of SUITS) {
      for (const num of NUMBERS) {
        const t = tileId(num, suit);
        let improves;
        if (S === 0) {
          // Tenpai → check agari directly (fast path)
          improves = isAgari([...after13, t]);
        } else {
          // Iishanten/ryanshanten → check if any sub-discard reduces shanten
          improves = minShantenAfterDiscard([...after13, t]) < S;
        }
        if (improves) acceptingTiles.push(t);
      }
    }

    let count = 0;
    for (const t of acceptingTiles) {
      count += Math.max(0, 4 - (after13Counts[t] || 0));
    }

    results.push({ tile: discard, count, acceptingTiles, shanten: S });
  }

  results.sort((a, b) => {
    // Sort by shanten first (lower is better), then by count
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    return b.count - a.count;
  });
  return results;
}

// ---------------------------------------------------------------
// Best discards: lowest shanten, then highest acceptance count
// ---------------------------------------------------------------
export function bestDiscards(acceptanceResults) {
  if (acceptanceResults.length === 0) return [];
  const best = acceptanceResults[0];
  return acceptanceResults.filter(
    r => r.shanten === best.shanten && r.count === best.count
  );
}

function _firstTile(counts) {
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      const t = tileId(num, suit);
      if (counts[t] && counts[t] > 0) return t;
    }
  }
  return null;
}

function _removeOne(arr, target) {
  const idx = arr.indexOf(target);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}
