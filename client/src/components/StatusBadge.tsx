import type { ConnectionState } from "../types";
import { connectionLabel } from "../utils/format";

const color: Record<string, string> = {
  waiting: "bg-amber-500/15 text-amber-300",
  connecting: "bg-sky-500/15 text-sky-300",
  connected: "bg-emerald-500/15 text-emerald-300",
  unstable: "bg-orange-500/15 text-orange-300",
  disconnected: "bg-slate-500/15 text-slate-300",
  ended: "bg-rose-500/15 text-rose-300",
  "not-found": "bg-rose-500/15 text-rose-300",
  expired: "bg-rose-500/15 text-rose-300",
  "permission-denied": "bg-rose-500/15 text-rose-300",
  error: "bg-rose-500/15 text-rose-300",
  idle: "bg-slate-500/15 text-slate-300",
};

export default function StatusBadge({ state }: { state: ConnectionState }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${color[state] ?? color.idle}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === "connected" ? "bg-emerald-400" : "bg-current"}`} />
      {connectionLabel(state)}
    </span>
  );
}
