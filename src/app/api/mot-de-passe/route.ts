import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";

// Changement de mot de passe — tuile « CHANGER MOT DE PASSE » de l'app
// commerciale. Chaque utilisateur change **le sien**, en prouvant qu'il connaît
// l'actuel : sans cette vérification, une session laissée ouverte permettrait à
// n'importe qui de verrouiller le compte.
//
// POST /api/mot-de-passe { actuel, nouveau, confirmation }

const s = (v: unknown) => (v == null ? "" : String(v));

/** Longueur minimale. Volontairement modeste : les comptes existants de A ont
 *  des mots de passe très courts (« 007 »), un seuil élevé les bloquerait tous
 *  au premier changement. */
const LONGUEUR_MIN = 4;

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const actuel = s(body.actuel);
  const nouveau = s(body.nouveau);
  const confirmation = s(body.confirmation);

  if (!actuel || !nouveau) {
    return NextResponse.json({ error: "Mot de passe actuel et nouveau requis" }, { status: 400 });
  }
  if (nouveau.length < LONGUEUR_MIN) {
    return NextResponse.json(
      { error: `Le nouveau mot de passe doit faire au moins ${LONGUEUR_MIN} caractères` },
      { status: 400 }
    );
  }
  if (confirmation && nouveau !== confirmation) {
    return NextResponse.json({ error: "La confirmation ne correspond pas" }, { status: 400 });
  }
  if (nouveau === actuel) {
    return NextResponse.json({ error: "Le nouveau mot de passe est identique à l'actuel" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, password: true, isActive: true },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (!user.isActive) return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });

  const valide = await verifyPassword(actuel, user.password);
  if (!valide) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(nouveau) },
  });

  // La session reste valide : elle ne porte pas le mot de passe. Inutile de
  // déconnecter l'utilisateur qui vient de prouver son identité.
  return NextResponse.json({ ok: true, message: "Mot de passe modifié" });
}
