-- CreateTable
CREATE TABLE "partners" (
    "id" INTEGER NOT NULL,
    "nature" TEXT NOT NULL,
    "raisonSocial" TEXT NOT NULL,
    "adresse" TEXT,
    "tel" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "ville" TEXT,
    "gouvernorat" TEXT,
    "codeTva" TEXT,
    "cletva" TEXT,
    "categorieTva" TEXT,
    "matriculeF" TEXT,
    "famille" TEXT,
    "sousFamille" TEXT,
    "soldeIni" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldeFin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plafond" DOUBLE PRECISION,
    "remiseDef" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commercial" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "archiver" INTEGER NOT NULL DEFAULT 0,
    "exo" INTEGER,
    "assuj" INTEGER,
    "isEmploye" INTEGER NOT NULL DEFAULT 0,
    "registreCom" TEXT,
    "dateCreation" TIMESTAMP(3),

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles_ext" (
    "refArt" TEXT NOT NULL,
    "codeBarre" TEXT,
    "designation" TEXT NOT NULL,
    "caract" TEXT,
    "catalogue" TEXT,
    "codeCatalogue" INTEGER NOT NULL DEFAULT 0,
    "famille" INTEGER,
    "sousFamille" INTEGER,
    "unite" TEXT,
    "puAchat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puAchatTtc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pmp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puInv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarif1Ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarif2Ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarif3Ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maTarif1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxFodec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockIni" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entrer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortie" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendable" INTEGER NOT NULL DEFAULT 1,
    "achetable" INTEGER NOT NULL DEFAULT 1,
    "service" INTEGER NOT NULL DEFAULT 0,
    "archiver" INTEGER NOT NULL DEFAULT 0,
    "refOrigine" TEXT,

    CONSTRAINT "articles_ext_pkey" PRIMARY KEY ("refArt")
);

-- CreateTable
CREATE TABLE "documents_ext" (
    "refDoc" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "typeDoc" TEXT NOT NULL,
    "caraDoc" TEXT,
    "libDoc" TEXT,
    "dateDoc" TIMESTAMP(3),
    "codeCli" INTEGER,
    "raisonSocial" TEXT,
    "adrCli" TEXT,
    "mf" TEXT,
    "numSeq" TEXT,
    "thtBrut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totRemise" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thtNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timbre" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totFodec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ttcNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldeDoc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRegle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etat" TEXT,
    "modePayement" TEXT,
    "codeMag" INTEGER,
    "utilisateur" TEXT,
    "vehicule" TEXT,
    "commercial" TEXT,
    "echeance" TIMESTAMP(3),
    "couleur" TEXT,

    CONSTRAINT "documents_ext_pkey" PRIMARY KEY ("refDoc")
);

-- CreateTable
CREATE TABLE "ref_tables" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "ref_tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_nature_idx" ON "partners"("nature");

-- CreateIndex
CREATE INDEX "partners_raisonSocial_idx" ON "partners"("raisonSocial");

-- CreateIndex
CREATE INDEX "articles_ext_designation_idx" ON "articles_ext"("designation");

-- CreateIndex
CREATE INDEX "articles_ext_famille_idx" ON "articles_ext"("famille");

-- CreateIndex
CREATE INDEX "documents_ext_nature_typeDoc_idx" ON "documents_ext"("nature", "typeDoc");

-- CreateIndex
CREATE INDEX "documents_ext_codeCli_idx" ON "documents_ext"("codeCli");

-- CreateIndex
CREATE INDEX "documents_ext_dateDoc_idx" ON "documents_ext"("dateDoc");

-- CreateIndex
CREATE INDEX "ref_tables_kind_idx" ON "ref_tables"("kind");
