import crypto from "crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";

export type RoomStatus = "waiting" | "live" | "ended" | "expired";

export type RoomRow = {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  status: RoomStatus;
  sharing: number;
  created_at: number;
  expires_at: number;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function logEvent(roomId: string, eventType: string, actorId?: string, actorName?: string, meta?: unknown): void {
  db.prepare(
    "INSERT INTO room_events (room_id, event_type, actor_id, actor_name, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(roomId, eventType, actorId ?? null, actorName ?? null, meta ? JSON.stringify(meta) : null, Date.now());
}

export function createRoom(hostId: string, hostName: string): RoomRow {
  let code = generateRoomCode();
  for (let i = 0; i < 8; i++) {
    const clash = db.prepare("SELECT id FROM rooms WHERE code = ?").get(code);
    if (!clash) break;
    code = generateRoomCode();
  }
  const now = Date.now();
  const room: RoomRow = {
    id: crypto.randomUUID(),
    code,
    host_id: hostId,
    host_name: hostName,
    status: "waiting",
    sharing: 0,
    created_at: now,
    expires_at: now + env.roomTtlMs,
  };
  db.prepare(
    `INSERT INTO rooms (id, code, host_id, host_name, status, sharing, created_at, expires_at)
     VALUES (@id, @code, @host_id, @host_name, @status, @sharing, @created_at, @expires_at)`
  ).run(room);
  logEvent(room.id, "room_created", hostId, hostName);
  return room;
}

export function getRoomByCode(code: string): RoomRow | undefined {
  return db.prepare("SELECT * FROM rooms WHERE code = ?").get(normalizeCode(code)) as RoomRow | undefined;
}

export function getRoomById(id: string): RoomRow | undefined {
  return db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isExpired(room: RoomRow): boolean {
  return Date.now() > room.expires_at || room.status === "expired";
}

export function markExpired(roomId: string): void {
  db.prepare("UPDATE rooms SET status = 'expired' WHERE id = ? AND status != 'ended'").run(roomId);
  logEvent(roomId, "room_expired");
}

export function endRoom(roomId: string, actorId?: string, actorName?: string): void {
  db.prepare("UPDATE rooms SET status = 'ended', sharing = 0 WHERE id = ?").run(roomId);
  logEvent(roomId, "room_ended", actorId, actorName);
}

export function setSharing(roomId: string, sharing: boolean): void {
  db.prepare("UPDATE rooms SET sharing = ?, status = CASE WHEN ? = 1 AND status = 'waiting' THEN 'live' ELSE status END WHERE id = ?").run(
    sharing ? 1 : 0,
    sharing ? 1 : 0,
    roomId
  );
  logEvent(roomId, sharing ? "screen_started" : "screen_stopped");
}

export function expireStaleRooms(): void {
  const now = Date.now();
  const stale = db.prepare("SELECT id FROM rooms WHERE expires_at < ? AND status NOT IN ('ended', 'expired')").all(now) as { id: string }[];
  for (const row of stale) {
    markExpired(row.id);
  }
}

export function toPublicRoom(room: RoomRow, extra?: Record<string, unknown>) {
  return {
    id: room.id,
    code: room.code,
    hostName: room.host_name,
    hostId: room.host_id,
    status: isExpired(room) ? "expired" : room.status,
    sharing: Boolean(room.sharing),
    createdAt: room.created_at,
    expiresAt: room.expires_at,
    ...extra,
  };
}
