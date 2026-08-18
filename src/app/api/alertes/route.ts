import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { round3 } from "@/lib/vente-stats";

// Alertes d'exploitation — dérivées de l'état réel de la base.
// Remplace les alertes et journaux fictifs du tableau de bord admin.
//
// GET /api/alertes

export async function GET() {
  const auth = await requireSession(["ADMIN", "MANAGER", "COMMERCIAL"]);
  if (!auth.ok) return auth.res;

  const [ruptures, sousMini, docsNonValides, gros, echusJ] = await Promise.all([
    prisma.article.findMany({
      where: { archiver: 0, vendable: 1, enStock: { lte: 0 } },
      select: { refArt: true, designation: true, enStock: true, stMin: true },
      take: 5,
    }),
    prisma.article.findMany({
      where: { archiver: 0, vendable: 1, enStock: { gt: 0 } },
      select: { refArt: true, designation: true, enStock: true, stMin: true },
      take: 200,
    }),
    prisma.erpDocument.count({ where: { nature: "Vente", valide: false } }),
    // Clients dont la créance dépasse nettement le plafond usuel.
    prisma.partner.findMany({
      where: { nature: "C", soldeFin: { gt: 5000 } },
      orderBy: { soldeFin: "desc" },
      select: { id: true, raisonSocial: true, soldeFin: true },
      take: 5,
    }),
    // Documents non soldés les plus anciens.
    prisma.erpDocument.findMany({
      where: { nature: "Vente", soldeDoc: { gt: 0 } },
      orderBy: { dateDoc: "asc" },
      select: { refDoc: true, raisonSocial: true, soldeDoc: true, dateDoc: true },
      take: 5,
    }),
  ]);

  const alertes: {
    type: string; niveau: "critique" | "avertissement" | "info";
    message: string; detail?: string;
  }[] = [];

  for (const a of ruptures) {
    alertes.push({
      type: "STOCK",
      niveau: "critique",
      message: `${a.designation} — rupture de stock`,
      detail: `Réf. ${a.refArt} · stock ${a.enStock}${a.stMin ? ` (min ${a.stMin})` : ""}`,
    });
  }

  const bas = sousMini.filter((a) => a.stMin > 0 && a.enStock <= a.stMin);
  for (const a of bas.slice(0, 3)) {
    alertes.push({
      type: "STOCK",
      niveau: "avertissement",
      message: `${a.designation} — sous le stock minimum`,
      detail: `Réf. ${a.refArt} · stock ${a.enStock} / min ${a.stMin}`,
    });
  }

  for (const c of gros) {
    alertes.push({
      type: "FINANCE",
      niveau: "avertissement",
      message: `${c.raisonSocial || `Client ${c.id}`} — créance élevée`,
      detail: `${round3(c.soldeFin)} TND dus`,
    });
  }

  const now = Date.now();
  for (const d of echusJ) {
    const jours = d.dateDoc ? Math.floor((now - d.dateDoc.getTime()) / 86400000) : 0;
    if (jours < 90) continue;
    alertes.push({
      type: "RECOUVREMENT",
      niveau: "critique",
      message: `${d.refDoc} impayé depuis ${jours} jours`,
      detail: `${d.raisonSocial || "—"} · ${round3(d.soldeDoc)} TND`,
    });
  }

  if (docsNonValides > 0) {
    alertes.push({
      type: "VALIDATION",
      niveau: "info",
      message: `${docsNonValides} document(s) en attente de validation`,
      detail: "Stock et soldes non encore impactés",
    });
  }

  const ordre = { critique: 0, avertissement: 1, info: 2 } as const;
  alertes.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);

  return NextResponse.json({
    alertes,
    total: alertes.length,
    critiques: alertes.filter((a) => a.niveau === "critique").length,
    compteurs: {
      ruptures: await prisma.article.count({ where: { archiver: 0, vendable: 1, enStock: { lte: 0 } } }),
      sousMini: bas.length,
      docsNonValides,
    },
  });
}
