"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

// Champ de saisie assisté par la liste des valeurs déjà utilisées.
//
// Remplace le champ libre sur les données à forte cardinalité : la base compte
// 28 orthographes de commerciaux et 244 villes, chacune issue d'une frappe
// différente. Chaque variante casse les rapprochements (portefeuille, tournée,
// statistiques par vendeur).
//
// La saisie libre reste possible — il faut pouvoir enregistrer un commercial
// ou une ville qui n'existe pas encore — mais l'existant est proposé en
// premier, ce qui évite de créer un doublon par inadvertance.

export default function ChampListe({
  nom, valeurInitiale, options, placeholder, accent,
}: {
  nom: string;
  valeurInitiale: string;
  options: string[];
  placeholder?: string;
  accent: string;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const boite = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur : sans cela la liste reste ouverte au-dessus
  // des champs suivants.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const filtrees = useMemo(() => {
    const q = filtre.trim().toLocaleLowerCase("fr");
    const base = q ? options.filter((o) => o.toLocaleLowerCase("fr").includes(q)) : options;
    return base.slice(0, 60);
  }, [filtre, options]);

  // `nom` porte la valeur réellement soumise : le formulaire parent lit les
  // champs par leur `name`, la liste n'est qu'une aide à la saisie.
  return (
    <div className="relative" ref={boite}>
      <input type="hidden" name={nom} value={valeur} />

      <button type="button" onClick={() => { setOuvert((o) => !o); setFiltre(""); }}
        className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)]
                   rounded-lg flex items-center gap-2 text-left focus:outline-none">
        <span className={`flex-1 truncate ${valeur ? "" : "text-[var(--text-secondary)] opacity-60"}`}>
          {valeur || placeholder || "— Choisir —"}
        </span>
        {valeur && (
          <span role="button" tabIndex={-1} aria-label="Effacer"
            onClick={(e) => { e.stopPropagation(); setValeur(""); }}
            className="text-[var(--text-secondary)] hover:text-red-500">
            <X size={13} />
          </span>
        )}
        <ChevronDown size={14} className={`text-[var(--text-secondary)] transition ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-primary)]
                        rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--border-primary)] relative">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input autoFocus value={filtre} onChange={(e) => setFiltre(e.target.value)}
              placeholder="Rechercher ou saisir une nouvelle valeur…"
              onKeyDown={(e) => {
                // Entrée valide la frappe libre : indispensable pour créer une
                // valeur absente de la liste.
                if (e.key === "Enter") {
                  e.preventDefault();
                  const t = filtre.trim();
                  if (t) { setValeur(t); setOuvert(false); }
                }
              }}
              className="w-full pl-7 pr-2 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)]
                         rounded-lg focus:outline-none" />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtrees.map((o) => (
              <button key={o} type="button"
                onClick={() => { setValeur(o); setOuvert(false); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--accent-light)] flex items-center gap-2">
                {o === valeur
                  ? <Check size={13} style={{ color: accent }} />
                  : <span className="w-[13px]" />}
                <span className="truncate">{o}</span>
              </button>
            ))}

            {filtrees.length === 0 && (
              <div className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                Aucune valeur existante.
                {filtre.trim() && (
                  <button type="button" onClick={() => { setValeur(filtre.trim()); setOuvert(false); }}
                    className="block mt-1.5 font-semibold" style={{ color: accent }}>
                    Utiliser « {filtre.trim()} »
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Rappel du nombre de valeurs : signale un référentiel qui dérive. */}
          <div className="px-3 py-1.5 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-secondary)]">
            {options.length} valeur(s) existante(s) — Entrée pour saisir une nouvelle
          </div>
        </div>
      )}
    </div>
  );
}
