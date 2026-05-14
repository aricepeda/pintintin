import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { socketAuthMiddleware } from "./auth/socketAuth.js";
import { attachSocketHandlers } from "./sockets/index.js";
import { RoomRegistry } from "./rooms/RoomRegistry.js";
import { CASH_TEMPLATES } from "./lobby/catalog.js";

async function main() {
  const app = express();
  app.get("/health", (_req, res) => res.json({ ok: true }));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const pub = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  pub.on("error", () => {});
  try {
    await pub.connect();
    const sub = pub.duplicate();
    sub.on("error", () => {});
    await sub.connect();
    io.adapter(createAdapter(pub, sub));
    logger.info("redis adapter attached");
  } catch (err) {
    logger.warn(
      { msg: (err as Error).message },
      "redis unavailable — running single-instance in-memory only",
    );
    pub.disconnect();
  }

  io.use(socketAuthMiddleware);
  const registry = new RoomRegistry(io);
  registry.initCashTables(CASH_TEMPLATES);
  attachSocketHandlers(io, registry);

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, "pintintin server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
