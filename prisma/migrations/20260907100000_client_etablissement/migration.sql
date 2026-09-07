-- Établissement du matricule fiscal (4e segment du format tunisien
-- « 1234567 / A / M / 000 » : code, clé, catégorie, n° d'établissement).
-- Les trois premiers segments existaient déjà (codeTva, cletva, categorieTva) ;
-- le formulaire de création terrain saisissait un matricule en un seul champ,
-- que l'ERP d'origine décompose en quatre. Par défaut « 000 » : c'est
-- l'établissement principal, valeur retenue par l'ERP quand rien n'est saisi.
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "etabTva" TEXT;
