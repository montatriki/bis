import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Suivi des numéros de série — reprend `entete_vente_articles_serie` et
// `entete_achat_articles_serie` de l'ERP source (deux tables, une seule ici :
// le sens du document distingue l'entrée de la sortie).
//
// L'intérêt du module est la **traçabilité** : pour un numéro donné, savoir de
// quel achat il vient et à quel client il est parti. C'est ce que la vue
// `tracabilite` reconstitue.
//
// GET    /api/series?vue=liste|tracabilite|stats|non-vendus
// POST   /api/series { numSerie, refArt, sens, refDoc, codeCli }
// DELETE /api/series?id=...

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};

const SENS = ["Achat", "Vente"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "liste";

  if (vue === "liste") {
    const q = s(sp.get("q"));
    const sens = s(sp.get("sens"));
    const refArt = s(sp.get("refArt"));

    const rows = await prisma.numeroSerie.findMany({
      where: {
        ...(sens && sens !== "Tous" ? { sens } : {}),
        ...(refArt ? { refArt } : {}),
        ...(q
          ? {
              OR: [
                { numSerie: { contains: q, mode: "insensitive" } },
                { refArt: { contains: q, mode: "insensitive" } },
                { refDoc: { contains: q, mode: "insensitive" } },
                { tiersNom: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
    return NextResponse.json({ rows, total: rows.length, sens: SENS });
  }

  if (vue === "tracabilite") {
    // Cycle de vie d'un numéro : achat puis vente(s). Un numéro vendu et
    // retourné réapparaît — l'historique complet est renvoyé, dans l'ordre.
    const numSerie = s(sp.get("numSerie"));
    if (!numSerie) return NextResponse.json({ error: "numSerie requis" }, { status: 400 });

    const rows = await prisma.numeroSerie.findMany({
      where: { numSerie },
      orderBy: [{ dateDoc: "asc" }, { id: "asc" }],
    });
    if (rows.length === 0) {
      return NextResponse.json({ rows: [], numSerie, etat: "Inconnu", article: null });
    }

    const refs = [...new Set(rows.map((r) => r.refDoc).filter((x): x is string => Boolean(x)))];
    const docs = refs.length
      ? await prisma.erpDocument.findMany({
          where: { refDoc: { in: refs } },
          select: { refDoc: true, typeDoc: true, dateDoc: true, raisonSocial: true, etat: true, valide: true },
        })
      : [];
    const parRef = new Map(docs.map((d) => [d.refDoc, d]));

    // Dernier mouvement : une vente qui n'a pas été annulée signifie « vendu ».
    const dernier = rows[rows.length - 1];
    const etat = dernier.sens === "Vente" ? "Vendu" : "En stock";

    const article = await prisma.article.findUnique({
      where: { refArt: rows[0].refArt },
      select: { refArt: true, designation: true, unite: true, enStock: true },
    });

    return NextResponse.json({
      numSerie,
      etat,
      article,
      rows: rows.map((r) => ({ ...r, document: r.refDoc ? parRef.get(r.refDoc) ?? null : null })),
      total: rows.length,
    });
  }

  if (vue === "non-vendus") {
    // Numéros entrés en stock et jamais sortis — l'inventaire par numéro.
    const achats = await prisma.numeroSerie.findMany({
      where: { sens: "Achat" },
      select: { numSerie: true, refArt: true, desArt: true, refDoc: true, dateDoc: true },
      orderBy: { dateDoc: "desc" },
      take: 2000,
    });
    const vendus = new Set(
      (await prisma.numeroSerie.findMany({ where: { sens: "Vente" }, select: { numSerie: true } }))
        .map((v) => v.numSerie)
    );
    const rows = achats.filter((a) => !vendus.has(a.numSerie));
    return NextResponse.json({ rows: rows.slice(0, 500), total: rows.length });
  }

  // stats
  const [total, parSens, parArticle] = await Promise.all([
    prisma.numeroSerie.count(),
    prisma.numeroSerie.groupBy({ by: ["sens"], _count: { _all: true } }),
    prisma.numeroSerie.groupBy({
      by: ["refArt"],
      _count: { _all: true },
      orderBy: { _count: { refArt: "desc" } },
      take: 10,
    }),
  ]);
  const distincts = await prisma.numeroSerie.findMany({ select: { numSerie: true }, distinct: ["numSerie"] });

  return NextResponse.json({
    total,
    numerosDistincts: distincts.length,
    parSens: parSens.map((p) => ({ sens: p.sens, nb: p._count._all })),
    topArticles: parArticle.map((p) => ({ refArt: p.refArt, nb: p._count._all })),
  });
}

export async function POST(req: NextRequest) {
  // Cohérence avec le GET et le DELETE de cette même route : un commercial ne
  // pouvait ni lire ni supprimer ce module, mais pouvait y créer des numéros.
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));

  // Saisie en lot : un article livré en 20 exemplaires a 20 numéros.
  const brut: unknown[] = Array.isArray(body.numeros)
    ? body.numeros
    : [{ numSerie: body.numSerie, refArt: body.refArt }];

  const refArtDefaut = s(body.refArt);
  const sens = SENS.includes(s(body.sens) as typeof SENS[number]) ? s(body.sens) : "Achat";
  const refDoc = s(body.refDoc) || null;

  // Le document rattaché donne le tiers et la date : on les relit plutôt que de
  // faire confiance au formulaire.
  let codeCli = int(body.codeCli);
  let tiersNom = s(body.tiersNom) || null;
  let dateDoc = body.dateDoc ? new Date(String(body.dateDoc)) : null;

  if (refDoc) {
    const doc = await prisma.erpDocument.findUnique({
      where: { refDoc },
      select: { codeCli: true, raisonSocial: true, dateDoc: true, typeDoc: true },
    });
    if (!doc) return NextResponse.json({ error: `Document ${refDoc} inconnu` }, { status: 400 });
    codeCli = doc.codeCli ?? codeCli;
    tiersNom = doc.raisonSocial ?? tiersNom;
    dateDoc = doc.dateDoc ?? dateDoc;
  }

  const lignes = brut
    .map((n) => {
      const o = (typeof n === "object" && n !== null ? n : {}) as Record<string, unknown>;
      return {
        numSerie: s(typeof n === "string" ? n : o.numSerie),
        refArt: s(o.refArt) || refArtDefaut,
      };
    })
    .filter((l) => l.numSerie && l.refArt);

  if (lignes.length === 0) {
    return NextResponse.json({ error: "Numéro de série et article requis" }, { status: 400 });
  }

  // Doublon d'entrée : deux achats du même numéro sur le même article sont
  // une erreur de saisie (un numéro de série est unique par définition).
  const alertes: string[] = [];
  const aCreer: typeof lignes = [];
  for (const l of lignes) {
    if (sens === "Achat") {
      const deja = await prisma.numeroSerie.findFirst({
        where: { numSerie: l.numSerie, refArt: l.refArt, sens: "Achat" },
      });
      if (deja) {
        alertes.push(`${l.numSerie} : déjà enregistré en entrée — ignoré`);
        continue;
      }
    } else {
      // Vente d'un numéro jamais entré en stock : accepté mais signalé.
      const entre = await prisma.numeroSerie.findFirst({
        where: { numSerie: l.numSerie, sens: "Achat" },
      });
      if (!entre) alertes.push(`${l.numSerie} : vendu sans entrée en stock connue`);
    }
    aCreer.push(l);
  }

  if (aCreer.length === 0) {
    return NextResponse.json({ error: alertes.join("\n") || "Rien à enregistrer" }, { status: 409 });
  }

  const arts = await prisma.article.findMany({
    where: { refArt: { in: [...new Set(aCreer.map((l) => l.refArt))] } },
    select: { refArt: true, designation: true },
  });
  const parArt = new Map(arts.map((a) => [a.refArt, a.designation]));

  const res = await prisma.numeroSerie.createMany({
    data: aCreer.map((l) => ({
      numSerie: l.numSerie,
      refArt: l.refArt,
      desArt: parArt.get(l.refArt) ?? null,
      sens, refDoc, codeCli, tiersNom, dateDoc,
    })),
  });

  return NextResponse.json({
    ok: true,
    creees: res.count,
    alertes,
    message: `${res.count} numéro(s) enregistré(s) en ${sens.toLowerCase()}`,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const id = int(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.numeroSerie.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Numéro de série supprimé" });
}
