import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import ConfirmModal from "../components/ConfirmModal";
import Logo from "../components/Logo";
import ParticipantList from "../components/ParticipantList";
import QualityControls from "../components/QualityControls";
import StateScreen from "../components/StateScreen";
import StatusBadge from "../components/StatusBadge";
import VideoStage from "../components/VideoStage";
import { useAuth } from "../hooks/useAuth";
import { useClipboard } from "../hooks/useClipboard";
import { useWebRTC } from "../hooks/useWebRTC";
import { getSocket } from "../services/socket";
import type { ConnectionState, Participant, Room } from "../types";
import type { Socket } from "socket.io-client";

export default function RoomPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { copied, copy } = useClipboard();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [banner, setBanner] = useState<ConnectionState | null>(null);
  const [confirmShare, setConfirmShare] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [kicked, setKicked] = useState(false);
  const videoWrapRef = useRef<HTMLDivElement>(null);

  const role = room?.you?.role ?? null;
  const webrtc = useWebRTC({
    socket,
    room,
    role,
    iceServers: room?.iceServers,
  });

  const inviteUrl = useMemo(() => {
    if (!room) return "";
    return `${window.location.origin}/room/${room.code}`;
  }, [room]);

  const applyRoom = useCallback((next: Room) => {
    setRoom(next);
    setParticipants(next.participants ?? []);
  }, []);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onJoined = (payload: { room: Room }) => {
      applyRoom(payload.room);
      webrtc.setConnectionState(payload.room.sharing ? "connecting" : "waiting");
    };
    const onCreated = (payload: { room: Room }) => applyRoom(payload.room);
    const onUserJoined = (payload: { participants: Participant[] }) => setParticipants(payload.participants);
    const onUserLeft = (payload: { participants: Participant[]; wasHost?: boolean }) => {
      setParticipants(payload.participants);
      if (payload.wasHost) webrtc.setConnectionState("disconnected");
    };
    const onNotFound = () => setBanner("not-found");
    const onExpired = () => setBanner("expired");
    const onEnded = () => {
      setBanner("ended");
      webrtc.setConnectionState("ended");
    };
    const onKicked = () => setKicked(true);
    const onErr = (payload: { code?: string }) => {
      if (payload.code === "ROOM_NOT_FOUND") setBanner("not-found");
      if (payload.code === "ROOM_EXPIRED") setBanner("expired");
      if (payload.code === "ROOM_ENDED") setBanner("ended");
    };

    s.on("joined-room", onJoined);
    s.on("room-created", onCreated);
    s.on("user-joined", onUserJoined);
    s.on("user-disconnected", onUserLeft);
    s.on("room-not-found", onNotFound);
    s.on("room-expired", onExpired);
    s.on("session-ended", onEnded);
    s.on("kicked", onKicked);
    s.on("error-message", onErr);

    s.emit("join-room", { code });

    return () => {
      s.emit("leave-room");
      s.off("joined-room", onJoined);
      s.off("room-created", onCreated);
      s.off("user-joined", onUserJoined);
      s.off("user-disconnected", onUserLeft);
      s.off("room-not-found", onNotFound);
      s.off("room-expired", onExpired);
      s.off("session-ended", onEnded);
      s.off("kicked", onKicked);
      s.off("error-message", onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRoom, code]);

  async function toggleFullscreen() {
    const el = videoWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }

  function leave() {
    socket?.emit("leave-room");
    webrtc.stopSharing();
    webrtc.destroyAllPeers();
    navigate("/");
  }

  function endSession() {
    socket?.emit("end-session");
    webrtc.stopSharing();
    setConfirmEnd(false);
    setBanner("ended");
  }

  function kick(userId: string) {
    socket?.emit("kick-user", { userId });
  }

  if (kicked) {
    return <StateScreen title="Você foi removido" description="O anfitrião removeu você desta sala." actionLabel="Voltar" onAction={() => navigate("/")} />;
  }
  if (banner === "not-found") {
    return <StateScreen title="Sala inexistente" description="Este código não corresponde a nenhuma sala ativa." actionLabel="Início" onAction={() => navigate("/")} />;
  }
  if (banner === "expired") {
    return <StateScreen title="Sala expirada" description="Esta sala expirou e não aceita mais participantes." actionLabel="Início" onAction={() => navigate("/")} />;
  }
  if (banner === "ended") {
    return <StateScreen title="Compartilhamento encerrado" description="A sessão foi finalizada pelo anfitrião." actionLabel="Início" onAction={() => navigate("/")} />;
  }
  if (webrtc.permissionDenied) {
    return (
      <StateScreen
        title="Erro de permissão"
        description="O navegador recusou a captura de tela. Autorize o compartilhamento para continuar."
        actionLabel="Tentar novamente"
        onAction={() => setConfirmShare(true)}
      />
    );
  }

  const displayStream = role === "host" ? webrtc.localStream : webrtc.remoteStream;
  const emptyLabel =
    role === "host"
      ? "Clique em compartilhar para transmitir sua tela. O navegador pedirá autorização."
      : "Aguardando o anfitrião compartilhar a tela.";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <Logo compact={false} />
        <div className="flex items-center gap-2">
          <StatusBadge state={webrtc.connectionState} />
          <Button variant="ghost" onClick={leave}>
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row">
        <section ref={videoWrapRef} className="flex min-h-[50vh] flex-1 flex-col">
          <VideoStage
            stream={displayStream}
            muted={role === "host"}
            sharingLocal={role === "host" && webrtc.sharing}
            state={webrtc.connectionState}
            emptyLabel={emptyLabel}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {role === "host" && !webrtc.sharing && (
              <Button onClick={() => setConfirmShare(true)}>Compartilhar minha tela</Button>
            )}
            {role === "host" && webrtc.sharing && (
              <Button variant="danger" onClick={() => webrtc.stopSharing()}>
                Parar compartilhamento
              </Button>
            )}
            <Button variant="secondary" onClick={() => void toggleFullscreen()}>
              Tela cheia
            </Button>
            {role === "host" && (
              <Button variant="ghost" className="text-rose-300" onClick={() => setConfirmEnd(true)}>
                Encerrar sessão
              </Button>
            )}
          </div>
        </section>

        <aside className="w-full shrink-0 space-y-4 rounded-2xl border border-white/5 bg-ink-800/60 p-4 lg:w-80">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Sala</p>
            <p className="font-display text-2xl font-semibold tracking-wider">{room?.code ?? code.toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => void copy(inviteUrl)}>
              {copied ? "Link copiado" : "Copiar convite"}
            </Button>
          </div>
          <p className="break-all text-xs text-slate-500">{inviteUrl}</p>
          <ParticipantList
            participants={participants}
            isHost={role === "host"}
            currentUserId={user?.id}
            onKick={kick}
          />
          {role === "host" && (
            <QualityControls
              quality={webrtc.quality}
              fps={webrtc.fps}
              shareAudio={webrtc.shareAudio}
              disabled={webrtc.sharing}
              onQuality={webrtc.setQuality}
              onFps={webrtc.setFps}
              onAudio={webrtc.setShareAudio}
            />
          )}
          {webrtc.error && <p className="text-sm text-rose-400">{webrtc.error}</p>}
        </aside>
      </div>

      <ConfirmModal
        open={confirmShare}
        title="Compartilhar sua tela?"
        description="O navegador vai pedir permissão oficial para capturar a tela. Ninguém verá nada até você confirmar."
        confirmLabel="Continuar"
        onCancel={() => setConfirmShare(false)}
        onConfirm={() => {
          setConfirmShare(false);
          void webrtc.startSharing();
        }}
      />
      <ConfirmModal
        open={confirmEnd}
        title="Encerrar sessão?"
        description="Todos os participantes serão desconectados e a sala será encerrada."
        confirmLabel="Encerrar sessão"
        danger
        onCancel={() => setConfirmEnd(false)}
        onConfirm={endSession}
      />
    </div>
  );
}
