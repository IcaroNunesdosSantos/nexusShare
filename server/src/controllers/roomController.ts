import type { Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getIceServers } from "../config/ice.js";
import type { AuthedRequest } from "../middleware/auth.js";
import * as roomService from "../services/roomService.js";
import { getRoomRuntime } from "../socket/roomStore.js";

export const createRoomSchema = z.object({}).strict();

export const joinPreviewSchema = z.object({
  code: z.string().min(4).max(16),
});

export function iceConfig(_req: AuthedRequest, res: Response): void {
  res.json({ iceServers: getIceServers() });
}

export function createRoom(req: AuthedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }
  const room = roomService.createRoom(req.user.id, req.user.name);
  const inviteUrl = `${env.clientUrl.replace(/\/$/, "")}/room/${room.code}`;
  res.status(201).json({
    room: roomService.toPublicRoom(room, { inviteUrl, participantCount: 1 }),
  });
}

export function getRoom(req: AuthedRequest, res: Response): void {
  const code = roomService.normalizeCode(String(req.params.code ?? ""));
  const room = roomService.getRoomByCode(code);
  if (!room) {
    res.status(404).json({ error: "Sala inexistente.", code: "ROOM_NOT_FOUND" });
    return;
  }
  if (roomService.isExpired(room)) {
    roomService.markExpired(room.id);
    res.status(410).json({ error: "Sala expirada.", code: "ROOM_EXPIRED" });
    return;
  }
  if (room.status === "ended") {
    res.status(410).json({ error: "Compartilhamento encerrado.", code: "ROOM_ENDED" });
    return;
  }
  const runtime = getRoomRuntime(room.id);
  const inviteUrl = `${env.clientUrl.replace(/\/$/, "")}/room/${room.code}`;
  res.json({
    room: roomService.toPublicRoom(room, {
      inviteUrl,
      participantCount: runtime?.participants.size ?? 0,
      participants: runtime ? Array.from(runtime.participants.values()).map((p) => ({ id: p.userId, name: p.name, role: p.role })) : [],
    }),
  });
}

export function endRoom(req: AuthedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }
  const code = roomService.normalizeCode(String(req.params.code ?? ""));
  const room = roomService.getRoomByCode(code);
  if (!room) {
    res.status(404).json({ error: "Sala inexistente." });
    return;
  }
  if (room.host_id !== req.user.id) {
    res.status(403).json({ error: "Apenas o anfitrião pode encerrar a sessão." });
    return;
  }
  roomService.endRoom(room.id, req.user.id, req.user.name);
  res.json({ ok: true });
}
