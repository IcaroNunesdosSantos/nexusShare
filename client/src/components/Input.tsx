import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Input({ label, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input
        id={inputId}
        className={`w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-sm text-slate-100 outline-none ring-accent-500/40 placeholder:text-slate-500 focus:border-accent-500 focus:ring-2 ${className}`}
        {...rest}
      />
    </label>
  );
}
