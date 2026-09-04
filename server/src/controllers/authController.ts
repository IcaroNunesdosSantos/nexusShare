import type { Response } from "express";
import { z } from "zod";
import { isProd } from "../config/env.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { signToken } from "../middleware/auth.js";
import * as userService from "../services/userService.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(60, "Nome muito longo."),
  email: z.string().trim().email("E-mail inválido.").max(120),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function register(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body as z.infer<typeof registerSchema>;
    const user = await userService.createUser(name, email, password);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message || "Falha ao criar conta." });
  }
}

export async function login(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await userService.verifyPassword(email, password);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user, token });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message || "Falha ao entrar." });
  }
}

export function me(req: AuthedRequest, res: Response): void {
  res.json({ user: req.user });
}

export function logout(_req: AuthedRequest, res: Response): void {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
}
