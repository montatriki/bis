import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { docTypeRule, stockSign, soldeSign } from "@/lib/document-types";
import { round3 } from "@/lib/document-calc";
import { pmpApresEntree } from "@/lib/tarif-article";

// Validation / dévalidation d'un document ERP.
//
// Reproduit ce que fait `insertEntete` dans l'ERP source (document-vente.service.js) :
//   1. mouvement de stock article (entrer / sortie / en_stock) selon T_stock
//   2. mise à jour du solde du tiers (debit / credit / solde_fin) selon T_solde
//   3. recalcul du PMP à l'entrée
//   4. journal des mouvements pour traçabilité
//
// Différence assumée avec A : tout se fait dans UNE transaction, et le drapeau
// `valide` interdit d'appliquer deux fois les mêmes mouvements — l'ERP source
// n'a pas ce garde-fou et peut doubler le stock si l'enregistrement est rejoué.

export type ValidationResult = {
  ok: boolean;
  message: string;
  mouvements?: number;
  stockUpdates?: { refArt: string; avant: number; apres: number }[];
};

/**
 * Valide un document : applique stock + solde, puis marque `valide = true`.
 * Sans effet (et sans erreur) si le document est déjà validé.
 */
/**
 * Emplacement d'imputation quand le document ne nomme pas de véhicule : c'est le
 * dépôt depuis lequel la vente au bureau est servie (`Code_mag = 1` en production).
 */
const DEPOT_PAR_DEFAUT = "Dépôt principale";

export async function validerDocument(refDoc: string): Promise<ValidationResult> {
  const doc = await prisma.erpDocument.findUnique({
    where: { refDoc },
    include: { lignes: { orderBy: { ordre: "asc" } } },
  });
  if (!doc) return { ok: false, message: "Document introuvable" };
  if (doc.valide) return { ok: false, message: "Document déjà validé" };
  if (doc.lignes.length === 0)
    return { ok: false, message: "Impossible de valider un document sans lignes" };

  const rule = docTypeRule(doc.typeDoc);
  const sStock = stockSign(rule.tStock);
  const sSolde = soldeSign(rule.tSolde);

  // Regroupe les quantités par article (un article peut figurer sur plusieurs lignes).
  const parArticle = new Map<string, { qte: number; puHt: number }>();
  for (const l of doc.lignes) {
    const cur = parArticle.get(l.refArt) ?? { qte: 0, puHt: 0 };
    parArticle.set(l.refArt, { qte: cur.qte + l.qte, puHt: l.puHt });
  }

  const articles = await prisma.article.findMany({
    where: { refArt: { in: [...parArticle.keys()] } },
  });
  const byRef = new Map(articles.map((a) => [a.refArt, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const stockUpdates: { refArt: string; avant: number; apres: number }[] = [];

  // Emplacement d'où sort (ou où entre) la marchandise. Une vente en tournée
  // part du **stock du véhicule**, pas du dépôt : c'est ce que le commercial a
  // réellement chargé.
  //
  // Sans véhicule (saisie au bureau), le mouvement s'impute au dépôt principal :
  // sans cela `stock_depots` n'était jamais touché et une vente depuis le dépôt
  // laissait son stock inchangé — seul le compteur global bougeait, ce qui
  // creusait l'écart entre les deux.
  const emplacement = (doc.vehicule ?? "").trim() || DEPOT_PAR_DEFAUT;

  // Sortie de stock : on refuse de vendre à découvert. L'import compte déjà
  // 64 articles en stock négatif ; laisser passer aggraverait la valorisation
  // et masquerait une erreur de saisie sur le terrain.
  if (sStock < 0) {
    // Contrôle sur l'emplacement quand il est connu (stock camion), sinon sur
    // le stock global de l'article.
    // `Article.enStock` et la somme des emplacements divergent sur 161 articles
    // — un écart hérité de la production, où les deux compteurs ne sont pas
    // tenus ensemble (l'article peut afficher -5 131 quand le dépôt en porte
    // 8 228). Le stock par emplacement est le seul chiffre vérifiable, c'est
    // donc lui qui fait foi ; à défaut d'emplacement nommé, on somme les
    // emplacements de l'article plutôt que de lire le compteur global.
    const lignesStock = await prisma.stockDepot.findMany({
      where: {
        refArt: { in: [...parArticle.keys()] },
        ...(emplacement ? { emplacement } : {}),
      },
      select: { refArt: true, quantite: true },
    });
    const dispoEmplacement = new Map<string, number>();
    for (const r of lignesStock) {
      dispoEmplacement.set(r.refArt, (dispoEmplacement.get(r.refArt) ?? 0) + r.quantite);
    }

    const insuffisants = [...parArticle.entries()]
      .map(([refArt, { qte }]) => {
        const art = byRef.get(refArt);
        // Un article sans ligne de stock n'a jamais été mouvementé : on retombe
        // sur le compteur de l'article faute de mieux.
        const dispo = dispoEmplacement.has(refArt)
          ? dispoEmplacement.get(refArt)!
          : (art?.enStock ?? 0);
        return { refArt, qte, art, dispo };
      })
      .filter((x) => x.art && x.dispo < x.qte);

    if (insuffisants.length > 0) {
      const detail = insuffisants
        .map((x) => `${x.art?.designation || x.refArt} (demandé ${x.qte}, dispo ${x.dispo})`)
        .join(" ; ");
      return {
        ok: false,
        message: emplacement
          ? `Stock insuffisant dans « ${emplacement} » : ${detail}`
          : `Stock insuffisant : ${detail}`,
      };
    }
  }

  // État de l'emplacement avant mouvement : nécessaire pour recalculer son
  // coût moyen (le PMP dépend de la quantité et du coût déjà en place).
  const depotsAvant = new Map<string, { quantite: number; pmp: number }>();
  if (sStock !== 0 && emplacement) {
    const lignes = await prisma.stockDepot.findMany({
      where: { emplacement, refArt: { in: [...parArticle.keys()] } },
      select: { refArt: true, quantite: true, pmp: true },
    });
    for (const l of lignes) depotsAvant.set(l.refArt, { quantite: l.quantite, pmp: l.pmp });
  }

  if (sStock !== 0) {
    for (const [refArt, { qte, puHt }] of parArticle) {
      const art = byRef.get(refArt);
      if (!art) continue; // article hors référentiel : on ne bloque pas le document

      const avant = art.enStock;
      const apres = round3(avant + sStock * qte);

      // PMP recalculé uniquement à l'entrée, comme dans A (updateValeurStock).
      // Même moyenne pondérée que l'ERP source, factorisée dans `tarif-article`.
      const pmp = sStock > 0 ? pmpApresEntree(art.pmp, avant, qte, puHt) : art.pmp;

      ops.push(
        prisma.article.update({
          where: { refArt },
          data: {
            enStock: apres,
            ...(sStock > 0
              ? { entrer: round3(art.entrer + qte), pmp }
              : { sortie: round3(art.sortie + qte) }),
          },
        })
      );

      ops.push(
        prisma.erpStockMovement.create({
          data: {
            refDoc,
            refArt,
            sens: rule.tStock,
            qte,
            stockAvant: avant,
            stockApres: apres,
            puHt,
            typeDoc: doc.typeDoc,
            codeMag: doc.codeMag,
            motif: `Validation ${doc.typeDoc} ${refDoc}`,
          },
        })
      );

      // Stock de l'emplacement (camion du commercial) : c'est physiquement
      // de là que part la marchandise vendue en tournée. Sans ce mouvement,
      // le stock véhicule resterait figé alors que la caisse est faite.
      if (emplacement) {
        const ligneDepot = depotsAvant.get(refArt);
        // Le coût moyen de l'emplacement suit ses propres entrées : la
        // marchandise d'un camion peut avoir été achetée à un autre prix que
        // celle du dépôt. Une sortie consomme au coût moyen sans le modifier.
        const pmpDepot =
          sStock > 0
            ? pmpApresEntree(ligneDepot?.pmp ?? 0, ligneDepot?.quantite ?? 0, qte, puHt)
            : (ligneDepot?.pmp ?? 0);

        ops.push(
          prisma.stockDepot.upsert({
            where: { refArt_emplacement: { refArt, emplacement } },
            create: { refArt, emplacement, quantite: round3(sStock * qte), pmp: round3(pmpDepot) },
            update:
              sStock > 0
                ? { quantite: { increment: qte }, pmp: round3(pmpDepot) }
                : { quantite: { decrement: qte } },
          })
        );
      }

      stockUpdates.push({ refArt, avant, apres });
    }
  }

  // Solde du tiers : le TTC débite (facture) ou crédite (avoir) le compte client.
  if (sSolde !== 0 && doc.codeCli != null) {
    const partner = await prisma.partner.findUnique({ where: { id: doc.codeCli } });
    if (partner) {
      const montant = round3(doc.ttcNet);
      ops.push(
        prisma.partner.update({
          where: { id: doc.codeCli },
          data:
            sSolde > 0
              ? { debit: round3(partner.debit + montant), soldeFin: round3(partner.soldeFin + montant) }
              : { credit: round3(partner.credit + montant), soldeFin: round3(partner.soldeFin - montant) },
        })
      );
    }
  }

  ops.push(
    prisma.erpDocument.update({
      where: { refDoc },
      data: { valide: true, dateValide: new Date(), etat: "Validé" },
    })
  );

  await prisma.$transaction(ops);

  return {
    ok: true,
    message:
      sStock === 0 && sSolde === 0
        ? `Document validé (type ${rule.label} : sans effet stock ni solde)`
        : `Document validé — ${stockUpdates.length} article(s) mouvementé(s)`,
    mouvements: stockUpdates.length,
    stockUpdates,
  };
}

/**
 * Dévalide un document : applique les mouvements inverses et remet `valide = false`.
 * Le PMP n'est pas restauré (comme dans A, c'est une moyenne historique).
 */
export async function devaliderDocument(refDoc: string): Promise<ValidationResult> {
  const doc = await prisma.erpDocument.findUnique({
    where: { refDoc },
    include: { lignes: true },
  });
  if (!doc) return { ok: false, message: "Document introuvable" };
  if (!doc.valide) return { ok: false, message: "Document non validé" };

  const rule = docTypeRule(doc.typeDoc);
  const sStock = stockSign(rule.tStock);
  const sSolde = soldeSign(rule.tSolde);

  const parArticle = new Map<string, number>();
  for (const l of doc.lignes) parArticle.set(l.refArt, (parArticle.get(l.refArt) ?? 0) + l.qte);

  const articles = await prisma.article.findMany({
    where: { refArt: { in: [...parArticle.keys()] } },
  });
  const byRef = new Map(articles.map((a) => [a.refArt, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  // Même règle qu'à la validation : sans véhicule, le mouvement a été imputé au
  // dépôt principal, c'est donc là qu'il faut le reprendre.
  const emplacement = (doc.vehicule ?? "").trim() || DEPOT_PAR_DEFAUT;

  if (sStock !== 0) {
    for (const [refArt, qte] of parArticle) {
      const art = byRef.get(refArt);
      if (!art) continue;
      ops.push(
        prisma.article.update({
          where: { refArt },
          data: {
            enStock: round3(art.enStock - sStock * qte),
            ...(sStock > 0
              ? { entrer: round3(art.entrer - qte) }
              : { sortie: round3(art.sortie - qte) }),
          },
        })
      );

      // Le stock du camion est remis dans l'état d'avant la vente.
      if (emplacement) {
        ops.push(
          prisma.stockDepot.upsert({
            where: { refArt_emplacement: { refArt, emplacement } },
            create: { refArt, emplacement, quantite: round3(-sStock * qte) },
            update:
              sStock > 0
                ? { quantite: { decrement: qte } }
                : { quantite: { increment: qte } },
          })
        );
      }
    }
  }

  if (sSolde !== 0 && doc.codeCli != null) {
    const partner = await prisma.partner.findUnique({ where: { id: doc.codeCli } });
    if (partner) {
      const montant = round3(doc.ttcNet);
      ops.push(
        prisma.partner.update({
          where: { id: doc.codeCli },
          data:
            sSolde > 0
              ? { debit: round3(partner.debit - montant), soldeFin: round3(partner.soldeFin - montant) }
              : { credit: round3(partner.credit - montant), soldeFin: round3(partner.soldeFin + montant) },
        })
      );
    }
  }

  ops.push(prisma.erpStockMovement.deleteMany({ where: { refDoc } }));
  ops.push(
    prisma.erpDocument.update({
      where: { refDoc },
      data: { valide: false, dateValide: null, etat: "En cours" },
    })
  );

  await prisma.$transaction(ops);
  return { ok: true, message: "Document dévalidé — mouvements annulés" };
}
