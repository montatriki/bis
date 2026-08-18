-- Unicité des clients : matricule fiscal et téléphone.
--
-- Index PARTIELS : ils ne portent que sur les valeurs renseignées. Les 2 399
-- tiers importés (matricule fiscal vide, téléphone parfois absent) restent donc
-- valides et modifiables ; seules les nouvelles saisies sont contraintes.

-- Matricule fiscal : aucun conflit dans l'import (0 valeur renseignée).
CREATE UNIQUE INDEX IF NOT EXISTS "partners_matriculeF_unique"
  ON "partners" (upper(btrim("matriculeF")))
  WHERE "matriculeF" IS NOT NULL AND btrim("matriculeF") <> '';

-- Téléphone : comparé sur ses chiffres seuls, indicatif tunisien retiré, pour
-- que « 98 123 456 » et « +216 98123456 » soient bien vus comme identiques.
--
-- L'import contient 53 groupes de doublons hérités (même commerce saisi
-- plusieurs fois) : un index unique global échouerait. On ne contraint donc que
-- les lignes créées par l'application, repérées par `creePar`.
CREATE UNIQUE INDEX IF NOT EXISTS "partners_tel_unique_nouveaux"
  ON "partners" (regexp_replace(regexp_replace(coalesce("tel", ''), '\D', '', 'g'), '^(00216|216)', ''))
  WHERE "creePar" IS NOT NULL
    AND "tel" IS NOT NULL
    AND regexp_replace(coalesce("tel", ''), '\D', '', 'g') <> '';
