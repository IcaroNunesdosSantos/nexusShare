export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type Participant = {
  id: string;
  socketId?: string;
  name: string;
  role: "host" | "viewer";
};

export type RoomStatus = "waiting" | "live" | "ended" | "expired";

export type Room = {
  id: string;
  code: string;
  hostName: string;
  hostId: string;
  status: RoomStatus;
  sharing: boolean;
  createdAt: number;
  expiresAt: number;
  inviteUrl?: string;
  iceServers?: IceServer[];
  participants?: Participant[];
  participantCount?: number;
  you?: { id: string; name: string; role: "host" | "viewer" };
};

export type User = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type QualityPreset = "auto" | "720p" | "1080p";
export type FpsPreset = 15 | 30 | 60;

export type ConnectionState =
  | "idle"
  | "waiting"
  | "connecting"
  | "connected"
  | "unstable"
  | "disconnected"
  | "ended"
  | "not-found"
  | "expired"
  | "permission-denied"
  | "error";

export type SignalingSdp = {
  type: "offer" | "answer";
  sdp: string;
};
