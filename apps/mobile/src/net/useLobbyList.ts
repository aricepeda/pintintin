import { useEffect, useState } from "react";
import { getSocket } from "./socket";
import type {
  CashTableTemplate,
  LobbyListResponse,
  TournamentTemplate,
} from "@pintintin/protocol";

export function useLobbyList() {
  const [cash, setCash] = useState<CashTableTemplate[]>([]);
  const [tournaments, setTournaments] = useState<TournamentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;

        const onUpdate = (payload: { cash: CashTableTemplate[] }) => {
          if (payload?.cash) setCash(payload.cash);
        };
        socket.on("lobby:update", onUpdate);
        cleanup = () => socket.off("lobby:update", onUpdate);

        socket.emit("lobby:list", {}, (resp: LobbyListResponse) => {
          if (cancelled) return;
          setCash(resp?.cash ?? []);
          setTournaments(resp?.tournaments ?? []);
          setLoading(false);
        });
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return { cash, tournaments, loading, error };
}
