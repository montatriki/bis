-- Les tournées planifiées par l'application étaient créées sans véhicule :
-- la barre de tournée du commercial affichait « Véhicule — » alors qu'un
-- camion lui est bien affecté, et le relevé kilométrique n'avait rien à
-- rattacher.
--
-- Les ordres de mission concernés reprennent le véhicule affecté à leur
-- commercial. Les tournées importées de la production ne sont pas touchées :
-- elles portent déjà le véhicule réellement conduit ce jour-là.
UPDATE "erp_missions" m
SET "vehicule" = v."plate"
FROM "commercials" c
JOIN "users" u ON u."id" = c."userId"
JOIN "vehicles" v ON v."id" = c."vehicleId"
WHERE (m."vehicule" IS NULL OR btrim(m."vehicule") = '')
  AND lower(btrim(m."commercial")) = lower(btrim(u."name"));
