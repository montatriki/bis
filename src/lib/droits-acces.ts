import prisma from "@/lib/prisma";
import { ERP_MODULES } from "@/lib/erp-modules";

// Droits d'accès par utilisateur et par composant.
//
// Reprend `list_droit_access` (catalogue des fonctions protégeables) et
// `component_user_droit` (le droit accordé) de l'ERP source, plus les colonnes
// de `droit_list_doc_vente` (imp_list, supp_doc, modif_doc, creat_doc…).
//
// Règle de résolution, volontairement différente de A : un **ADMIN a tous les
// droits sans enregistrement**. Dans A, un administrateur pouvait se retrouver
// bloqué faute de ligne dans `component_user_droit` ; ici le rôle prime, ce qui
// évite de se verrouiller hors de son propre écran de droits.

/** Actions protégeables, reprises de `droit_list_doc_vente`. */
export const FONCTIONS_STANDARD = [
  { funcName: "acces", funcLib: "Accès à l'écran", typeFn: "acces", numOrder: 1 },
  { funcName: "creat_doc", funcLib: "Créer", typeFn: "action", numOrder: 2 },
  { funcName: "modif_doc", funcLib: "Modifier", typeFn: "action", numOrder: 3 },
  { funcName: "supp_doc", funcLib: "Supprimer", typeFn: "action", numOrder: 4 },
  { funcName: "imp_doc", funcLib: "Imprimer", typeFn: "action", numOrder: 5 },
  { funcName: "transform", funcLib: "Transformer", typeFn: "action", numOrder: 6 },
  { funcName: "aff_total", funcLib: "Voir les totaux", typeFn: "affichage", numOrder: 7 },
  { funcName: "aff_valeur", funcLib: "Voir les valeurs / prix", typeFn: "affichage", numOrder: 8 },
] as const;

/** Rôles qui disposent de tous les droits sans enregistrement explicite. */
const ROLES_TOUT_PERMIS = ["ADMIN"];

/**
 * Composants protégeables : un par sous-menu de module.
 * Dérivé de la config des modules, donc jamais désynchronisé du menu réel.
 */
export function composantsDisponibles(): { component: string; label: string; module: string }[] {
  return ERP_MODULES.flatMap((m) =>
    m.subs.map((sub) => ({
      component: `${m.slug}.${sub.slug}`,
      label: sub.label,
      module: m.label,
    }))
  );
}

/**
 * Crée les fonctions manquantes au catalogue.
 *
 * Idempotent : appelable à chaque ouverture de l'écran sans dupliquer. Un
 * nouveau sous-menu ajouté au menu devient protégeable sans migration.
 */
export async function initialiserCatalogue(): Promise<{ crees: number; total: number }> {
  const composants = composantsDisponibles();

  const existantes = await prisma.droitFonction.findMany({
    select: { component: true, funcName: true },
  });
  const deja = new Set(existantes.map((e) => `${e.component}|${e.funcName}`));

  const aCreer = composants.flatMap((c) =>
    FONCTIONS_STANDARD.filter((f) => !deja.has(`${c.component}|${f.funcName}`)).map((f) => ({
      component: c.component,
      funcName: f.funcName,
      funcLib: f.funcLib,
      typeFn: f.typeFn,
      numOrder: f.numOrder,
    }))
  );

  if (aCreer.length > 0) {
    await prisma.droitFonction.createMany({ data: aCreer, skipDuplicates: true });
  }

  const total = await prisma.droitFonction.count();
  return { crees: aCreer.length, total };
}

/**
 * Un utilisateur a-t-il le droit d'exécuter `funcName` sur `component` ?
 *
 * Absence d'enregistrement = **refus** pour les rôles non privilégiés : un droit
 * sensible ne doit pas être accordé par défaut. `acces` reste une exception
 * pragmatique — sans elle, un utilisateur n'ayant aucun droit paramétré ne
 * verrait plus aucun écran, ce qui bloquerait la mise en route du module.
 */
export async function aLeDroit(
  login: string,
  role: string,
  component: string,
  funcName: string
): Promise<boolean> {
  if (ROLES_TOUT_PERMIS.includes(role)) return true;

  const fonction = await prisma.droitFonction.findUnique({
    where: { component_funcName: { component, funcName } },
    select: { id: true },
  });
  // Fonction hors catalogue : rien à restreindre.
  if (!fonction) return true;

  const droit = await prisma.droitUtilisateur.findUnique({
    where: { login_fonctionId: { login, fonctionId: fonction.id } },
    select: { valeur: true },
  });

  if (droit) return droit.valeur;
  return funcName === "acces";
}

/** Tous les droits d'un utilisateur, indexés `component.funcName` → booléen. */
export async function droitsDe(login: string, role: string): Promise<Record<string, boolean>> {
  const fonctions = await prisma.droitFonction.findMany({
    include: { droits: { where: { login }, select: { valeur: true } } },
    orderBy: [{ component: "asc" }, { numOrder: "asc" }],
  });

  const tout = ROLES_TOUT_PERMIS.includes(role);
  const res: Record<string, boolean> = {};
  for (const f of fonctions) {
    const explicite = f.droits[0]?.valeur;
    res[`${f.component}.${f.funcName}`] = tout
      ? true
      : explicite !== undefined
        ? explicite
        : f.funcName === "acces";
  }
  return res;
}
