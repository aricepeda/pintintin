import type { Server, Socket } from "socket.io";
import { ClientEvents, type LobbyListResponse } from "@pintintin/protocol";
import { RoomRegistry } from "../rooms/RoomRegistry.js";
import { TOURNAMENT_TEMPLATES } from "../lobby/catalog.js";
import { logger } from "../logger.js";

export function attachSocketHandlers(io: Server, registry: RoomRegistry) {
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ userId, sid: socket.id }, "socket connected");

    const existing = registry.roomForUser(userId);
    if (existing) {
      socket.join(`room:${existing.id}`);
      existing.markReconnected(userId);
    }
    registry.broadcastLobby();

    socket.on("lobby:leave", (_raw, ack?: (r: { ok: boolean }) => void) => {
      const room = registry.roomForUser(userId);
      if (room) socket.leave(`room:${room.id}`);
      registry.removeRoomForUser(userId);
      ack?.({ ok: true });
    });

    socket.on("lobby:list", (_raw, ack?: (r: LobbyListResponse) => void) => {
      ack?.({ cash: registry.getCashSnapshot(), tournaments: TOURNAMENT_TEMPLATES });
    });

    socket.on("lobby:join", (raw, ack?: (r: unknown) => void) => {
      const parsed = ClientEvents["lobby:join"].safeParse(raw);
      if (!parsed.success) return ack?.({ ok: false, error: "bad payload" });
      const displayName = parsed.data.displayName ?? `Jugador ${userId.slice(0, 6)}`;

      const targetRoom = registry.roomForTable(parsed.data.tableId);
      if (targetRoom) socket.join(`room:${targetRoom.id}`);

      const res = registry.joinTable(parsed.data.tableId, userId, displayName);
      if (!res.ok || !res.room) {
        if (targetRoom) socket.leave(`room:${targetRoom.id}`);
        return ack?.({ ok: false, error: res.reason ?? "join failed" });
      }
      const room = res.room;
      if (res.seat === undefined) {
        // Mid-match join — keep in socket room so they receive game:dealt next round.
        ack?.({ ok: true, pending: true, roomId: room.id });
        socket.emit("room:pending", { roomId: room.id, tableName: room.tableName });
        return;
      }
      socket.emit("room:waiting", registry.buildWaitingPayload(room, res.seat));
      if (room.countdownDeadline) {
        socket.emit("match:countdown", { deadline: room.countdownDeadline });
      }
      ack?.({ ok: true, roomId: room.id });

      registry.broadcastWaiting(room);
      registry.broadcastLobby();
    });

    socket.on("lobby:sit", (raw, ack?: (r: unknown) => void) => {
      const parsed = ClientEvents["lobby:sit"].safeParse(raw);
      if (!parsed.success) return ack?.({ ok: false, error: "bad payload" });
      const displayName = `Jugador ${userId.slice(0, 6)}`;
      const res = registry.claimSeat(userId, parsed.data.seat, displayName);
      if (!res.ok || !res.room) {
        return ack?.({ ok: false, error: res.reason ?? "sit failed" });
      }
      socket.emit("room:waiting", registry.buildWaitingPayload(res.room, parsed.data.seat));
      ack?.({ ok: true, seat: parsed.data.seat });
      registry.broadcastWaiting(res.room);
      registry.broadcastLobby();
    });

    socket.on("game:playTile", (raw, ack?: (r: unknown) => void) => {
      const parsed = ClientEvents["game:playTile"].safeParse(raw);
      if (!parsed.success) return ack?.({ ok: false, error: "bad payload" });
      const room = registry.roomForUser(userId);
      if (!room) return ack?.({ ok: false, error: "no room" });
      try {
        room.handleHumanAction(userId, {
          type: "PLAY",
          tileId: parsed.data.tileId,
          end: parsed.data.end,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on("game:pass", (_raw, ack?: (r: unknown) => void) => {
      const room = registry.roomForUser(userId);
      if (!room) return ack?.({ ok: false, error: "no room" });
      try {
        room.handleHumanAction(userId, { type: "PASS" });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on("game:nextRound", (_raw, ack?: (r: unknown) => void) => {
      const room = registry.roomForUser(userId);
      if (!room) return ack?.({ ok: false });
      room.requestNextRound();
      ack?.({ ok: true });
    });

    // Dev-only: force a fresh hand mid-match. Used by the temporary reset button.
    socket.on("game:devReset", (_raw, ack?: (r: unknown) => void) => {
      const room = registry.roomForUser(userId);
      if (!room) return ack?.({ ok: false });
      room.devForceReset();
      ack?.({ ok: true });
    });

    socket.on("disconnect", (reason) => {
      logger.info({ userId, reason }, "socket disconnected");
      const room = registry.roomForUser(userId);
      if (room) {
        if (room.observers.has(userId)) {
          registry.leaveTable(userId);
          registry.broadcastWaiting(room);
        } else if (room.phase === "waiting") {
          registry.leaveTable(userId);
          registry.broadcastWaiting(room);
        } else {
          room.markDisconnected(userId);
        }
      }
      registry.broadcastLobby();
    });
  });
}
