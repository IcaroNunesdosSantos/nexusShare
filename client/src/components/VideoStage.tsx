import { useEffect, useRef } from "react";
import type { ConnectionState } from "../types";

type Props = {
  stream: MediaStream | null;
  muted?: boolean;
  sharingLocal?: boolean;
  state: ConnectionState;
  emptyLabel: string;
};

export default function VideoStage({ stream, muted, sharingLocal, state, emptyLabel }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-stage relative flex min-h-[240px] flex-1 overflow-hidden rounded-2xl border border-white/5 bg-black shadow-glow">
      <video ref={ref} autoPlay playsInline muted={muted} className={stream ? "block" : "hidden"} />
      {!stream && (
        <div className="flex w-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-800 text-slate-400">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="5" width="18" height="12" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <p className="max-w-sm text-sm text-slate-400">{emptyLabel}</p>
          {state === "connecting" && <p className="text-xs text-sky-300">Estabelecendo conexão segura...</p>}
        </div>
      )}
      {sharingLocal && (
        <div className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Você está compartilhando sua tela
        </div>
      )}
    </div>
  );
}
