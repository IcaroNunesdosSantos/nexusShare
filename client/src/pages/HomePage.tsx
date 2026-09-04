import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { clampCodeInput } from "../utils/format";

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  async function shareScreen() {
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.createRoom();
      navigate(`/room/${room.code}`, { state: { asHost: true } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const clean = clampCodeInput(code);
    if (clean.replace("-", "").length < 8) {
      setError("Informe um código válido.");
      return;
    }
    navigate(`/room/${clean}`);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="hidden sm:inline">{user?.name}</span>
          <Button variant="ghost" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-20 pt-10 text-center">
        <p className="mb-3 rounded-full border border-white/10 bg-ink-800 px-3 py-1 text-xs text-slate-400">
          Privado · Ponta a ponta · Sem gravação no servidor
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
          Compartilhe sua tela com qualquer pessoa
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-400">
          Crie uma sala privada e compartilhe sua tela em segundos.
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Button full disabled={busy} onClick={() => void shareScreen()}>
            {busy ? "Criando sala..." : "Compartilhar minha tela"}
          </Button>
          <Button variant="secondary" full onClick={() => setShowJoin((v) => !v)}>
            Entrar em uma sala
          </Button>
        </div>

        {showJoin && (
          <form onSubmit={join} className="mt-6 w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-800/70 p-4 text-left">
            <Input
              label="Código da sala"
              name="code"
              placeholder="A7FK-29QP"
              value={code}
              onChange={(e) => setCode(clampCodeInput(e.target.value))}
            />
            <Button type="submit" full variant="secondary">
              Entrar
            </Button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
      </main>
    </div>
  );
}
