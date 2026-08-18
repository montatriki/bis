-- Les notifications semées faisaient double emploi avec les alertes système,
-- que `/api/notifications` recalcule à chaque appel à partir des données
-- réelles : le panneau affichait chaque alerte deux fois, et la version semée
-- portait des chiffres faux (« 3 bons de commande en attente » pour 1 015,
-- « 1 chèque de 2500 TND arrivé à échéance » pour aucun).
--
-- Seules ces quatre alertes de démonstration sont supprimées ; les
-- notifications produites par l'application à l'exécution sont conservées.
DELETE FROM "notifications"
WHERE "title" IN (
  'Stock minimum atteint',
  'Chèque échu',
  'Véhicule hors ligne',
  'Document à valider'
)
AND "message" IN (
  '2 articles sous le seuil minimum',
  '1 chèque de 2500 TND arrivé à échéance',
  '238TU1019 — HICHEM — hors ligne depuis 2h',
  '3 bons de commande en attente'
);
