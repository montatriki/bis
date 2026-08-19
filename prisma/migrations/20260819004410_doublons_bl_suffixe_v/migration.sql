-- Le suffixe `-V` distingue les références présentes à la fois dans
-- `entete_achat` et `entete_vente` en production. Deux bons de livraison ont
-- été dédoublés à tort : leur jumeau sans suffixe est lui aussi une vente,
-- c'est-à-dire la même pièce enregistrée deux fois (BAO230052, BAO230054).
--
-- La production ne les connaît qu'une fois. Conservées, ces copies comptaient
-- double dans le chiffre d'affaires et dans la statistique par article
-- (24012025 : 3 122 unités au lieu de 1 561).
--
-- On supprime la copie suffixée ; la référence d'origine, celle que porte la
-- production, reste.
DELETE FROM "document_lines_ext"
WHERE "refDoc" IN ('BAO230052-V', 'BAO230054-V');

DELETE FROM "documents_ext"
WHERE "refDoc" IN ('BAO230052-V', 'BAO230054-V')
  AND "nature" = 'Vente'
  AND EXISTS (
    SELECT 1 FROM "documents_ext" o
    WHERE o."refDoc" = left("documents_ext"."refDoc", length("documents_ext"."refDoc") - 2)
      AND o."nature" = 'Vente'
  );
