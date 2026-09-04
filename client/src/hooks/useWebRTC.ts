import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { addIce, applyAnswer, attachLocalStream, closePeer, createPeerConnection, makeAnswer, makeOffer, stopStream } from "../services/webrtc";
import type { ConnectionState, FpsPreset, IceServer, Participant, QualityPreset, Room } from "../types";
import { constraintsFor, degradeIfSlow } from "../utils/quality";

type Options = {
  socket: Socket | null;
  room: Room | null;
  role: "host" | "viewer" | null;
  iceServers?: IceServer[];
};

export function useWebRTC({ socket, room, role, iceServers }: Options) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [quality, setQuality] = useState<QualityPreset>("auto");
  const [fps, setFps] = useState<FpsPreset>(30);
  const [shareAudio, setShareAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectTimers = useRef<Map<string, number>>(new Map());
  const reconnectAttempts = useRef<Map<string, number>>(new Map());
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  const flushIce = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(socketId) ?? [];
    pendingIceRef.current.delete(socketId);
    for (const c of queued) {
      await addIce(pc, c);
    }
  }, []);

  const destroyPeer = useCallback((socketId: string) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      closePeer(pc);
      peersRef.current.delete(socketId);
    }
    const timer = reconnectTimers.current.get(socketId);
    if (timer) {
      window.clearTimeout(timer);
      reconnectTimers.current.delete(socketId);
    }
  }, []);

  const destroyAllPeers = useCallback(() => {
    for (const id of Array.from(peersRef.current.keys())) {
      destroyPeer(id);
    }
  }, [destroyPeer]);

  const mapPcState = useCallback((state: RTCPeerConnectionState): ConnectionState => {
    if (state === "connected") return "connected";
    if (state === "connecting") return "connecting";
    if (state === "disconnected") return "unstable";
    if (state === "failed") return "error";
    if (state === "closed") return "disconnected";
    return "connecting";
  }, []);

  const stopSharingRef = useRef<() => void>(() => undefined);

  const createHostPeer = useCallback(
    async (viewerSocketId: string) => {
      if (!socket || !localStreamRef.current) return;
      destroyPeer(viewerSocketId);
      const pc = createPeerConnection(iceServers, {
        onIceCandidate: (candidate) => {
          socket.emit("ice-candidate", { targetSocketId: viewerSocketId, candidate });
        },
        onConnectionState: (state) => {
          setConnectionState(mapPcState(state));
          if (state === "failed") {
            const n = (reconnectAttempts.current.get(viewerSocketId) ?? 0) + 1;
            reconnectAttempts.current.set(viewerSocketId, n);
            if (n <= 5) {
              const t = window.setTimeout(() => {
                void createHostPeer(viewerSocketId);
              }, 1500 * n);
              reconnectTimers.current.set(viewerSocketId, t);
            } else {
              setConnectionState("error");
            }
          }
          if (state === "connected") {
            reconnectAttempts.current.set(viewerSocketId, 0);
          }
        },
        onIceConnectionState: (state) => {
          if (state === "disconnected") setConnectionState("unstable");
        },
      });
      attachLocalStream(pc, localStreamRef.current);
      peersRef.current.set(viewerSocketId, pc);
      const offer = await makeOffer(pc, qualityRef.current);
      socket.emit("offer", { targetSocketId: viewerSocketId, sdp: { type: offer.type, sdp: offer.sdp } });
      await flushIce(viewerSocketId, pc);
    },
    [destroyPeer, flushIce, iceServers, mapPcState, socket]
  );

  const startSharing = useCallback(async () => {
    if (!socket || role !== "host") return;
    setError(null);
    setPermissionDenied(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraintsFor(quality, fps, shareAudio));
      localStreamRef.current = stream;
      setLocalStream(stream);
      setSharing(true);
      setConnectionState(room?.participants && room.participants.length > 1 ? "connecting" : "waiting");
      socket.emit("screen-started");

      const video = stream.getVideoTracks()[0];
      if (video) {
        video.onended = () => {
          stopSharingRef.current();
        };
      }
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setConnectionState("permission-denied");
        setError("Permissão para capturar a tela foi recusada.");
      } else {
        setConnectionState("error");
        setError("Não foi possível iniciar o compartilhamento.");
      }
    }
  }, [fps, quality, role, room?.participants, shareAudio, socket]);

  const stopSharing = useCallback(() => {
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setSharing(false);
    destroyAllPeers();
    socket?.emit("screen-stopped");
    setConnectionState("waiting");
  }, [destroyAllPeers, socket]);

  stopSharingRef.current = stopSharing;

  useEffect(() => {
    if (!socket) return;

    const onOffer = async (payload: { fromSocketId: string; sdp: RTCSessionDescriptionInit }) => {
      if (role !== "viewer") return;
      destroyPeer(payload.fromSocketId);
      const pc = createPeerConnection(iceServers, {
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          setConnectionState("connected");
        },
        onIceCandidate: (candidate) => {
          socket.emit("ice-candidate", { targetSocketId: payload.fromSocketId, candidate });
        },
        onConnectionState: (state) => {
          setConnectionState(mapPcState(state));
        },
        onIceConnectionState: (state) => {
          if (state === "disconnected") setConnectionState("unstable");
        },
      });
      peersRef.current.set(payload.fromSocketId, pc);
      const answer = await makeAnswer(pc, payload.sdp);
      socket.emit("answer", { targetSocketId: payload.fromSocketId, sdp: { type: answer.type, sdp: answer.sdp } });
      await flushIce(payload.fromSocketId, pc);
      setConnectionState("connecting");
    };

    const onAnswer = async (payload: { fromSocketId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(payload.fromSocketId);
      if (!pc) return;
      await applyAnswer(pc, payload.sdp);
      await flushIce(payload.fromSocketId, pc);
    };

    const onIce = async (payload: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(payload.fromSocketId);
      if (!pc || !pc.remoteDescription) {
        const list = pendingIceRef.current.get(payload.fromSocketId) ?? [];
        list.push(payload.candidate);
        pendingIceRef.current.set(payload.fromSocketId, list);
        return;
      }
      await addIce(pc, payload.candidate);
    };

    const onViewerReady = (payload: { viewerSocketId: string }) => {
      if (role !== "host" || !localStreamRef.current) return;
      void createHostPeer(payload.viewerSocketId);
    };

    const onScreenStarted = () => {
      if (role === "viewer") setConnectionState("connecting");
    };

    const onScreenStopped = () => {
      setRemoteStream(null);
      destroyAllPeers();
      if (role === "viewer") setConnectionState("ended");
    };

    const onUserDisconnected = (payload: { participant: Participant; wasHost?: boolean; reason?: string }) => {
      if (payload.participant.socketId) destroyPeer(payload.participant.socketId);
      if (payload.wasHost) {
        setRemoteStream(null);
        setConnectionState("disconnected");
      }
    };

    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("viewer-ready", onViewerReady);
    socket.on("screen-started", onScreenStarted);
    socket.on("screen-stopped", onScreenStopped);
    socket.on("user-disconnected", onUserDisconnected);

    return () => {
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("viewer-ready", onViewerReady);
      socket.off("screen-started", onScreenStarted);
      socket.off("screen-stopped", onScreenStopped);
      socket.off("user-disconnected", onUserDisconnected);
    };
  }, [createHostPeer, destroyAllPeers, destroyPeer, flushIce, iceServers, mapPcState, role, socket]);

  useEffect(() => {
    if (!sharing || role !== "host") return;
    const id = window.setInterval(() => {
      for (const pc of peersRef.current.values()) {
        void degradeIfSlow(pc).then((degraded) => {
          if (degraded) setConnectionState("unstable");
        });
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [role, sharing]);

  useEffect(() => {
    return () => {
      stopStream(localStreamRef.current);
      destroyAllPeers();
    };
  }, [destroyAllPeers]);

  return {
    localStream,
    remoteStream,
    sharing,
    connectionState,
    setConnectionState,
    quality,
    setQuality,
    fps,
    setFps,
    shareAudio,
    setShareAudio,
    error,
    permissionDenied,
    startSharing,
    stopSharing,
    destroyAllPeers,
  };
}
