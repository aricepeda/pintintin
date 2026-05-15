import { z } from "zod";

export const SeatSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const EndSchema = z.union([z.literal("left"), z.literal("right")]);

// Client -> Server
export const LobbyJoin = z.object({
  tableId: z.string().min(1),
  displayName: z.string().min(1).max(40).optional(),
});
export const LobbySit = z.object({
  seat: SeatSchema,
});
export const GamePlayTile = z.object({
  tileId: z.string().regex(/^[0-6]-[0-6]$/),
  end: EndSchema,
});
export const GamePass = z.object({});
export const GameAck = z.object({ stateVersion: z.number().int().nonnegative() });

export type LobbyJoinMsg = z.infer<typeof LobbyJoin>;
export type GamePlayTileMsg = z.infer<typeof GamePlayTile>;
export type GameAckMsg = z.infer<typeof GameAck>;

// Server -> Client payload shapes are typed via game-core types directly.

export const ClientEvents = {
  "lobby:join": LobbyJoin,
  "lobby:leave": z.object({}),
  "lobby:list": z.object({}),
  "lobby:sit": LobbySit,
  "game:playTile": GamePlayTile,
  "game:pass": GamePass,
  "game:ack": GameAck,
} as const;

export type CashTableTemplate = {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  playerCount: 2 | 3 | 4;
  players: number;
  status: "open" | "playing" | "full";
};

export type SeatSummary = {
  seat: 0 | 1 | 2 | 3;
  occupied: boolean;
  displayName?: string;
  connected?: boolean;
};

export type RoomWaitingPayload = {
  roomId: string;
  tableId: string;
  tableName: string;
  stake: number;
  playerCount: 2 | 3 | 4;
  yourSeat: 0 | 1 | 2 | 3 | null;  // null = observer (joined but not seated)
  seats: SeatSummary[];
};

export type TournamentTemplate = {
  id: string;
  name: string;
  buyIn: number;
  prizePool: number;
  playersRegistered: number;
  maxPlayers: number;
  startsAt: string; // ISO date
  status: "registering" | "starting" | "running" | "ended";
};

export type LobbyListResponse = {
  cash: CashTableTemplate[];
  tournaments: TournamentTemplate[];
};

export type ClientEventName = keyof typeof ClientEvents;

export const ServerEventNames = [
  "room:joined",
  "room:waiting",
  "room:resync",
  "room:playerDisconnected",
  "room:playerReconnected",
  "game:openerDraw",
  "game:dealt",
  "game:moveApplied",
  "game:passed",
  "game:roundEnded",
  "game:matchEnded",
  "game:turnTimer",
  "error",
] as const;

export type ServerEventName = (typeof ServerEventNames)[number];
