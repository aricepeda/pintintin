import type { Pip, Tile, Seat } from "./types";

export const FULL_SET_SIZE = 28;

export function tilesPerHand(playerCount: 2 | 3 | 4): number {
  return playerCount === 4 ? 6 : 7;
}

export function activeSeats(playerCount: 2 | 3 | 4): readonly Seat[] {
  const seats: Seat[] = [];
  for (let i = 0; i < playerCount; i++) seats.push(i as Seat);
  return seats;
}

export function buildFullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: `${a}-${b}`, a: a as Pip, b: b as Pip });
    }
  }
  return tiles;
}

export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function dealHands(rng: Rng, playerCount: 2 | 3 | 4): Record<Seat, Tile[]> {
  const deck = shuffle(buildFullSet(), rng);
  const perHand = tilesPerHand(playerCount);
  const hands: Record<Seat, Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const seat of activeSeats(playerCount)) {
    hands[seat] = deck.splice(0, perHand);
  }
  return hands;
}

export function tilePips(tile: Tile): number {
  return tile.a + tile.b;
}

export function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}

/**
 * Returns the tile the opener is required to play on an empty board.
 * Highest double first; if no doubles, the tile with the highest single pip.
 */
export function findOpenerTile(hand: Tile[]): Tile {
  for (let pip = 6; pip >= 0; pip--) {
    const t = hand.find((h) => h.a === pip && h.b === pip);
    if (t) return t;
  }
  return hand.reduce((best, t) =>
    Math.max(t.a, t.b) > Math.max(best.a, best.b) ? t : best,
  );
}

/** Highest double held wins the open. 6-6 first, then 5-5, etc. */
export function findStarter(hands: Record<Seat, Tile[]>, playerCount: 2 | 3 | 4): Seat {
  const seats = activeSeats(playerCount);
  for (let pip = 6; pip >= 0; pip--) {
    for (const seat of seats) {
      if (hands[seat].some((t) => t.a === pip && t.b === pip)) return seat;
    }
  }
  // No doubles dealt — fallback to seat with highest-pip tile
  let bestSeat: Seat = seats[0]!;
  let bestPips = -1;
  for (const seat of seats) {
    for (const t of hands[seat]) {
      const p = tilePips(t);
      if (p > bestPips) {
        bestPips = p;
        bestSeat = seat;
      }
    }
  }
  return bestSeat;
}
