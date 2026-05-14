import { getSocket } from "./socket";

export async function sitAtSeat(seat: 0 | 1 | 2 | 3): Promise<{ ok: boolean; error?: string }> {
  const socket = await getSocket();
  return new Promise((resolve) => {
    socket.emit("lobby:sit", { seat }, (resp: { ok: boolean; error?: string }) => {
      resolve(resp);
    });
  });
}
