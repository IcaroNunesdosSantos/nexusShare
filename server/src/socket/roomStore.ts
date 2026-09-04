import { env } from "../config/env.js";

export type ParticipantRole = "host" | "viewer";

export type Participant = {
  socketId: string;
  userId: string;
  name: string;
  role: ParticipantRole;
  joinedAt: number;
};

export type RoomRuntime = {
  roomId: string;
  code: string;
  hostUserId: string;
  hostSocketId: string | null;
  sharing: boolean;
  participants: Map<string, Participant>;
  joinAttempts: Map<string, { count: number; resetAt: number }>;
};

const rooms = new Map<string, RoomRuntime>();
const socketToRoom = new Map<string, string>();

export function getRoomRuntime(roomId: string): RoomRuntime | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocket(socketId: string): RoomRuntime | undefined {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

export function ensureRuntime(roomId: string, code: string, hostUserId: string): RoomRuntime {
  let runtime = rooms.get(roomId);
  if (!runtime) {
    runtime = {
      roomId,
      code,
      hostUserId,
      hostSocketId: null,
      sharing: false,
      participants: new Map(),
      joinAttempts: new Map(),
    };
    rooms.set(roomId, runtime);
  }
  return runtime;
}

export function recordJoinAttempt(runtime: RoomRuntime, key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = runtime.joinAttempts.get(key);
  if (!current || now > current.resetAt) {
    runtime.joinAttempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return { allowed: true, remaining: env.maxJoinAttempts - 1 };
  }
  current.count += 1;
  if (current.count > env.maxJoinAttempts) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: env.maxJoinAttempts - current.count };
}

export function addParticipant(runtime: RoomRuntime, participant: Participant): void {
  runtime.participants.set(participant.socketId, participant);
  socketToRoom.set(participant.socketId, runtime.roomId);
  if (participant.role === "host") {
    runtime.hostSocketId = participant.socketId;
  }
}

export function removeParticipant(socketId: string): { runtime: RoomRuntime; participant: Participant } | null {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;
  const runtime = rooms.get(roomId);
  if (!runtime) {
    socketToRoom.delete(socketId);
    return null;
  }
  const participant = runtime.participants.get(socketId);
  runtime.participants.delete(socketId);
  socketToRoom.delete(socketId);
  if (runtime.hostSocketId === socketId) {
    runtime.hostSocketId = null;
    runtime.sharing = false;
  }
  if (runtime.participants.size === 0) {
    rooms.delete(roomId);
  }
  if (!participant) return null;
  return { runtime, participant };
}

export function kickParticipant(runtime: RoomRuntime, targetUserId: string): Participant | null {
  for (const [socketId, p] of runtime.participants) {
    if (p.userId === targetUserId && p.role !== "host") {
      runtime.participants.delete(socketId);
      socketToRoom.delete(socketId);
      return p;
    }
  }
  return null;
}

export function listParticipants(runtime: RoomRuntime) {
  return Array.from(runtime.participants.values()).map((p) => ({
    id: p.userId,
    socketId: p.socketId,
    name: p.name,
    role: p.role,
  }));
}

export function cleanupEmpty(): void {
  for (const [id, runtime] of rooms) {
    if (runtime.participants.size === 0) rooms.delete(id);
  }
}
