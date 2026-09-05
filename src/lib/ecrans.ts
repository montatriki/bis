// Titre de l'écran courant, déduit de l'URL.
//
// Le libellé affiché dans la barre du haut doit être *celui du menu* : deux
// tables séparées finiraient par diverger (« Stock véhicule » d'un côté,
// « Stock du camion » de l'autre). Les entrées viennent donc d'ici, et la
// barre latérale comme l'en-tête s'y réfèrent.

export type Ecran = { href: string; titre: string; section?: string };

const ECRANS: Ecran[] = [
  // Espace commercial
  { href: "/commercial/dashboard", titre: "Menu principal" },
  { href: "/commercial/statistiques", titre: "Tableau de bord" },
  { href: "/commercial/clients", titre: "Mes clients" },
  { href: "/commercial/map", titre: "Carte GPS" },
  { href: "/commercial/planning", titre: "Planning du jour" },
  { href: "/commercial/catalogue", titre: "Catalogue" },
  { href: "/commercial/panier", titre: "Panier de commande" },
  { href: "/commercial/recouvrement", titre: "Recouvrement" },
  { href: "/commercial/retour-stock", titre: "Stock véhicule" },
  { href: "/commercial/approvisionnement", titre: "Bon d'approvisionnement" },
  { href: "/commercial/journal", titre: "Journal de caisse" },
  { href: "/commercial/dernier-ticket", titre: "Dernier ticket" },
  { href: "/commercial/reclamation", titre: "Réclamations" },
  { href: "/commercial/mot-de-passe", titre: "Changer mot de passe" },
  // Administration
  { href: "/admin/dashboard", titre: "Tableau de bord" },
  { href: "/admin/synthese", titre: "Synthèse" },
  { href: "/admin/compta", titre: "Comptabilité" },
  { href: "/admin/etat-stock", titre: "État du stock" },
  { href: "/admin/missions", titre: "Ordres de mission" },
  { href: "/admin/commerciaux", titre: "Commerciaux" },
  { href: "/admin/visites", titre: "Visites terrain" },
  { href: "/admin/grh", titre: "GRH" },
  { href: "/admin/traites", titre: "KEMBYELTY — Traites" },
  { href: "/admin/rapports-admin", titre: "Rapports" },
  { href: "/admin/users", titre: "Utilisateurs" },
  { href: "/admin/recordings", titre: "Enregistrements" },
  // Management
  { href: "/manager/dashboard", titre: "Tableau de bord" },
  { href: "/manager/supervision", titre: "Supervision GPS" },
  { href: "/manager/missions", titre: "Ordres de mission" },
  { href: "/manager/validation", titre: "Validation docs" },
  { href: "/manager/objectifs", titre: "Objectifs" },
  { href: "/manager/rapports", titre: "Rapports" },
  // Espace client
  { href: "/client/dashboard", titre: "Accueil" },
  { href: "/client/commander", titre: "Commander" },
  { href: "/client/historique", titre: "Historique" },
  { href: "/client/suivi", titre: "Suivi livraison" },
];

/** Nom de l'espace, affiché en tête du fil d'Ariane. */
export const ESPACES: Record<string, string> = {
  ADMIN: "Administration",
  MANAGER: "Management",
  COMMERCIAL: "Espace commercial",
  CLIENT: "Espace client",
};

/**
 * Titre de l'écran pour un chemin donné. La correspondance la plus longue
 * gagne, pour que `/admin/modules/vente/clients/123` ne soit pas capté par
 * `/admin`. Renvoie `null` sur un écran non répertorié : la barre affiche
 * alors le seul nom de l'espace, plutôt qu'un libellé inventé.
 */
export function titreEcran(chemin: string): string | null {
  let trouve: Ecran | null = null;
  for (const e of ECRANS) {
    if (chemin === e.href || chemin.startsWith(e.href + "/")) {
      if (!trouve || e.href.length > trouve.href.length) trouve = e;
    }
  }
  // Les modules ERP de l'admin ont une route dynamique : on lit le segment.
  if (!trouve && chemin.startsWith("/admin/modules/")) {
    const seg = chemin.split("/").filter(Boolean);
    const nom = seg[3] ?? seg[2];
    if (nom) return nom.charAt(0).toUpperCase() + nom.slice(1).replace(/-/g, " ");
  }
  return trouve?.titre ?? null;
}
