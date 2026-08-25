-- Schéma complet de l'application, régénéré pour la base `bechir`.
-- Les clés primaires numériques sont déclarées `serial` : PostgreSQL crée la
-- séquence et attribue l'identifiant à chaque insertion.

-- ─── Types énumérés ───
DO $$ BEGIN
  CREATE TYPE public."AccountClass" AS ENUM ('CLASSE_1', 'CLASSE_2', 'CLASSE_3', 'CLASSE_4', 'CLASSE_5', 'CLASSE_6', 'CLASSE_7');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."DocumentType" AS ENUM ('TIC', 'BL', 'AV', 'BR', 'FAC', 'DEV', 'BC', 'BCC', 'BLC', 'AVC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."MovementType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'INVENTORY', 'RETURN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."OrderStatus" AS ENUM ('PENDING', 'VALIDATED', 'LOADING', 'IN_ROUTE', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."ReglementMode" AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT', 'TRAITE', 'CARTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."ReglementSens" AS ENUM ('CLIENT', 'FOURNISSEUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."Role" AS ENUM ('ADMIN', 'MANAGER', 'COMMERCIAL', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."VehicleStatus" AS ENUM ('ACTIVE', 'PARKED', 'OFFLINE', 'BREAKDOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tables ───
CREATE TABLE IF NOT EXISTS public._prisma_migrations
(
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" text COLLATE pg_catalog."default",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT _prisma_migrations_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.account_entries
(
    "id" serial NOT NULL,
    "label" text COLLATE pg_catalog."default",
    "debit" double precision DEFAULT 0 NOT NULL,
    "credit" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "journalEntryId" integer NOT NULL,
    "accountId" integer NOT NULL,
    CONSTRAINT account_entries_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.accounts
(
    "id" serial NOT NULL,
    "number" text COLLATE pg_catalog."default" NOT NULL,
    "label" text COLLATE pg_catalog."default" NOT NULL,
    "class" "AccountClass" NOT NULL,
    "isStandard" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "parentId" integer,
    CONSTRAINT accounts_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.alertes_acquittees
(
    "id" serial NOT NULL,
    "cle" text COLLATE pg_catalog."default" NOT NULL,
    "empreinte" text COLLATE pg_catalog."default" NOT NULL,
    "acquitteA" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" integer NOT NULL,
    CONSTRAINT alertes_acquittees_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.articles_ext
(
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "codeBarre" text COLLATE pg_catalog."default",
    "designation" text COLLATE pg_catalog."default" NOT NULL,
    "caract" text COLLATE pg_catalog."default",
    "catalogue" text COLLATE pg_catalog."default",
    "codeCatalogue" integer DEFAULT 0 NOT NULL,
    "famille" integer,
    "sousFamille" integer,
    "unite" text COLLATE pg_catalog."default",
    "puAchat" double precision DEFAULT 0 NOT NULL,
    "puAchatTtc" double precision DEFAULT 0 NOT NULL,
    "pmp" double precision DEFAULT 0 NOT NULL,
    "dpa" double precision DEFAULT 0 NOT NULL,
    "puInv" double precision DEFAULT 0 NOT NULL,
    "tarif1Ht" double precision DEFAULT 0 NOT NULL,
    "tarif2Ht" double precision DEFAULT 0 NOT NULL,
    "tarif3Ht" double precision DEFAULT 0 NOT NULL,
    "maTarif1" double precision DEFAULT 0 NOT NULL,
    "tauxTva" double precision DEFAULT 0 NOT NULL,
    "tauxFodec" double precision DEFAULT 0 NOT NULL,
    "stockIni" double precision DEFAULT 0 NOT NULL,
    "entrer" double precision DEFAULT 0 NOT NULL,
    "sortie" double precision DEFAULT 0 NOT NULL,
    "enStock" double precision DEFAULT 0 NOT NULL,
    "vendable" integer DEFAULT 1 NOT NULL,
    "achetable" integer DEFAULT 1 NOT NULL,
    "service" integer DEFAULT 0 NOT NULL,
    "archiver" integer DEFAULT 0 NOT NULL,
    "refOrigine" text COLLATE pg_catalog."default",
    "kind" text COLLATE pg_catalog."default" DEFAULT 'P'::text NOT NULL,
    "cmpteAchatImp" text COLLATE pg_catalog."default",
    "cmpteAchatLoc" text COLLATE pg_catalog."default",
    "cmpteVente" text COLLATE pg_catalog."default",
    "cmpteVenteExo" text COLLATE pg_catalog."default",
    "cmpteVenteExp" text COLLATE pg_catalog."default",
    "commission" double precision DEFAULT 0 NOT NULL,
    "conversion" double precision DEFAULT 1 NOT NULL,
    "fab" text COLLATE pg_catalog."default",
    "fifo" integer DEFAULT 0 NOT NULL,
    "fodecAchat" double precision DEFAULT 0 NOT NULL,
    "fodecVente" double precision DEFAULT 0 NOT NULL,
    "gerSerie" integer DEFAULT 0 NOT NULL,
    "gesLot" integer DEFAULT 0 NOT NULL,
    "lifo" integer DEFAULT 0 NOT NULL,
    "margePct" double precision DEFAULT 0 NOT NULL,
    "marque" text COLLATE pg_catalog."default",
    "remiseMax" double precision DEFAULT 0 NOT NULL,
    "remiseParQte" integer DEFAULT 0 NOT NULL,
    "sousCategorie" text COLLATE pg_catalog."default",
    "stMax" double precision DEFAULT 0 NOT NULL,
    "stMin" double precision DEFAULT 0 NOT NULL,
    "uniteEntree" text COLLATE pg_catalog."default",
    CONSTRAINT articles_ext_pkey PRIMARY KEY ("refArt")
);

CREATE TABLE IF NOT EXISTS public.bank_accounts
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "bank" text COLLATE pg_catalog."default" NOT NULL,
    "rib" text COLLATE pg_catalog."default",
    "iban" text COLLATE pg_catalog."default",
    "label" text COLLATE pg_catalog."default" NOT NULL,
    "balance" double precision DEFAULT 0 NOT NULL,
    "type" text COLLATE pg_catalog."default" DEFAULT 'BANQUE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_accounts_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.bilan_comptable
(
    "id" serial NOT NULL,
    "exerciceId" integer NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "montant" double precision DEFAULT 0 NOT NULL,
    "type" text COLLATE pg_catalog."default" NOT NULL,
    "rubrique" text COLLATE pg_catalog."default",
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "dateArret" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bilan_comptable_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.bon_appro_lignes
(
    "id" serial NOT NULL,
    "bonId" integer NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "designation" text COLLATE pg_catalog."default",
    "qteDemandee" double precision DEFAULT 0 NOT NULL,
    "qteServie" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bon_appro_lignes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.bons_approvisionnement
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default" NOT NULL,
    "commercial" text COLLATE pg_catalog."default",
    "vehicule" text COLLATE pg_catalog."default",
    "depot" text COLLATE pg_catalog."default",
    "dayId" integer,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Demandé'::text NOT NULL,
    "observation" text COLLATE pg_catalog."default",
    "refMouvement" text COLLATE pg_catalog."default",
    "dateDemande" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dateService" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bons_approvisionnement_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.borderau_lignes
(
    "id" serial NOT NULL,
    "borderauId" integer NOT NULL,
    "reglementId" integer,
    "chequeId" integer,
    "numPiece" text COLLATE pg_catalog."default",
    "tiersNom" text COLLATE pg_catalog."default",
    "montant" double precision DEFAULT 0 NOT NULL,
    "echeance" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT borderau_lignes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.catalogue_art
(
    "code" integer NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT catalogue_art_pkey PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS public.charges_fixes
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default",
    "du" timestamp(3) without time zone NOT NULL,
    "au" timestamp(3) without time zone NOT NULL,
    "montant" double precision DEFAULT 0 NOT NULL,
    "montantJr" double precision DEFAULT 0 NOT NULL,
    "nbJour" integer DEFAULT 0 NOT NULL,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Brouillon'::text NOT NULL,
    "dateRepartition" timestamp(3) without time zone,
    "lignesTouchees" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT charges_fixes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.cheques
(
    "id" serial NOT NULL,
    "chequierId" integer NOT NULL,
    "numero" integer NOT NULL,
    "montant" double precision DEFAULT 0 NOT NULL,
    "dateEmis" timestamp(3) without time zone,
    "echeance" timestamp(3) without time zone,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Emis'::text NOT NULL,
    "tiersNom" text COLLATE pg_catalog."default",
    "tiersCode" integer,
    "refDoc" text COLLATE pg_catalog."default",
    "borderauId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cheques_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.chequiers
(
    "id" serial NOT NULL,
    "banque" text COLLATE pg_catalog."default" NOT NULL,
    "numCompte" text COLLATE pg_catalog."default",
    "serie" text COLLATE pg_catalog."default",
    "numDebut" integer NOT NULL,
    "numFin" integer NOT NULL,
    "suivant" integer DEFAULT 0 NOT NULL,
    "epuise" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chequiers_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.claims
(
    "id" serial NOT NULL,
    "type" text COLLATE pg_catalog."default" NOT NULL,
    "description" text COLLATE pg_catalog."default" NOT NULL,
    "status" text COLLATE pg_catalog."default" DEFAULT 'OPEN'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" integer NOT NULL,
    CONSTRAINT claims_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.clients
(
    "id" serial NOT NULL,
    "name" text COLLATE pg_catalog."default" NOT NULL,
    "address" text COLLATE pg_catalog."default",
    "city" text COLLATE pg_catalog."default",
    "governorate" text COLLATE pg_catalog."default",
    "phone" text COLLATE pg_catalog."default",
    "email" text COLLATE pg_catalog."default",
    "taxId" text COLLATE pg_catalog."default",
    "rc" text COLLATE pg_catalog."default",
    "balance" double precision DEFAULT 0 NOT NULL,
    "creditLimit" double precision DEFAULT 5000 NOT NULL,
    "category" text COLLATE pg_catalog."default" DEFAULT 'Grossiste'::text,
    "familyClient" text COLLATE pg_catalog."default",
    "isPlanned" boolean DEFAULT false NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "riskScore" integer DEFAULT 0 NOT NULL,
    "potentialScore" integer DEFAULT 50 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" integer,
    "commercialId" integer,
    CONSTRAINT clients_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.commercials
(
    "id" serial NOT NULL,
    "zone" text COLLATE pg_catalog."default",
    "targetCA" double precision DEFAULT 5000 NOT NULL,
    "missionCode" text COLLATE pg_catalog."default",
    "currentLat" double precision,
    "currentLng" double precision,
    "lastGpsUpdate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" integer NOT NULL,
    "vehicleId" integer,
    CONSTRAINT commercials_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.component_user_droit
(
    "id" serial NOT NULL,
    "login" text COLLATE pg_catalog."default" NOT NULL,
    "fonctionId" integer NOT NULL,
    "valeur" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT component_user_droit_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.depots
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "name" text COLLATE pg_catalog."default" NOT NULL,
    "address" text COLLATE pg_catalog."default",
    "isMain" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT depots_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.document_lines
(
    "id" serial NOT NULL,
    "qty" double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "discount" double precision DEFAULT 0 NOT NULL,
    "totalHT" double precision NOT NULL,
    "totalTTC" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "documentId" integer NOT NULL,
    "productId" integer NOT NULL,
    CONSTRAINT document_lines_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.document_lines_ext
(
    "id" serial NOT NULL,
    "refDoc" text COLLATE pg_catalog."default" NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "designation" text COLLATE pg_catalog."default" NOT NULL,
    "unite" text COLLATE pg_catalog."default",
    "qte" double precision DEFAULT 0 NOT NULL,
    "puHt" double precision DEFAULT 0 NOT NULL,
    "remise" double precision DEFAULT 0 NOT NULL,
    "tauxTva" double precision DEFAULT 0 NOT NULL,
    "tauxFodec" double precision DEFAULT 0 NOT NULL,
    "thtBrut" double precision DEFAULT 0 NOT NULL,
    "thtNet" double precision DEFAULT 0 NOT NULL,
    "totTva" double precision DEFAULT 0 NOT NULL,
    "ttcNet" double precision DEFAULT 0 NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "docLiee" text COLLATE pg_catalog."default",
    "charge" double precision DEFAULT 0 NOT NULL,
    CONSTRAINT document_lines_ext_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.documents
(
    "id" serial NOT NULL,
    "type" "DocumentType" NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "totalHT" double precision DEFAULT 0 NOT NULL,
    "totalTTC" double precision DEFAULT 0 NOT NULL,
    "totalTVA" double precision DEFAULT 0 NOT NULL,
    "discount" double precision DEFAULT 0 NOT NULL,
    "status" text COLLATE pg_catalog."default" DEFAULT 'PENDING'::text NOT NULL,
    "isValidated" boolean DEFAULT false NOT NULL,
    "notes" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" integer NOT NULL,
    "commercialId" integer,
    CONSTRAINT documents_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.documents_ext
(
    "refDoc" text COLLATE pg_catalog."default" NOT NULL,
    "nature" text COLLATE pg_catalog."default" NOT NULL,
    "typeDoc" text COLLATE pg_catalog."default" NOT NULL,
    "caraDoc" text COLLATE pg_catalog."default",
    "libDoc" text COLLATE pg_catalog."default",
    "dateDoc" timestamp(3) without time zone,
    "codeCli" integer,
    "raisonSocial" text COLLATE pg_catalog."default",
    "adrCli" text COLLATE pg_catalog."default",
    "mf" text COLLATE pg_catalog."default",
    "numSeq" text COLLATE pg_catalog."default",
    "thtBrut" double precision DEFAULT 0 NOT NULL,
    "totRemise" double precision DEFAULT 0 NOT NULL,
    "thtNet" double precision DEFAULT 0 NOT NULL,
    "totTva" double precision DEFAULT 0 NOT NULL,
    "timbre" double precision DEFAULT 0 NOT NULL,
    "totFodec" double precision DEFAULT 0 NOT NULL,
    "ttcNet" double precision DEFAULT 0 NOT NULL,
    "soldeDoc" double precision DEFAULT 0 NOT NULL,
    "totalRegle" double precision DEFAULT 0 NOT NULL,
    "etat" text COLLATE pg_catalog."default",
    "modePayement" text COLLATE pg_catalog."default",
    "codeMag" integer,
    "utilisateur" text COLLATE pg_catalog."default",
    "vehicule" text COLLATE pg_catalog."default",
    "commercial" text COLLATE pg_catalog."default",
    "echeance" timestamp(3) without time zone,
    "couleur" text COLLATE pg_catalog."default",
    "dateValide" timestamp(3) without time zone,
    "valide" boolean DEFAULT false NOT NULL,
    "docSource" text COLLATE pg_catalog."default",
    "transformeEn" text COLLATE pg_catalog."default",
    "dayId" integer,
    "transferFrom" text COLLATE pg_catalog."default",
    "transferTo" text COLLATE pg_catalog."default",
    "generer" boolean DEFAULT false NOT NULL,
    "facturer" boolean DEFAULT false NOT NULL,
    "comptabiliser" boolean DEFAULT false NOT NULL,
    "tiers" text COLLATE pg_catalog."default",
    CONSTRAINT documents_ext_pkey PRIMARY KEY ("refDoc")
);

CREATE TABLE IF NOT EXISTS public.ecritures_compta
(
    "id" serial NOT NULL,
    "exerciceId" integer NOT NULL,
    "codeJournal" text COLLATE pg_catalog."default" NOT NULL,
    "numPiece" text COLLATE pg_catalog."default" NOT NULL,
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "numCompte" text COLLATE pg_catalog."default" NOT NULL,
    "libelleCompte" text COLLATE pg_catalog."default",
    "libelleEcriture" text COLLATE pg_catalog."default",
    "dateEcriture" timestamp(3) without time zone NOT NULL,
    "refDoc" text COLLATE pg_catalog."default",
    "debit" double precision DEFAULT 0 NOT NULL,
    "credit" double precision DEFAULT 0 NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ecritures_compta_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.enregistrements_visite
(
    "id" serial NOT NULL,
    "ligneId" integer NOT NULL,
    "commercial" text COLLATE pg_catalog."default" NOT NULL,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "latitude" double precision,
    "longitude" double precision,
    "debut" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "fin" timestamp(3) without time zone,
    "duree" integer DEFAULT 0 NOT NULL,
    "audio" text COLLATE pg_catalog."default",
    "transcript" text COLLATE pg_catalog."default",
    "motifFin" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT enregistrements_visite_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.erp_accounts
(
    "id" integer NOT NULL,
    "type" text COLLATE pg_catalog."default",
    "rib" text COLLATE pg_catalog."default",
    "libelle" text COLLATE pg_catalog."default",
    "banque" text COLLATE pg_catalog."default",
    "agence" text COLLATE pg_catalog."default",
    "nature" text COLLATE pg_catalog."default",
    "codeJournal" text COLLATE pg_catalog."default",
    "planComptable" text COLLATE pg_catalog."default",
    CONSTRAINT erp_accounts_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.erp_borderaux
(
    "id" integer NOT NULL,
    "dateBord" timestamp(3) without time zone,
    "numCompte" text COLLATE pg_catalog."default",
    "total" double precision DEFAULT 0 NOT NULL,
    "type" text COLLATE pg_catalog."default",
    "mtEsp" double precision DEFAULT 0 NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default",
    CONSTRAINT erp_borderaux_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.erp_missions
(
    "id" integer NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default",
    "commercial" text COLLATE pg_catalog."default",
    "vehicule" text COLLATE pg_catalog."default",
    "dateOrdre" timestamp(3) without time zone,
    "kmDepart" double precision DEFAULT 0 NOT NULL,
    "kmArrive" double precision DEFAULT 0 NOT NULL,
    "etat" text COLLATE pg_catalog."default",
    "du" timestamp(3) without time zone,
    "au" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "objectifCA" double precision DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT erp_missions_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.erp_reglements
(
    "id" integer NOT NULL,
    "sens" text COLLATE pg_catalog."default" NOT NULL,
    "datePay" timestamp(3) without time zone,
    "montant" double precision DEFAULT 0 NOT NULL,
    "echeance" text COLLATE pg_catalog."default",
    "numPiece" text COLLATE pg_catalog."default",
    "numDoc" text COLLATE pg_catalog."default",
    "etat" text COLLATE pg_catalog."default",
    "modePay" text COLLATE pg_catalog."default",
    "tiersCode" integer,
    "tiersNom" text COLLATE pg_catalog."default",
    "utilisateur" text COLLATE pg_catalog."default",
    "banque" text COLLATE pg_catalog."default",
    "idEmplac" integer,
    "commentaire" text COLLATE pg_catalog."default",
    "dayId" integer,
    "idSource" integer,
    "borderauId" integer,
    "lettrage" text COLLATE pg_catalog."default",
    CONSTRAINT erp_reglements_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.evenements_opportunite
(
    "id" serial NOT NULL,
    "opportuniteId" integer NOT NULL,
    "type" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "dateEvent" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "auteur" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT evenements_opportunite_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.exercices_compta
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "annee" integer NOT NULL,
    "dateDeb" timestamp(3) without time zone NOT NULL,
    "dateFin" timestamp(3) without time zone NOT NULL,
    "cloture" boolean DEFAULT false NOT NULL,
    "courant" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT exercices_compta_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.fam_art
(
    "code" integer NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "charge" boolean DEFAULT false NOT NULL,
    "lettreCompta" text COLLATE pg_catalog."default",
    "image" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fam_art_pkey PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS public.frais_mission
(
    "id" serial NOT NULL,
    "dayId" integer NOT NULL,
    "refArt" text COLLATE pg_catalog."default",
    "libelle" text COLLATE pg_catalog."default",
    "montant" double precision DEFAULT 0 NOT NULL,
    "puAchat" double precision DEFAULT 0 NOT NULL,
    "carburant" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT frais_mission_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gmao_machines
(
    "id" serial NOT NULL,
    "numSerie" text COLLATE pg_catalog."default",
    "machine" text COLLATE pg_catalog."default" NOT NULL,
    "posteCharge" text COLLATE pg_catalog."default",
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Fonctionnel'::text NOT NULL,
    "dateMiseEnMarche" timestamp(3) without time zone,
    "coutAcquisition" double precision DEFAULT 0 NOT NULL,
    "capaciteHoraire" double precision DEFAULT 0 NOT NULL,
    "coutHoraire" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gmao_machines_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_gammes
(
    "id" serial NOT NULL,
    "gamme" text COLLATE pg_catalog."default" NOT NULL,
    "desGamme" text COLLATE pg_catalog."default",
    "refArt" text COLLATE pg_catalog."default",
    "site" text COLLATE pg_catalog."default",
    "alternative" text COLLATE pg_catalog."default",
    "versionMaj" text COLLATE pg_catalog."default",
    "versionMin" text COLLATE pg_catalog."default",
    "dateRef" timestamp(3) without time zone,
    "dateDebutVal" timestamp(3) without time zone,
    "dateFinVal" timestamp(3) without time zone,
    "elaboration" boolean DEFAULT true NOT NULL,
    "exploitation" boolean DEFAULT false NOT NULL,
    "qteMin" double precision DEFAULT 0 NOT NULL,
    "qteMax" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_gammes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_jalonnements
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT gpao_jalonnements_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_nomenclature_lignes
(
    "id" serial NOT NULL,
    "refNom" text COLLATE pg_catalog."default" NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "desArt" text COLLATE pg_catalog."default",
    "typeComposant" text COLLATE pg_catalog."default" DEFAULT 'MP'::text NOT NULL,
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "numSequence" integer DEFAULT 0 NOT NULL,
    "qte" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_nomenclature_lignes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_nomenclatures
(
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "desArt" text COLLATE pg_catalog."default",
    "site" text COLLATE pg_catalog."default",
    "alternative" text COLLATE pg_catalog."default",
    "versionMaj" text COLLATE pg_catalog."default",
    "versionMin" text COLLATE pg_catalog."default",
    "uniteStock" text COLLATE pg_catalog."default",
    "uniteGes" text COLLATE pg_catalog."default",
    "qteBase" double precision DEFAULT 1 NOT NULL,
    "dateRef" timestamp(3) without time zone,
    "dateDebutVal" timestamp(3) without time zone,
    "dateFinVal" timestamp(3) without time zone,
    "elaboration" boolean DEFAULT true NOT NULL,
    "exploitation" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_nomenclatures_pkey PRIMARY KEY ("refArt")
);

CREATE TABLE IF NOT EXISTS public.gpao_operations
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "typeJalonnement" text COLLATE pg_catalog."default",
    "operationSuivante" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_operations_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_operations_gamme
(
    "id" serial NOT NULL,
    "gammeId" integer NOT NULL,
    "operationId" integer,
    "desOperation" text COLLATE pg_catalog."default" NOT NULL,
    "numSequence" integer DEFAULT 0 NOT NULL,
    "posteChargeId" integer,
    "nbPosteCharge" integer DEFAULT 1 NOT NULL,
    "posteMo" text COLLATE pg_catalog."default",
    "nbPosteMo" integer DEFAULT 0 NOT NULL,
    "tempsReg" double precision DEFAULT 0 NOT NULL,
    "tempsPreparation" double precision DEFAULT 0 NOT NULL,
    "tempsOperatoire" double precision DEFAULT 0 NOT NULL,
    "qteBase" double precision DEFAULT 1 NOT NULL,
    "coeffCharge" double precision DEFAULT 1 NOT NULL,
    "efficience" double precision DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_operations_gamme_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_operations_of
(
    "id" serial NOT NULL,
    "refDoc" text COLLATE pg_catalog."default" NOT NULL,
    "desArt" text COLLATE pg_catalog."default",
    "operationId" integer,
    "desOperation" text COLLATE pg_catalog."default" NOT NULL,
    "numSequence" integer DEFAULT 0 NOT NULL,
    "posteChargeId" integer,
    "posteMo" text COLLATE pg_catalog."default",
    "tempsReg" double precision DEFAULT 0 NOT NULL,
    "tempsPreparation" double precision DEFAULT 0 NOT NULL,
    "tempsOperatoire" double precision DEFAULT 0 NOT NULL,
    "duree" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_operations_of_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_plannification
(
    "id" serial NOT NULL,
    "refDoc" text COLLATE pg_catalog."default" NOT NULL,
    "operationId" integer,
    "desOperation" text COLLATE pg_catalog."default",
    "dateDebut" timestamp(3) without time zone NOT NULL,
    "dateFin" timestamp(3) without time zone NOT NULL,
    "duree" double precision DEFAULT 0 NOT NULL,
    "typeDuree" text COLLATE pg_catalog."default" DEFAULT 'Temps opératoire'::text NOT NULL,
    "posteChargeId" integer,
    "posteMo" text COLLATE pg_catalog."default",
    "disponibilite" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT gpao_plannification_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gpao_postes_charge
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "centre" text COLLATE pg_catalog."default",
    "mainOeuvre" boolean DEFAULT false NOT NULL,
    "machine" boolean DEFAULT false NOT NULL,
    "sousTraitance" boolean DEFAULT false NOT NULL,
    "nbRessources" double precision DEFAULT 1 NOT NULL,
    "heureDebut" text COLLATE pg_catalog."default" DEFAULT '08:00'::text NOT NULL,
    "heureFin" text COLLATE pg_catalog."default" DEFAULT '17:00'::text NOT NULL,
    "pauseDebut" text COLLATE pg_catalog."default" DEFAULT '12:00'::text NOT NULL,
    "pauseFin" text COLLATE pg_catalog."default" DEFAULT '13:00'::text NOT NULL,
    "coutHoraire" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT gpao_postes_charge_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.gps_positions
(
    "id" serial NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "speed" double precision DEFAULT 0 NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "commercialId" integer,
    "vehicleId" integer,
    CONSTRAINT gps_positions_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_bulletin
(
    "id" serial NOT NULL,
    "codeEmploye" text COLLATE pg_catalog."default" NOT NULL,
    "sessionId" integer NOT NULL,
    "salaireBase" double precision DEFAULT 0 NOT NULL,
    "primes" double precision DEFAULT 0 NOT NULL,
    "heuresSupp" double precision DEFAULT 0 NOT NULL,
    "brutImposable" double precision DEFAULT 0 NOT NULL,
    "cnss" double precision DEFAULT 0 NOT NULL,
    "irpp" double precision DEFAULT 0 NOT NULL,
    "css" double precision DEFAULT 0 NOT NULL,
    "autresRet" double precision DEFAULT 0 NOT NULL,
    "netAPayer" double precision DEFAULT 0 NOT NULL,
    "jourTravailles" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT grh_bulletin_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_categorie
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    CONSTRAINT grh_categorie_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_conge
(
    "id" serial NOT NULL,
    "codeEmploye" text COLLATE pg_catalog."default" NOT NULL,
    "sessionId" integer,
    "dateDebut" timestamp(3) without time zone NOT NULL,
    "dateFin" timestamp(3) without time zone NOT NULL,
    "nbrJours" double precision DEFAULT 0 NOT NULL,
    "motif" text COLLATE pg_catalog."default",
    "statut" text COLLATE pg_catalog."default" DEFAULT 'En attente'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT grh_conge_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_contrats
(
    "id" serial NOT NULL,
    "personnelId" integer NOT NULL,
    "typeContrat" text COLLATE pg_catalog."default" DEFAULT 'CDI'::text NOT NULL,
    "reference" text COLLATE pg_catalog."default",
    "dateDebut" timestamp(3) without time zone NOT NULL,
    "dateFin" timestamp(3) without time zone,
    "essaiMois" double precision DEFAULT 0 NOT NULL,
    "salaireBrut" double precision DEFAULT 0 NOT NULL,
    "poste" text COLLATE pg_catalog."default",
    "lieuTravail" text COLLATE pg_catalog."default",
    "horaire" text COLLATE pg_catalog."default",
    "observation" text COLLATE pg_catalog."default",
    "etat" text COLLATE pg_catalog."default" DEFAULT 'En cours'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT grh_contrats_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_echelon
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    CONSTRAINT grh_echelon_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_fonction
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    CONSTRAINT grh_fonction_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_grade
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    CONSTRAINT grh_grade_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_impo
(
    "id" serial NOT NULL,
    "du" double precision NOT NULL,
    "au" double precision,
    "taux" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT grh_impo_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_personnel
(
    "id" serial NOT NULL,
    "codeEmploye" text COLLATE pg_catalog."default" NOT NULL,
    "nom" text COLLATE pg_catalog."default" NOT NULL,
    "prenom" text COLLATE pg_catalog."default",
    "cin" text COLLATE pg_catalog."default",
    "lieuCin" text COLLATE pg_catalog."default",
    "dateCin" timestamp(3) without time zone,
    "sexe" text COLLATE pg_catalog."default",
    "dateNaiss" timestamp(3) without time zone,
    "lieuNaiss" text COLLATE pg_catalog."default",
    "situationFamiliale" text COLLATE pg_catalog."default",
    "chefFamille" boolean DEFAULT false NOT NULL,
    "nbrEnfants" integer DEFAULT 0 NOT NULL,
    "nbrHandicape" integer DEFAULT 0 NOT NULL,
    "adresse" text COLLATE pg_catalog."default",
    "tel" text COLLATE pg_catalog."default",
    "email" text COLLATE pg_catalog."default",
    "numContrat" text COLLATE pg_catalog."default",
    "contratDu" timestamp(3) without time zone,
    "contratAu" timestamp(3) without time zone,
    "dateEmbauche" timestamp(3) without time zone,
    "dateDepart" timestamp(3) without time zone,
    "titularisation" timestamp(3) without time zone,
    "partant" boolean DEFAULT false NOT NULL,
    "traitement" text COLLATE pg_catalog."default",
    "salaireBase" double precision DEFAULT 0 NOT NULL,
    "coutHoraire" double precision DEFAULT 0 NOT NULL,
    "njTraitNormal" double precision DEFAULT 26 NOT NULL,
    "njMaxMois" double precision DEFAULT 30 NOT NULL,
    "smigar" boolean DEFAULT false NOT NULL,
    "plafondCredit" double precision DEFAULT 0 NOT NULL,
    "soldeConge" double precision DEFAULT 0 NOT NULL,
    "prixConge" double precision DEFAULT 0 NOT NULL,
    "numCnss" text COLLATE pg_catalog."default",
    "typeCnss" text COLLATE pg_catalog."default",
    "pourcentageAssGro" double precision DEFAULT 0 NOT NULL,
    "pourcentageAssAccTra" double precision DEFAULT 0 NOT NULL,
    "montExoAss" double precision DEFAULT 0 NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "fonctionId" integer,
    "gradeId" integer,
    "serviceId" integer,
    "categorieId" integer,
    "echelonId" integer,
    CONSTRAINT grh_personnel_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_pointage
(
    "id" serial NOT NULL,
    "codeEmploye" text COLLATE pg_catalog."default" NOT NULL,
    "sessionId" integer NOT NULL,
    "regime" text COLLATE pg_catalog."default" DEFAULT 'M'::text NOT NULL,
    "presenceJ" double precision DEFAULT 0 NOT NULL,
    "presenceH" double precision DEFAULT 0 NOT NULL,
    "ferieJ" double precision DEFAULT 0 NOT NULL,
    "ferieH" double precision DEFAULT 0 NOT NULL,
    "ferieTrJ" double precision DEFAULT 0 NOT NULL,
    "ferieTrH" double precision DEFAULT 0 NOT NULL,
    "congeJ" double precision DEFAULT 0 NOT NULL,
    "congeH" double precision DEFAULT 0 NOT NULL,
    "absenceJ" double precision DEFAULT 0 NOT NULL,
    "absenceH" double precision DEFAULT 0 NOT NULL,
    "hSupp" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT grh_pointage_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_service
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    CONSTRAINT grh_service_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_session
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "mois" integer,
    "annee" integer,
    "nHeures" double precision DEFAULT 0 NOT NULL,
    "nJours" double precision DEFAULT 26 NOT NULL,
    "cloturee" boolean DEFAULT false NOT NULL,
    "dateDeb" timestamp(3) without time zone,
    "dateFin" timestamp(3) without time zone,
    CONSTRAINT grh_session_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grh_typecnss
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "retCnss" double precision DEFAULT 9.18 NOT NULL,
    "chCnss" double precision DEFAULT 16.57 NOT NULL,
    "retCavis" double precision DEFAULT 0 NOT NULL,
    "chCavis" double precision DEFAULT 0 NOT NULL,
    "retenuIrpp" boolean DEFAULT true NOT NULL,
    "parDefaut" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT grh_typecnss_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.grille_salaire
(
    "id" serial NOT NULL,
    "regime" text COLLATE pg_catalog."default" NOT NULL,
    "categorie" text COLLATE pg_catalog."default" NOT NULL,
    "echelon" text COLLATE pg_catalog."default" NOT NULL,
    "salaireBase" double precision DEFAULT 0 NOT NULL,
    "dureeEchelon" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT grille_salaire_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.inventaire_lignes
(
    "id" serial NOT NULL,
    "inventaireId" integer NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "designation" text COLLATE pg_catalog."default",
    "qteTheorique" double precision DEFAULT 0 NOT NULL,
    "qteComptee" double precision DEFAULT 0 NOT NULL,
    "ecart" double precision DEFAULT 0 NOT NULL,
    "pmp" double precision DEFAULT 0 NOT NULL,
    "valeurEcart" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT inventaire_lignes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.inventaires
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default",
    "emplacement" text COLLATE pg_catalog."default",
    "dateInv" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Brouillon'::text NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default",
    "observation" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT inventaires_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.journal_entries
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "journal" text COLLATE pg_catalog."default" DEFAULT 'OD'::text NOT NULL,
    "date" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "label" text COLLATE pg_catalog."default" NOT NULL,
    "totalDebit" double precision DEFAULT 0 NOT NULL,
    "totalCredit" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT journal_entries_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.journaux_compta
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "type" text COLLATE pg_catalog."default" DEFAULT 'OD'::text NOT NULL,
    CONSTRAINT journaux_compta_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.ligne_mission
(
    "id" serial NOT NULL,
    "dayId" integer NOT NULL,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "motif" text COLLATE pg_catalog."default",
    "objectif" double precision DEFAULT 0 NOT NULL,
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'À visiter'::text NOT NULL,
    "heurePrevue" text COLLATE pg_catalog."default",
    "dateVisite" timestamp(3) without time zone,
    "latitude" double precision,
    "longitude" double precision,
    "commentaire" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT ligne_mission_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.list_droit_access
(
    "id" serial NOT NULL,
    "component" text COLLATE pg_catalog."default" NOT NULL,
    "funcName" text COLLATE pg_catalog."default" NOT NULL,
    "funcLib" text COLLATE pg_catalog."default" NOT NULL,
    "typeFn" text COLLATE pg_catalog."default" DEFAULT 'action'::text NOT NULL,
    "numOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT list_droit_access_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.managers
(
    "id" serial NOT NULL,
    "department" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" integer NOT NULL,
    CONSTRAINT managers_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.mouvements_compte
(
    "id" serial NOT NULL,
    "compteId" integer NOT NULL,
    "dateMvt" timestamp(3) without time zone NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "sens" text COLLATE pg_catalog."default" NOT NULL,
    "montant" double precision DEFAULT 0 NOT NULL,
    "soldeApres" double precision DEFAULT 0 NOT NULL,
    "reference" text COLLATE pg_catalog."default",
    "refDoc" text COLLATE pg_catalog."default",
    "reglementId" integer,
    "borderauId" integer,
    "utilisateur" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT mouvements_compte_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.mouvements_depot
(
    "id" serial NOT NULL,
    "refDoc" text COLLATE pg_catalog."default",
    "typeDoc" text COLLATE pg_catalog."default",
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "designation" text COLLATE pg_catalog."default",
    "quantite" double precision DEFAULT 0 NOT NULL,
    "source" text COLLATE pg_catalog."default",
    "destination" text COLLATE pg_catalog."default",
    "utilisateur" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT mouvements_depot_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.notifications
(
    "id" serial NOT NULL,
    "title" text COLLATE pg_catalog."default" NOT NULL,
    "message" text COLLATE pg_catalog."default" NOT NULL,
    "type" text COLLATE pg_catalog."default" NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" integer NOT NULL,
    CONSTRAINT notifications_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.numeros_serie
(
    "id" serial NOT NULL,
    "numSerie" text COLLATE pg_catalog."default" NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "desArt" text COLLATE pg_catalog."default",
    "sens" text COLLATE pg_catalog."default" DEFAULT 'Achat'::text NOT NULL,
    "refDoc" text COLLATE pg_catalog."default",
    "ligneId" integer,
    "codeCli" integer,
    "tiersNom" text COLLATE pg_catalog."default",
    "dateDoc" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT numeros_serie_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.objectifs
(
    "id" serial NOT NULL,
    "vendeur" text COLLATE pg_catalog."default" NOT NULL,
    "mois" integer NOT NULL,
    "annee" integer NOT NULL,
    "objectifCA" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT objectifs_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.opportunites
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "etape" text COLLATE pg_catalog."default" DEFAULT 'Prospection'::text NOT NULL,
    "montant" double precision DEFAULT 0 NOT NULL,
    "probabilite" integer DEFAULT 50 NOT NULL,
    "source" text COLLATE pg_catalog."default",
    "suiviPar" text COLLATE pg_catalog."default",
    "description" text COLLATE pg_catalog."default",
    "dateCloture" timestamp(3) without time zone,
    "archiver" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT opportunites_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.order_lines
(
    "id" serial NOT NULL,
    "qty" integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalTTC" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "orderId" integer NOT NULL,
    "productId" integer NOT NULL,
    CONSTRAINT order_lines_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.orders
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "status" "OrderStatus" DEFAULT 'PENDING'::"OrderStatus" NOT NULL,
    "totalTTC" double precision DEFAULT 0 NOT NULL,
    "deliveryDate" timestamp(3) without time zone,
    "notes" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" integer NOT NULL,
    CONSTRAINT orders_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.panier_lignes
(
    "id" serial NOT NULL,
    "panierId" integer NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "designation" text COLLATE pg_catalog."default",
    "unite" text COLLATE pg_catalog."default",
    "qte" double precision DEFAULT 1 NOT NULL,
    "puHt" double precision DEFAULT 0 NOT NULL,
    "tauxTva" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tauxFodec" double precision DEFAULT 0 NOT NULL,
    "remise" double precision DEFAULT 0 NOT NULL,
    CONSTRAINT panier_lignes_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.paniers
(
    "id" serial NOT NULL,
    "utilisateur" text COLLATE pg_catalog."default" NOT NULL,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Ouvert'::text NOT NULL,
    "refDoc" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT paniers_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.param_compta
(
    "id" serial NOT NULL,
    "cle" text COLLATE pg_catalog."default" NOT NULL,
    "numCompte" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default",
    CONSTRAINT param_compta_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.parametrage_bilan
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "formule" text COLLATE pg_catalog."default" DEFAULT ''::text NOT NULL,
    "type" text COLLATE pg_catalog."default" NOT NULL,
    "rubrique" text COLLATE pg_catalog."default",
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT parametrage_bilan_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.partners
(
    "id" integer NOT NULL,
    "nature" text COLLATE pg_catalog."default" NOT NULL,
    "raisonSocial" text COLLATE pg_catalog."default" NOT NULL,
    "adresse" text COLLATE pg_catalog."default",
    "tel" text COLLATE pg_catalog."default",
    "fax" text COLLATE pg_catalog."default",
    "email" text COLLATE pg_catalog."default",
    "ville" text COLLATE pg_catalog."default",
    "gouvernorat" text COLLATE pg_catalog."default",
    "codeTva" text COLLATE pg_catalog."default",
    "cletva" text COLLATE pg_catalog."default",
    "categorieTva" text COLLATE pg_catalog."default",
    "matriculeF" text COLLATE pg_catalog."default",
    "famille" text COLLATE pg_catalog."default",
    "sousFamille" text COLLATE pg_catalog."default",
    "soldeIni" double precision DEFAULT 0 NOT NULL,
    "debit" double precision DEFAULT 0 NOT NULL,
    "credit" double precision DEFAULT 0 NOT NULL,
    "soldeFin" double precision DEFAULT 0 NOT NULL,
    "plafond" double precision,
    "remiseDef" double precision DEFAULT 0 NOT NULL,
    "commercial" text COLLATE pg_catalog."default",
    "longitude" double precision,
    "latitude" double precision,
    "archiver" integer DEFAULT 0 NOT NULL,
    "exo" integer,
    "assuj" integer,
    "isEmploye" integer DEFAULT 0 NOT NULL,
    "registreCom" text COLLATE pg_catalog."default",
    "dateCreation" timestamp(3) without time zone,
    "creePar" text COLLATE pg_catalog."default",
    "photo" text COLLATE pg_catalog."default",
    "charge" integer DEFAULT 0 NOT NULL,
    CONSTRAINT partners_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.plan_comptable
(
    "id" serial NOT NULL,
    "numCompte" text COLLATE pg_catalog."default" NOT NULL,
    "intitule" text COLLATE pg_catalog."default" NOT NULL,
    "classe" integer DEFAULT 0 NOT NULL,
    "soldeIni" double precision DEFAULT 0 NOT NULL,
    "lettrable" boolean DEFAULT false NOT NULL,
    CONSTRAINT plan_comptable_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.plan_comptable_standard
(
    "id" serial NOT NULL,
    "numCompte" text COLLATE pg_catalog."default" NOT NULL,
    "intitule" text COLLATE pg_catalog."default" NOT NULL,
    "utilisable" boolean DEFAULT true NOT NULL,
    "pointable" boolean DEFAULT false NOT NULL,
    "lettrable" boolean DEFAULT false NOT NULL,
    "commentaire" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT plan_comptable_standard_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.products
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "barcode" text COLLATE pg_catalog."default",
    "name" text COLLATE pg_catalog."default" NOT NULL,
    "family" text COLLATE pg_catalog."default",
    "subFamily" text COLLATE pg_catalog."default",
    "stock" integer DEFAULT 0 NOT NULL,
    "price" double precision DEFAULT 0 NOT NULL,
    "priceTTC" double precision DEFAULT 0 NOT NULL,
    "purchasePrice" double precision DEFAULT 0 NOT NULL,
    "imageUrl" text COLLATE pg_catalog."default",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "minStock" integer DEFAULT 5 NOT NULL,
    "tvaRate" double precision DEFAULT 19 NOT NULL,
    "unit" text COLLATE pg_catalog."default" DEFAULT 'U'::text NOT NULL,
    "depotId" integer,
    "supplierId" integer,
    CONSTRAINT products_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.projet_jalons
(
    "id" serial NOT NULL,
    "projetId" integer NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "numOrdre" integer DEFAULT 0 NOT NULL,
    "poids" double precision DEFAULT 1 NOT NULL,
    "avancement" double precision DEFAULT 0 NOT NULL,
    "datePrevue" timestamp(3) without time zone,
    "dateReelle" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT projet_jalons_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.projets
(
    "id" serial NOT NULL,
    "projet" text COLLATE pg_catalog."default" NOT NULL,
    "codeCli" integer,
    "raisonSoc" text COLLATE pg_catalog."default",
    "respProjet" text COLLATE pg_catalog."default",
    "famille" text COLLATE pg_catalog."default",
    "description" text COLLATE pg_catalog."default",
    "adresse" text COLLATE pg_catalog."default",
    "modePay" text COLLATE pg_catalog."default",
    "dateAccept" timestamp(3) without time zone,
    "periodeDu" timestamp(3) without time zone,
    "periodeAu" timestamp(3) without time zone,
    "dateLiv" timestamp(3) without time zone,
    "dateFinReel" timestamp(3) without time zone,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'En attente'::text NOT NULL,
    "avancement" double precision DEFAULT 0 NOT NULL,
    "budget" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT projets_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.purchase_documents
(
    "id" serial NOT NULL,
    "type" "DocumentType" NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "totalHT" double precision DEFAULT 0 NOT NULL,
    "totalTTC" double precision DEFAULT 0 NOT NULL,
    "totalTVA" double precision DEFAULT 0 NOT NULL,
    "discount" double precision DEFAULT 0 NOT NULL,
    "paid" double precision DEFAULT 0 NOT NULL,
    "status" text COLLATE pg_catalog."default" DEFAULT 'PENDING'::text NOT NULL,
    "notes" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "supplierId" integer NOT NULL,
    CONSTRAINT purchase_documents_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.reclamation_client
(
    "id" serial NOT NULL,
    "dayId" integer,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "type" text COLLATE pg_catalog."default" DEFAULT 'Autre'::text NOT NULL,
    "reclamation" text COLLATE pg_catalog."default" NOT NULL,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Ouverte'::text NOT NULL,
    "reponse" text COLLATE pg_catalog."default",
    "utilisateur" text COLLATE pg_catalog."default",
    "latitude" double precision,
    "longitude" double precision,
    "dateReclam" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dateReponse" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT reclamation_client_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.recordings
(
    "id" serial NOT NULL,
    "duration" integer,
    "fileUrl" text COLLATE pg_catalog."default",
    "transcript" text COLLATE pg_catalog."default",
    "summary" text COLLATE pg_catalog."default",
    "sentiment" text COLLATE pg_catalog."default",
    "keywords" text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "visitId" integer NOT NULL,
    "commercialId" integer NOT NULL,
    CONSTRAINT recordings_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.ref_tables
(
    "id" serial NOT NULL,
    "kind" text COLLATE pg_catalog."default" NOT NULL,
    "code" text COLLATE pg_catalog."default",
    "label" text COLLATE pg_catalog."default" NOT NULL,
    "data" jsonb,
    CONSTRAINT ref_tables_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.reglements
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "sens" "ReglementSens" NOT NULL,
    "mode" "ReglementMode" NOT NULL,
    "amount" double precision NOT NULL,
    "date" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "chequeNumber" text COLLATE pg_catalog."default",
    "status" text COLLATE pg_catalog."default" DEFAULT 'ENCAISSE'::text NOT NULL,
    "notes" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "clientId" integer,
    "supplierId" integer,
    "bankAccountId" integer,
    CONSTRAINT reglements_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.rubrique_employe
(
    "id" serial NOT NULL,
    "rubriqueId" integer NOT NULL,
    "codeEmploye" text COLLATE pg_catalog."default" NOT NULL,
    "sessionId" integer,
    "montant" double precision DEFAULT 0 NOT NULL,
    "quantite" double precision DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT rubrique_employe_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.rubrique_paie
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "sens" text COLLATE pg_catalog."default" DEFAULT 'Gain'::text NOT NULL,
    "soumisCnss" boolean DEFAULT true NOT NULL,
    "soumisIrpp" boolean DEFAULT true NOT NULL,
    "soumisAccTravail" boolean DEFAULT false NOT NULL,
    "soumisAssGroupe" boolean DEFAULT false NOT NULL,
    "prorataAbsence" boolean DEFAULT false NOT NULL,
    "parQuantite" boolean DEFAULT false NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT rubrique_paie_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.sous_fam_art
(
    "code" integer NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "charge" boolean DEFAULT false NOT NULL,
    "lettreCompta" text COLLATE pg_catalog."default",
    "image" text COLLATE pg_catalog."default",
    "codeFamille" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT sous_fam_art_pkey PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS public.stock_depots
(
    "id" serial NOT NULL,
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "emplacement" text COLLATE pg_catalog."default" NOT NULL,
    "quantite" double precision DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "pmp" double precision DEFAULT 0 NOT NULL,
    CONSTRAINT stock_depots_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.stock_movements
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "type" "MovementType" NOT NULL,
    "qty" double precision NOT NULL,
    "qtyBefore" double precision DEFAULT 0 NOT NULL,
    "qtyAfter" double precision DEFAULT 0 NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "reason" text COLLATE pg_catalog."default",
    "documentRef" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "productId" integer NOT NULL,
    "depotId" integer,
    CONSTRAINT stock_movements_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.stock_movements_ext
(
    "id" serial NOT NULL,
    "refDoc" text COLLATE pg_catalog."default",
    "refArt" text COLLATE pg_catalog."default" NOT NULL,
    "sens" text COLLATE pg_catalog."default" NOT NULL,
    "qte" double precision DEFAULT 0 NOT NULL,
    "stockAvant" double precision DEFAULT 0 NOT NULL,
    "stockApres" double precision DEFAULT 0 NOT NULL,
    "puHt" double precision DEFAULT 0 NOT NULL,
    "typeDoc" text COLLATE pg_catalog."default",
    "codeMag" integer,
    "motif" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT stock_movements_ext_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.suppliers
(
    "id" serial NOT NULL,
    "code" text COLLATE pg_catalog."default" NOT NULL,
    "name" text COLLATE pg_catalog."default" NOT NULL,
    "contact" text COLLATE pg_catalog."default",
    "phone" text COLLATE pg_catalog."default",
    "email" text COLLATE pg_catalog."default",
    "address" text COLLATE pg_catalog."default",
    "city" text COLLATE pg_catalog."default",
    "taxId" text COLLATE pg_catalog."default",
    "balance" double precision DEFAULT 0 NOT NULL,
    "category" text COLLATE pg_catalog."default" DEFAULT 'Local'::text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT suppliers_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.tickets_sav
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "codeCli" integer,
    "clientNom" text COLLATE pg_catalog."default",
    "typePanne" text COLLATE pg_catalog."default",
    "description" text COLLATE pg_catalog."default" NOT NULL,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Ouvert'::text NOT NULL,
    "priorite" text COLLATE pg_catalog."default" DEFAULT 'Normale'::text NOT NULL,
    "intervenant" text COLLATE pg_catalog."default",
    "solution" text COLLATE pg_catalog."default",
    "dateReclamation" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dateReparation" timestamp(3) without time zone,
    "refDoc" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT tickets_sav_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.traite_bancaire
(
    "id" serial NOT NULL,
    "reference" text COLLATE pg_catalog."default" NOT NULL,
    "numeroOrdre" text COLLATE pg_catalog."default",
    "codeTiers" integer,
    "tireNom" text COLLATE pg_catalog."default" NOT NULL,
    "tireAdresse" text COLLATE pg_catalog."default",
    "beneficiaire" text COLLATE pg_catalog."default" NOT NULL,
    "ribBanque" text COLLATE pg_catalog."default",
    "ribAgence" text COLLATE pg_catalog."default",
    "ribCompte" text COLLATE pg_catalog."default",
    "ribCle" text COLLATE pg_catalog."default",
    "domiciliation" text COLLATE pg_catalog."default",
    "valeurEn" text COLLATE pg_catalog."default",
    "nomCedant" text COLLATE pg_catalog."default",
    "montant" numeric(14,3) NOT NULL,
    "montantLettres" text COLLATE pg_catalog."default",
    "lieuCreation" text COLLATE pg_catalog."default",
    "dateCreation" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "echeance" timestamp(3) without time zone,
    "etat" text COLLATE pg_catalog."default" DEFAULT 'Brouillon'::text NOT NULL,
    "nbImpressions" integer DEFAULT 0 NOT NULL,
    "derniereImpr" timestamp(3) without time zone,
    "offsetX" double precision DEFAULT 0 NOT NULL,
    "offsetY" double precision DEFAULT 0 NOT NULL,
    "notes" text COLLATE pg_catalog."default",
    "utilisateur" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT traite_bancaire_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.unite_art
(
    "unite" text COLLATE pg_catalog."default" NOT NULL,
    "libelle" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unite_art_pkey PRIMARY KEY ("unite")
);

CREATE TABLE IF NOT EXISTS public.users
(
    "id" serial NOT NULL,
    "name" text COLLATE pg_catalog."default" NOT NULL,
    "email" text COLLATE pg_catalog."default" NOT NULL,
    "login" text COLLATE pg_catalog."default" NOT NULL,
    "password" text COLLATE pg_catalog."default" NOT NULL,
    "role" "Role" NOT NULL,
    "avatar" text COLLATE pg_catalog."default",
    "phone" text COLLATE pg_catalog."default",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "codeTiers" integer,
    CONSTRAINT users_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.vehicles
(
    "id" serial NOT NULL,
    "plate" text COLLATE pg_catalog."default" NOT NULL,
    "brand" text COLLATE pg_catalog."default" NOT NULL,
    "model" text COLLATE pg_catalog."default",
    "year" integer,
    "status" "VehicleStatus" DEFAULT 'PARKED'::"VehicleStatus" NOT NULL,
    "insuranceExpiry" timestamp(3) without time zone,
    "controlExpiry" timestamp(3) without time zone,
    "taxExpiry" timestamp(3) without time zone,
    "currentLat" double precision,
    "currentLng" double precision,
    "lastUpdate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "chassis" text COLLATE pg_catalog."default",
    "typeVehicule" text COLLATE pg_catalog."default",
    "couleur" text COLLATE pg_catalog."default",
    "assureur" text COLLATE pg_catalog."default",
    "insuranceStart" timestamp(3) without time zone,
    "controlStart" timestamp(3) without time zone,
    "taxPaidAt" timestamp(3) without time zone,
    "kmMoyen" integer,
    "consoMoyenneJour" double precision,
    "consoCarburant" double precision,
    "kilometrage" integer,
    CONSTRAINT vehicles_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.vehicules_operations
(
    "id" serial NOT NULL,
    "libelle" text COLLATE pg_catalog."default" NOT NULL,
    "intervalleKm" integer,
    "intervalleJours" integer,
    "dernierKm" integer,
    "derniereDate" timestamp(3) without time zone,
    "prochaineDate" timestamp(3) without time zone,
    "prochainKm" integer,
    "actif" boolean DEFAULT true NOT NULL,
    "notes" text COLLATE pg_catalog."default",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "vehicleId" integer NOT NULL,
    CONSTRAINT vehicules_operations_pkey PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public.visits
(
    "id" serial NOT NULL,
    "checkedIn" boolean DEFAULT false NOT NULL,
    "checkInTime" timestamp(3) without time zone,
    "checkOutTime" timestamp(3) without time zone,
    "duration" integer,
    "notes" text COLLATE pg_catalog."default",
    "tags" text[],
    "caVisit" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "commercialId" integer NOT NULL,
    "clientId" integer NOT NULL,
    CONSTRAINT visits_pkey PRIMARY KEY ("id")
);
