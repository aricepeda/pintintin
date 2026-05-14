export type Pip = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Tile {
  id: string;
  a: Pip;
  b: Pip;
}

export type Seat = 0 | 1 | 2 | 3;
export const SEATS: readonly Seat[] = [0, 1, 2, 3] as const;

export type End = "left" | "right";

export interface BoardTile {
  tile: Tile;
  playedBy: Seat;
  end: End | "start";
  /** If true, render tile as b|a so the connecting pip faces the board */
  flipped: boolean;
}

export interface PublicState {
  board: BoardTile[];
  leftEnd: Pip | null;
  rightEnd: Pip | null;
  handCounts: Record<Seat, number>;
  currentSeat: Seat;
  scores: Record<Seat, number>;
  roundNo: number;
  passesInARow: number;
  stateVersion: number;
  phase: "waiting" | "playing" | "roundEnded" | "matchEnded";
  lastEvent?: GameEvent;
  matchWinner?: Seat;
  activeSeats: readonly Seat[];
}

export interface PrivateView {
  yourSeat: Seat;
  yourHand: Tile[];
  publicState: PublicState;
}

export interface FullState extends PublicState {
  hands: Record<Seat, Tile[]>;
  starterSeat: Seat;
  targetScore: number;
  playerCount: 2 | 3 | 4;
}

export type Action =
  | { type: "PLAY"; seat: Seat; tileId: string; end: End }
  | { type: "PASS"; seat: Seat };

export type GameEvent =
  | { type: "DEALT"; starterSeat: Seat; roundNo: number }
  | { type: "PLAYED"; seat: Seat; tile: Tile; end: End | "start" }
  | { type: "PASSED"; seat: Seat }
  | {
      type: "ROUND_ENDED";
      winnerSeat: Seat | null;
      reason: "domino" | "blocked";
      scores: Record<Seat, number>;
      pointsAwarded: number;
    }
  | { type: "MATCH_ENDED"; winnerSeat: Seat };

export class GameError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
