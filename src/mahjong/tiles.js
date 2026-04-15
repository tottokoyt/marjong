// Tile representation: "1m", "2p", "3s" etc.
// suits: m=man, p=pin, s=sou

export const SUITS = ['m', 'p', 's'];
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function tileId(num, suit) {
  return `${num}${suit}`;
}

export function parseTile(tile) {
  return { num: parseInt(tile[0]), suit: tile[1] };
}

// Full deck: 4 copies of each tile (27 types × 4 = 108 tiles)
export function fullDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      for (let i = 0; i < 4; i++) {
        deck.push(tileId(num, suit));
      }
    }
  }
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Count occurrences of each tile in a hand
export function countTiles(tiles) {
  const counts = {};
  for (const t of tiles) {
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

// Sort tiles: by suit order (m, p, s) then by number
export function sortTiles(tiles) {
  const suitOrder = { m: 0, p: 1, s: 2 };
  return [...tiles].sort((a, b) => {
    const pa = parseTile(a), pb = parseTile(b);
    if (suitOrder[pa.suit] !== suitOrder[pb.suit]) {
      return suitOrder[pa.suit] - suitOrder[pb.suit];
    }
    return pa.num - pb.num;
  });
}

export const TILE_COLORS = {
  m: 'text-red-400',
  p: 'text-blue-400',
  s: 'text-green-400',
};

export const TILE_LABELS = {
  m: '萬',
  p: '筒',
  s: '索',
};
