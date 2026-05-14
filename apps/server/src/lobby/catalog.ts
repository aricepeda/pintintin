import type { CashTableTemplate, TournamentTemplate } from "@pintintin/protocol";

export const CASH_TEMPLATES: Omit<CashTableTemplate, "players" | "status">[] = [
  { id: "habana",   name: "Mesa Habana",   smallBlind: 1,   bigBlind: 2,   playerCount: 4 },
  { id: "dorado",   name: "Salón Dorado",  smallBlind: 5,   bigBlind: 10,  playerCount: 4 },
  { id: "caribe",   name: "Caribe Club",   smallBlind: 10,  bigBlind: 25,  playerCount: 4 },
  { id: "tropical", name: "VIP Tropical",  smallBlind: 25,  bigBlind: 50,  playerCount: 4 },
  { id: "royale",   name: "Domino Royale", smallBlind: 50,  bigBlind: 100, playerCount: 4 },
  { id: "ron",      name: "Noche de Ron",  smallBlind: 100, bigBlind: 200, playerCount: 4 },
];

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export const TOURNAMENT_TEMPLATES: TournamentTemplate[] = [
  { id: "rapidito",  name: "Rapidito",          buyIn: 5,   prizePool: 200,   playersRegistered: 18, maxPlayers: 32,  startsAt: inMinutes(8),   status: "registering" },
  { id: "sunday",    name: "Sunday Major",      buyIn: 50,  prizePool: 5000,  playersRegistered: 76, maxPlayers: 128, startsAt: inMinutes(45),  status: "registering" },
  { id: "freeroll",  name: "Freeroll Caribeño", buyIn: 0,   prizePool: 100,   playersRegistered: 64, maxPlayers: 64,  startsAt: inMinutes(2),   status: "starting" },
  { id: "highroller",name: "High Roller",       buyIn: 500, prizePool: 25000, playersRegistered: 12, maxPlayers: 24,  startsAt: inMinutes(120), status: "registering" },
];

