import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TYPES_CA, signeCA, periode, round3 } from "@/lib/vente-stats";

// Rapports de vente — reprend les 5 axes de `vente-module/rapports` dans l'ERP source :
//   article · client · commercial · gouvernorat · famille client
//
// GET /api/rapports-vente?axe=article|client|commercial|gouvernorat|famille&du=&au=
//
// Règle de calcul : CA = Σ(BL, TIC, FC) − Σ(BR, AV), comme dans A.

type Ligne = { cle: string; libelle: string; qte: number; ht: number; ttc: number; docs: number };

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const sp = req.nextUrl.searchParams;
  const axe = sp.get("axe") ?? "article";
  const { debut, fin } = periode(sp.get("du"), sp.get("au"));

  const where = {
    nature: "Vente",
    typeDoc: { in: [...TYPES_CA] },
    dateDoc: { gte: debut, lte: fin },
  };

  // Balance âgée des créances : ancienneté du dernier document non soldé.
  if (axe === "creances") {
    const impayes = await prisma.erpDocument.findMany({
      where: { nature: "Vente", soldeDoc: { gt: 0 } },
      select: { refDoc: true, dateDoc: true, soldeDoc: true, raisonSocial: true, codeCli: true },
    });

    const TRANCHES = [
      { cle: "0-30", libelle: "Moins de 30 jours", min: 0, max: 30 },
      { cle: "30-60", libelle: "30 à 60 jours", min: 30, max: 60 },
      { cle: "60-90", libelle: "60 à 90 jours", min: 60, max: 90 },
      { cle: "90+", libelle: "Plus de 90 jours", min: 90, max: Infinity },
    ];
    const now = Date.now();
    const map = new Map<string, Ligne>(
      TRANCHES.map((t) => [t.cle, { cle: t.cle, libelle: t.libelle, qte: 0, ht: 0, ttc: 0, docs: 0 }])
    );

    for (const d of impayes) {
      const jours = d.dateDoc ? Math.floor((now - d.dateDoc.getTime()) / 86400000) : 0;
      const t = TRANCHES.find((x) => jours >= x.min && jours < x.max) ?? TRANCHES[TRANCHES.length - 1];
      const cur = map.get(t.cle)!;
      cur.ttc = round3(cur.ttc + d.soldeDoc);
      cur.ht = cur.ttc;
      cur.docs += 1;
    }

    const rows = [...map.values()];
    return NextResponse.json({ axe, rows, total: rows.length, ...totaux(rows) });
  }

  // Clients sans achat récent, par ancienneté du dernier document.
  if (axe === "inactifs") {
    const docs = await prisma.erpDocument.findMany({
      where: { nature: "Vente", typeDoc: { in: [...TYPES_CA] }, codeCli: { not: null } },
      select: { codeCli: true, raisonSocial: true, dateDoc: true, ttcNet: true },
      orderBy: { dateDoc: "desc" },
    });

    const dernier = new Map<number, { nom: string; date: Date | null; ca: number; docs: number }>();
    for (const d of docs) {
      if (d.codeCli == null) continue;
      const cur = dernier.get(d.codeCli);
      if (!cur) {
        dernier.set(d.codeCli, {
          nom: d.raisonSocial || `Client ${d.codeCli}`,
          date: d.dateDoc,
          ca: d.ttcNet,
          docs: 1,
        });
      } else {
        cur.ca = round3(cur.ca + d.ttcNet);
        cur.docs += 1;
        if (d.dateDoc && (!cur.date || d.dateDoc > cur.date)) cur.date = d.dateDoc;
      }
    }

    const now = Date.now();
    const rows: Ligne[] = [...dernier.entries()]
      .map(([code, v]) => ({
        cle: String(code),
        libelle: v.nom,
        // `qte` porte ici le nombre de jours depuis le dernier achat.
        qte: v.date ? Math.floor((now - v.date.getTime()) / 86400000) : 9999,
        ht: v.ca,
        ttc: v.ca,
        docs: v.docs,
      }))
      .filter((r) => r.qte >= 30)
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 100);

    return NextResponse.json({ axe, rows, total: rows.length, ...totaux(rows) });
  }

  // Axe article : passe par les lignes de document.
  if (axe === "article") {
    const lignes = await prisma.erpDocumentLine.findMany({
      where: { document: where },
      select: {
        refArt: true, designation: true, qte: true, thtNet: true, ttcNet: true,
        document: { select: { typeDoc: true } },
      },
    });

    const map = new Map<string, Ligne>();
    for (const l of lignes) {
      const sgn = signeCA(l.document.typeDoc);
      if (sgn === 0) continue;
      const cur = map.get(l.refArt) ?? { cle: l.refArt, libelle: l.designation, qte: 0, ht: 0, ttc: 0, docs: 0 };
      cur.qte = round3(cur.qte + sgn * l.qte);
      cur.ht = round3(cur.ht + sgn * l.thtNet);
      cur.ttc = round3(cur.ttc + sgn * l.ttcNet);
      cur.docs += 1;
      map.set(l.refArt, cur);
    }

    const rows = [...map.values()].sort((a, b) => b.ttc - a.ttc);
    return NextResponse.json({ axe, rows, total: rows.length, ...totaux(rows), sansLignes: lignes.length === 0 });
  }

  // Autres axes : agrégation au niveau des entêtes.
  const docs = await prisma.erpDocument.findMany({
    where,
    select: { typeDoc: true, thtNet: true, ttcNet: true, codeCli: true, raisonSocial: true, commercial: true, utilisateur: true },
  });

  // Le gouvernorat et la famille vivent sur le tiers, pas sur le document.
  let infoClient = new Map<number, { ville: string | null; gouvernorat: string | null; famille: string | null }>();
  if (axe === "gouvernorat" || axe === "famille") {
    const ids = [...new Set(docs.map((d) => d.codeCli).filter((c): c is number => c != null))];
    const partners = await prisma.partner.findMany({
      where: { id: { in: ids } },
      select: { id: true, ville: true, gouvernorat: true, famille: true },
    });
    infoClient = new Map(partners.map((p) => [p.id, { ville: p.ville, gouvernorat: p.gouvernorat, famille: p.famille }]));
  }

  const map = new Map<string, Ligne>();
  for (const d of docs) {
    const sgn = signeCA(d.typeDoc);
    if (sgn === 0) continue;

    let cle: string;
    let libelle: string;

    if (axe === "client") {
      cle = String(d.codeCli ?? d.raisonSocial ?? "?");
      libelle = d.raisonSocial || `Client ${d.codeCli ?? "?"}`;
    } else if (axe === "commercial") {
      // `commercial` est vide sur les documents importés : on retombe sur
      // `utilisateur`, qui porte réellement l'auteur de la saisie.
      const v = d.commercial?.trim() || d.utilisateur?.trim() || "";
      cle = v || "—";
      libelle = v || "Non affecté";
    } else if (axe === "gouvernorat") {
      const g = d.codeCli != null ? infoClient.get(d.codeCli)?.gouvernorat : null;
      cle = g || "—";
      libelle = g || "Non renseigné";
    } else if (axe === "famille") {
      const f = d.codeCli != null ? infoClient.get(d.codeCli)?.famille : null;
      cle = f || "—";
      libelle = f || "Non renseignée";
    } else {
      return NextResponse.json({ error: "axe inconnu" }, { status: 400 });
    }

    const cur = map.get(cle) ?? { cle, libelle, qte: 0, ht: 0, ttc: 0, docs: 0 };
    cur.ht = round3(cur.ht + sgn * d.thtNet);
    cur.ttc = round3(cur.ttc + sgn * d.ttcNet);
    cur.docs += 1;
    map.set(cle, cur);
  }

  const rows = [...map.values()].sort((a, b) => b.ttc - a.ttc);
  return NextResponse.json({ axe, rows, total: rows.length, ...totaux(rows) });
}

function totaux(rows: Ligne[]) {
  return {
    totalHT: round3(rows.reduce((s, r) => s + r.ht, 0)),
    totalTTC: round3(rows.reduce((s, r) => s + r.ttc, 0)),
    totalDocs: rows.reduce((s, r) => s + r.docs, 0),
  };
}
