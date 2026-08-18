-- Les tiers de charge issus de la table `fournisseurs` de la production sont
-- des fournisseurs portant `Charge = 1` — c'est le cas de VIVO ENERGY, déjà
-- enregistré ainsi. Sept d'entre eux avaient été rangés sous une nature « T »
-- propre à notre base, ce qui les excluait de la liste des fournisseurs (43 au
-- lieu de 50) tout en les laissant visibles dans les tiers de charge.
--
-- La nature devient `F` ; le drapeau `charge`, sur lequel l'écran des tiers
-- filtre déjà, continue de les y faire apparaître.
UPDATE "partners" SET "nature" = 'F' WHERE "nature" = 'T' AND "charge" = 1;
