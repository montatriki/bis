import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { round3 } from "@/lib/vente-stats";
import { prepareDocument } from "@/lib/document-numbering";
import { docTypeRule } from "@/lib/document-types";

// Bons de sortie / transfert / retour — module « Gestion Tourner ».
//
// Comble `updateStockDepotByMvt` de l'ERP source : le stock global de l'article
// était suivi, mais **pas sa répartition par emplacement**.
//
//   Bon de sortie (BST)          dépôt → véhicule   (sortie du stock global)
//   Bon de transfert (BTR)       dépôt → dépôt      (stock global inchangé)
//   Transfert véhicules (BTV)    véhicule → véhicule (stock global inchangé)
//   Bon de retour (BRT)          véhicule → dépôt    (entrée en stock global)

export type LigneMvt = {
  refArt: string;
  designation?: string | null;
  quantite: number;
};

export type MvtResult = {
  ok: boolean;
  message: string;
  refDoc?: string;
  lignes?: number;
  alertes?: string[];
};

/** Types gérés par ce module, avec leur sens de déplacement. */
export const TYPES_MVT = {
  BST: { label: "Bon de sortie", source: "depot", destination: "vehicule" },
  BTR: { label: "Bon de transfert", source: "depot", destination: "depot" },
  BTV: { label: "Transfert entre véhicules", source: "vehicule", destination: "vehicule" },
  BRT: { label: "Bon de retour", source: "vehicule", destination: "depot" },
} as const;

export type TypeMvt = keyof typeof TYPES_MVT;

export const estTypeMvt = (t: string): t is TypeMvt =>
  Object.prototype.hasOwnProperty.call(TYPES_MVT, t);

/** Quantité disponible d'un article à un emplacement donné. */
export async function disponible(refArt: string, emplacement: string): Promise<number> {
  const row = await prisma.stockDepot.findUnique({
    where: { refArt_emplacement: { refArt, emplacement } },
  });
  return row?.quantite ?? 0;
}

/**
 * Crée un bon de mouvement et applique le déplacement.
 *
 * Le stock **par emplacement** bouge toujours ; le stock **global** de l'article
 * ne bouge que pour une sortie (BST) ou un retour (BRT) — un transfert interne
 * ne crée ni ne détruit de marchandise.
 */
export async function creerMouvement(
  typeDoc: string,
  source: string | null,
  destination: string | null,
  lignes: LigneMvt[],
  utilisateur?: string
): Promise<MvtResult> {
  const type = String(typeDoc).toUpperCase();
  if (!estTypeMvt(type)) {
    return { ok: false, message: `Type de mouvement inconnu : ${typeDoc}` };
  }

  const cfg = TYPES_MVT[type];
  const besoinSource = type !== "BRT" || Boolean(source);
  if (besoinSource && !source) {
    return { ok: false, message: `${cfg.label} : emplacement source requis` };
  }
  if (!destination) {
    return { ok: false, message: `${cfg.label} : emplacement destination requis` };
  }
  if (source && source === destination) {
    return { ok: false, message: "Source et destination doivent être différentes" };
  }

  const valides = lignes
    .map((l) => ({
      refArt: String(l.refArt ?? "").trim(),
      designation: l.designation ?? null,
      quantite: round3(Number(l.quantite) || 0),
    }))
    .filter((l) => l.refArt && l.quantite > 0);

  if (valides.length === 0) {
    return { ok: false, message: "Aucune ligne valide (référence et quantité > 0)" };
  }

  // Contrôle de disponibilité à la source : on refuse de créer un stock négatif.
  const alertes: string[] = [];
  if (source) {
    const stocks = await prisma.stockDepot.findMany({
      where: { emplacement: source, refArt: { in: valides.map((l) => l.refArt) } },
    });
    const dispo = new Map(stocks.map((s) => [s.refArt, s.quantite]));
    const insuffisants = valides.filter((l) => (dispo.get(l.refArt) ?? 0) < l.quantite);
    if (insuffisants.length > 0) {
      return {
        ok: false,
        message:
          `Stock insuffisant à « ${source} » : ` +
          insuffisants
            .map((l) => `${l.refArt} (demandé ${l.quantite}, dispo ${dispo.get(l.refArt) ?? 0})`)
            .join(", "),
      };
    }
  }

  const prepared = await prepareDocument(type);
  const rule = docTypeRule(type);
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // En-tête du bon.
  ops.push(
    prisma.erpDocument.create({
      data: {
        refDoc: prepared.refDoc,
        caraDoc: prepared.caraDoc,
        numSeq: prepared.numSeq,
        nature: "Achat",
        typeDoc: type,
        libDoc: `${cfg.label} ${source ?? "—"} → ${destination}`,
        dateDoc: new Date(),
        etat: "Validé",
        valide: true,
        dateValide: new Date(),
        utilisateur: utilisateur ?? null,
      },
    })
  );

  for (const l of valides) {
    // Journal du mouvement.
    ops.push(
      prisma.mouvementDepot.create({
        data: {
          refDoc: prepared.refDoc,
          typeDoc: type,
          refArt: l.refArt,
          designation: l.designation,
          quantite: l.quantite,
          source,
          destination,
          utilisateur: utilisateur ?? null,
        },
      })
    );

    // Décrément à la source.
    if (source) {
      ops.push(
        prisma.stockDepot.upsert({
          where: { refArt_emplacement: { refArt: l.refArt, emplacement: source } },
          create: { refArt: l.refArt, emplacement: source, quantite: round3(-l.quantite) },
          update: { quantite: { decrement: l.quantite } },
        })
      );
    }

    // Incrément à la destination.
    ops.push(
      prisma.stockDepot.upsert({
        where: { refArt_emplacement: { refArt: l.refArt, emplacement: destination } },
        create: { refArt: l.refArt, emplacement: destination, quantite: l.quantite },
        update: { quantite: { increment: l.quantite } },
      })
    );

    // Stock global : seuls BST (sortie) et BRT (retour) le modifient.
    const sgn = rule.tStock === "S" ? -1 : rule.tStock === "E" ? 1 : 0;
    if (sgn !== 0) {
      const art = await prisma.article.findUnique({ where: { refArt: l.refArt } });
      if (art) {
        ops.push(
          prisma.article.update({
            where: { refArt: l.refArt },
            data: {
              enStock: round3(art.enStock + sgn * l.quantite),
              ...(sgn > 0
                ? { entrer: round3(art.entrer + l.quantite) }
                : { sortie: round3(art.sortie + l.quantite) }),
            },
          })
        );
      } else {
        alertes.push(`${l.refArt} : article hors référentiel, stock global non ajusté`);
      }
    }
  }

  await prisma.$transaction(ops);

  return {
    ok: true,
    message: `${cfg.label} ${prepared.refDoc} créé — ${valides.length} ligne(s)`,
    refDoc: prepared.refDoc,
    lignes: valides.length,
    ...(alertes.length ? { alertes } : {}),
  };
}

/** État du stock par emplacement, pour l'écran de consultation. */
export async function etatParEmplacement(emplacement?: string) {
  const rows = await prisma.stockDepot.findMany({
    where: {
      ...(emplacement ? { emplacement } : {}),
      // On masque les lignes soldées pour ne pas noyer l'écran.
      NOT: { quantite: 0 },
    },
    orderBy: [{ emplacement: "asc" }, { refArt: "asc" }],
    take: 500,
  });

  const refs = [...new Set(rows.map((r) => r.refArt))];
  const articles = refs.length
    ? await prisma.article.findMany({
        where: { refArt: { in: refs } },
        select: { refArt: true, designation: true, puAchat: true },
      })
    : [];
  const infos = new Map(articles.map((a) => [a.refArt, a]));

  return rows.map((r) => ({
    ...r,
    designation: infos.get(r.refArt)?.designation ?? r.refArt,
    // Valorisation au coût moyen **de l'emplacement** : le camion et le dépôt
    // n'ont pas forcément été approvisionnés au même prix.
    valeur: round3(r.quantite * (r.pmp || infos.get(r.refArt)?.puAchat || 0)),
  }));
}
