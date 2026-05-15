import type { End } from '@pintintin/game-core';
import { getSocket } from './socket';

interface Resp {
  ok: boolean;
  error?: string;
}

export async function playTile(tileId: string, end: End): Promise<Resp> {
  const socket = await getSocket();
  return new Promise<Resp>((resolve) => {
    socket.emit('game:playTile', { tileId, end }, (r: Resp) => {
      resolve(r ?? { ok: false, error: 'no-ack' });
    });
  });
}

export async function passTurn(): Promise<Resp> {
  const socket = await getSocket();
  return new Promise<Resp>((resolve) => {
    socket.emit('game:pass', {}, (r: Resp) => {
      resolve(r ?? { ok: false, error: 'no-ack' });
    });
  });
}
