import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const rawDb = process.env.DATABASE_URL ?? "data/screenshare.db";
const databaseUrl = path.isAbsolute(rawDb)
  ? rawDb
  : path.resolve(serverRoot, rawDb.replace(/^(\.\/)?server\//, ""));

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  databaseUrl,
  jwtSecret: required("JWT_SECRET", "dev-only-change-me-in-production-use-a-long-random-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  stunUrl: process.env.STUN_URL ?? "stun:stun.l.google.com:19302",
  stunUrlSecondary: process.env.STUN_URL_SECONDARY ?? "stun:stun1.l.google.com:19302",
  turnUrl: process.env.TURN_URL ?? "",
  turnUsername: process.env.TURN_USERNAME ?? "",
  turnPassword: process.env.TURN_PASSWORD ?? "",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  roomTtlMs: Number(process.env.ROOM_TTL_MS ?? 2 * 60 * 60 * 1000),
  maxJoinAttempts: Number(process.env.MAX_JOIN_ATTEMPTS ?? 8),
  maxParticipants: Number(process.env.MAX_PARTICIPANTS ?? 12),
};

export const isProd = env.nodeEnv === "production";
