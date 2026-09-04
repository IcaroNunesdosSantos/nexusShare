import type { IceServer, QualityPreset } from "../types";
import { adaptBitrate } from "../utils/quality";

export type PeerHandlers = {
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onIceConnectionState?: (state: RTCIceConnectionState) => void;
};

const DEFAULT_STUN: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function createPeerConnection(iceServers: IceServer[] | undefined, handlers: PeerHandlers): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: iceServers && iceServers.length > 0 ? iceServers : DEFAULT_STUN,
    iceCandidatePoolSize: 4,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  });

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      handlers.onIceCandidate(ev.candidate.toJSON());
    } else {
      handlers.onIceCandidate({ candidate: "", sdpMid: null, sdpMLineIndex: null });
    }
  };

  pc.ontrack = (ev) => {
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    handlers.onRemoteStream?.(stream);
  };

  pc.onconnectionstatechange = () => {
    handlers.onConnectionState(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    handlers.onIceConnectionState?.(pc.iceConnectionState);
  };

  return pc;
}

export async function makeOffer(pc: RTCPeerConnection, quality: QualityPreset): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
  await pc.setLocalDescription(offer);
  await adaptBitrate(pc, quality);
  return pc.localDescription!;
}

export async function makeAnswer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return pc.localDescription!;
}

export async function applyAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
  if (pc.signalingState === "have-local-offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

export async function addIce(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
  if (!candidate.candidate) {
    try {
      await pc.addIceCandidate(null);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    /* candidate may arrive before remote description */
  }
}

export function attachLocalStream(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    const existing = pc.getSenders().find((s) => s.track?.kind === track.kind);
    if (existing) {
      void existing.replaceTrack(track);
    } else {
      pc.addTrack(track, stream);
    }
  }
}

export function closePeer(pc: RTCPeerConnection | null): void {
  if (!pc) return;
  try {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {
        /* ignore */
      }
    });
    pc.close();
  } catch {
    /* ignore */
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
