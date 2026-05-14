import { io, type Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase } from "../auth/supabase";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const DEV_USER_KEY = "pintintin.devUserId";

let socket: Socket | null = null;
let devUserId: string | null = null;

async function loadOrCreateDevUserId(): Promise<string> {
  if (devUserId) return devUserId;
  try {
    const stored = await AsyncStorage.getItem(DEV_USER_KEY);
    if (stored) {
      devUserId = stored;
      return stored;
    }
  } catch {}
  const created = `dev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  devUserId = created;
  try { await AsyncStorage.setItem(DEV_USER_KEY, created); } catch {}
  return created;
}

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const supa = getSupabase();
  let token: string | undefined;
  if (supa) {
    const { data } = await supa.auth.getSession();
    token = data.session?.access_token;
  }
  const id = token ? undefined : await loadOrCreateDevUserId();
  socket = io(SERVER_URL, {
    auth: { token, devUserId: id },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
  return socket;
}

// Useful for testing: clears the persisted dev user so the next reload looks
// like a brand-new player to the server.
export async function resetDevUserId() {
  devUserId = null;
  try { await AsyncStorage.removeItem(DEV_USER_KEY); } catch {}
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
