import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Référentiels articles — familles, sous-familles, unités, catalogue.
//
// Comble le constat du §10 : `Article.famille` et `Article.sousFamille` portent
// des **codes numériques sans table de libellés** (523 articles avec famille=2,
// 3, 11…). Les écrans affichaient donc « 2 » au lieu du nom de la famille, et
// le filtre par famille avait été remplacé par un filtre disponibilité faute
// de libellés exploitables.
//
// GET    /api/referentiels-articles?vue=familles|sous-familles|unites|catalogue|tout|orphelins
// POST   /api/referentiels-articles { vue, code, libelle, ... }
// POST   /api/referentiels-articles { vue: "init" }  → crée les entrées manquantes
// PUT    /api/referentiels-articles { vue, code, libelle }
// DELETE /api/referentiels-articles?vue=…&code=…

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const int = (v: unknown) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : null;
};
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const vue = req.nextUrl.searchParams.get("vue") ?? "tout";

  if (vue === "familles" || vue === "tout") {
    const familles = await prisma.familleArticle.findMany({ orderBy: { code: "asc" } });
    if (vue === "familles") {
      // Nombre d'articles par famille : une famille vide se repère tout de suite.
      const comptes = await prisma.article.groupBy({ by: ["famille"], _count: { _all: true } });
      const parCode = new Map(comptes.map((c) => [c.famille, c._count._all]));
      return NextResponse.json({
        rows: familles.map((f) => ({ ...f, nbArticles: parCode.get(f.code) ?? 0 })),
        total: familles.length,
      });
    }

    const [sousFamilles, unites, catalogue] = await Promise.all([
      prisma.sousFamilleArticle.findMany({ orderBy: { code: "asc" } }),
      prisma.uniteArticle.findMany({ orderBy: { unite: "asc" } }),
      prisma.catalogueArticle.findMany({ orderBy: { code: "asc" } }),
    ]);
    return NextResponse.json({ familles, sousFamilles, unites, catalogue });
  }

  if (vue === "sous-familles") {
    const codeFamille = int(req.nextUrl.searchParams.get("famille"));
    const rows = await prisma.sousFamilleArticle.findMany({
      where: codeFamille != null ? { codeFamille } : {},
      orderBy: { code: "asc" },
    });
    const comptes = await prisma.article.groupBy({ by: ["sousFamille"], _count: { _all: true } });
    const parCode = new Map(comptes.map((c) => [c.sousFamille, c._count._all]));
    return NextResponse.json({
      rows: rows.map((f) => ({ ...f, nbArticles: parCode.get(f.code) ?? 0 })),
      total: rows.length,
    });
  }

  if (vue === "unites") {
    const rows = await prisma.uniteArticle.findMany({ orderBy: { unite: "asc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  if (vue === "catalogue") {
    const rows = await prisma.catalogueArticle.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ rows, total: rows.length });
  }

  // Codes présents sur les articles mais absents des référentiels : c'est
  // exactement ce qui produit l'affichage « 2 » au lieu d'un libellé.
  if (vue === "orphelins") {
    const [fam, sfam, uni] = await Promise.all([
      prisma.article.groupBy({ by: ["famille"], _count: { _all: true } }),
      prisma.article.groupBy({ by: ["sousFamille"], _count: { _all: true } }),
      prisma.article.groupBy({ by: ["unite"], _count: { _all: true } }),
    ]);
    const [famRef, sfamRef, uniRef] = await Promise.all([
      prisma.familleArticle.findMany({ select: { code: true } }),
      prisma.sousFamilleArticle.findMany({ select: { code: true } }),
      prisma.uniteArticle.findMany({ select: { unite: true } }),
    ]);
    const famCodes = new Set(famRef.map((f) => f.code));
    const sfamCodes = new Set(sfamRef.map((f) => f.code));
    const uniCodes = new Set(uniRef.map((u) => u.unite));

    return NextResponse.json({
      familles: fam
        .filter((f) => f.famille != null && !famCodes.has(f.famille))
        .map((f) => ({ code: f.famille, nbArticles: f._count._all })),
      sousFamilles: sfam
        .filter((f) => f.sousFamille != null && !sfamCodes.has(f.sousFamille))
        .map((f) => ({ code: f.sousFamille, nbArticles: f._count._all })),
      unites: uni
        .filter((u) => u.unite && !uniCodes.has(u.unite))
        .map((u) => ({ unite: u.unite, nbArticles: u._count._all })),
    });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);

  // Crée une entrée pour chaque code réellement utilisé par les articles.
  // Les libellés sont provisoires (« Famille 2 ») : l'utilisateur les renomme
  // ensuite. Inventer un nom métier serait pire que d'afficher le code.
  if (vue === "init") {
    const [fam, sfam, uni] = await Promise.all([
      prisma.article.groupBy({ by: ["famille"], _count: { _all: true } }),
      prisma.article.groupBy({ by: ["sousFamille"], _count: { _all: true } }),
      prisma.article.groupBy({ by: ["unite"], _count: { _all: true } }),
    ]);
    const [famRef, sfamRef, uniRef] = await Promise.all([
      prisma.familleArticle.findMany({ select: { code: true } }),
      prisma.sousFamilleArticle.findMany({ select: { code: true } }),
      prisma.uniteArticle.findMany({ select: { unite: true } }),
    ]);
    const famCodes = new Set(famRef.map((f) => f.code));
    const sfamCodes = new Set(sfamRef.map((f) => f.code));
    const uniCodes = new Set(uniRef.map((u) => u.unite));

    const nouvellesFam = fam
      .filter((f) => f.famille != null && !famCodes.has(f.famille))
      .map((f) => ({ code: f.famille!, libelle: `Famille ${f.famille}` }));
    const nouvellesSFam = sfam
      .filter((f) => f.sousFamille != null && !sfamCodes.has(f.sousFamille))
      .map((f) => ({ code: f.sousFamille!, libelle: `Sous-famille ${f.sousFamille}` }));
    const nouvellesUni = uni
      .filter((u) => u.unite && !uniCodes.has(u.unite))
      .map((u) => ({ unite: u.unite! }));

    await prisma.$transaction([
      ...(nouvellesFam.length ? [prisma.familleArticle.createMany({ data: nouvellesFam, skipDuplicates: true })] : []),
      ...(nouvellesSFam.length ? [prisma.sousFamilleArticle.createMany({ data: nouvellesSFam, skipDuplicates: true })] : []),
      ...(nouvellesUni.length ? [prisma.uniteArticle.createMany({ data: nouvellesUni, skipDuplicates: true })] : []),
    ]);

    return NextResponse.json({
      ok: true,
      familles: nouvellesFam.length,
      sousFamilles: nouvellesSFam.length,
      unites: nouvellesUni.length,
      message:
        `${nouvellesFam.length} famille(s), ${nouvellesSFam.length} sous-famille(s) et ` +
        `${nouvellesUni.length} unité(s) créées depuis les codes utilisés — ` +
        `renommez-les avec vos libellés métier`,
    });
  }

  if (vue === "famille" || vue === "sous-famille" || vue === "catalogue") {
    const code = int(body.code);
    const libelle = s(body.libelle);
    if (code == null || !libelle) {
      return NextResponse.json({ error: "Code et libellé requis" }, { status: 400 });
    }

    if (vue === "famille") {
      const exist = await prisma.familleArticle.findUnique({ where: { code } });
      if (exist) return NextResponse.json({ error: `La famille ${code} existe déjà` }, { status: 409 });
      const row = await prisma.familleArticle.create({
        data: { code, libelle, charge: bool(body.charge), lettreCompta: s(body.lettreCompta) || null },
      });
      return NextResponse.json({ ok: true, row, message: `Famille ${code} créée` });
    }
    if (vue === "sous-famille") {
      const exist = await prisma.sousFamilleArticle.findUnique({ where: { code } });
      if (exist) return NextResponse.json({ error: `La sous-famille ${code} existe déjà` }, { status: 409 });
      const codeFamille = int(body.codeFamille);
      if (codeFamille != null) {
        const f = await prisma.familleArticle.findUnique({ where: { code: codeFamille } });
        if (!f) return NextResponse.json({ error: `Famille ${codeFamille} inconnue` }, { status: 400 });
      }
      const row = await prisma.sousFamilleArticle.create({
        data: { code, libelle, codeFamille, charge: bool(body.charge), lettreCompta: s(body.lettreCompta) || null },
      });
      return NextResponse.json({ ok: true, row, message: `Sous-famille ${code} créée` });
    }
    const exist = await prisma.catalogueArticle.findUnique({ where: { code } });
    if (exist) return NextResponse.json({ error: `Le catalogue ${code} existe déjà` }, { status: 409 });
    const row = await prisma.catalogueArticle.create({ data: { code, libelle } });
    return NextResponse.json({ ok: true, row, message: `Catalogue ${code} créé` });
  }

  if (vue === "unite") {
    const unite = s(body.unite);
    if (!unite) return NextResponse.json({ error: "Unité requise" }, { status: 400 });
    const exist = await prisma.uniteArticle.findUnique({ where: { unite } });
    if (exist) return NextResponse.json({ error: `L'unité ${unite} existe déjà` }, { status: 409 });
    const row = await prisma.uniteArticle.create({ data: { unite, libelle: s(body.libelle) || null } });
    return NextResponse.json({ ok: true, row, message: `Unité ${unite} créée` });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const vue = s(body.vue);
  const libelle = s(body.libelle);

  if (vue === "unite") {
    const unite = s(body.unite);
    if (!unite) return NextResponse.json({ error: "Unité requise" }, { status: 400 });
    const row = await prisma.uniteArticle.update({ where: { unite }, data: { libelle: libelle || null } });
    return NextResponse.json({ ok: true, row, message: "Unité modifiée" });
  }

  const code = int(body.code);
  if (code == null) return NextResponse.json({ error: "Code requis" }, { status: 400 });
  if (!libelle) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });

  if (vue === "famille") {
    const row = await prisma.familleArticle.update({
      where: { code },
      data: {
        libelle,
        ...(body.charge != null ? { charge: bool(body.charge) } : {}),
        ...(body.lettreCompta != null ? { lettreCompta: s(body.lettreCompta) || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Famille modifiée" });
  }
  if (vue === "sous-famille") {
    const row = await prisma.sousFamilleArticle.update({
      where: { code },
      data: {
        libelle,
        ...(body.codeFamille !== undefined ? { codeFamille: int(body.codeFamille) } : {}),
        ...(body.charge != null ? { charge: bool(body.charge) } : {}),
      },
    });
    return NextResponse.json({ ok: true, row, message: "Sous-famille modifiée" });
  }
  if (vue === "catalogue") {
    const row = await prisma.catalogueArticle.update({ where: { code }, data: { libelle } });
    return NextResponse.json({ ok: true, row, message: "Catalogue modifié" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const vue = s(sp.get("vue"));

  if (vue === "unite") {
    const unite = s(sp.get("unite"));
    if (!unite) return NextResponse.json({ error: "Unité requise" }, { status: 400 });
    const used = await prisma.article.count({ where: { unite } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Unité utilisée par ${used} article(s) — suppression refusée` },
        { status: 409 }
      );
    }
    await prisma.uniteArticle.delete({ where: { unite } });
    return NextResponse.json({ ok: true, message: "Unité supprimée" });
  }

  const code = int(sp.get("code"));
  if (code == null) return NextResponse.json({ error: "Code requis" }, { status: 400 });

  // Supprimer un référentiel utilisé rendrait les articles à nouveau orphelins.
  if (vue === "famille") {
    const used = await prisma.article.count({ where: { famille: code } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Famille utilisée par ${used} article(s) — suppression refusée` },
        { status: 409 }
      );
    }
    await prisma.familleArticle.delete({ where: { code } });
    return NextResponse.json({ ok: true, message: "Famille supprimée" });
  }
  if (vue === "sous-famille") {
    const used = await prisma.article.count({ where: { sousFamille: code } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Sous-famille utilisée par ${used} article(s) — suppression refusée` },
        { status: 409 }
      );
    }
    await prisma.sousFamilleArticle.delete({ where: { code } });
    return NextResponse.json({ ok: true, message: "Sous-famille supprimée" });
  }
  if (vue === "catalogue") {
    await prisma.catalogueArticle.delete({ where: { code } });
    return NextResponse.json({ ok: true, message: "Catalogue supprimé" });
  }

  return NextResponse.json({ error: `Vue inconnue : ${vue}` }, { status: 400 });
}
