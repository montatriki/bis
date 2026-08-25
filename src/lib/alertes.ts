import Swal from "sweetalert2";

// Boîtes de dialogue de l'application.
//
// `confirm()` et `alert()` du navigateur affichaient « localhost:3000 says » et
// ignoraient le thème : un dialogue système au milieu d'une application métier.
// SweetAlert2 reprend les couleurs de l'interface et laisse formuler un intitulé
// d'action explicite (« Vider le panier » plutôt que « OK »).

/** Palette reprise des variables CSS, pour suivre le thème clair/sombre. */
function theme() {
  if (typeof window === "undefined") return {};
  const v = getComputedStyle(document.documentElement);
  const lire = (n: string, defaut: string) => v.getPropertyValue(n).trim() || defaut;
  return {
    background: lire("--bg-card", "#ffffff"),
    color: lire("--text-primary", "#0f172a"),
  };
}

const BASE = {
  buttonsStyling: true,
  reverseButtons: true,
  focusCancel: true,
  customClass: { popup: "rounded-2xl" },
} as const;

/**
 * Demande une confirmation. `intitule` nomme l'action plutôt que « OK » : à la
 * lecture du bouton, on sait ce qui va se passer.
 */
export async function confirmer(
  texte: string,
  options?: { titre?: string; intitule?: string; danger?: boolean; html?: string },
): Promise<boolean> {
  const r = await Swal.fire({
    ...BASE,
    ...theme(),
    icon: options?.danger ? "warning" : "question",
    title: options?.titre ?? "Confirmer",
    text: options?.html ? undefined : texte,
    html: options?.html,
    showCancelButton: true,
    confirmButtonText: options?.intitule ?? "Confirmer",
    cancelButtonText: "Annuler",
    confirmButtonColor: options?.danger ? "#dc2626" : "#2563eb",
    cancelButtonColor: "#64748b",
  });
  return r.isConfirmed;
}

/** Signale un échec. Remplace `alert(...)`. */
export async function erreur(texte: string, titre = "Échec") {
  await Swal.fire({
    ...BASE,
    ...theme(),
    icon: "error",
    title: titre,
    text: texte,
    confirmButtonText: "Fermer",
    confirmButtonColor: "#dc2626",
  });
}

/** Confirme une action réussie, sans bloquer : disparaît seule. */
export async function succes(texte: string, titre?: string) {
  await Swal.fire({
    ...BASE,
    ...theme(),
    icon: "success",
    title: titre ?? "Terminé",
    text: texte,
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

/** Information neutre. */
export async function info(texte: string, titre?: string) {
  await Swal.fire({
    ...BASE,
    ...theme(),
    icon: "info",
    title: titre ?? "Information",
    text: texte,
    confirmButtonText: "Fermer",
    confirmButtonColor: "#2563eb",
  });
}
