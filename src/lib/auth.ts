"use server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
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

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("bis_session")?.value;
  if (!session) return null;
  try {
    return JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const cookieStore = await cookies();
  const encoded = Buffer.from(JSON.stringify(user)).toString("base64");
  cookieStore.set("bis_session", encoded, {
    httpOnly: true,
    secure: false,
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
