import { getToken } from "../utils/storage";
import type { AuthResponse, Room, User } from "../types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(data.error || "Falha na requisição") as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  register(name: string, email: string, password: string) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  login(email: string, password: string) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<{ user: User }>("/api/auth/me");
  },
  createRoom() {
    return request<{ room: Room }>("/api/rooms", { method: "POST" });
  },
  getRoom(code: string) {
    return request<{ room: Room }>(`/api/rooms/${encodeURIComponent(code)}`);
  },
  endRoom(code: string) {
    return request<{ ok: boolean }>(`/api/rooms/${encodeURIComponent(code)}/end`, { method: "POST" });
  },
  ice() {
    return request<{ iceServers: RTCIceServer[] }>("/api/rooms/ice");
  },
};
