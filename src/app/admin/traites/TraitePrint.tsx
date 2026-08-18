"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  CHAMPS_TRAITE, PAGE_LARGEUR_MM, PAGE_HAUTEUR_MM, TRAITE_HAUTEUR_MM,
  appliquerMiroirs,
} from "@/lib/traite-layout";

// Feuille d'impression de la traite.
//
// Le formulaire papier est PRÉ-IMPRIMÉ : cette feuille ne sort que les valeurs,
// posées au millimètre. Le cadre, la grille et les libellés servent uniquement
// à se repérer à l'écran ; ils disparaissent au moment d'imprimer.
//
// La feuille est rendue DEUX fois :
//  - en place, pour l'aperçu écran (masquée à l'impression) ;
//  - dans un portail greffé sur <body>, qui est la seule version imprimée.
// Ce dédoublement est nécessaire : la carte d'aperçu porte `print:hidden`, et un
// ancêtre en `display:none` retire tout son sous-arbre de la page imprimée —
// aucune règle `visibility` sur l'enfant ne peut le rattraper.

type Props = {
  valeurs: Record<string, string>;
  /** Décalage imprimante en mm, réglé par le panneau de calibrage. */
  offsetX: number;
  offsetY: number;
  /** Repères d'écran : cadre des cases, libellés, grille cm. */
  reperes?: boolean;
  /** Zoom de l'aperçu écran (1 = taille réelle). Sans effet à l'impression. */
  zoom?: number;
};

/** `false` au rendu serveur, `true` une fois hydraté — `document` n'existe qu'ensuite. */
const sabonner = () => () => {};
const monteClient = () => true;
const monteServeur = () => false;

export default function TraitePrint(props: Props) {
  // Le portail ne peut viser <body> qu'après hydratation.
  const monte = useSyncExternalStore(sabonner, monteClient, monteServeur);

  return (
    <>
      {/* Aperçu écran, à l'échelle demandée. */}
      <Feuille {...props} pourImpression={false} />

      {/* Version imprimée : hors de toute carte `print:hidden`. */}
      {monte && createPortal(
        <Feuille {...props} zoom={1} reperes={false} pourImpression />,
        document.body,
      )}
    </>
  );
}

function Feuille({
  valeurs, offsetX, offsetY, reperes = true, zoom = 1, pourImpression,
}: Props & { pourImpression: boolean }) {
  const v = appliquerMiroirs(valeurs);

  return (
    <div
      className={pourImpression ? "traite-portail" : "traite-zoom"}
      style={pourImpression ? undefined : { ["--zoom" as string]: zoom }}
    >
      <div
        id={pourImpression ? "traite-feuille" : undefined}
        className="traite-feuille bg-white relative"
        style={{ width: `${PAGE_LARGEUR_MM}mm`, height: `${PAGE_HAUTEUR_MM}mm` }}
      >
        {/* Repères d'écran uniquement — jamais imprimés. */}
        {reperes && (
          <>
            <div
              className="absolute border-2 border-dashed border-slate-300 print:hidden pointer-events-none"
              style={{ left: 0, top: 0, width: `${PAGE_LARGEUR_MM}mm`, height: `${TRAITE_HAUTEUR_MM}mm` }}
            />
            {/* Grille au centimètre : aide à mesurer un décalage sur le papier. */}
            <div
              className="absolute inset-0 print:hidden pointer-events-none opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #e2e8f0 0.2mm, transparent 0.2mm), linear-gradient(to bottom, #e2e8f0 0.2mm, transparent 0.2mm)",
                backgroundSize: "10mm 10mm",
              }}
            />
            <div className="absolute print:hidden text-[7px] font-bold uppercase tracking-widest text-slate-300"
              style={{ left: "4mm", top: `${TRAITE_HAUTEUR_MM + 4}mm` }}>
              Zone hors traite — le papier pré-imprimé s&apos;arrête ici
            </div>
          </>
        )}

        {CHAMPS_TRAITE.map((c) => {
          const texte = v[c.cle] ?? "";
          return (
            <div
              key={c.cle}
              className="absolute"
              style={{
                left: `${c.x + offsetX}mm`,
                top: `${c.y + offsetY}mm`,
                width: `${c.largeur}mm`,
              }}
            >
              {/* Cadre + libellé de repérage : écran seulement. */}
              {reperes && (
                <>
                  <div
                    className="absolute border border-sky-300/70 rounded-[1px] print:hidden pointer-events-none"
                    style={{ left: "-0.6mm", top: "-1.4mm", width: `${c.largeur}mm`, height: "5mm" }}
                  />
                  <div
                    className="absolute text-[5.5px] font-semibold uppercase tracking-wide text-sky-500 whitespace-nowrap print:hidden pointer-events-none"
                    style={{ left: "-0.6mm", top: "-4mm" }}
                  >
                    {c.libelle}
                  </div>
                </>
              )}

              <div
                className={`leading-tight ${c.mono ? "font-mono tracking-[0.12em]" : ""} ${c.gras ? "font-bold" : ""}`}
                style={{
                  fontSize: `${c.taille ?? 10}pt`,
                  textAlign: c.align ?? "left",
                  color: "#0b1220",
                  // Le montant en lettres est le seul champ qui peut déborder :
                  // on le laisse passer à la ligne, les autres restent sur une ligne.
                  whiteSpace: c.cle === "montantLettres" ? "normal" : "nowrap",
                  overflow: "hidden",
                }}
              >
                {texte}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
