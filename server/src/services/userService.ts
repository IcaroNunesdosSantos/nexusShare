import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../config/database.js";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

const SALT_ROUNDS = 12;

export function toPublic(user: UserRow): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}

export function findByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
}

export function findById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export async function createUser(name: string, email: string, password: string): Promise<PublicUser> {
  const existing = findByEmail(email);
  if (existing) {
    throw Object.assign(new Error("Este e-mail já está em uso."), { status: 409 });
  }
  const id = crypto.randomUUID();
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const created_at = Date.now();
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name.trim(), email.toLowerCase(), password_hash, created_at);
  return { id, name: name.trim(), email: email.toLowerCase() };
}

export async function verifyPassword(email: string, password: string): Promise<PublicUser> {
  const user = findByEmail(email);
  if (!user) {
    throw Object.assign(new Error("E-mail ou senha incorretos."), { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw Object.assign(new Error("E-mail ou senha incorretos."), { status: 401 });
  }
  return toPublic(user);
}
