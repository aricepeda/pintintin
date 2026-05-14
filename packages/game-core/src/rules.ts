import type { End, FullState, Pip, Seat, Tile } from "./types";
import { activeSeats, tilePips } from "./tiles";

export function canPlayTile(
  tile: Tile,
  leftEnd: Pip | null,
  rightEnd: Pip | null,
  end: End,
): boolean {
  if (leftEnd === null && rightEnd === null) return true;
  const target = end === "left" ? leftEnd : rightEnd;
  return tile.a === target || tile.b === target;
}

export function tileHasPlayableEnd(
  tile: Tile,
  leftEnd: Pip | null,
  rightEnd: Pip | null,
): boolean {
  if (leftEnd === null && rightEnd === null) return true;
  return (
    tile.a === leftEnd ||
    tile.b === leftEnd ||
    tile.a === rightEnd ||
    tile.b === rightEnd
  );
}

export function handHasAnyLegalMove(
  hand: Tile[],
  leftEnd: Pip | null,
  rightEnd: Pip | null,
): boolean {
  return hand.some((t) => tileHasPlayableEnd(t, leftEnd, rightEnd));
}

export function nextSeat(seat: Seat, playerCount: 2 | 3 | 4): Seat {
  // Counter-clockwise rotation (Dominican domino convention).
  return ((seat - 1 + playerCount) % playerCount) as Seat;
}

export function handPipTotal(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + tilePips(t), 0);
}

export function isBlocked(state: FullState): boolean {
  return activeSeats(state.playerCount).every(
    (seat) => !handHasAnyLegalMove(state.hands[seat], state.leftEnd, state.rightEnd),
  );
}

export interface RoundResult {
  winnerSeat: Seat | null;
  reason: "domino" | "blocked";
  pointsAwarded: number;
}

export function resolveRound(state: FullState): RoundResult | null {
  const seats = activeSeats(state.playerCount);
  for (const seat of seats) {
    if (state.hands[seat].length === 0) {
      const points = seats
        .filter((s) => s !== seat)
        .reduce((sum, s) => sum + handPipTotal(state.hands[s]), 0);
      return { winnerSeat: seat, reason: "domino", pointsAwarded: points };
    }
  }
  if (isBlocked(state)) {
    let minTotal = Infinity;
    let winner: Seat | null = null;
    let tie = false;
    for (const seat of seats) {
      const t = handPipTotal(state.hands[seat]);
      if (t < minTotal) {
        minTotal = t;
        winner = seat;
        tie = false;
      } else if (t === minTotal) {
        tie = true;
      }
    }
    const points = tie
      ? 0
      : seats
          .filter((s) => s !== winner)
          .reduce((sum, s) => sum + handPipTotal(state.hands[s]), 0);
    return { winnerSeat: tie ? null : winner, reason: "blocked", pointsAwarded: points };
  }
  return null;
}
