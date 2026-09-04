import type { Participant } from "../types";
import Button from "./Button";

type Props = {
  participants: Participant[];
  isHost: boolean;
  currentUserId?: string;
  onKick?: (userId: string) => void;
};

export default function ParticipantList({ participants, isHost, currentUserId, onKick }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Participantes</h3>
        <span className="rounded-full bg-ink-700 px-2 py-0.5 text-xs text-slate-400">{participants.length}</span>
      </div>
      <ul className="space-y-2">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl bg-ink-900/80 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-600/30 text-xs font-semibold text-accent-400">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.name}
                  {p.id === currentUserId ? " (você)" : ""}
                </p>
                <p className="text-xs text-slate-500">{p.role === "host" ? "Anfitrião" : "Convidado"}</p>
              </div>
            </div>
            {isHost && p.role !== "host" && p.id !== currentUserId && (
              <Button variant="ghost" className="px-2 py-1 text-xs text-rose-300" onClick={() => onKick?.(p.id)}>
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
