import type { Server } from "socket.io";
import { Room, type SeatOccupant } from "./Room.js";
import { randomUUID } from "node:crypto";
import { activeSeats, type Seat } from "@pintintin/game-core";
import type { CashTableTemplate, SeatSummary } from "@pintintin/protocol";

export type CashTemplateDef = Omit<CashTableTemplate, "players" | "status">;

export class RoomRegistry {
  private rooms = new Map<string, Room>();
  private userRoom = new Map<string, string>();
  private tableToRoom = new Map<string, string>(); // tableId -> roomId
  private cashTemplates: CashTemplateDef[] = [];

  constructor(private io: Server) {}

  initCashTables(templates: CashTemplateDef[]) {
    this.cashTemplates = templates;
    for (const t of templates) {
      this.createCashRoom(t);
    }
  }

  private createCashRoom(t: CashTemplateDef): Room {
    const id = randomUUID();
    const seats: Record<Seat, SeatOccupant> = {
      0: { kind: "empty" },
      1: { kind: "empty" },
      2: { kind: "empty" },
      3: { kind: "empty" },
    };
    const room = new Room(
      id,
      t.bigBlind,
      t.playerCount,
      seats,
      {
        toAll: (event, payload) => this.io.to(`room:${id}`).emit(event, payload),
        toUser: (uid, event, payload) => {
          const sid = this.findSocketIdForUser(uid);
          if (sid) this.io.to(sid).emit(event, payload);
        },
        onMatchEnded: (roomId) => this.handleMatchEnded(roomId),
        onMatchStarted: () => this.broadcastLobby(),
      },
      t.id,
      t.name,
    );
    this.rooms.set(id, room);
    this.tableToRoom.set(t.id, id);
    return room;
  }

  roomById(id: string) {
    return this.rooms.get(id);
  }

  roomForUser(userId: string) {
    const id = this.userRoom.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  roomForTable(tableId: string): Room | undefined {
    const id = this.tableToRoom.get(tableId);
    return id ? this.rooms.get(id) : undefined;
  }

  joinTable(
    tableId: string,
    userId: string,
    displayName: string,
  ): { ok: boolean; room?: Room; seat?: Seat; reason?: string } {
    const room = this.roomForTable(tableId);
    if (!room) return { ok: false, reason: "no-table" };
    const existingRoom = this.roomForUser(userId);
    if (existingRoom && existingRoom.id !== room.id) {
      return { ok: false, reason: "already-in-other-room" };
    }
    const res = room.addHuman(userId, displayName);
    if (!res.ok) return { ok: false, reason: res.reason };
    this.userRoom.set(userId, room.id);
    return { ok: true, room, seat: res.seat };
  }

  joinAsObserver(
    tableId: string,
    userId: string,
    displayName: string,
  ): { ok: boolean; room?: Room; reason?: string } {
    const room = this.roomForTable(tableId);
    if (!room) return { ok: false, reason: "no-table" };
    const existingRoom = this.roomForUser(userId);
    if (existingRoom && existingRoom.id !== room.id) {
      return { ok: false, reason: "already-in-other-room" };
    }
    room.addObserver(userId, displayName);
    this.userRoom.set(userId, room.id);
    return { ok: true, room };
  }

  claimSeat(
    userId: string,
    seat: Seat,
    displayNameFallback?: string,
  ): { ok: boolean; room?: Room; reason?: string } {
    const room = this.roomForUser(userId);
    if (!room) return { ok: false, reason: "not-in-room" };
    const res = room.claimSeat(userId, seat, displayNameFallback);
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, room };
  }

  leaveTable(userId: string): Room | undefined {
    const room = this.roomForUser(userId);
    if (!room) return undefined;
    room.removeHuman(userId);
    room.removeObserver(userId);
    this.userRoom.delete(userId);
    return room;
  }

  removeRoomForUser(userId: string): boolean {
    const room = this.leaveTable(userId);
    if (!room) return false;
    this.broadcastWaiting(room);
    this.broadcastLobby();
    return true;
  }

  getCashSnapshot(): CashTableTemplate[] {
    return this.cashTemplates.map((t) => {
      const room = this.roomForTable(t.id);
      const players = room ? room.connectedHumanCount() : 0;
      let status: CashTableTemplate["status"] = "open";
      if (room) {
        if (room.phase === "playing") status = "playing";
        else if (room.isFull()) status = "full";
        else status = "open";
      }
      return { ...t, players, status };
    });
  }

  private handleMatchEnded(roomId: string) {
    const room = this.rooms.get(roomId);
    for (const [uid, rid] of this.userRoom) {
      if (rid === roomId) this.userRoom.delete(uid);
    }
    if (room) {
      // Re-attach users still seated after resetToWaiting (promoted pendingHumans).
      for (const s of activeSeats(room.playerCount)) {
        const occ = room.seats[s];
        if (occ.kind === "human") this.userRoom.set(occ.userId, roomId);
      }
      // Re-attach observers — they remain in the room ready to claim seats for next match.
      for (const [uid] of room.observers) {
        this.userRoom.set(uid, roomId);
      }
      this.broadcastWaiting(room);
    }
    this.broadcastLobby();
  }

  broadcastLobby() {
    this.io.emit("lobby:update", { cash: this.getCashSnapshot() });
  }

  buildWaitingPayload(room: Room, yourSeat: Seat | null) {
    const seats: SeatSummary[] = activeSeats(room.playerCount).map((s) => {
      const occ = room.seats[s];
      if (occ.kind === "human") {
        return { seat: s, occupied: true, displayName: occ.displayName, connected: occ.connected };
      }
      return { seat: s, occupied: false };
    });
    return {
      roomId: room.id,
      tableId: room.tableId,
      tableName: room.tableName,
      stake: room.stake,
      playerCount: room.playerCount,
      yourSeat,
      seats,
    };
  }

  broadcastWaiting(room: Room) {
    for (const s of activeSeats(room.playerCount)) {
      const occ = room.seats[s];
      if (occ.kind === "human") {
        const sid = this.findSocketIdForUser(occ.userId);
        if (sid) this.io.to(sid).emit("room:waiting", this.buildWaitingPayload(room, s));
      }
    }
    // Observers also receive the snapshot, with yourSeat=null.
    for (const [uid] of room.observers) {
      const sid = this.findSocketIdForUser(uid);
      if (sid) this.io.to(sid).emit("room:waiting", this.buildWaitingPayload(room, null));
    }
  }

  private findSocketIdForUser(userId: string): string | undefined {
    for (const [sid, sock] of this.io.sockets.sockets) {
      if (sock.data?.userId === userId) return sid;
    }
    return undefined;
  }
}
