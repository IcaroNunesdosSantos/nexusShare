import { io, type Socket } from "socket.io-client";
import { getToken } from "../utils/storage";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    socket.auth = { token: getToken() };
    socket.connect();
    return socket;
  }
  socket = io({
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: { token: getToken() },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
