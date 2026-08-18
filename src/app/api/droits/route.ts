import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  FONCTIONS_STANDARD, composantsDisponibles, droitsDe, initialiserCatalogue,
} from "@/lib/droits-acces";

// Droits d'accès par utilisateur / composant.
//
// GET    /api/droits?vue=catalogue|utilisateur|matrice|mes-droits
// POST   /api/droits { vue: "init" }                       → complète le catalogue
// PUT    /api/droits { login, droits: { "<component>.<func>": bool } }
// DELETE /api/droits?login=…                               → remet à zéro
//
// Lecture et écriture réservées ADMIN : qui peut lire la matrice des droits
// connaît la surface d'attaque. `mes-droits` est la seule vue ouverte, et elle
// ne renvoie que les droits de l'appelant.

const s = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "matrice";

  // Un utilisateur peut toujours consulter ses propres droits — l'UI en a
  // besoin pour masquer les boutons qu'il n'a pas le droit d'utiliser.
  if (vue === "mes-droits") {
    const auth = await requireSession();
    if (!auth.ok) return auth.res;
    const droits = await droitsDe(auth.user.login, auth.user.role);
    return NextResponse.json({ login: auth.user.login, role: auth.user.role, droits });
  }

  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  if (vue === "catalogue") {
    const rows = await prisma.droitFonction.findMany({
      orderBy: [{ component: "asc" }, { numOrder: "asc" }],
    });
    return NextResponse.json({
      rows, total: rows.length,
      composants: composantsDisponibles(),
      fonctions: FONCTIONS_STANDARD,
    });
  }

  if (vue === "utilisateur") {
    const login = s(sp.get("login"));
    if (!login) return NextResponse.json({ error: "login requis" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { login },
      select: { login: true, name: true, role: true, isActive: true },
    });
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    const fonctions = await prisma.droitFonction.findMany({
      include: { droits: { where: { login }, select: { valeur: true } } },
      orderBy: [{ component: "asc" }, { numOrder: "asc" }],
    });

    // Regroupement par composant : la matrice se lit écran par écran.
    const libelles = new Map(composantsDisponibles().map((c) => [c.component, c]));
    const groupes = new Map<string, {
      component: string; label: string; module: string;
      fonctions: { id: number; funcName: string; funcLib: string; typeFn: string; valeur: boolean; explicite: boolean }[];
    }>();

    for (const f of fonctions) {
      const meta = libelles.get(f.component);
      const g = groupes.get(f.component) ?? {
        component: f.component,
        label: meta?.label ?? f.component,
        module: meta?.module ?? "—",
        fonctions: [],
      };
      const explicite = f.droits[0]?.valeur;
      g.fonctions.push({
        id: f.id, funcName: f.funcName, funcLib: f.funcLib, typeFn: f.typeFn,
        // Même règle que `aLeDroit` : ADMIN tout permis, sinon défaut = accès seul.
        valeur: user.role === "ADMIN" ? true : explicite !== undefined ? explicite : f.funcName === "acces",
        explicite: explicite !== undefined,
      });
      groupes.set(f.component, g);
    }

    return NextResponse.json({
      user,
      // Un ADMIN a tous les droits par son rôle : le signaler évite de croire
      // que la matrice affichée est ce qui est enregistré.
      toutPermisParRole: user.role === "ADMIN",
      groupes: [...groupes.values()],
      total: fonctions.length,
    });
  }

  // matrice : la liste des comptes avec leur nombre de droits accordés.
  //
  // Le catalogue se complète ici, côté serveur : un sous-menu ajouté au menu
  // devient protégeable dès la première consultation. L'opération est
  // idempotente et ne coûte qu'un SELECT quand rien ne manque — l'écran
  // reste ainsi une lecture, sans POST déclenché au montage.
  await initialiserCatalogue();

  const users = await prisma.user.findMany({
    select: { login: true, name: true, role: true, isActive: true },
    orderBy: { name: "asc" },
  });
  const parLogin = await prisma.droitUtilisateur.groupBy({
    by: ["login"],
    _count: { _all: true },
    where: { valeur: true },
  });
  const nb = new Map(parLogin.map((p) => [p.login, p._count._all]));
  const totalFonctions = await prisma.droitFonction.count();

  return NextResponse.json({
    rows: users.map((u) => ({
      ...u,
      droitsAccordes: u.role === "ADMIN" ? totalFonctions : nb.get(u.login) ?? 0,
      toutPermisParRole: u.role === "ADMIN",
    })),
    total: users.length,
    totalFonctions,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  if (s(body.vue) === "init") {
    const res = await initialiserCatalogue();
    return NextResponse.json({
      ok: true, ...res,
      message: res.crees > 0
        ? `${res.crees} fonction(s) ajoutée(s) au catalogue (${res.total} au total)`
        : `Catalogue déjà complet (${res.total} fonctions)`,
    });
  }
  return NextResponse.json({ error: "Vue inconnue" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const login = s(body.login);
  const droits = body.droits;

  if (!login) return NextResponse.json({ error: "login requis" }, { status: 400 });
  if (typeof droits !== "object" || droits === null) {
    return NextResponse.json({ error: "droits requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login }, select: { login: true, role: true } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Retirer l'accès à l'écran des droits à soi-même verrouillerait la
  // configuration : personne ne pourrait plus la rouvrir.
  if (login === auth.user.login) {
    const cle = "administration.droits.acces";
    if (Object.prototype.hasOwnProperty.call(droits, cle) && !droits[cle]) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas retirer votre propre accès à l'écran des droits" },
        { status: 409 }
      );
    }
  }

  const fonctions = await prisma.droitFonction.findMany({
    select: { id: true, component: true, funcName: true },
  });
  const parCle = new Map(fonctions.map((f) => [`${f.component}.${f.funcName}`, f.id]));

  const ops: { fonctionId: number; valeur: boolean }[] = [];
  const inconnues: string[] = [];
  for (const [cle, val] of Object.entries(droits as Record<string, unknown>)) {
    const id = parCle.get(cle);
    if (id == null) { inconnues.push(cle); continue; }
    ops.push({ fonctionId: id, valeur: val === true });
  }

  if (ops.length === 0) {
    return NextResponse.json(
      { error: `Aucun droit reconnu${inconnues.length ? ` (${inconnues.length} clé(s) inconnue(s))` : ""}` },
      { status: 400 }
    );
  }

  // Un upsert par droit, dans une transaction : la matrice est enregistrée
  // entièrement ou pas du tout.
  await prisma.$transaction(
    ops.map((o) =>
      prisma.droitUtilisateur.upsert({
        where: { login_fonctionId: { login, fonctionId: o.fonctionId } },
        create: { login, fonctionId: o.fonctionId, valeur: o.valeur },
        update: { valeur: o.valeur },
      })
    )
  );

  const accordes = ops.filter((o) => o.valeur).length;
  return NextResponse.json({
    ok: true,
    enregistres: ops.length,
    inconnues,
    message: `${ops.length} droit(s) enregistré(s) pour ${login} — ${accordes} accordé(s)`
      + (user.role === "ADMIN" ? " (compte ADMIN : tous les droits restent accordés par son rôle)" : ""),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const login = s(req.nextUrl.searchParams.get("login"));
  if (!login) return NextResponse.json({ error: "login requis" }, { status: 400 });

  const res = await prisma.droitUtilisateur.deleteMany({ where: { login } });
  return NextResponse.json({
    ok: true,
    message: `${res.count} droit(s) supprimé(s) — ${login} revient aux valeurs par défaut`,
  });
}
