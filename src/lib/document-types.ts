// Règles par type de document — reproduit `typde_doc_vente` / `typde_doc_achat` de l'ERP source.
//
//   tStock : "E" = entrée en stock, "S" = sortie de stock, "N" = sans effet
//   tSolde : "D" = débite le client (facture), "C" = crédite (avoir), "N" = sans effet
//
// Dans A ces règles vivent en base et pilotent `updateStockArticleByMvt`
// et `updateSoldeClientByMvt`. Ici elles sont déclaratives et centralisées.

export type StockEffect = "E" | "S" | "N";
export type SoldeEffect = "D" | "C" | "N";

export type DocTypeRule = {
  code: string;
  label: string;
  nature: "Vente" | "Achat";
  tStock: StockEffect;
  tSolde: SoldeEffect;
};

export const DOC_TYPES: DocTypeRule[] = [
  // ---- Vente ----
  { code: "DEV", label: "Devis", nature: "Vente", tStock: "N", tSolde: "N" },
  { code: "COM", label: "Commande client", nature: "Vente", tStock: "N", tSolde: "N" },
  { code: "BL", label: "Bon de livraison", nature: "Vente", tStock: "S", tSolde: "D" },
  { code: "FAC", label: "Facture", nature: "Vente", tStock: "S", tSolde: "D" },
  { code: "TIC", label: "Ticket caisse", nature: "Vente", tStock: "S", tSolde: "D" },
  { code: "AV", label: "Avoir client", nature: "Vente", tStock: "E", tSolde: "C" },
  { code: "BRE", label: "Bon de retour", nature: "Vente", tStock: "E", tSolde: "C" },
  { code: "OF", label: "Ordre de fabrication", nature: "Vente", tStock: "N", tSolde: "N" },

  // ---- Achat ----
  { code: "CDF", label: "Commande fournisseur", nature: "Achat", tStock: "N", tSolde: "N" },
  { code: "BRC", label: "Bon de réception", nature: "Achat", tStock: "E", tSolde: "C" },
  { code: "FACA", label: "Facture achat", nature: "Achat", tStock: "E", tSolde: "C" },
  { code: "AVA", label: "Avoir fournisseur", nature: "Achat", tStock: "S", tSolde: "D" },
  { code: "INV", label: "Inventaire", nature: "Achat", tStock: "N", tSolde: "N" },
  { code: "TR", label: "Transfert", nature: "Achat", tStock: "N", tSolde: "N" },

  // ---- Gestion Tourner (mouvements internes, sans effet sur un tiers) ----
  // Un transfert ne change pas le stock global : il déplace la marchandise
  // d'un emplacement à un autre (géré par `MouvementDepot`, pas par `T_stock`).
  { code: "BST", label: "Bon de sortie", nature: "Achat", tStock: "S", tSolde: "N" },
  { code: "BTR", label: "Bon de transfert", nature: "Achat", tStock: "N", tSolde: "N" },
  { code: "BTV", label: "Transfert entre véhicules", nature: "Achat", tStock: "N", tSolde: "N" },
  { code: "BRT", label: "Bon de retour dépôt", nature: "Achat", tStock: "E", tSolde: "N" },
];

const BY_CODE = new Map(DOC_TYPES.map((d) => [d.code.toUpperCase(), d]));

/** Règle d'un type de document. Par défaut : aucun effet (sûr). */
export function docTypeRule(typeDoc?: string | null): DocTypeRule {
  const found = typeDoc ? BY_CODE.get(String(typeDoc).toUpperCase()) : undefined;
  return (
    found ?? {
      code: String(typeDoc ?? "?"),
      label: String(typeDoc ?? "Inconnu"),
      nature: "Vente",
      tStock: "N",
      tSolde: "N",
    }
  );
}

/** Signe appliqué au stock : +1 entrée, -1 sortie, 0 neutre. */
export function stockSign(tStock: StockEffect): number {
  return tStock === "E" ? 1 : tStock === "S" ? -1 : 0;
}

/** Signe appliqué au solde du tiers : +1 débit, -1 crédit, 0 neutre. */
export function soldeSign(tSolde: SoldeEffect): number {
  return tSolde === "D" ? 1 : tSolde === "C" ? -1 : 0;
}

export const affectsStock = (t?: string | null) => docTypeRule(t).tStock !== "N";
export const affectsSolde = (t?: string | null) => docTypeRule(t).tSolde !== "N";
