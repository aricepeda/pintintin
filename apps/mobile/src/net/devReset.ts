import { getSocket } from './socket';

interface Resp {
  ok: boolean;
}

export async function devReset(): Promise<Resp> {
  const socket = await getSocket();
  return new Promise<Resp>((resolve) => {
    socket.emit('game:devReset', {}, (r: Resp) => {
      resolve(r ?? { ok: false });
    });
  });
}
