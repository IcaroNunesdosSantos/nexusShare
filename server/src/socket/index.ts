import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { env } from "../config/env.js";
import { getIceServers } from "../config/ice.js";
import { verifyToken } from "../middleware/auth.js";
import * as roomService from "../services/roomService.js";
import {
  addParticipant,
  ensureRuntime,
  getRoomBySocket,
  kickParticipant,
  listParticipants,
  recordJoinAttempt,
  removeParticipant,
  type Participant,
} from "./roomStore.js";

const codeSchema = z.string().min(4).max(16);
const sdpSchema = z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().min(1).max(200_000) });
const iceSchema = z.object({
  candidate: z.string().nullable(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

type AuthedSocket = Socket & {
  user?: { id: string; name: string; email: string };
};

function authFromHandshake(socket: AuthedSocket): boolean {
  const token =
    (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) ||
    (typeof socket.handshake.query?.token === "string" && socket.handshake.query.token) ||
    "";
  if (!token) return false;
  const user = verifyToken(token);
  if (!user) return false;
  socket.user = user;
  return true;
}

function emitError(socket: Socket, message: string, code?: string): void {
  socket.emit("error-message", { error: message, code });
}

export function registerSocket(io: Server): void {
  io.use((socket: AuthedSocket, next) => {
    if (!authFromHandshake(socket)) {
      next(new Error("Autenticação necessária."));
      return;
    }
    next();
  });

  io.on("connection", (socket: AuthedSocket) => {
    const user = socket.user!;
    roomService.logEvent("system", "socket_connected", user.id, user.name, { socketId: socket.id });

    socket.on("create-room", () => {
      try {
        const room = roomService.createRoom(user.id, user.name);
        const runtime = ensureRuntime(room.id, room.code, user.id);
        const participant: Participant = {
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          role: "host",
          joinedAt: Date.now(),
        };
        addParticipant(runtime, participant);
        void socket.join(room.id);
        socket.emit("room-created", {
          room: roomService.toPublicRoom(room, {
            inviteUrl: `${env.clientUrl.replace(/\/$/, "")}/room/${room.code}`,
            iceServers: getIceServers(),
            participants: listParticipants(runtime),
            you: { id: user.id, name: user.name, role: "host" },
          }),
        });
      } catch {
        emitError(socket, "Não foi possível criar a sala.");
      }
    });

    socket.on("join-room", (payload: unknown) => {
      const parsed = z.object({ code: codeSchema }).safeParse(payload);
      if (!parsed.success) {
        emitError(socket, "Código de sala inválido.", "INVALID_CODE");
        return;
      }
      const code = roomService.normalizeCode(parsed.data.code);
      const room = roomService.getRoomByCode(code);
      if (!room) {
        emitError(socket, "Sala inexistente.", "ROOM_NOT_FOUND");
        socket.emit("room-not-found", { code });
        return;
      }
      if (roomService.isExpired(room)) {
        roomService.markExpired(room.id);
        emitError(socket, "Sala expirada.", "ROOM_EXPIRED");
        socket.emit("room-expired", { code: room.code });
        return;
      }
      if (room.status === "ended") {
        emitError(socket, "Compartilhamento encerrado.", "ROOM_ENDED");
        socket.emit("session-ended", { code: room.code });
        return;
      }

      const runtime = ensureRuntime(room.id, room.code, room.host_id);
      const attemptKey = `${socket.handshake.address}:${code}`;
      const attempt = recordJoinAttempt(runtime, attemptKey);
      if (!attempt.allowed) {
        emitError(socket, "Muitas tentativas de entrar nesta sala.", "JOIN_LIMIT");
        return;
      }

      if (runtime.participants.size >= env.maxParticipants) {
        emitError(socket, "A sala está cheia.", "ROOM_FULL");
        return;
      }

      const already = Array.from(runtime.participants.values()).find((p) => p.userId === user.id);
      if (already) {
        runtime.participants.delete(already.socketId);
      }

      const role = user.id === room.host_id ? "host" : "viewer";
      const participant: Participant = {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        role,
        joinedAt: Date.now(),
      };
      addParticipant(runtime, participant);
      void socket.join(room.id);
      roomService.logEvent(room.id, "user_joined", user.id, user.name);

      const publicRoom = roomService.toPublicRoom(room, {
        inviteUrl: `${env.clientUrl.replace(/\/$/, "")}/room/${room.code}`,
        iceServers: getIceServers(),
        participants: listParticipants(runtime),
        sharing: runtime.sharing,
        you: { id: user.id, name: user.name, role },
      });

      socket.emit("joined-room", { room: publicRoom });
      socket.to(room.id).emit("user-joined", {
        participant: { id: user.id, socketId: socket.id, name: user.name, role },
        participants: listParticipants(runtime),
      });

      if (runtime.sharing && runtime.hostSocketId && role === "viewer") {
        io.to(runtime.hostSocketId).emit("viewer-ready", {
          viewerSocketId: socket.id,
          viewerId: user.id,
          viewerName: user.name,
        });
      }
    });

    socket.on("offer", (payload: unknown) => {
      const parsed = z
        .object({ targetSocketId: z.string().min(1).max(64), sdp: sdpSchema })
        .safeParse(payload);
      if (!parsed.success) return;
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me || me.role !== "host") return;
      const target = runtime.participants.get(parsed.data.targetSocketId);
      if (!target) return;
      io.to(parsed.data.targetSocketId).emit("offer", {
        fromSocketId: socket.id,
        fromUserId: me.userId,
        sdp: parsed.data.sdp,
      });
    });

    socket.on("answer", (payload: unknown) => {
      const parsed = z
        .object({ targetSocketId: z.string().min(1).max(64), sdp: sdpSchema })
        .safeParse(payload);
      if (!parsed.success) return;
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me) return;
      const target = runtime.participants.get(parsed.data.targetSocketId);
      if (!target) return;
      io.to(parsed.data.targetSocketId).emit("answer", {
        fromSocketId: socket.id,
        fromUserId: me.userId,
        sdp: parsed.data.sdp,
      });
    });

    socket.on("ice-candidate", (payload: unknown) => {
      const parsed = z
        .object({ targetSocketId: z.string().min(1).max(64), candidate: iceSchema })
        .safeParse(payload);
      if (!parsed.success) return;
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      if (!runtime.participants.has(parsed.data.targetSocketId)) return;
      io.to(parsed.data.targetSocketId).emit("ice-candidate", {
        fromSocketId: socket.id,
        candidate: parsed.data.candidate,
      });
    });

    socket.on("screen-started", () => {
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me || me.role !== "host") return;
      runtime.sharing = true;
      roomService.setSharing(runtime.roomId, true);
      io.to(runtime.roomId).emit("screen-started", {
        hostSocketId: socket.id,
        hostName: me.name,
      });
      for (const p of runtime.participants.values()) {
        if (p.role === "viewer") {
          io.to(socket.id).emit("viewer-ready", {
            viewerSocketId: p.socketId,
            viewerId: p.userId,
            viewerName: p.name,
          });
        }
      }
    });

    socket.on("screen-stopped", () => {
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me || me.role !== "host") return;
      runtime.sharing = false;
      roomService.setSharing(runtime.roomId, false);
      io.to(runtime.roomId).emit("screen-stopped", { hostName: me.name });
    });

    socket.on("kick-user", (payload: unknown) => {
      const parsed = z.object({ userId: z.string().uuid() }).safeParse(payload);
      if (!parsed.success) return;
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me || me.role !== "host") return;
      const kicked = kickParticipant(runtime, parsed.data.userId);
      if (!kicked) return;
      roomService.logEvent(runtime.roomId, "user_kicked", user.id, user.name, { target: kicked.userId });
      io.to(kicked.socketId).emit("kicked", { reason: "Removido pelo anfitrião." });
      io.to(runtime.roomId).emit("user-disconnected", {
        participant: { id: kicked.userId, name: kicked.name, role: kicked.role },
        participants: listParticipants(runtime),
        reason: "kicked",
      });
      const kickedSocket = io.sockets.sockets.get(kicked.socketId);
      if (kickedSocket) {
        void kickedSocket.leave(runtime.roomId);
        kickedSocket.disconnect(true);
      }
    });

    socket.on("end-session", () => {
      const runtime = getRoomBySocket(socket.id);
      if (!runtime) return;
      const me = runtime.participants.get(socket.id);
      if (!me || me.role !== "host") return;
      roomService.endRoom(runtime.roomId, user.id, user.name);
      io.to(runtime.roomId).emit("session-ended", { code: runtime.code });
      for (const p of runtime.participants.values()) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) {
          void s.leave(runtime.roomId);
        }
      }
    });

    socket.on("leave-room", () => {
      handleLeave(io, socket, "left");
    });

    socket.on("disconnect", () => {
      handleLeave(io, socket, "disconnected");
      roomService.logEvent("system", "socket_disconnected", user.id, user.name, { socketId: socket.id });
    });
  });
}

function handleLeave(io: Server, socket: Socket, reason: "left" | "disconnected"): void {
  const result = removeParticipant(socket.id);
  if (!result) return;
  const { runtime, participant } = result;
  roomService.logEvent(runtime.roomId, "user_left", participant.userId, participant.name, { reason });
  io.to(runtime.roomId).emit("user-disconnected", {
    participant: { id: participant.userId, name: participant.name, role: participant.role, socketId: participant.socketId },
    participants: listParticipants(runtime),
    reason,
    wasHost: participant.role === "host",
  });
  if (participant.role === "host") {
    roomService.setSharing(runtime.roomId, false);
    io.to(runtime.roomId).emit("screen-stopped", { hostName: participant.name, reason: "host-left" });
  }
  void socket.leave(runtime.roomId);
}
