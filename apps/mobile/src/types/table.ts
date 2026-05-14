export type SeatPosition = 'north' | 'south' | 'east' | 'west';

export interface Player {
  id: string;
  name: string;
  rating: number;
  money: number;
  avatarUri?: string;
  isBot?: boolean;
}

export interface SeatState {
  position: SeatPosition;
  player: Player | null;
  handCount: number;
  hasPassedLastTurn: boolean;
}

export type TurnPhase = 'waiting' | 'dealing' | 'playing' | 'roundEnd' | 'gameEnd';

export interface TableState {
  tableId: string;
  phase: TurnPhase;
  seats: Record<SeatPosition, SeatState>;
  activeSeat: SeatPosition | null;
  currentUserSeat: SeatPosition | null;
  pot: number;
  buyIn: number;
  roundNumber: number;
}

export interface ActiveTurn {
  seat: SeatPosition;
  startedAt: number;
  deadlineMs: number;
}
