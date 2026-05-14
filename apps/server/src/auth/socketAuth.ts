import type { Socket } from "socket.io";
import { jwtVerify } from "jose";
import { config } from "../config.js";
import { logger } from "../logger.js";

export interface AuthedSocket extends Socket {
  data: Socket["data"] & { userId: string };
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      if (config.allowDevBypassAuth) {
        const devUser = (socket.handshake.auth?.devUserId as string) ?? `dev-${socket.id}`;
        socket.data.userId = devUser;
        return next();
      }
      return next(new Error("missing token"));
    }

    if (!config.supabaseJwtSecret) {
      if (config.allowDevBypassAuth) {
        socket.data.userId = `dev-${socket.id}`;
        return next();
      }
      return next(new Error("server jwt secret not configured"));
    }

    const secret = new TextEncoder().encode(config.supabaseJwtSecret);
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return next(new Error("token has no subject"));
    socket.data.userId = payload.sub;
    return next();
  } catch (err) {
    logger.warn({ err }, "socket auth failed");
    return next(new Error("auth failed"));
  }
}
