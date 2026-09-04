import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  full?: boolean;
};

const styles = {
  primary: "bg-accent-600 hover:bg-accent-500 text-white shadow-glow",
  secondary: "bg-ink-700 hover:bg-ink-600 text-slate-100 border border-white/5",
  danger: "bg-rose-600 hover:bg-rose-500 text-white",
  ghost: "bg-transparent hover:bg-white/5 text-slate-200",
};

export default function Button({ variant = "primary", full, className = "", children, ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
