import type { ReactNode } from "react";
import Logo from "./Logo";

export default function Layout({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        {right}
      </header>
      {children}
    </div>
  );
}
