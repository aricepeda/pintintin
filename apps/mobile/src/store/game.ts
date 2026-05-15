import { create } from "zustand";
import type { PublicState, Seat, Tile } from "@pintintin/game-core";
import type { RoomWaitingPayload } from "@pintintin/protocol";

export interface RoundEndData {
  reason: "domino" | "blocked";
  winnerSeat: Seat | null;
  scores: Record<Seat, number>;
  pointsAwarded: number;
  hands: Record<number, Tile[]>;
  isMatchEnd: boolean;
}

export interface Announcement {
  type: "pass" | "blocked";
  seat?: Seat;
}

export interface OpenerDrawData {
  draws: Record<number, { a: number; b: number }>;
  winnerSeat: Seat;
  durationMs: number;
}

interface GameState {
  roomId: string | null;
  yourSeat: Seat | null;
  yourHand: Tile[];
  publicState: PublicState | null;
  turnDeadline: number | null;
  announcement: Announcement | null;
  roundEndData: RoundEndData | null;
  waiting: RoomWaitingPayload | null;
  matchCountdownDeadline: number | null;
  setMatchCountdownDeadline: (t: number | null) => void;
  pending: boolean;
  setPending: (p: boolean) => void;
  openerDraw: OpenerDrawData | null;
  setOpenerDraw: (d: OpenerDrawData | null) => void;
  setJoined: (p: { roomId: string; yourSeat: Seat; yourHand: Tile[]; publicState: PublicState }) => void;
  setWaiting: (p: RoomWaitingPayload | null) => void;
  setDealt: (p: { yourHand: Tile[]; publicState?: PublicState }) => void;
  setPublic: (p: PublicState) => void;
  setTurnDeadline: (t: number | null) => void;
  removeTile: (id: string) => void;
  setAnnouncement: (a: Announcement | null) => void;
  setRoundEndData: (d: RoundEndData | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomId: null,
  yourSeat: null,
  yourHand: [],
  publicState: null,
  turnDeadline: null,
  announcement: null,
  roundEndData: null,
  waiting: null,
  matchCountdownDeadline: null,
  setMatchCountdownDeadline: (t) => set({ matchCountdownDeadline: t }),
  pending: false,
  setPending: (p) => set({ pending: p }),
  openerDraw: null,
  setOpenerDraw: (d) => set({ openerDraw: d }),
  setJoined: (p) =>
    set({ roomId: p.roomId, yourSeat: p.yourSeat, yourHand: p.yourHand, publicState: p.publicState, waiting: null }),
  setWaiting: (p) =>
    set(p ? { waiting: p, roomId: p.roomId, yourSeat: p.yourSeat } : { waiting: null }),
  setDealt: (p) =>
    set((s) => ({ yourHand: p.yourHand, publicState: p.publicState ?? s.publicState, waiting: null, pending: false })),
  setPublic: (p) => set({ publicState: p }),
  setTurnDeadline: (t) => set({ turnDeadline: t }),
  removeTile: (id) => set((s) => ({ yourHand: s.yourHand.filter((t) => t.id !== id) })),
  setAnnouncement: (a) => set({ announcement: a }),
  setRoundEndData: (d) => set({ roundEndData: d }),
  reset: () => set({
    roomId: null, yourSeat: null, yourHand: [], publicState: null,
    turnDeadline: null, announcement: null, roundEndData: null, waiting: null,
    matchCountdownDeadline: null, pending: false, openerDraw: null,
  }),
}));
