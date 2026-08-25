// Master config mirroring the external S.K.Y app — every module + every submenu.
// Each submenu declares how its page renders: a data "view" + columns.
// This drives both the sidebar and the generic module page.

export type ColumnType = "text" | "num" | "money" | "date" | "badge" | "jours";
// (les colonnes `date` sont saisies via <input type="date"> dans le formulaire)
export type Column = {
  key: string;
  label: string;
  type?: ColumnType;
  filter?: boolean;   // show a per-column search box
  sortable?: boolean; // clickable header sort
  form?: boolean;     // editable in the create/edit form
  required?: boolean; // required in the create form
  /** false => champ de formulaire uniquement, masqué dans le tableau. */
  list?: boolean;
  /**
   * Section du formulaire de saisie. Une fiche de 20 champs en liste continue
   * est illisible : le regroupement reprend les blocs de l'ERP d'origine.
   */
  groupe?: string;
  /**
   * Liste de valeurs existantes proposée à la saisie, au lieu d'un champ libre.
   * `"partner-options.commercial"` interroge
   * `/api/erp?resource=partner-options` et lit la clé `commercial`.
   * Indispensable pour les champs à forte cardinalité (28 commerciaux,
   * 244 villes) où la frappe libre multiplie les orthographes.
   */
  optionsKey?: string;
  /** Champ de saisie long (adresse) : occupe toute la largeur. */
  large?: boolean;
};
// resource the view writes to (for CRUD); undefined => read-only
export type WriteResource = "articles" | "partners" | "documents" | "reglements" | "accounts" | "machines" | "vehicules" | "ref";

export type View =
  | { kind: "partners"; nature: "C" | "F" | "T"; charge?: boolean }
  | { kind: "articles"; articleKind?: "P" | "MP" | "SF" | "CH" }
  | { kind: "documents"; nature: "Vente" | "Achat"; type?: string }
  | { kind: "ref"; refKind: string }
  | { kind: "reglements"; sens: "C" | "F" }
  | { kind: "accounts" }
  | { kind: "machines" }           // GMAO : parc machines
  | { kind: "vehicules" }          // Parc roulant : flotte + échéances
  | { kind: "entretien" }          // Parc roulant : vidanges, échéances, alertes
  | { kind: "transferts" }         // Stock : transferts entre dépôts et véhicules
  | { kind: "borderaux" }
  | { kind: "tresobalance" }
  | { kind: "tresorerie" }        // cockpit trésorerie : chéquiers, chèques, bordereaux, extraits
  | { kind: "crm"; crmMode: "pipeline" | "tickets" } // CRM : pipeline / tickets SAV
  | { kind: "mvtdepot"; typeDoc: "BST" | "BTR" | "BTV" | "BRT" } // bons de sortie / transfert / retour
  | { kind: "gpao"; gpaoMode: "technique" | "cbn" | "planification" } // GPAO : données techniques, CBN, ordonnancement
  | { kind: "series" }   // suivi des numéros de série (vente + achat)
  | { kind: "inventaire" } // inventaire physique : comptage, écarts, régularisation
  | { kind: "refarticles" } // référentiels articles : familles, unités, catalogue
  | { kind: "charges" }     // charges fixes + marge nette par article
  | { kind: "projets" }  // projets et jalonnements
  | { kind: "droits" }   // droits d'accès par utilisateur / composant
  | { kind: "generic"; resource: string } // any read-only /api/erp resource
  | { kind: "settings"; scope: string }   // Paramétrages screen (config sections)
  | { kind: "reports"; scope: string }    // Rapports screen (statistics)
  | { kind: "info"; message?: string };

// Advanced filter-bar field spec (rendered above the table)
export type FilterField =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "number" }
  | { key: string; label: string; type: "select"; optionsKey: string }; // optionsKey => /api/erp?resource=<optionsKey>

export type SubMenu = {
  slug: string;
  label: string;
  view: View;
  columns?: Column[];
  accent?: string;
  filterBar?: FilterField[];
};

export type ErpModule = {
  slug: string;
  label: string;
  color: string; // matches external module tile color
  icon: string; // lucide icon name
  subs: SubMenu[];
};

// Fiche client / fournisseur : reprend les blocs de l'ERP d'origine —
// IDENTITÉ, IDENTITÉ FISC., CLASSEMENT et FINANCE. Les colonnes marquées
// `form` composent le formulaire de saisie ; `list: false` les garde hors du
// tableau, qui resterait illisible avec une trentaine de colonnes.
const partnerCols: Column[] = [
  { key: "id", label: "Code", type: "text", sortable: true },
  { key: "raisonSocial", label: "Raison sociale", filter: true, sortable: true, form: true, required: true, groupe: "Identité" },

  // Ancienneté du dernier contact (vente ou réclamation), calculée par l'API.
  // Placée contre le nom : c'est l'indicateur qui fait ressortir les clients
  // délaissés, il doit se lire sans faire défiler le tableau.
  { key: "nbrJours", label: "Dernier contact", type: "jours" },

  // ── Identité ──
  { key: "adresse", label: "Adresse", type: "text", form: true, list: false, groupe: "Identité", large: true },
  { key: "tel", label: "Tél", type: "text", filter: true, form: true, groupe: "Identité" },
  { key: "fax", label: "Fax", type: "text", form: true, list: false, groupe: "Identité" },
  { key: "email", label: "Email", type: "text", form: true, groupe: "Identité" },
  { key: "gouvernorat", label: "Gouvernorat", filter: true, form: true, groupe: "Identité", optionsKey: "partner-options.gouvernorat" },
  { key: "ville", label: "Ville", filter: true, form: true, groupe: "Identité", optionsKey: "partner-options.ville" },
  { key: "longitude", label: "Longitude", type: "num", form: true, list: false, groupe: "Identité" },
  { key: "latitude", label: "Latitude", type: "num", form: true, list: false, groupe: "Identité" },

  // ── Identité fiscale ──
  { key: "matriculeF", label: "Matricule fiscale", type: "text", form: true, groupe: "Identité fiscale" },
  { key: "codeTva", label: "Code TVA", type: "text", form: true, list: false, groupe: "Identité fiscale" },
  { key: "cletva", label: "Clé", type: "text", form: true, list: false, groupe: "Identité fiscale" },
  { key: "categorieTva", label: "Cat.", type: "text", form: true, list: false, groupe: "Identité fiscale" },
  { key: "registreCom", label: "Registre de commerce", type: "text", form: true, list: false, groupe: "Identité fiscale", large: true },

  // ── Classement ── champs à forte cardinalité : listes, pas de frappe libre.
  { key: "commercial", label: "Commercial", filter: true, form: true, list: false, groupe: "Classement", optionsKey: "partner-options.commercial" },
  { key: "famille", label: "Famille", filter: true, form: true, groupe: "Classement", optionsKey: "partner-options.famille" },
  { key: "sousFamille", label: "Sous famille", filter: true, form: true, groupe: "Classement", optionsKey: "partner-options.sousFamille" },

  // ── Finance ──
  { key: "plafond", label: "Plafond encours", type: "money", form: true, list: false, groupe: "Finance" },
  { key: "remiseDef", label: "Remise (%)", type: "num", form: true, list: false, groupe: "Finance" },
  { key: "soldeIni", label: "Solde initial", type: "money", form: true, list: false, groupe: "Finance" },
  { key: "debit", label: "Débit", type: "money", sortable: true },
  { key: "credit", label: "Crédit", type: "money", sortable: true },
  { key: "soldeFin", label: "Solde", type: "money", sortable: true },
  // Colonnes de recouvrement de l'ERP d'origine : l'encours est ce qui est
  // remis mais pas encore encaissé, l'impayé ce qui est revenu impayé.
  { key: "encours", label: "Encours", type: "money", sortable: true },
  { key: "impayer", label: "Impayé", type: "money", sortable: true },
  { key: "risque", label: "Risque", type: "text", sortable: true },
];

// full "Liste des produits" layout, matching the external app
const articleCols: Column[] = [
  { key: "refArt", label: "Référence", type: "text", filter: true, sortable: true, form: true, required: true },
  { key: "codeBarre", label: "Code à barre", type: "text", filter: true, form: true },
  { key: "designation", label: "Désignation", filter: true, sortable: true, form: true, required: true },
  { key: "catalogue", label: "Catalogue", type: "text", filter: true, form: true },
  { key: "familleLabel", label: "Famille", filter: true },
  { key: "sousFamilleLabel", label: "S.Famille", filter: true },
  { key: "enStock", label: "En stock", type: "num", sortable: true, form: true },
  { key: "puAchat", label: "Pu achat.HT", type: "money", sortable: true, form: true },
  { key: "tarif1Ht", label: "T1.HT", type: "money", form: true },
  { key: "t1ttc", label: "T1.TTC", type: "money" },
  { key: "tauxTva", label: "TVA %", type: "num", form: true },
  { key: "unite", label: "Unité", type: "text", form: true },
  { key: "valeurAchat", label: "valeur achat", type: "money" },
  { key: "valeurVente", label: "valeur vente", type: "money" },
];

const docCols: Column[] = [
  { key: "typeDoc", label: "Type", type: "badge", filter: true },
  { key: "refDoc", label: "Référence", type: "text", filter: true, sortable: true },
  { key: "dateDoc", label: "Date", type: "date", sortable: true },
  { key: "raisonSocial", label: "Tiers", filter: true, form: true },
  { key: "thtNet", label: "Total HT", type: "money", sortable: true, form: true },
  { key: "ttcNet", label: "Total TTC", type: "money", sortable: true, form: true },
  { key: "totalRegle", label: "Réglé", type: "money" },
  { key: "soldeDoc", label: "Solde", type: "money", form: true },
  { key: "etat", label: "État", filter: true, form: true },
];

const refCols = (codeLabel = "Code"): Column[] => [
  { key: "code", label: codeLabel, type: "text", form: true },
  { key: "label", label: "Libellé", form: true, required: true },
];

const reglementCols: Column[] = [
  { key: "datePay", label: "Date", type: "date", sortable: true, form: true },
  { key: "tiersNom", label: "Tiers", filter: true, form: true, required: true },
  { key: "modePay", label: "Mode", filter: true, form: true },
  { key: "numDoc", label: "N° Doc", type: "text", filter: true, form: true },
  { key: "montant", label: "Montant", type: "money", sortable: true, form: true, required: true },
  { key: "echeance", label: "Échéance", type: "text", form: true },
  { key: "etat", label: "État", filter: true, form: true },
  { key: "banque", label: "Banque/Compte", type: "text", form: true },
  { key: "utilisateur", label: "Utilisateur", type: "text" },
];
const reglementFilterBar: FilterField[] = [
  { key: "tiersNom", label: "Client / Tiers", type: "text" },
  { key: "utilisateur", label: "Utilisateur", type: "select", optionsKey: "reglement-options.utilisateur" },
  { key: "modePay", label: "Mode paiement", type: "select", optionsKey: "reglement-options.modePay" },
  { key: "etat", label: "État", type: "select", optionsKey: "reglement-options.etat" },
  { key: "montantDu", label: "MT. Du", type: "number" },
  { key: "montantAu", label: "MT. Au", type: "number" },
  { key: "dateDu", label: "Date du", type: "date" },
  { key: "dateAu", label: "Date au", type: "date" },
  { key: "numDoc", label: "N° Vente", type: "text" },
];

const accountCols: Column[] = [
  { key: "id", label: "N°", type: "text" },
  { key: "libelle", label: "Libellé compte", form: true, required: true },
  { key: "type", label: "Type", form: true },
  { key: "banque", label: "Banque", form: true },
  { key: "agence", label: "Agence", form: true },
  { key: "rib", label: "RIB", type: "text", form: true },
  { key: "nature", label: "Nature", form: true },
];
const machineCols: Column[] = [
  { key: "id", label: "N°", type: "text" },
  { key: "numSerie", label: "N° série", form: true, filter: true, sortable: true },
  { key: "machine", label: "Machine", form: true, required: true, filter: true, sortable: true },
  { key: "posteCharge", label: "Poste de charge", form: true, filter: true },
  { key: "etat", label: "État", type: "badge", form: true, filter: true, sortable: true },
  { key: "dateMiseEnMarche", label: "Date mise en marche", type: "date", form: true, sortable: true },
  { key: "coutAcquisition", label: "Valeur d'acquisition", type: "money", form: true },
  { key: "capaciteHoraire", label: "Capacité horaire", type: "num", form: true },
  { key: "coutHoraire", label: "Coût horaire", type: "money", form: true },
];
const missionCols: Column[] = [
  { key: "id", label: "N°", type: "text" },
  { key: "commercial", label: "Commercial", filter: true },
  { key: "vehicule", label: "Véhicule", type: "text", filter: true },
  { key: "dateOrdre", label: "Date ordre", type: "date", sortable: true },
  { key: "kmDepart", label: "Km départ", type: "num" },
  { key: "kmArrive", label: "Km arrivée", type: "num" },
  { key: "etat", label: "État", filter: true },
  { key: "utilisateur", label: "Utilisateur", type: "text" },
];
const borderauCols: Column[] = [
  { key: "id", label: "N° Bordereau", type: "text" },
  { key: "dateBord", label: "Date", type: "date" },
  { key: "type", label: "Type" },
  { key: "numCompte", label: "Compte" },
  { key: "nbReglements", label: "Pièces", type: "text" },
  { key: "total", label: "Total", type: "money" },
  { key: "mtEsp", label: "Mt espèces", type: "money" },
  { key: "utilisateur", label: "Utilisateur" },
];
const mouvementCols: Column[] = [
  { key: "id", label: "N°", type: "text" },
  { key: "type", label: "Type", type: "badge", filter: true },
  { key: "datePay", label: "Date", type: "date", sortable: true },
  { key: "libelle", label: "Libellé", filter: true },
  { key: "compte", label: "Compte", filter: true },
  { key: "montant", label: "Montant", type: "money", sortable: true },
  { key: "modePay", label: "Mode", filter: true },
  { key: "numDoc", label: "N° Doc", type: "text" },
  { key: "etat", label: "État" },
];
// Registre des feuilles de chèque : une ligne par feuille du carnet, vierge ou
// consommée — c'est ce que montre « Gestion chéquiers » en production.
const chequeCols: Column[] = [
  { key: "numero", label: "N° Chèque", type: "text", sortable: true, filter: true },
  { key: "banque", label: "Banque", filter: true },
  { key: "serie", label: "Chéquier", filter: true },
  { key: "etat", label: "État", filter: true },
  { key: "tiersNom", label: "Bénéficiaire", filter: true },
  { key: "montant", label: "Montant", type: "money", sortable: true },
  { key: "dateEmis", label: "Émis le", type: "date", sortable: true },
  { key: "echeance", label: "Échéance", type: "date" },
  { key: "refDoc", label: "Document", type: "text" },
];

/**
 * Barre de filtres des listes de documents, reprise de l'ERP d'origine
 * (« Liste des documents de vente ») : période, client, référence, utilisateur
 * et bornes de montant. La période est le filtre principal — dans l'ancienne
 * application elle était pré-remplie sur l'année en cours.
 */
const documentFilterBar = (nature: "Vente" | "Achat"): FilterField[] => [
  { key: "dateDu", label: "Période du", type: "date" },
  { key: "dateAu", label: "Période au", type: "date" },
  { key: "client", label: nature === "Vente" ? "Client" : "Fournisseur", type: "text" },
  { key: "refDoc", label: "Référence", type: "text" },
  { key: "typeDocFiltre", label: "Type doc.", type: "select", optionsKey: "document-options.typeDoc" },
  { key: "utilisateur", label: "Utilisateur", type: "select", optionsKey: "document-options.utilisateur" },
  { key: "montantDu", label: "MT. Du", type: "number" },
  { key: "montantAu", label: "MT. Au", type: "number" },
];

/**
 * Parc roulant : la flotte réelle avec ses échéances administratives
 * (assurance, visite technique, vignette). L'écran ne montrait que
 * l'immatriculation, alors que la table `vehicles` porte tout le reste.
 */
// Fiche véhicule complète, reprenant les champs de la table `vehicules` de
// l'ERP d'origine (châssis, assureur, consommations) que la version précédente
// n'avait pas repris.
const vehiculeCols: Column[] = [
  // ── Identification ──
  { key: "plate", label: "Immatriculation", type: "text", filter: true, sortable: true, form: true, required: true, groupe: "Identification" },
  { key: "brand", label: "Marque", filter: true, sortable: true, form: true, groupe: "Identification" },
  { key: "model", label: "Modèle", filter: true, form: true, groupe: "Identification" },
  { key: "year", label: "Année", type: "num", sortable: true, form: true, groupe: "Identification" },
  { key: "typeVehicule", label: "Type", type: "text", filter: true, form: true, list: false, groupe: "Identification" },
  { key: "couleur", label: "Couleur", type: "text", form: true, list: false, groupe: "Identification" },
  { key: "chassis", label: "N° châssis", type: "text", form: true, list: false, groupe: "Identification" },
  { key: "status", label: "Statut", type: "badge", filter: true, form: true, groupe: "Identification" },

  // ── Compteur ── référence de toutes les échéances kilométriques.
  { key: "kilometrage", label: "Kilométrage", type: "num", sortable: true, form: true, groupe: "Compteur" },
  { key: "kmMoyen", label: "KM moyen / jour", type: "num", form: true, list: false, groupe: "Compteur" },
  { key: "consoCarburant", label: "Consommation L/100", type: "num", form: true, list: false, groupe: "Compteur" },
  { key: "consoMoyenneJour", label: "Consommation moy./jour", type: "num", form: true, list: false, groupe: "Compteur" },

  // ── Échéances administratives ── surveillées par les notifications.
  { key: "assureur", label: "Assureur", type: "text", form: true, list: false, groupe: "Échéances" },
  { key: "insuranceStart", label: "Début assurance", type: "date", form: true, list: false, groupe: "Échéances" },
  { key: "insuranceExpiry", label: "Fin assurance", type: "date", sortable: true, form: true, groupe: "Échéances" },
  { key: "controlStart", label: "Date de visite", type: "date", form: true, list: false, groupe: "Échéances" },
  { key: "controlExpiry", label: "Fin visite technique", type: "date", sortable: true, form: true, groupe: "Échéances" },
  { key: "taxPaidAt", label: "Paiement vignette", type: "date", form: true, list: false, groupe: "Échéances" },
  { key: "taxExpiry", label: "Fin vignette", type: "date", sortable: true, form: true, groupe: "Échéances" },
];

const doc = (label: string, slug: string, nature: "Vente" | "Achat", type: string): SubMenu => ({
  slug, label, view: { kind: "documents", nature, type },
  columns: docCols, filterBar: documentFilterBar(nature),
});

export const ERP_MODULES: ErpModule[] = [
  {
    slug: "stock", label: "STOCK", color: "#f0a020", icon: "Boxes",
    subs: [
      { slug: "produits", label: "Liste des produits", view: { kind: "articles", articleKind: "P" }, columns: articleCols },
      { slug: "matieres", label: "Liste des matières", view: { kind: "articles", articleKind: "MP" }, columns: articleCols },
      { slug: "semifini", label: "Liste semifini", view: { kind: "articles", articleKind: "SF" }, columns: articleCols },
      { slug: "inventaires", label: "Inventaire physique", view: { kind: "inventaire" } },
      { slug: "documents-stock", label: "Documents de stock", view: { kind: "documents", nature: "Achat", type: "TR" }, columns: docCols },
      { slug: "mouvements", label: "Mouvement de stock", view: { kind: "documents", nature: "Achat", type: "%" }, columns: docCols },
      { slug: "allocation", label: "Allocation stock", view: { kind: "documents", nature: "Achat", type: "TR" }, columns: docCols },
      { slug: "transferts", label: "Transferts", view: { kind: "transferts" } },
      { slug: "depots", label: "Gestion des dépôts", view: { kind: "ref", refKind: "depot" }, columns: refCols("Code dépôt") },
      { slug: "etat-stock", label: "Etat du stock", view: { kind: "articles" }, columns: articleCols },
      { slug: "of", label: "Liste des OF", view: { kind: "documents", nature: "Vente", type: "OF" }, columns: docCols },
      { slug: "referentiels", label: "Familles & unités", view: { kind: "refarticles" } },
      { slug: "parametrages", label: "Paramétrages Stock", view: { kind: "settings", scope: "stock" } },
    ],
  },
  {
    slug: "achat", label: "ACHAT", color: "#e8821e", icon: "ShoppingCart",
    subs: [
      { slug: "fournisseurs", label: "Fournisseurs", view: { kind: "partners", nature: "F" }, columns: partnerCols },
      doc("Documents Frs", "documents", "Achat", "%"),
      doc("Demande de devis", "demande-devis", "Achat", "DEM"),
      doc("Devis", "devis", "Achat", "DEV"),
      doc("B.Commande", "bon-commande", "Achat", "COM"),
      doc("Importation", "importation", "Achat", "IMP"),
      doc("B.Réception", "bon-reception", "Achat", "BRE"),
      doc("B.Retour", "bon-retour-achat", "Achat", "BR"),
      doc("Facture", "facture", "Achat", "FC"),
      doc("Avoir", "avoir", "Achat", "AV"),
      { slug: "rapport", label: "Rapport", view: { kind: "reports", scope: "achat" } },
      { slug: "parametrages", label: "Paramétrages achat", view: { kind: "settings", scope: "achat" } },
    ],
  },
  {
    slug: "crm", label: "CRM", color: "#3b82c4", icon: "Building2",
    subs: [
      { slug: "contacts", label: "Contacts", view: { kind: "partners", nature: "C" }, columns: partnerCols },
      { slug: "opportunites", label: "Opportunités", view: { kind: "crm", crmMode: "pipeline" } },
      { slug: "mailing", label: "Mailing", view: { kind: "partners", nature: "C" }, columns: partnerCols },
      { slug: "tickets", label: "Gestion des tickets SAV", view: { kind: "crm", crmMode: "tickets" } },
      { slug: "parametrages", label: "Paramétrages CRM", view: { kind: "settings", scope: "crm" } },
    ],
  },
  {
    slug: "vente", label: "VENTE", color: "#3aa856", icon: "TrendingUp",
    subs: [
      { slug: "clients", label: "Clients", view: { kind: "partners", nature: "C" }, columns: partnerCols },
      doc("Documents client", "documents", "Vente", "%"),
      { slug: "suivie-commande", label: "Suivie commande", view: { kind: "documents", nature: "Vente", type: "COM" }, columns: docCols },
      { slug: "cloturer-caisse", label: "Clôturer caisse", view: { kind: "documents", nature: "Vente", type: "TIC" }, columns: docCols },
      doc("Dem.devis", "dem-devis", "Vente", "DEM"),
      doc("Devis", "devis", "Vente", "DEV"),
      doc("B.Commande", "bon-commande", "Vente", "COM"),
      doc("B.Livraison", "bon-livraison", "Vente", "TIC"),
      { slug: "bon-sortie", label: "B.Sortie", view: { kind: "documents", nature: "Achat", type: "TR" }, columns: docCols },
      doc("B.Retour", "bon-retour", "Vente", "BR"),
      doc("Facture", "facture", "Vente", "FC"),
      doc("Avoir", "avoir", "Vente", "AV"),
      { slug: "rapports", label: "Rapports", view: { kind: "reports", scope: "vente" } },
      { slug: "commerciaux", label: "Gestion des commerciaux", view: { kind: "ref", refKind: "commercial" }, columns: refCols() },
      { slug: "num-series", label: "Suivi des numéros de série", view: { kind: "series" } },
      { slug: "parametrages", label: "Paramétrages", view: { kind: "settings", scope: "vente" } },
    ],
  },
  {
    slug: "gestion-tourner", label: "GESTION TOURNER", color: "#16a34a", icon: "Truck",
    subs: [
      { slug: "ordres-missions", label: "Gestion des ordres missions", view: { kind: "generic", resource: "missions" }, columns: missionCols },
      doc("Transferts", "transferts", "Achat", "TR"),
      { slug: "creer-bon-sortie", label: "Créer bon de sortie", view: { kind: "mvtdepot", typeDoc: "BST" } },
      { slug: "creer-bon-transfert", label: "Créer bon de transfert", view: { kind: "mvtdepot", typeDoc: "BTR" } },
      { slug: "creer-transfert-vehicules", label: "Créer bon de transfert entre véhicules", view: { kind: "mvtdepot", typeDoc: "BTV" } },
      { slug: "creer-bon-retour", label: "Créer bon de retour", view: { kind: "mvtdepot", typeDoc: "BRT" } },
      { slug: "commerciaux", label: "Gestion des commerciaux", view: { kind: "ref", refKind: "commercial" }, columns: refCols() },
      { slug: "rapports", label: "Rapports", view: { kind: "reports", scope: "tourner" } },
      { slug: "vehicules", label: "Véhicules", view: { kind: "ref", refKind: "vehicule" }, columns: refCols("Matricule") },
    ],
  },
  {
    slug: "charge", label: "CHARGE", color: "#e0455e", icon: "Receipt",
    subs: [
      // « CHARGE » n'est pas un type de document mais un critère : tout
      // document portant un compte de charge (`tiers`), quel que soit son type.
      //
      // Colonnes propres à l'écran : le compte de charge et la date sont
      // saisissables, sans quoi une pièce créée ici n'entrerait pas dans le
      // critère qui la fait apparaître.
      {
        slug: "documents", label: "Documents charge",
        view: { kind: "documents", nature: "Achat", type: "CHARGE" },
        columns: [
          { key: "typeDoc", label: "Type", type: "badge", filter: true, form: true },
          { key: "refDoc", label: "Référence", type: "text", filter: true, sortable: true },
          { key: "dateDoc", label: "Date", type: "date", sortable: true, form: true },
          { key: "tiers", label: "Compte de charge", type: "text", filter: true, form: true },
          { key: "raisonSocial", label: "Tiers", filter: true, form: true },
          { key: "thtNet", label: "Total HT", type: "money", sortable: true, form: true },
          { key: "ttcNet", label: "Total TTC", type: "money", sortable: true, form: true },
          { key: "totalRegle", label: "Réglé", type: "money" },
          { key: "soldeDoc", label: "Solde", type: "money", form: true },
          { key: "etat", label: "État", filter: true, form: true },
        ],
        filterBar: documentFilterBar("Achat"),
      },
      { slug: "charges", label: "Les Charges", view: { kind: "articles", articleKind: "CH" }, columns: articleCols },
      // Les tiers de charge se reconnaissent à l'indicateur `charge`, pas à la
      // nature du compte : VIVO ENERGY est un fournisseur (nature F) qui est
      // aussi un tiers de charge, et la liste doit l'inclure.
      { slug: "tiers", label: "Tiers", view: { kind: "partners", nature: "T", charge: true }, columns: partnerCols },
      { slug: "charges-fixes", label: "Charges fixes & marge", view: { kind: "charges" } },
      { slug: "rapports", label: "Rapports", view: { kind: "reports", scope: "charge" } },
    ],
  },
  {
    slug: "gmao", label: "GMAO", color: "#64748b", icon: "Wrench",
    subs: [
      { slug: "machines", label: "Machines", view: { kind: "machines" }, columns: machineCols },
    ],
  },
  {
    slug: "gpao", label: "GPAO", color: "#8b5cf6", icon: "Factory",
    subs: [
      { slug: "donnees-techniques", label: "Données techniques", view: { kind: "gpao", gpaoMode: "technique" } },
      { slug: "of", label: "Liste des OF", view: { kind: "documents", nature: "Vente", type: "OF" }, columns: docCols },
      { slug: "cbn", label: "Calcul besoin net", view: { kind: "gpao", gpaoMode: "cbn" } },
      { slug: "ordonnancement", label: "Ordonnancement", view: { kind: "gpao", gpaoMode: "planification" } },
      { slug: "planification", label: "Planification", view: { kind: "gpao", gpaoMode: "planification" } },
    ],
  },
  {
    slug: "tresorerie", label: "TRESORERIE", color: "#d4a017", icon: "Wallet",
    subs: [
      { slug: "cockpit", label: "Trésorerie", view: { kind: "tresorerie" } },
      { slug: "reglements-clients", label: "Règlements Clients", view: { kind: "reglements", sens: "C" }, columns: reglementCols, filterBar: reglementFilterBar },
      { slug: "decaissements-frs", label: "Décaissements Frs", view: { kind: "reglements", sens: "F" }, columns: reglementCols, filterBar: reglementFilterBar },
      { slug: "chequiers", label: "Gestion chéquiers", view: { kind: "generic", resource: "cheques" }, columns: chequeCols },
      { slug: "comptes", label: "Comptes bancaires", view: { kind: "accounts" }, columns: accountCols },
      { slug: "mouvements-compte", label: "Mouvements compte", view: { kind: "generic", resource: "mouvements-compte" }, columns: mouvementCols },
      { slug: "extrait-compte", label: "Extrait compte", view: { kind: "generic", resource: "mouvements-compte" }, columns: mouvementCols },
      { slug: "borderaux", label: "BORDERAUX", view: { kind: "borderaux" }, columns: borderauCols },
      { slug: "decaissements-tier", label: "Décaissements Tier", view: { kind: "reglements", sens: "F" }, columns: reglementCols, filterBar: reglementFilterBar },
      { slug: "balance", label: "Balance globale de trésorerie", view: { kind: "tresobalance" } },
    ],
  },
  {
    slug: "parc-roulant", label: "PARC ROULANT", color: "#db2777", icon: "Car",
    subs: [
      { slug: "flotte", label: "Gestion des véhicules", view: { kind: "vehicules" }, columns: vehiculeCols },
      // Charges rattachées aux véhicules (carburant, entretien) : les factures
      // de charge FCH, comme l'écran « Charges véhicules » de l'ERP d'origine.
      {
        slug: "charges-vehicules", label: "Charges véhicules",
        view: { kind: "documents", nature: "Achat", type: "FCH" },
        columns: [
          ...docCols.slice(0, 4),
          { key: "vehicule", label: "Véhicule", filter: true, form: true },
          ...docCols.slice(4),
        ],
        filterBar: documentFilterBar("Achat"),
      },
      // Entretien : ce qui transforme la fiche véhicule en outil de pilotage —
      // échéances surveillées et périodicités (vidange, filtres, courroie).
      { slug: "entretien", label: "Entretien & échéances", view: { kind: "entretien" } },
      { slug: "vehicules", label: "Codes véhicules", view: { kind: "ref", refKind: "vehicule" }, columns: refCols("Matricule") },
    ],
  },
  {
    slug: "projets", label: "PROJETS", color: "#0891b2", icon: "FolderKanban",
    subs: [
      { slug: "liste", label: "Liste des projets", view: { kind: "projets" } },
    ],
  },
  {
    slug: "administration", label: "ADMINISTRATION", color: "#475569", icon: "ShieldCheck",
    subs: [
      { slug: "droits", label: "Droits d'accès", view: { kind: "droits" } },
      { slug: "societe", label: "Société & taux", view: { kind: "settings", scope: "societe" } },
    ],
  },
];

export const findModule = (slug: string) => ERP_MODULES.find((m) => m.slug === slug);
export const findSub = (mod: ErpModule, slug: string) => mod.subs.find((s) => s.slug === slug);

// Which write resource (CRUD endpoint) a view maps to. Ref/info are read-only.
export function writeResource(view: View): WriteResource | null {
  if (view.kind === "articles") return "articles";
  if (view.kind === "partners") return "partners";
  if (view.kind === "documents") return "documents";
  if (view.kind === "reglements") return "reglements";
  if (view.kind === "accounts") return "accounts";
  if (view.kind === "machines") return "machines";
  if (view.kind === "vehicules") return "vehicules";
  if (view.kind === "ref") return "ref";
  return null;
}

// Default values + fixed fields for a new record in a given view.
export function newRecordDefaults(view: View): Record<string, unknown> {
  if (view.kind === "articles") return { kind: view.articleKind ?? "P" };
  if (view.kind === "partners") return { nature: view.nature };
  if (view.kind === "documents") return { nature: view.nature, typeDoc: view.type && view.type !== "%" ? view.type : "BL" };
  if (view.kind === "reglements") return { sens: view.sens };
  if (view.kind === "accounts") return {};
  // Le référentiel visé est porté par la vue : une entrée créée depuis l'écran
  // « Dépôts » ne peut pas atterrir dans la liste des commerciaux.
  if (view.kind === "ref") return { kind: view.refKind };
  return {};
}
