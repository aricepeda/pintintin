import { router } from "expo-router";
import { getSocket } from "./socket";
import { useGameStore } from "../store/game";
import type { RoomWaitingPayload } from "@pintintin/protocol";

export async function joinLobby(opts: { tableId: string; displayName?: string }) {
  console.log("[joinLobby] start", opts);
  const socket = await getSocket();

  socket.off("room:joined");
  socket.off("room:waiting");
  socket.off("game:dealt");
  socket.off("game:moveApplied");
  socket.off("game:passed");
  socket.off("game:roundEnded");
  socket.off("game:matchEnded");
  socket.off("game:turnTimer");
  socket.off("room:resync");
  socket.off("match:countdown");
  socket.off("match:countdownCanceled");
  socket.off("room:pending");
  socket.off("game:openerDraw");

  socket.on("room:joined", (payload: any) => useGameStore.getState().setJoined(payload));
  socket.on("room:waiting", (payload: RoomWaitingPayload) =>
    useGameStore.getState().setWaiting(payload)
  );
  socket.on("game:dealt", (payload: any) => {
    useGameStore.getState().setOpenerDraw(null);
    useGameStore.getState().setDealt(payload);
  });
  socket.on("game:openerDraw", (payload: any) => {
    useGameStore.getState().setOpenerDraw(payload);
    setTimeout(() => useGameStore.getState().setOpenerDraw(null), (payload.durationMs ?? 3500) + 500);
  });
  socket.on("game:moveApplied", (payload: any) => {
    const store = useGameStore.getState();
    store.setPublic(payload.publicState);
    if (payload.seat === store.yourSeat && payload.tile?.id) {
      store.removeTile(payload.tile.id);
    }
  });
  socket.on("game:passed", (payload: any) => {
    const store = useGameStore.getState();
    if (payload.publicState) store.setPublic(payload.publicState);
    store.setAnnouncement({ type: "pass", seat: payload.seat });
    setTimeout(() => store.setAnnouncement(null), 1000);
  });
  socket.on("game:roundEnded", (payload: any) => {
    const store = useGameStore.getState();
    store.setTurnDeadline(null);
    const showEnd = () =>
      store.setRoundEndData({
        reason: payload.reason,
        winnerSeat: payload.winnerSeat ?? null,
        scores: payload.scores,
        pointsAwarded: payload.pointsAwarded,
        hands: payload.hands ?? {},
        isMatchEnd: false,
      });
    if (payload.reason === "blocked") {
      store.setAnnouncement({ type: "blocked" });
      setTimeout(() => {
        store.setAnnouncement(null);
        showEnd();
      }, 2000);
    } else {
      showEnd();
    }
  });
  socket.on("game:matchEnded", (_payload: any) => {
    const store = useGameStore.getState();
    const prev = store.roundEndData;
    if (prev) store.setRoundEndData({ ...prev, isMatchEnd: true });
  });
  socket.on("game:turnTimer", (payload: any) =>
    useGameStore.getState().setTurnDeadline(payload.deadline)
  );
  socket.on("room:resync", (payload: any) => {
    const store = useGameStore.getState();
    store.setDealt(payload);
  });
  socket.on("match:countdown", (payload: { deadline: number }) => {
    console.log("[match:countdown]", payload);
    useGameStore.getState().setMatchCountdownDeadline(payload.deadline);
  });
  socket.on("match:countdownCanceled", () => {
    console.log("[match:countdownCanceled]");
    useGameStore.getState().setMatchCountdownDeadline(null);
  });
  socket.on("room:pending", (_payload: any) => {
    console.log("[room:pending]");
    useGameStore.getState().setPending(true);
  });

  socket.emit("lobby:join", opts, (resp: { ok: boolean; error?: string; pending?: boolean }) => {
    console.log("[joinLobby] ack", resp);
    if (resp.ok) {
      if (resp.pending) useGameStore.getState().setPending(true);
      router.push("/game-preview");
    } else {
      console.warn("[joinLobby] failed:", resp.error);
    }
  });
}
