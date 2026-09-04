import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-ink-800/80 p-6">
        <h1 className="font-display text-2xl font-semibold">Criar conta</h1>
        <Input label="Nome" name="name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="E-mail" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Senha" type="password" name="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" full disabled={busy}>
          {busy ? "Criando..." : "Criar conta"}
        </Button>
        <p className="text-center text-sm text-slate-400">
          Já tem conta?{" "}
          <Link className="text-accent-400 hover:underline" to="/login">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
