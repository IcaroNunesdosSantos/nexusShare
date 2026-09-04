import type { FpsPreset, QualityPreset } from "../types";

type Props = {
  quality: QualityPreset;
  fps: FpsPreset;
  shareAudio: boolean;
  disabled?: boolean;
  onQuality: (q: QualityPreset) => void;
  onFps: (f: FpsPreset) => void;
  onAudio: (v: boolean) => void;
};

export default function QualityControls({ quality, fps, shareAudio, disabled, onQuality, onFps, onAudio }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-1 text-xs text-slate-400">
        Qualidade
        <select
          disabled={disabled}
          value={quality}
          onChange={(e) => onQuality(e.target.value as QualityPreset)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-2 text-sm text-slate-100"
        >
          <option value="auto">Automático</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        Quadros
        <select
          disabled={disabled}
          value={fps}
          onChange={(e) => onFps(Number(e.target.value) as FpsPreset)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-2 text-sm text-slate-100"
        >
          <option value={15}>15 FPS</option>
          <option value={30}>30 FPS</option>
          <option value={60}>60 FPS</option>
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-200">
        <input
          type="checkbox"
          disabled={disabled}
          checked={shareAudio}
          onChange={(e) => onAudio(e.target.checked)}
          className="h-4 w-4 accent-accent-500"
        />
        Compartilhar áudio
      </label>
    </div>
  );
}
