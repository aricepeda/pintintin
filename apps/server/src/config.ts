import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  allowDevBypassAuth: process.env.ALLOW_DEV_BYPASS_AUTH === "true",
  turnTimerMs: 20_000,
  disconnectGraceMs: 30_000,
  targetScore: 100,
};
