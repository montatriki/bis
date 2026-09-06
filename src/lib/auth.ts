"use server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "./prisma";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  login: string;
  /** Tiers ERP rattaché (Partner.id) — un CLIENT ne voit que ses documents. */
  codeTiers?: number | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/**
 * Secret de signature des sessions. Sans lui, le cookie ne serait qu'un JSON
 * en base64 : n'importe qui pourrait se déclarer ADMIN sans mot de passe et
 * tous les contrôles de rôle deviendraient décoratifs.
 */
function secretSession(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court (32 caractères minimum). " +
      "Générez-le avec : openssl rand -hex 32",
    );
  }
  return s;
}

/** Empreinte HMAC-SHA256 du contenu du cookie. */
function signature(charge: string): string {
  return createHmac("sha256", secretSession()).update(charge).digest("base64url");
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("bis_session")?.value;
  if (!session) return null;
  try {
    const [charge, sig] = session.split(".");
    // Un cookie sans signature est un ancien format, ou une contrefaçon :
    // dans les deux cas on le refuse.
    if (!charge || !sig) return null;
    const attendue = signature(charge);
    // Comparaison à temps constant : une comparaison naïve laisserait fuir la
    // signature octet par octet.
    const a = Buffer.from(sig), b = Buffer.from(attendue);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(charge, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  const charge = Buffer.from(JSON.stringify(user)).toString("base64url");
  cookieStore.set("bis_session", `${charge}.${signature(charge)}`, {
    httpOnly: true,
    // En production le cookie ne doit jamais transiter en clair.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("bis_session");
}

export async function loginUser(login: string, password: string) {
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || !user.isActive) return null;
  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;
  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    login: user.login,
    codeTiers: user.codeTiers ?? null,
  };
  await createSession(session);
  return session;
}
