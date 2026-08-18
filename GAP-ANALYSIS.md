# GAP ANALYSIS — Projet A → Projet B

**A (source)** : `/home/monta/rabota/bachir/production/BIS` — ERP complet
React 17 (CRA) + MUI + Redux · Express + MySQL · **281 000 lignes**, 24 modules, 135 contrôleurs, 135 routes, **360 tables**

**B (cible)** : `/home/monta/rabota/bachir/demo1` — portail Next.js
Next 16 + React 19 + TS + Tailwind · Prisma + PostgreSQL
*À l'origine* : 8 050 lignes, 61 fichiers, 33 modèles — *aujourd'hui* : **97 modèles**, 40 routes API, 12 modules ERP / 78 sous-menus

> **Aucun fichier n'est copiable.** Stacks incompatibles. Chaque élément doit être
> **réécrit** dans l'idiome de B. A sert de **spécification fonctionnelle**, pas de source.
>
> **Règle absolue : on n'enlève rien de B. Tout est additif.**

---

## 0. État d'avancement

| # | Lot | Statut |
|---|-----|--------|
| 1 | Lignes de documents (`ErpDocumentLine` + calcul + éditeur) | ✅ **FAIT** |
| 2 | Mouvement de stock à la validation | ✅ **FAIT** |
| 3 | Solde client + PMP article | ✅ **FAIT** |
| 4 | Numérotation par souche | ✅ **FAIT** |
| 5 | Transformation de documents (Devis→BL→Facture) | ✅ **FAIT** |
| 6 | Rapports de vente (5 axes) | ✅ **FAIT** |
| 7 | **Écran Paramétrages éditable** | ✅ **FAIT** |
| 8 | **GRH sur base de données** | ✅ **FAIT** |
| 8b | Tableaux de bord + recouvrement sur base | ✅ **FAIT** |
| 8c | Clients + catalogue + création de commande | ✅ **FAIT** |
| 8d | Espace client (portail) sur base | ✅ **FAIT** |
| 8e | Validation manager + rapports + alertes admin | ✅ **FAIT** |
| 8f | Utilisateurs, rapports direction, objectifs | ✅ **FAIT** |
| 9 | **Comptabilité : intégration, grand-livre, balance, résultat** | ✅ **FAIT** |
| 10 | **Trésorerie : chéquiers, chèques, bordereaux, extraits** | ✅ **FAIT** |
| 11 | **GPAO (données techniques, CBN, planification) · numéros de série · Projets · contrats GRH · droits d'accès** | ✅ **FAIT** (§19) |
| 12 | **Paie complète (rubriques, grilles, CNSS, barème) · Bilan comptable · Inventaire physique** | ✅ **FAIT** (§20) |
| 13 | **Tournées de vente ambulante · visites · réclamations · écrans commerciaux sur base** | ✅ **FAIT** (§21) |
| 14 | **Tuiles de l'app commerciale : panier persistant · dernier ticket · bon d'approvisionnement · mot de passe** | ✅ **FAIT** (§22) |
| 15 | **Référentiels articles · charges fixes analytiques · frais de mission · plan comptable standard** | ✅ **FAIT** (§23) |
| 16 | Caisse · Garage · Pièces auto · Impressions · Mailing CRM | ⬜ à faire |
| 17 | Données en dur restantes (`admin/recordings`, `client/suivi`, `manager/supervision`) | ⬜ à faire |

---

## 1. Modules de A vs B

A possède **24 modules**, B en déclare **10**. Modules de A **totalement absents** de B :

| Module A | Lignes | Contenu | Présent dans B |
|---|---|---|---|
| `gpao-module` | 35 047 | OF, gammes, nomenclatures, ordonnancement, CBN | ✅ **fait** (§19.1) |
| `vente-module` | 37 325 | Devis, BL, factures, clients, commerciaux, missions | ✅ **fait** (§21 pour les tournées) |
| `inventoryModule` | 20 661 | Produits, mouvements, dépôts, transferts, inventaires | ✅ **fait** (§18, §20.3) |
| `treasury` | 13 598 | Règlements, chéquiers, borderaux, comptes, extraits | ✅ **fait** (§15) |
| `buys-module` | 16 546 | Fournisseurs, commandes, réceptions, factures achat | ⚠️ partiel |
| `grh-module` | 15 271 | Personnel, contrats, congés, pointage, paie, grilles | ✅ **fait** (§8, §19.4, §20.1) |
| `compta` | 8 684 | Plan comptable, saisie, grand-livre, balance, bilan | ✅ **fait** (§14, §20.2) |
| `gestion-caisse` | 3 281 | Sessions de caisse, ouverture/clôture | ❌ **absent** |
| `settings-module` | 4 424 | TVA, FODEC, types docs, société, modules, raccourcis | ✅ **fait** (§16) |
| `piece_auto_recherche` | 4 318 | Recherche pièces auto, paiement, ticket | ❌ **absent** |
| `garage-module` | 7 879 | Ordres de réparation, devis garage | ❌ **absent** |
| `crm-module` | 6 572 | Opportunités, tickets SAV, mailing, intervenants | ✅ **fait** (§17) |
| `contrats` | 2 583 | Contrats **de travail** CDD/CDI/CIVP (et non contrats clients) | ✅ **fait** (§19.4) |
| `projets-module` | 2 015 | Projets, jalonnements, état d'avancement | ✅ **fait** (§19.3) |
| `parc-roulant-module` | 1 659 | Véhicules, charges véhicules | ⚠️ partiel |
| `impressions-module` | 1 853 | Modèles d'impression, code-barres | ❌ **absent** |
| `droit-access` | 1 258 | Droits par composant / par utilisateur | ✅ **fait** (§19.5) |
| `charges-module` | 389 | Charges fixes, centres de charge | ✅ **fait** (§23.2) |
| `gmao-module` | 274 | Machines, maintenance | ✅ **fait** (`GmaoMachine` + `/api/erp`) |
| `dashboard` | 732 | Tableau de bord ERP | ⚠️ différent |

---

## 2. Écrans vides dans B (`kind: "info"`) — ✅ **PLUS AUCUN**

Les 5 derniers sous-menus qui affichaient « Module disponible — écran dédié »
sont désormais branchés sur la base :

| Module | Sous-menu | Source dans A | Traité |
|---|---|---|---|
| VENTE | Suivi des numéros de série | `vente-module/suivi-num-series` + `achat-serie.controller` | ✅ §19.2 |
| GMAO | Machines | `machines.controller` | ✅ déjà branché (`GmaoMachine` + `/api/erp`) |
| GPAO | Données techniques | `gpao-module/dossier-technique` | ✅ §19.1 |
| GPAO | Calcul besoin net | `gpao-module` + `nomenclature.controller` | ✅ §19.1 |
| GPAO | Planification | `gpao-plannification.controller` | ✅ §19.1 |

Plus aucune vue `kind: "info"` n'est référencée par un sous-menu.
Le type est conservé dans `erp-modules.ts` (aucune régression possible pour un
sous-menu ajouté plus tard sans écran).

---

## 3. Données en dur à remplacer par la base

✅ **Basculés sur la base (12)** : `admin/grh` · `admin/dashboard` (partiel) ·
`commercial/dashboard` · `commercial/recouvrement` · `commercial/clients` ·
`commercial/catalogue` · `client/dashboard` · `client/commander` ·
`client/historique` · `manager/dashboard` · `manager/validation` · `manager/rapports`

✅ **Basculés au lot 13 (5)** : `commercial/planning` · `commercial/journal` ·
`commercial/reclamation` · `commercial/retour-stock` · `commercial/map` (§21).
**Les 9 écrans commerciaux tournent désormais sur la base.**

⬜ **Restent en dur (3 écrans + 3 composants)** : `admin/recordings` ·
`client/suivi` · `manager/supervision` · `CAChart` · `BISAssistant` ·
`TunisiaMap` (remplacé par `ClientsMap` sur l'écran carte, mais toujours
présent et utilisé par `admin/dashboard`)

ℹ️ `admin/compta` tournait **déjà** sur la base (12 comptes, 2 écritures) —
les données comptables importées sont simplement très pauvres.

🔴 **Correction d'une affirmation antérieure de cette analyse.** Il était écrit
que `map` et `planning` reposaient sur des données GPS *inexistantes*. C'était
faux : la table `partners` porte des colonnes `latitude`/`longitude` et
**2 283 des 2 399 clients sont réellement géolocalisés**. Les deux écrans sont
donc branchés sur ces coordonnées (§21).

⚠️ Restent effectivement sans données : `admin/recordings` (enregistrements
audio), `client/suivi` (suivi de livraison temps réel) et `manager/supervision`
(positions GPS des véhicules en direct) — il n'existe ni table ni flux pour les
alimenter, ni dans B ni dans les données importées de A.

~~**Cas le plus grave** : `admin/grh/page.tsx`~~ → ✅ **CORRIGÉ** : le module GRH
est désormais entièrement sur base de données (voir §8).

---

## 4. Logique métier manquante (le plus important)

Ces règles sont le cœur de l'ERP. Elles existent dans A et **n'existent pas** dans B.

### 4.1 ✅ Lignes de document — **FAIT**
`ErpDocument` ne stockait que des totaux, sans aucun article.
→ Modèle `ErpDocumentLine`, moteur de calcul, API transactionnelle, éditeur UI.
Source A : `entete_vente_articles`, `document-vente.service.js`.

### 4.2 ✅ Mouvement de stock à la validation — **FAIT**
Règles `T_stock` reproduites (`document-types.ts`) : E = entrée, S = sortie, N = neutre.
Validation transactionnelle (`document-validation.ts`) + journal `ErpStockMovement`
avec stock avant/après. Drapeau `valide` : interdit la double application
(garde-fou absent de A). Dévalidation = mouvements inverses.

### 4.3 ✅ Solde client & PMP — **FAIT**
Règles `T_solde` : D = débit (facture), C = crédit (avoir), N = neutre.
PMP recalculé à l'entrée uniquement, comme `updateValeurStock` dans A.

✅ Stock **par emplacement** désormais géré (`StockDepot`, voir §18).
Reste ⬜ : `updateLatestDocClient` / `updateLatestDocArticles` (date dernier mouvement).

### 4.4 ✅ Transformation de documents — **FAIT**
`document-transform.ts` : Devis → Commande → BL → Facture (+ BRE→AV, CDF→BRC→FACA).
Lignes recopiées avec `docLiee`, sources marquées `transformeEn`, totaux recalculés,
fusion multi-documents. Le cible naît en **brouillon** : stock/solde ne bougent
qu'à sa validation, ce qui évite le double comptage.
Reste ⬜ : `updateAvancementLivraison` (reliquat COM partiellement livrée).

### 4.5 ✅ Numérotation par souche — **FAIT**
`document-numbering.ts` : `Ref_doc = Cara_doc + Num_seq`, 15 souches réelles
(TIC, CMI, DAO, FAO, BAO, OFA…). Compteur `MAX+1` par souche et par exercice,
repart à `<AA>0001` chaque année. Boucle anti-collision absente de A.
Remplace `DOC${Date.now()}` dans `/api/erp`.

### 4.6 ✅ Rapports de vente — **FAIT**
Les 5 axes de `vente-module/rapports` : **article · client · commercial ·
gouvernorat · famille client**, avec période Du/Au et export CSV
(`/api/rapports-vente`, composant `RapportsVente`, branché sur le scope Vente).
Règle de calcul reprise de A : **CA = Σ(BL, TIC, FC) − Σ(BR, AV)**.

---

## 5. Modèles Prisma à ajouter

Au départ 33 modèles ; **75 aujourd'hui**. État réel du schéma :

| Domaine | Modèles |
|---|---|
| Vente | ✅ `ErpDocumentLine` · ⬜ `Souche`, `TypeDocument` (la numérotation et la transformation sont gérées en code, pas en tables — voir §4.4/§4.5) |
| Stock | ✅ `ErpStockMovement`, `StockDepot`, `MouvementDepot` · ⬜ `Inventaire`, `LigneInventaire` |
| GRH | ✅ `GrhPersonnel`, `GrhContrat`, `GrhConge`, `GrhPointage`, `GrhBulletin`, `GrhSession`, `GrhGrade`, `GrhEchelon`, `GrhFonction`, `GrhService`, `GrhCategorie` · ⬜ `Rubrique`, `GrilleSalaire` |
| Compta | ✅ `JournalCompta`, `EcritureCompta`, `ExerciceCompta`, `CompteCompta`, `ParamCompta` |
| Trésorerie | ✅ `Chequier`, `Cheque`, `ErpBorderau`, `BorderauLigne`, `MouvementCompte` |
| GPAO | ✅ `GpaoNomenclature`, `GpaoNomenclatureLigne`, `GpaoGamme`, `GpaoOperation`, `GpaoOperationGamme`, `GpaoOperationOf`, `GpaoPosteCharge`, `GpaoPlan`, `GpaoJalonnement` (l'OF reste un `ErpDocument` de type OF, comme dans A) |
| CRM | ✅ `Opportunite`, `EvenementOpportunite`, `TicketSav` · ⬜ `Intervenant` (référentiel dédié) |
| Paramétrage | ✅ `RefTable`, `ParamCompta`, `DroitFonction`, `DroitUtilisateur` · ⬜ `ModuleApp`/`raccourcis` |
| Divers | ✅ `Projet`, `ProjetJalon`, `GmaoMachine`, `NumeroSerie` · ⬜ `OrdreReparation`, `SessionCaisse` |

---

## 6. Ordre de réalisation retenu

Priorité : **rendre juste ce qui existe déjà**, avant d'ajouter des modules neufs.

**Phase 1 — Fiabiliser la vente** (le module le plus utilisé)
1. ✅ Lignes de documents
2. ⬜ Mouvement de stock à la validation
3. ⬜ Solde client + PMP
4. ⬜ Numérotation par souche
5. ⬜ Transformation Devis→BL→Facture

**Phase 2 — Sortir les données en dur**
6. ⬜ GRH sur base (modèles + API + écran)
7. ⬜ Dashboards commercial / manager / admin sur base
8. ⬜ Écran Paramétrages réel (TVA, FODEC, société, types docs)

**Phase 3 — Compléter les écrans vides**
9. ⬜ CRM : opportunités + tickets SAV
10. ⬜ Stock : transferts, bons de sortie/retour
11. ⬜ GPAO : nomenclatures, CBN, planification

**Phase 4 — Modules absents**
12. ⬜ Comptabilité complète · 13. ⬜ Trésorerie complète
14. ⬜ Projets · Contrats · Caisse · Garage · Parc roulant · GMAO
15. ⬜ Droits d'accès · Impressions

---

## 7. Estimation

| Phase | Contenu | Charge |
|---|---|---|
| 1 | Vente fiable | ~1 semaine |
| 2 | Données réelles | ~1–2 semaines |
| 3 | Écrans vides | ~2 semaines |
| 4 | Modules absents | ~2–3 mois |

Le portage intégral de A (281 k lignes) représente **plusieurs mois**.
La valeur arrive surtout en phases 1–2.

---

## 8. Module GRH — ✅ FAIT

Remplace intégralement la page à données en dur (tableau `EMPLOYES`, 4 onglets vides).

**Modèles Prisma** (9) : `GrhPersonnel` (45 champs, repris de `grh_personnel`),
`GrhFonction`, `GrhGrade`, `GrhService`, `GrhCategorie`, `GrhEchelon`,
`GrhSession`, `GrhPointage`, `GrhConge`, `GrhBulletin`.

**Moteur de paie** (`src/lib/paie-calc.ts`) — chaîne de calcul de A :
1. salaire selon régime — **M** = prorata des jours, **H** = heures × coût horaire
2. + primes + heures supp (majorées 25 %) → brut
3. − CNSS 9,18 % → imposable
4. − IRPP (barème annuel par tranches ÷ 12, abattements chef de famille + enfants)
5. − CSS 1 % → **net à payer**

Congés payés et jours fériés comptent comme travaillés, comme dans A.
Taux et barème surchargeables par appel (paramétrables sans toucher au moteur).

**API** : `/api/grh` (personnel, 5 référentiels, sessions, pointage, congés,
bulletins, stats) + `/api/grh/traitement` (génération des bulletins d'une session).
Écriture réservée ADMIN/MANAGER, suppression réservée ADMIN.

**UI** — les 6 onglets fonctionnent sur la base :
| Onglet | Contenu |
|---|---|
| Employés | Liste + fiche complète (identité, affectation, contrat, rémunération, CNSS) |
| Gestion pointage | Grille mensuelle ; le régime décide jours/heures ; lignes modifiées en jaune |
| Congés | Demandes + circuit d'approbation (En attente / Approuvé / Refusé) |
| Traitements | Lancement de paie, bulletins, totaux, export CSV |
| Rapports | Effectif par service, répartition par régime, masse salariale |
| Paramètres | CRUD des 5 référentiels + création des sessions de paie |

**Vérifié** : 8 cas de calcul (barème IRPP, abattements familiaux, prorata,
congés/fériés, régime horaire, heures supp, cohérence net, absence totale)
+ parcours complet en base (référentiels → employés → session → pointage →
bulletins), contrainte d'unicité du pointage et cascades de suppression.

Reste ⬜ : gestion des crédits/avances, rubriques de paie personnalisées,
grilles de salaire, types CNSS paramétrables, impression du bulletin.

---

## 9. Tableaux de bord & rapports sur base — ✅ FAIT

### Ce qui a été branché sur les données réelles
6 200 documents · 2 449 tiers · 523 articles · 1 148 règlements (2024 → 2026).

| Écran | Avant | Maintenant |
|---|---|---|
| `commercial/dashboard` | `DUMMY_CLIENTS` + stats fixes | CA réel, créances, panier moyen, état du stock, clients à risque |
| `manager/dashboard` | `LIVE_AGENTS` + `PENDING_DOCS` fictifs | Documents à valider, CA par commercial, évolution mensuelle, top clients |
| `commercial/recouvrement` | Créances et documents inventés | Vrais clients débiteurs + leurs documents ; **encaissement réel** |
| Rapports Vente | `ReportsView` générique | **5 axes** de A avec période Du/Au + export CSV |

### Nouvelles API
- `/api/dashboard?scope=admin|manager|commercial` — KPI, série mensuelle, top clients,
  clients à risque, documents à valider, alertes stock
- `/api/rapports-vente?axe=…&du=&au=` — les 5 axes de `vente-module/rapports`
- `/api/clients` — tiers réels + documents d'un client (écrans commerciaux)
- `/api/reglements` — encaissement transactionnel : crédite le tiers et réduit son solde

### Règle de calcul
`vente-stats.ts` centralise la règle de A : **CA = Σ(BL, TIC, FC) − Σ(BR, AV)**.

**Vérifié en base** : ventes brutes 1 376 688,353 − retours 9 218,999 = **CA net
1 367 469,354** (réconciliation exacte) ; axes client / gouvernorat / commercial
produisent des chiffres réels ; encaissement de 100 TND → crédit +100, solde −100,
règlement enregistré, puis valeurs restaurées.

### Points relevés dans les données
- **1 432 `codeCli` distincts** dans les documents, dont **379 seulement** existent
  dans `partners` → l'axe gouvernorat affiche « Non renseigné » pour le reste.
  Un mapping des codes tiers reste à faire côté import.
- **Aucune ligne de document** en base (données importées sans détail) : le rapport
  par article se remplira au fur et à mesure de la saisie via l'éditeur de lignes.
- Les objectifs commerciaux ne sont pas en base : la jauge « objectif » du dashboard
  commercial utilise une valeur indicative tant que `manager/objectifs` n'est pas branché.

---

## 10. Clients & catalogue sur base — ✅ FAIT

| Écran | Avant | Maintenant |
|---|---|---|
| `commercial/clients` | 15 `DUMMY_CLIENTS`, recommandations « IA » codées en dur | **2 399 clients réels**, filtre gouvernorat, fiche client avec débit/crédit/solde + derniers documents, relance WhatsApp |
| `commercial/catalogue` | 12 `DUMMY_PRODUCTS` | **488 articles vendables**, filtre disponibilité, TVA par article, panier → **vraie commande** |

### Nouvelles API
- `/api/catalogue` — articles vendables non archivés, prix TTC calculé par article
- `/api/commandes` — crée un document `COM` **avec ses lignes**, en brouillon,
  via la numérotation par souche et le moteur de calcul déjà en place

Le panier ne fait plus semblant : il crée un vrai document en base
(`CMI260001`, HT 31,757 / TVA 6,034 / TTC 37,791 lors du test), en **brouillon**.
Le stock ne bougera qu'à la validation — cohérent avec la chaîne documentaire.

### Anomalies de données corrigées côté code
| Constat | Traitement |
|---|---|
| `catalogue` **vide sur les 488 articles** ; `famille` est un code numérique sans table de libellés | Filtre « famille » remplacé par un filtre **disponibilité** (toutes / en stock / rupture) — un filtre par nom aurait été mort-né |
| Gouvernorats en casses mélangées (`TUNIS` / `Tunis`) : 33 entrées pour 29 réels | Dédoublonnage sans casse + filtre `insensitive` → **récupère 4 clients** invisibles avec un filtre strict |
| 2 clients sans raison sociale | Repli d'affichage sur `Client <code>` |

⚠️ **Restent à arbitrer côté données** (non modifiées, ce sont vos données) :
variantes orthographiques réelles — `Gabes`/`Gabés`, `Bizerte`/`BIZERT`,
`Medenine`/`Médnine`, `Djérba`, `Ben gerden`. Une normalisation fusionnerait
des enregistrements : à valider par vous avant de l'appliquer.

Autre point : **247 des 488 articles sont à stock ≤ 0**. Le catalogue les affiche
en « Rupture » avec le bouton d'ajout désactivé plutôt que de les masquer.

---

## 11. Espace client (portail) — ✅ FAIT

Les 3 écrans du portail client tournent désormais sur les données réelles du
tiers connecté.

### Rattachement utilisateur → tiers ERP
Nouveau champ **`User.codeTiers`** (→ `Partner.id`). Sans lui, un compte CLIENT
n'avait aucun lien avec les données ERP : la démo affichait des documents fictifs.
Le compte de démonstration `client` est rattaché au tiers **41101016
« AGIL BEJA SUD »** (13 documents réels, solde 9 703,241 TND).

### Sécurité du périmètre
`/api/espace-client` prend le tiers **dans la session**, jamais dans l'URL :
un client ne peut pas consulter les documents d'un autre compte.
Idem pour `/api/commandes` : un utilisateur `CLIENT` (ou `pourMonCompte: true`)
commande obligatoirement pour son propre tiers, le `codeCli` du corps est ignoré.

| Écran | Avant | Maintenant |
|---|---|---|
| `client/dashboard` | 4 commandes + 3 « recommandations » en dur | Solde/plafond réels, CA, impayés, derniers documents, articles habituels |
| `client/historique` | 10 documents inventés | Ses documents réels, onglets par type **présent**, totaux, export CSV |
| `client/commander` | 12 produits fictifs, référence `Math.random()` | Catalogue réel, TVA par article, **vraie commande** en brouillon |

**Vérifié en base** : isolation confirmée (**13 documents visibles sur 5 000**) ;
commande créée rattachée au bon tiers avec la remarque du client conservée
(`libDoc`) ; alerte de dépassement de plafond déclenchée correctement
(solde 9 703 > plafond 5 000). Document de test supprimé.

Corrigé au passage : apostrophe non échappée dans `client/suivi` qui faisait
échouer le lint (fichier pré-existant, non lié à ce lot).

⬜ Reste : `client/suivi` (suivi de livraison — dépend d'un module logistique
absent de B comme de A côté données GPS réelles).

---

## 12. Validation, rapports manager & alertes admin — ✅ FAIT

### `manager/validation` — la validation devient réelle
Avant : « Approuver » retirait simplement une ligne d'un tableau local ; **rien
n'était enregistré**. Maintenant, l'approbation appelle `validerDocument` et
applique réellement les mouvements de stock et de solde client.

Nouvelle API `/api/validation` (réservée ADMIN/MANAGER) :
- **GET** : documents non validés, avec nombre de lignes et **taux de remise
  calculé** (`totRemise / thtBrut`) — signale les remises > 12 %
- **POST** `approuver` → `validerDocument` (stock + solde)
- **POST** `rejeter` → marque `etat = "Rejeté"`, aucun mouvement

Garde-fou ajouté : un document **sans lignes** ne peut pas être approuvé
(bouton désactivé + explication), car il n'aurait aucun effet stock.

**Vérifié en base** : facture de 71,400 TND approuvée → stock 100 → **97**,
débit client 28 677,652 → **28 749,052**, solde +71,400. Rejet → aucun mouvement.
Valeurs restaurées après test.

### `manager/rapports` — 5 rapports réels
Remplace 5 rapports fictifs (dont 3 « preview: null »). Tous alimentés par
`/api/rapports-vente` avec période Du/Au et export CSV :

| Rapport | Source |
|---|---|
| Performance commerciaux | axe `commercial` |
| **Recouvrement & créances** | nouvel axe `creances` — balance âgée <30j / 30–60j / 60–90j / >90j |
| Produits les plus vendus | axe `article` |
| **Clients inactifs** | nouvel axe `inactifs` — ancienneté du dernier achat |
| Ventes par région | axe `gouvernorat` |

**Chiffres réels obtenus** : balance âgée = 4 567 documents impayés pour
**3 419 114,224 TND**, dont **3 526 documents à plus de 90 jours**
(2 592 268,998 TND) ; **1 431 clients sur 1 432** sans achat depuis ≥ 30 jours.

### `admin/dashboard` — fin des données inventées
Trois blocs mensongers supprimés et remplacés :

| Bloc supprimé | Remplacé par |
|---|---|
| Flotte GPS (`DEMO_VEHICLES`, vitesses, batteries, satellites) | **Meilleurs clients réels** avec CA et part relative |
| « Alertes critiques » codées en dur | **`/api/alertes`** — ruptures, stock mini, créances élevées, impayés > 90 j, documents à valider |
| « Console temps réel » avec faux logs système | **Activité récente** — derniers documents réellement enregistrés |

**Alertes réelles constatées** : 247 ruptures, 3 créances > 5 000 TND,
impayés les plus anciens à **251 jours**.

⚠️ Le bloc « Intelligence Artificielle » (prévisions, scores de confiance
98 %/91 %/95 %) reste en place : ce sont des valeurs inventées, sans modèle
derrière. Il faudrait soit le supprimer, soit l'adosser à un vrai calcul —
**décision produit à prendre**, je ne l'ai pas tranchée seul.

---

## 13. Utilisateurs, rapports direction & objectifs — ✅ FAIT

### 🔴 Correctif important : attribution des ventes par vendeur
`ErpDocument.commercial` est **vide sur les 5 000 documents** ; c'est
`utilisateur` qui porte l'auteur de la saisie (renseigné sur 4 996).

Conséquence : le « CA par commercial » du tableau de bord manager et l'axe
`commercial` des rapports regroupaient **tout sous « Non affecté »**.
Corrigé dans `/api/dashboard` et `/api/rapports-vente` via un helper `vendeur()`
(`commercial` puis repli sur `utilisateur`).

**Avant : 1 seule ligne. Après : 15 vendeurs réels.**
Admin 476 912,713 · FOUED 303 548,198 · sihem 129 887,780 ·
MOKHTAR 127 409,677 · heni 126 873,976 · aziz 53 249,037 TND.

### `admin/users` — vraie gestion des comptes
Avant : 6 utilisateurs inventés (dont 3 inexistants), aucune action réelle.
Maintenant : **les 4 comptes réels**, CRUD complet via `/api/utilisateurs`
(ADMIN uniquement), mots de passe **hachés bcrypt**, activation/désactivation,
rattachement d'un compte CLIENT à son tiers ERP, et colonne « documents saisis »
calculée depuis l'activité réelle.

Garde-fous ajoutés : impossible de supprimer **son propre compte** ou le
**dernier administrateur** ; le mot de passe reste inchangé si le champ est vide.

**Vérifié en base** : création → hash bcrypt confirmé → désactivation →
suppression, total revenu à 4.

### `admin/rapports-admin` — 5 rapports réels
Remplace 6 rapports décoratifs et un tableau de charges codé en dur.
Alimenté par `/api/dashboard` et `/api/rapports-vente` : CA mensuel (graphe +
tableau), créances (balance âgée), valorisation du stock avec liste des ruptures,
performance vendeurs, ventes par région. Export CSV par rapport.

### `manager/objectifs` — objectifs persistés
Avant : objectifs et « commissions » entièrement inventés.
Nouveau modèle **`Objectif`** (vendeur, mois, année, objectifCA) + `/api/objectifs`.
Le **réalisé est calculé** depuis les documents ; l'**objectif est saisi** par le
manager et enregistré. Sélecteur mois/année, écart, taux d'atteinte.

Choix assumé : sans objectif fixé, le pourcentage affiche **« — »** et non
« 0 % » — un objectif non défini n'est pas un objectif manqué.

**Vérifié en base** (06/2026) : 373 documents, 8 vendeurs ;
FOUED CA 58 268,669 ; objectif de test 50 000 → **atteinte 117 %**, écart
+8 268,669 ; objectif supprimé après test.

### Anomalie de données relevée
**1 318 documents ont un `utilisateur` vide** (chaîne vide, pas NULL) : ils sont
exclus des comptages d'activité plutôt que d'apparaître comme une ligne anonyme.

---

## 14. Comptabilité — ✅ FAIT

Le module comptable de B se limitait à 12 comptes et 2 écritures de démonstration,
sans aucun lien avec les 5 000 documents commerciaux. Il génère désormais de
vraies écritures à partir des documents.

### Modèles ajoutés (5)
`ExerciceCompta` · `JournalCompta` · `EcritureCompta` · `CompteCompta` · `ParamCompta`
— reprennent `exercices_compta`, `journaux_comptable`, `ecritures_comptable`,
`plan_comptable` et `vente_achat_compta` de l'ERP source.

### Moteur d'intégration (`compta-integration.ts`)
Reproduit `integrationDocVente` de A. Une facture devient :

| Compte | Sens | Montant |
|---|---|---|
| 411000 Clients | **Débit** | TTC |
| 707000 Ventes | Crédit | HT |
| 436700 TVA collectée | Crédit | TVA |
| 445700 Timbre | Crédit | timbre |

Avoir / retour (AV, BR, BRE) : **sens inversé**.

### 🔴 Anomalie majeure trouvée dans les données
Le garde-fou d'équilibre a **refusé la première intégration** — et il avait raison :

> `TIC253406` : HT 212,160 + TVA 42,840 + **FODEC 2,496** = 257,496 ≠ TTC 255,000

Dans les données importées, **le FODEC est déjà compris dans le TTC**
(HT + TVA = TTC exactement), contrairement au schéma de A où il s'ajoute.
**3 232 documents sur 3 812** étaient concernés, avec un écart allant jusqu'à 52,541.

Sans ce contrôle, la comptabilité aurait été fausse sur 85 % des documents.
Le moteur calcule maintenant la ligne de vente comme `TTC − TVA − timbre`,
ce qui garantit l'équilibre quelle que soit la convention FODEC.

### API `/api/comptabilite`
`exercices` · `journaux` · `plan` · `a-integrer` · `balance` · `grand-livre` ·
`ecritures` · `resultat` + actions `integrer` / `annuler` / `exercice` / `init-plan`.
Réservé ADMIN / MANAGER.

### UI — onglet « Intégration » dans `admin/compta`
5 vues : documents à intégrer (sélection multiple), balance, journal par pièce,
grand livre avec solde progressif, compte de résultat. Export CSV de la balance.

### Vérifications en base
- **3 486 documents → 0 déséquilibre** sur la construction des écritures
- 30 documents réels intégrés (28 TIC + 2 BR) : balance **17 459,766 = 17 459,766 ✓**
- **Les 30 pièces individuellement équilibrées** ✓
- Grand livre 411000 : solde progressif correct, avoirs en négatif
- Compte de résultat : produits 12 736,918 · résultat 12 736,918
- Double intégration refusée · annulation fonctionnelle · écritures nettoyées

### Reste ⬜
Achats (`integrationDocAchat`), règlements en trésorerie, lettrage,
bilan actif/passif, clôture d'exercice avec report à nouveau.

---

## 15. Trésorerie — ✅ FAIT

B disposait de `ErpAccount` (6 comptes), `ErpBorderau` (5 bordereaux sans lignes)
et `ErpReglement` (1 148 règlements), mais **aucune gestion de chéquiers, aucune
ligne de bordereau et aucun mouvement de compte** : impossible de suivre un
chèque ou de sortir un extrait.

### Modèles ajoutés (4)
`Chequier` · `Cheque` · `BorderauLigne` · `MouvementCompte`
— reprennent `chequiers`, `borderaux` et `accounts_mvt` de l'ERP source.

### Cycle de vie du chèque
`Emis → Remis → Encaissé` (+ `Rejeté`, `Déchiré`), avec numérotation
automatique : le chéquier porte un compteur `suivant` et se marque `epuise`
quand la plage est consommée.

La **remise en banque** est transactionnelle : création du bordereau, de ses
lignes, passage des chèques à « Remis » et **alimentation du compte de
trésorerie** en une seule opération. Un chèque qui n'est pas à l'état « Emis »
est refusé (409).

### API `/api/tresorerie`
`synthese` · `comptes` · `chequiers` · `cheques` · `borderaux` · `extrait`
+ actions `chequier` / `emettre-cheque` / `cheque-etat` / `borderau` / `mouvement`.
Réservé ADMIN / MANAGER.

### UI — nouveau sous-menu « Trésorerie » dans le module TRESORERIE
6 vues : synthèse (encaissements/décaissements, portefeuille, règlements par
mode), comptes avec solde calculé, chéquiers, portefeuille de chèques avec
sélection multiple pour la remise, bordereaux, extrait de compte à solde
progressif + export CSV.

### Vérifications en base
- Chéquier 10 chèques → 4 émis → compteur `suivant` **1000 → 1004** ✓
- Bordereau de 3 chèques (600 TND) : **3/3 passés à « Remis »**, 1 reste « Emis » ✓
- Extrait de compte : **solde 600 = total remis** ✓
- Encaissement d'un chèque → portefeuille réparti correctement
  (1 Emis 400 · 2 Remis 500 · 1 Encaissé 100)
- Synthèse sur données réelles : 500 encaissements (193 581,102 TND),
  648 décaissements (2 526 142,062 TND)
- Base nettoyée après test

⚠️ **Constat sur les données** : les décaissements dépassent les encaissements
de **2,33 M TND**. Ce n'est pas un bug de calcul mais le reflet des règlements
importés — à vérifier côté données (imports fournisseurs probablement plus
complets que les encaissements clients).

### Reste ⬜
Rapprochement bancaire, échéancier des traites, intégration comptable des
règlements (journal BQ/CA), remise à l'escompte.

---

## 16. Paramétrages — ✅ FAIT

L'écran Paramétrages était en **lecture seule** : il listait les référentiels
sans permettre la moindre modification. Et le moteur comptable livré au §14
dépendait de `ParamCompta` **sans aucune interface** pour le configurer.

### API `/api/parametres`
`refs` (référentiels par domaine) · `comptes` (comptes d'intégration) ·
`societe` (identité + taux). CRUD complet, ADMIN/MANAGER en écriture,
suppression réservée ADMIN.

### 3 volets dans l'écran Paramétrages
| Volet | Contenu |
|---|---|
| **Référentiels** | Types de documents, familles/sous-familles clients et fournisseurs, dépôts, véhicules, commerciaux — **création, modification, suppression** |
| **Comptes comptables** | Les 10 comptes qui pilotent l'intégration (client, vente, TVA, FODEC, timbre, caisse, banque…) |
| **Société & taux** | Raison sociale, matricule fiscale, adresse + taux TVA / FODEC / timbre / retenue |

### Garde-fous
- Numéro de compte validé (3 à 10 chiffres) — un compte mal saisi casserait la balance
- Tout compte paramétré est **automatiquement créé au plan comptable**, sinon il
  n'apparaîtrait jamais à la balance
- Suppression d'un commercial **refusée s'il est référencé** par des documents

### Vérifications en base
- Référentiel : création → modification → suppression (dépôts 10 → 11 → 10) ✓
- **Le paramétrage pilote réellement la comptabilité** : compte de vente
  707000 → 701000, puis intégration d'un vrai document (`TIC253406`) →
  écriture générée sur **701000** ✓
- Société & taux enregistrés et relus ✓
- Base nettoyée après test

### Reste ⬜
Gestion des modules/raccourcis (`application-modules`, `raccourcis` dans A) et
droits d'accès par composant (`droit-access`, 1 258 lignes).

---

## 17. CRM — opportunités & tickets SAV — ✅ FAIT

Les deux sous-menus CRM affichaient « Module disponible — écran dédié » sans
aucune donnée. Le modèle `Claim` existant était rattaché au modèle **démo**
`Client` (0 enregistrement), pas aux **2 399 tiers réels**.

### Modèles ajoutés (3)
`Opportunite` · `EvenementOpportunite` · `TicketSav`
— reprennent `opportunites`, `evenement_opportunite` et `crm_pdr` de l'ERP
source, rattachés aux **tiers réels** (`Partner.id`).

### Pipeline commercial
6 étapes : Prospection → Qualification → Proposition → Négociation → Gagnée /
Perdue. Affichage en colonnes, déplacement d'une étape à l'autre en un clic,
historique par opportunité (appel, visite, email, relance, note).

**Prévision pondérée** : chaque étape affiche le montant brut *et* le montant
pondéré par la probabilité — un pipeline de 177 000 TND à 95 900 TND pondérés
est une information bien plus utile que le seul total.

### Tickets SAV
Référence séquentielle `SAV-<AA><NNNN>`, 5 états
(Ouvert → En cours → Résolu → Clôturé / Rejeté), 4 niveaux de priorité,
type de panne, intervenant, solution. Le passage à « Résolu » ou « Clôturé »
**horodate automatiquement** la réparation.

### Choix assumés
- **Archivage au lieu de suppression** pour les opportunités : l'historique
  commercial (y compris les affaires perdues) a de la valeur analytique
- Le nom du client est **relu du référentiel** à la création, jamais recopié
  depuis le formulaire — évite les divergences si le tiers est renommé

### Vérifications en base
- Pipeline 4 opportunités : total **177 000 TND**, pondéré **95 900 TND**,
  taux de conversion **25 %** ✓
- Déplacement Prospection → Qualification ✓
- Historique : 3 événements enregistrés et relus ✓
- Tickets : références **SAV-260001/2/3** séquentielles ✓
- Cycle de vie : Ouvert → En cours → Résolu **avec date de réparation** ✓
- Archivage : 3 actives / 1 archivée, **total 4 conservé** ✓
- Base nettoyée après test

### Reste ⬜
Mailing (campagnes), intervenants comme référentiel dédié, opportunités
converties automatiquement en devis.

---

## 18. Bons de sortie / transfert / retour (Gestion Tourner) — ✅ FAIT

Les 4 sous-menus de création de bons étaient vides. Plus important : **rien ne
suivait la répartition du stock par emplacement** — le stock global de l'article
existait, mais on ne savait pas ce qui était au dépôt et ce qui était dans les
camions. C'est le `updateStockDepotByMvt` de A qui manquait.

### Modèles ajoutés (2)
`StockDepot` (quantité par article × emplacement) · `MouvementDepot` (journal
des déplacements avec source et destination).

### 4 types de bons, 4 comportements distincts
| Type | Trajet | Stock global |
|---|---|---|
| **BST** Bon de sortie | dépôt → véhicule | **diminue** (sortie) |
| **BTR** Bon de transfert | dépôt → dépôt | **inchangé** |
| **BTV** Transfert véhicules | véhicule → véhicule | **inchangé** |
| **BRT** Bon de retour | véhicule → dépôt | **augmente** (entrée) |

La distinction est le cœur du module : un transfert **déplace** la marchandise
sans en créer ni en détruire, alors qu'une sortie vers un camion la fait sortir
du stock disponible. Confondre les deux fausse tout l'inventaire.

### Écran unique, 3 onglets
**Saisie** (lignes avec recherche d'article et affichage de la dispo à la source),
**État du stock** (ventilation par emplacement + valorisation), **Historique**
(tous les mouvements avec trajet).

### Garde-fous
- **Stock insuffisant refusé** avec le détail par article
  (`n29 : demandé 99999, dispo 50`) — évite les stocks négatifs
- Source ≠ destination obligatoire
- Article hors référentiel : mouvement accepté, stock global non ajusté,
  **alerte remontée** plutôt qu'échec silencieux
- Tout est transactionnel : en-tête, journal, décrément et incrément d'un bloc

### Vérifications en base
- Retour +100 → stock global **100 → 200** ✓
- Sortie 30 → stock global **200 → 170**, dépôt 70 / véhicule 30 ✓
- Transfert dépôt→dépôt : stock global **inchangé**, 50 / 20 ✓
- Transfert véhicule→véhicule : 20 / 10 ✓
- Stock insuffisant **refusé** ✓ · source = destination **refusée** ✓
- **Somme par emplacement = 100** (cohérence totale) ✓
- Stock article restauré à l'identique après test ✓

### Reste ⬜
Impression des bons, réception d'un bon de transfert (accusé côté destination),
inventaire tournant par emplacement.

---

## 19. GPAO · numéros de série · Projets · contrats GRH · droits d'accès — ✅ FAIT

Ce lot solde les **5 derniers écrans vides** et les modules de A qui n'avaient
aucun équivalent. **20 modèles Prisma ajoutés** (55 → 75), 4 nouvelles API,
4 nouveaux écrans. **83 vérifications en base, toutes passantes.**

### 19.1 GPAO — données techniques, CBN, planification

Le module GPAO de A fait 35 000 lignes mais son écran CBN est un **stub de
12 lignes** qui se contente d'afficher la liste des documents : il n'y a
**aucun moteur de calcul des besoins** dans A. Les nomenclatures y sont
consultées à plat (`getNomenclatureArticles` = un `SELECT` par article).

**Modèles ajoutés (9)** : `GpaoPosteCharge` · `GpaoNomenclature` ·
`GpaoNomenclatureLigne` · `GpaoGamme` · `GpaoOperation` · `GpaoOperationGamme` ·
`GpaoOperationOf` · `GpaoPlan` · `GpaoJalonnement`
— reprennent `gpao_poste_charge`, `gpao_entete_nomenclature`,
`gpao_ligne_nomenclature`, `gpao_entete_gammes`, `gpao_operations`,
`gpao_operations_gamme`, `ligne_operations_of`, `gpao_plannification`.
L'OF reste un `ErpDocument` de type OF, comme dans A.

#### Moteur CBN (`gpao-cbn.ts`) — ce que A n'avait pas
Éclatement **récursif multi-niveaux**, puis :

> besoin brut = Σ (qte composant × quantité à produire)
> **besoin net = besoin brut − stock disponible**

Le besoin net est la seule information actionnable : c'est lui qui déclenche un
achat. `qteBase` est respectée — une nomenclature qui produit 10 unités donne
des quantités unitaires divisées par 10.

Garde-fous absents de A :
- **détection de cycle** par branche (`A → B → A` refusé, message explicite) —
  sans elle, l'éclatement récursif boucle jusqu'au dépassement de pile ;
- profondeur maximale (10 niveaux) ;
- une nomenclature **en élaboration** n'est pas éclatée, et le composant est
  alors **signalé** comme approvisionné plutôt que de disparaître du calcul ;
- valorisation au **PMP** en priorité (coût réel du stock), repli sur le prix
  d'achat catalogue seulement si l'article n'a jamais été valorisé.

Le refus de cycle est aussi appliqué **à la saisie** (`POST nomenclature-ligne`) :
ajouter un composant qui contient déjà l'article père renvoie 409.

#### Moteur de planification (`gpao-planification.ts`)
Reproduit `plannifierOf` de A : chaque opération génère jusqu'à 3 créneaux
successifs — **Temps réglage → Temps préparation → Temps opératoire**.

Deux différences assumées avec A :
- A codait les plages en dur (`08:00–12:00 / 13:00–17:00`). Ici elles viennent
  du **poste de charge**, donc chaque atelier a son horaire, sa pause et son
  nombre de ressources.
- Les **week-ends sont sautés** : un atelier fermé ne produit pas. A plaçait des
  créneaux le dimanche.

Le temps opératoire est mis à l'échelle de la quantité, pondéré par le
coefficient de charge et **dégradé par l'efficience** du poste (efficience 50 %
→ temps doublé). Réglage et préparation ne dépendent pas de la quantité : on
règle la machine une fois, quel que soit le lot.

Un conflit de ressource est enregistré avec `disponibilite: false` **plutôt que
refusé** — c'est un arbitrage à faire, pas une erreur de saisie. La vue
« Charge par poste » calcule le taux d'occupation contre la capacité ouvrable
réelle et signale les postes au-delà de 100 %.

#### UI — 3 écrans, plus aucun « Module disponible »
| Sous-menu | Contenu |
|---|---|
| **Données techniques** | Nomenclatures (composants + éclatement multi-niveaux), gammes (opérations et temps), postes de charge (horaires, capacité, coût) |
| **Calcul besoin net** | CBN depuis un article ou depuis une sélection d'OF ; besoin brut/stock/net, valorisation, export CSV |
| **Planification / Ordonnancement** | Génération des opérations depuis la gamme, planification datée, créneaux, conflits, charge par poste |

#### Vérifications en base (45 cas)
- Éclatement : 10 PF → 20 SF → **40 MP2** (`qteBase` 2 correctement appliquée), niveau 2 atteint
- Besoins nets : SF 20 brut − 5 stock = **15 net** ; MP1 couvert par le stock → **0 net**
- Valorisation : PMP 22 retenu contre prix d'achat 20 ✓ ; repli sur prix d'achat quand PMP = 0 ✓
- Agrégation : MP2 partagé entre 2 demandes = 40 + 12 = **52** ✓
- **Cycle `PF → SF → PF` détecté** et branche abandonnée ✓
- Nomenclature en élaboration : non éclatée **et alerte remontée** ✓
- Gamme : `qteBase` 2 → 120/2 × 4 = **240 min** ; efficience 50 % → **480 min** ✓
- Planification : **somme des créneaux = somme des temps** (aucune minute perdue) ✓
- **Aucun créneau dans la pause ni le week-end** ✓ · les 3 phases présentes et ordonnées ✓
- Conflit de ressource détecté (4 créneaux marqués indisponibles) ✓
- Replanifier ne duplique pas ✓ · dépassement de date limite signalé ✓
- OF sans opération et article sans gamme : refus explicites ✓
- Base nettoyée après test ✓

### 19.2 Suivi des numéros de série

`entete_vente_articles_serie` et `entete_achat_articles_serie` de A sont deux
tables ; ici **un seul modèle `NumeroSerie`**, le sens du document distinguant
l'entrée de la sortie. L'apport est la **traçabilité** : pour un numéro donné,
d'où il vient et chez quel client il est parti.

Saisie **en lot** (un numéro par ligne — un collage depuis un scanner ou un
tableur marche tel quel). Le tiers et la date sont **relus du document**, jamais
repris du formulaire. Doublon d'entrée ignoré avec alerte ; vente d'un numéro
jamais entré en stock acceptée **mais signalée**.

**Vérifié** : 3 numéros entrés, 1 vendu → traçabilité de SN001 en 2 mouvements
dans l'ordre chronologique, client de sortie conservé, **2 numéros restent en
stock** ✓

### 19.3 Module Projets

`Projet` + `ProjetJalon`, repris de la table `projets`.

**Différence assumée avec A** : dans A l'avancement est un champ saisi à la
main. Ici il est **calculé depuis les jalons pondérés** dès qu'il y en a — un
projet dont 3 jalons sur 4 sont finis ne peut plus afficher 10 % par oubli de
saisie. Sans jalon, la valeur saisie est conservée (le projet n'est pas encore
découpé).

Passer un projet à « Terminé » sans date de fin réelle la pose au jour même ;
un jalon à 100 % est horodaté automatiquement. Les retards sont détectés
(échéance passée + avancement < 100).

**Vérifié** : pondération 1/1/2 avec 100/100/0 → **50 %** ; jalons 1/2/3 à
100/50/0 → **33,333 %** alors que **90 % était saisi** ; poids tous nuls →
moyenne simple (pas de division par zéro) ; 2 jalons en retard détectés ;
cascade de suppression ✓

### 19.4 Contrats de travail (GRH)

⚠️ **Correction d'une erreur de cette analyse** : le module `contrats` de A
n'est **pas** un module de contrats clients mais les **contrats de travail**
(`contrat_CDD.js`, `contrat_CDI.js`, `contrat_CIVP.js` + table `grh_contrats`).
Il est donc rattaché au GRH, pas à la vente.

Nouveau modèle `GrhContrat` + resource `contrats` dans `/api/grh` + onglet
**Contrats** dans l'écran GRH.

Garde-fous :
- un contrat **CDD/CIVP/SIVP/Stage sans date de fin est refusé** — un contrat à
  durée déterminée sans terme n'en est pas un ; seul le CDI l'accepte ;
- **chevauchement refusé** : deux contrats « En cours » sur la même période pour
  le même employé rendraient la situation contractuelle indéterminée (409 avec
  la référence du contrat bloquant) ;
- un CDD dont la date de fin est passée est affiché **Expiré** même si l'état
  enregistré dit « En cours » — la base ne se met pas à jour toute seule ;
- alerte de renouvellement à **J-30** (`J-15` affiché sur la ligne).

**Vérifié** : CDI sans date de fin ✓ · salaire repris de la fiche employé ✓ ·
chevauchement détecté puis place libérée après clôture ✓ · CDD expiré
détecté ✓ · échéance J-15 et comptage « à renouveler » ✓ · cascade employé →
contrats ✓

### 19.5 Droits d'accès par utilisateur / composant

`DroitFonction` (catalogue) + `DroitUtilisateur` (droit accordé), reprenant
`list_droit_access`, `component_user_droit` et les colonnes de
`droit_list_doc_vente` (8 fonctions : accès, créer, modifier, supprimer,
imprimer, transformer, voir les totaux, voir les valeurs).

Le catalogue est **dérivé de la config des modules**, donc jamais désynchronisé
du menu réel : **78 composants × 8 = 624 fonctions** protégeables, créées
automatiquement et **idempotemment** à l'ouverture de l'écran. Un sous-menu
ajouté plus tard devient protégeable sans migration.

**Deux règles de résolution différentes de A**, et c'est volontaire :
1. Un **ADMIN a tous les droits par son rôle**, sans enregistrement. Dans A, un
   administrateur pouvait se retrouver bloqué faute de ligne dans
   `component_user_droit`. L'écran le signale explicitement pour qu'on ne croie
   pas que la matrice affichée est ce qui est enregistré.
2. **Absence d'enregistrement = refus** pour les actions sensibles (créer,
   modifier, supprimer, voir les valeurs). Seul `acces` est accordé par défaut,
   sinon un utilisateur sans droit paramétré ne verrait plus aucun écran et le
   module serait inutilisable à la mise en route.

Garde-fou : impossible de **retirer son propre accès à l'écran des droits** —
personne ne pourrait plus rouvrir la configuration. La matrice est enregistrée
**en une transaction** (entièrement ou pas du tout). Lecture réservée ADMIN :
qui lit la matrice connaît la surface d'attaque.

**Vérifié** : 624 fonctions créées, réinitialisation **idempotente (0 doublon)** ·
défaut accès accordé / suppression **refusée** ✓ · ADMIN tout permis sans
enregistrement ✓ · droit accordé puis **refus explicite écrasant le défaut**
permissif ✓ · unicité (login, fonction) ✓ · fonction hors catalogue : aucune
restriction inventée ✓ · réinitialisation → retour au défaut ✓

### Vérification globale du lot
`prisma migrate` appliqué · `tsc --noEmit` **clean** · `eslint` **clean** sur
tous les fichiers touchés · `next build` **exit 0** ·
**45 + 38 = 83 tests base de données, 0 échec**, base nettoyée après chaque
suite (le catalogue des 624 droits est conservé : c'est un référentiel).

### Reste ⬜
- **Caisse** (`gestion-caisse`) : A n'a pas de table de session de caisse
  (`caisses` ne contient qu'un ID et un nom) — c'est une UI de point de vente
  au-dessus des documents TIC. À spécifier avant de coder.
- **Garage** (`garage-module`) : dans A c'est une variante de devis réutilisant
  la chaîne documentaire de vente, pas une entité séparée.
- **Pièces auto** (`piece_auto_recherche`), **Impressions** (modèles
  d'impression et code-barres), **charges par centre**, **inventaire tournant**.
- GPAO : schéma hebdomadaire complet par poste (A a `gpao_ligne_schema`),
  jalonnement par chevauchement, sous-traitance.

---

## 20. Paie complète · Bilan comptable · Inventaire physique — ✅ FAIT

Scan intégral de A (`app`, `server`, `bisdb`, `bis-dist`, `bisSecure`), puis
comblement des trois derniers manques de fond. **9 modèles ajoutés (75 → 84)**,
2 API étendues, 1 API nouvelle, 3 écrans. **78 vérifications en base.**

### Ce que le scan complet a établi
- **`bisSecure` est une copie antérieure de `server`** (mêmes 135 contrôleurs)
  et **`bis-dist` un sous-ensemble de build de `app`**. Seuls `app` + `server`
  font foi — inutile de les porter séparément.
- **`bisdb`** est le répertoire de données MySQL brut : **197 tables réelles**
  (et non 360, qui comptait les vues et les tables temporaires).
- Les **135 contrôleurs** de A ont été classés un par un (voir la carte ci-dessous).

### 20.1 Paie — rubriques, grilles, types CNSS, barème IRPP

Le §8 avait livré le moteur de paie mais laissé quatre paramétrages **codés en
dur**, listés comme « reste ⬜ ». Ils sont maintenant en base et éditables.

**Modèles (5)** : `GrhRubrique` · `GrhRubriqueEmploye` · `GrhGrilleSalaire` ·
`GrhTypeCnss` · `GrhTrancheIrpp` — reprennent `rubrique_paie`,
`rubrique_employe`, `grille_salaire`, `grh_typecnss` et `grh_impo`.

**Rubriques** : les drapeaux décident sur quelle assiette la rubrique agit —
c'est ce qui distingue une prime imposable d'une indemnité exonérée. Une prime
soumise à CNSS augmente les cotisations ; une indemnité exonérée s'ajoute
directement au net. `parQuantite` (montant × quantité : repas, kilomètres) et
`prorataAbsence` (réduite au prorata des jours travaillés) sont gérés.

Règle de résolution retenue : une rubrique définie **pour la session remplace**
la rubrique permanente de même code. Sans cela, une prime exceptionnelle
s'**ajouterait** à la prime habituelle au lieu de la remplacer.

**Barème IRPP** : lu de la base, avec garde-fou — un barème dont la première
tranche ne démarre pas à 0 est **refusé** au profit du barème par défaut, car
les premiers dinars échapperaient silencieusement à l'impôt. Les
discontinuités et une dernière tranche bornée sont signalées.

**Types CNSS** : chaque employé peut relever d'un régime différent (RSNA, RSA,
stagiaire non imposable). Un seul type par défaut à la fois.

🔴 **Bug trouvé par les tests** : un code CNSS inconnu retombait sur le type par
défaut **sans le dire** — donc avec des taux différents de ceux attendus, et un
bulletin faux que personne n'aurait vu. La résolution retourne désormais si le
type demandé a été trouvé, et l'alerte remonte au traitement de paie.

Le traitement (`/api/grh/traitement`) consomme tout cela : taux selon le type
CNSS de l'employé, salaire pris dans la grille si la fiche n'en a pas, rubriques
appliquées avec leur prorata. Les surcharges d'appel restent prioritaires — on
peut simuler un taux sans modifier le paramétrage.

**Vérifié** : barème base ≡ barème codé (même IRPP, 366,925) · type exonéré →
ni CNSS ni IRPP · rubrique de session **remplace** la permanente (350 et non
550) · la permanente s'applique toujours aux autres sessions · prorata 50 % ·
rubrique désactivée exclue · la prime augmente bien le brut **et** la CNSS
(91,8 → 123,93).

### 20.2 Bilan comptable actif / passif

`etat-resultat` existait (§14) mais **pas le bilan**. A stockait des formules en
texte libre évaluées côté client ; ici la formule est **parsée**, jamais évaluée
comme du code.

**Modèles (2)** : `ParamBilan` (les lignes et leurs formules) · `BilanComptable`
(le bilan figé pour un exercice).

Une formule est une liste de comptes signés : `+21;-281`. Un préfixe agrège ses
sous-comptes (`21` couvre 2110, 2181…), comme le plan comptable tunisien
s'utilise réellement. Le résultat de l'exercice (classes 7 − 6) est ajouté au
passif : sans lui le bilan ne peut pas s'équilibrer, le bénéfice n'étant encore
affecté à aucun compte de capitaux propres.

🔴 **Bug trouvé par les tests** : avec `+53;+54;+532`, le compte 532000 était
compté **deux fois** (il correspond à `53` et à `532`) — l'actif affichait 20 000
au lieu de 10 000. Corrigé : **le préfixe le plus spécifique l'emporte**, chaque
compte n'est retenu qu'une fois. C'est aussi la bonne sémantique comptable, et
cela rend `+21;-281` correct au lieu d'ajouter puis soustraire.

Un modèle NCT par défaut (15 lignes) est fourni, chaque ligne restant éditable
depuis l'écran. Le déséquilibre est **affiché**, jamais masqué.

**Vérifié** : préfixe le plus précis retenu (1 800 et non double comptage) ·
passif inversé affiché positif · bilan équilibré 10 000 = 10 000, puis
13 000 = 13 000 après apparition d'un résultat de 3 000 · figer remplace au lieu
d'empiler.

### 20.3 Inventaire physique

Le sous-menu « Liste des inventaires » pointait sur des documents de type INV
**inexistants en base**. C'est maintenant un vrai module de comptage.

**Modèles (2)** : `Inventaire` · `InventaireLigne`.

Point de conception clé : **`qteTheorique` est figée à la saisie**. Si on la
recalculait à la validation, un mouvement survenu entre-temps (une vente le
lendemain) serait absorbé dans l'écart d'inventaire et la vraie perte deviendrait
introuvable.

La validation **aligne le stock sur le comptage** (l'inventaire physique fait
foi) et journalise chaque écart en `ErpStockMovement` avec stock avant/après —
une régularisation reste traçable, jamais un changement silencieux. Tout est
transactionnel : un inventaire à moitié régularisé serait pire que pas
régularisé du tout.

Sur un **emplacement**, le théorique est celui de l'emplacement (`StockDepot`)
et non le stock global — les confondre fausserait tout inventaire partiel.

**Garde-fous** : double validation refusée (sinon double régularisation) ·
article compté deux fois refusé · inventaire validé non modifiable et non
supprimable (il justifie un mouvement de stock) · article hors référentiel :
écart conservé, stock non ajusté, **alerte remontée**.

**Vérifié** : 100 → 95 et 50 → 53 régularisés, article conforme intact ·
**2 mouvements journalisés (pas 3)** · double validation refusée et stock
inchangé après le refus · inventaire d'emplacement : dépôt aligné à 37 et stock
global reporté de l'écart (95 → 92).

### Carte de couverture des 135 contrôleurs de A

| État | Nb | Contenu |
|---|---|---|
| ✅ **Couvert** | **77** | vente, achat, stock, trésorerie, compta, GRH complet, GPAO, CRM, projets, droits, séries, machines, référentiels tiers/articles |
| ⚠️ Partiel | 13 | catalogue, tarifs, centres de charge, charges fixes, approvisionnement, zones de stock, réclamations |
| ⬜ Absent | 46 | listés ci-dessous |

Les 46 absents sont, pour l'essentiel, **du CRUD sur de petites tables de
référence** (marque, variétés, sous-catégories, motifs d'annulation, types de
panne, jalonnements alternatifs…) ou des paramétrages d'affichage propres à
l'ancienne interface (`navbar-components`, `application-modules`, `modeles`,
`param-etoiles`). Leur poids cumulé côté service est inférieur à 400 lignes.

Restent quatre modules de **fonctionnalité réelle**, tous listés au lot 13 :
- **Caisse** (`gestion-caisse`) — A n'a pas de table de session de caisse
  (`caisses` = un identifiant et un nom) : c'est une UI de point de vente au
  dessus des documents TIC. À spécifier avant de coder.
- **Garage** (`garage-module`) — variante de devis réutilisant la chaîne
  documentaire de vente, pas une entité séparée.
- **Pièces auto** (`piece_auto_recherche`) et **Impressions** (modèles
  d'impression, code-barres).
- **Mailing CRM** et **intervenants** comme référentiel dédié.

### Vérification globale
`prisma migrate` appliqué · `tsc --noEmit` **clean** · `eslint` **clean** sur
tous les fichiers touchés · `next build` **exit 0** (31 routes API) ·
**45 + 38 + 78 = 161 tests base de données, 0 échec**, base nettoyée après
chaque suite. Barème IRPP, types CNSS et modèle de bilan sont conservés : ce
sont des référentiels, pas des jeux de test.

---

## 21. Tournées de vente ambulante & écrans commerciaux — ✅ FAIT

Les lots précédents avaient traité le **back-office** (vente, stock, compta,
GRH, GPAO). Le **terrain** — le métier quotidien du commercial ambulant —
restait largement fictif : sur les 9 écrans de `commercial/`, **5 tournaient
encore sur des données inventées**, et la chaîne de tournée de A n'existait pas
du tout dans B.

### 🔴 Ce que l'audit du côté commercial a révélé

| Écran | Avant |
|---|---|
| `commercial/planning` | Visites dérivées de `DUMMY_CLIENTS`, **heures et durées tirées au hasard** (`Math.random()`) |
| `commercial/journal` | Timeline de 9 opérations entièrement inventées, avec un solde de caisse fictif |
| `commercial/reclamation` | 4 réclamations codées en dur |
| `commercial/retour-stock` | Stock camion = 8 produits fictifs × `Math.random()` |
| `commercial/map` | `TunisiaMap` avec 4 véhicules et 6 clients aux coordonnées codées en dur |

Plus grave que les écrans : **le lien `dayID` de A était absent**. Dans l'ERP
source, chaque document et chaque règlement porte l'identifiant de la tournée
qui l'a produit. Sans ce lien, il est impossible de répondre à la seule question
qui compte en fin de journée pour un vendeur ambulant : **combien doit-il rendre,
et le stock du camion est-il juste ?**

`ErpMission` existait pourtant en base avec **2 509 tournées importées** — mais
sans lignes, sans visites, sans réclamations et sans rattachement aux documents.
C'était une coquille.

### Modèles ajoutés (2) + 2 clés de rattachement
`LigneMission` (les visites planifiées, table `ligne_mission`) ·
`Reclamation` (table `reclamation_client`, rattachée aux **tiers réels**).

Et surtout : **`dayId` sur `ErpDocument` et sur `ErpReglement`** — le `dayID`
de A, qui referme la chaîne. `ErpMission` gagne un objectif de CA et des
horodatages.

⚠️ **Migration délicate** : ajouter `updatedAt` sur `erp_missions` a d'abord
échoué — 2 509 lignes existantes sans valeur. Corrigé avec un `@default(now())`,
**les 2 509 tournées importées sont préservées**.

### Moteur de réconciliation (`missions.ts`)

`getMouvementsCommercial` dans A répond à la question par **sept requêtes SQL
séparées, sans jamais recouper les chiffres**. Le moteur centralise le calcul et
ajoute ce que A ne produisait nulle part :

- **CA net de la tournée** = Σ(ventes) − Σ(retours), la règle de `vente-stats.ts`
- **Reste à encaisser** = CA net − encaissé : **le crédit accordé dans la journée**
- **Espèces isolées** des autres modes : c'est ce que le commercial rapporte physiquement
- Taux de réalisation des visites, taux d'objectif, kilomètres parcourus

Garde-fous absents de A :
- **une seule tournée par commercial et par jour** — deux tournées le même jour
  rendraient le rattachement d'une vente ambigu ;
- **clôture refusée s'il reste des visites « À visiter »** — sinon le taux de
  réalisation devient ininterprétable ; `forcer` les reporte explicitement ;
- kilométrage d'arrivée < départ refusé ; double clôture refusée ;
- un document ni vente ni retour (un devis) est **exclu du CA et signalé** ;
- encaisser plus que le CA du jour est **légitime** (recouvrement d'anciennes
  créances) mais signalé, pour que le chiffre négatif ne surprenne pas.

### Les 5 écrans, refaits sur la base

| Écran | Maintenant |
|---|---|
| **Planning** | Tournée du jour réelle, visites depuis `LigneMission`, marquage Visité / Reporté / Absent horodaté, ajout de clients depuis les 2 399 tiers, création de la tournée si absente |
| **Journal** | Chronologie réelle des documents et encaissements de la tournée, ventilation par mode de paiement, **espèces à rendre**, clôture avec relevé kilométrique |
| **Réclamations** | Sur `Reclamation`, rattachée **automatiquement à la tournée du jour**, circuit Ouverte → En cours → Résolue horodaté |
| **Stock camion** | Vraie ventilation via `StockDepot` (§18) — le véhicule est un emplacement ; retour au dépôt (BRT) et transfert entre véhicules (BTV) réels |
| **Carte** | Nouveau composant `ClientsMap` : **2 283 clients géolocalisés**, ceux de la tournée du jour mis en évidence avec leur numéro d'ordre, filtre par gouvernorat, itinéraire Google Maps |

Périmètre de sécurité : un utilisateur `COMMERCIAL` ne voit **que ses propres
tournées et réclamations** — le filtre vient de la session, jamais de l'URL.

### Vérifications en base (41 cas)
- Tournée créée avec 3 visites ; **nom du client relu du référentiel**, pas repris du formulaire
- **2ᵉ tournée le même jour refusée** ; le lendemain acceptée avec un identifiant distinct
- 2 ventes (1 000) − 1 retour (100) = **CA net 900** ; **le devis de 5 000 exclu et signalé**
- 3 encaissements = 800 ; **espèces isolées 500 + 100 = 600**
- **Reste à encaisser = 900 − 800 = 100** (le crédit du jour) · objectif 1 000 → **90 %**
- Encaissé 1 300 > CA 900 → −400 avec alerte « recouvrement »
- Visites : 1 visité / 1 absent / 1 restant → taux **33,333 %**
- Clôture **refusée** avec une visite en attente ; kilométrage incohérent refusé ;
  clôture forcée → visite reportée ; **150 km** parcourus ; double clôture refusée
- Stock camion : 2 articles, valorisation PMP **200 + 60 = 260**
- Suppression de tournée → **le document survit avec `dayId` à null** (SetNull)
- Base nettoyée après test

### Vérification globale
`prisma migrate` appliqué (2 509 tournées préservées) · `tsc --noEmit` **clean** ·
`eslint` **clean** · `next build` **exit 0** (33 routes API) ·
**45 + 38 + 78 + 41 = 202 tests base de données, 0 échec**.

### Reste ⬜
- `admin/recordings`, `client/suivi`, `manager/supervision` : aucune donnée
  source (audio, livraison temps réel, GPS véhicule en direct).
- `TunisiaMap` reste utilisé par `admin/dashboard` avec ses véhicules codés en
  dur — à remplacer quand un flux GPS existera.
- Frais de route (carburant, péage) : A ne les stocke pas non plus ; le journal
  de tournée les accueillera dès qu'un modèle de frais sera défini.

---

## 22. Tuiles manquantes de l'application commerciale — ✅ FAIT

Le §21 avait refait les 5 écrans commerciaux qui tournaient sur des données
inventées. Mais la comparaison portait sur **le menu de B**, pas sur celui de
l'application commerciale réelle. En regardant le menu de l'app en service
(`http://41.226.17.73:3000`), **4 tuiles sur 11 n'avaient aucun équivalent** :

| Tuile de l'app A | État dans B avant |
|---|---|
| Catalogue produit · Mes clients · Planning du jour · Recouvrement · Retour de stock · Journal de caisse · Réclamation client | ✅ déjà là (§21) |
| **Panier de commande** (avec son badge) | ⚠️ panier en état React, perdu au changement d'écran, aucun badge possible |
| **Dernier ticket** | ❌ absent |
| **Bon d'approvisionnement** | ❌ absent |
| **Changer mot de passe** | ❌ absent |

### 22.1 Panier de commande persistant

Le panier de B vivait dans `useState` : il disparaissait dès qu'on quittait le
catalogue, et le badge du menu ne pouvait rien compter. Deux modèles
(`Panier`, `PanierLigne`), un panier « Ouvert » par commercial.

Choix de conception :
- **Le prix est figé à l'ajout.** Un tarif modifié au catalogue en cours de
  saisie ne doit pas changer rétroactivement ce que le commercial a annoncé au
  client. Vérifié : tarif passé de 10 à 99 au catalogue → le panier garde 10.
- **Prix et libellé viennent du référentiel**, jamais du corps de requête : un
  appelant ne doit pas pouvoir fixer son propre tarif.
- Ajouter un article déjà présent **cumule** les quantités, comme dans A.
- Un panier validé est **archivé avec la référence du document créé**, pas
  supprimé : il garde la trace de ce qui a produit la commande.
- La validation **réutilise `/api/commandes`** (numérotation par souche + moteur
  de calcul) plutôt que de dupliquer cette logique, qui divergerait.

Le **badge du menu** est relu de `/api/panier?vue=badge` à chaque navigation.
Un panier vide n'affiche rien plutôt qu'un « 0 ».

### 22.2 Dernier ticket

Retrouve et réimprime le dernier ticket (TIC / BL / FC) édité par le
commercial — le cas courant : l'impression a échoué, ou le client en redemande
un. Rendu au format ticket (en-tête société depuis les paramétrages §16,
lignes, totaux HT/TVA/FODEC/timbre, reste dû, mode de règlement), avec
navigation dans l'historique et impression navigateur.

Périmètre : un commercial ne voit **que ses propres tickets**, et ne peut pas
ouvrir celui d'un collègue en devinant son numéro. Le filtre porte sur
`utilisateur` **et** `commercial`, car `commercial` est vide sur les
5 000 documents importés (constat du §13).

Un document en brouillon est signalé comme tel : le stock n'a pas encore bougé.

### 22.3 Bon d'approvisionnement

Le commercial constate un manque en tournée et demande au dépôt de recharger
son camion. Deux modèles (`BonApprovisionnement`, `BonApproLigne`), référence
séquentielle `APP-<AA><NNNN>`.

**Le point central : une demande ne bouge pas le stock.** C'est au *service* de
la demande que le mouvement se produit, via un vrai bon de sortie **BST dépôt →
véhicule** (§18) — avec ses garde-fous (stock insuffisant refusé,
transactionnel). Confondre la demande et le mouvement gonflerait le stock du
camion avec de la marchandise jamais chargée.

Le **service partiel** est géré : `qteDemandee` et `qteServie` sont distinctes,
et c'est la quantité servie qui déplace le stock. L'écran de saisie affiche,
pour chaque article, le stock du dépôt **et ce qui reste à bord** — l'information
qui déclenche la demande.

Garde-fous : article demandé deux fois refusé · bon servi non modifiable et non
supprimable (il justifie un mouvement de stock) · un commercial ne touche pas au
bon d'un collègue · seul un ADMIN/MANAGER peut servir ou refuser.

### 22.4 Changer mot de passe

Chaque utilisateur change le sien **en prouvant qu'il connaît l'actuel** : sans
cette vérification, une session laissée ouverte permettrait à n'importe qui de
verrouiller le compte. Hachage bcrypt, comme la création de comptes (§13).

Longueur minimale volontairement modeste (4 caractères) : les comptes existants
de A ont des mots de passe très courts (« 007 ») ; un seuil élevé les bloquerait
tous au premier changement. La session reste valide — inutile de déconnecter
quelqu'un qui vient de prouver son identité.

### Vérifications en base (24 cas)
- Prix **figé à l'ajout** : tarif catalogue 10 → 99, le panier garde **10** ✓
- Contrainte d'unicité (panier, article) · cumul des quantités · totaux HT 50 / TVA 9,5 ✓
- Panier validé → **aucun panier ouvert**, lignes et `refDoc` conservés · cascade ✓
- **La demande d'appro seule ne bouge pas le stock camion** (reste à 3) ✓
- Au service : camion **3 → 23**, dépôt **100 → 80**, bon lié au BST généré ✓
- Service partiel **12 servis sur 30 demandés** ✓
- Stock insuffisant refusé avec le détail (`demandé 99999, dispo 40`) ✓
- Dernier ticket = celui du vendeur, **pas celui du collègue** ; 2 tickets
  visibles sur 3 ; brouillon signalé ; lignes relues ✓
- Base nettoyée après test

### Vérification globale
`prisma migrate` appliqué · `tsc --noEmit` **clean** · `eslint` **clean** ·
`next build` **exit 0** (37 routes API) ·
**45 + 38 + 78 + 41 + 24 = 226 tests base de données, 0 échec**.

Le menu commercial de B compte désormais **13 entrées** et couvre les
11 tuiles de l'application d'origine (plus le tableau de bord et la carte).

---

## 23. Scan vérifié des contrôleurs — 4 manques réels comblés — ✅ FAIT

### 🔴 Correction de méthode

Le §20 annonçait une « carte de couverture des 135 contrôleurs ». En réalité,
cette classification avait été faite **d'après les noms de fichiers et la taille
des services**, pas en les ouvrant : environ **15 fichiers lus sur ~1 724**. Elle
était présentée comme un relevé ; c'était une estimation.

Trois erreurs successives l'ont démontré : les écrans commerciaux annoncés comme
faits tournaient sur `Math.random()` (§21), les données GPS déclarées
« inexistantes » couvraient en fait 2 283 clients (§21), et la comparaison des
menus portait sur celui de B au lieu de celui de l'application réelle (§22).

Ce lot reprend donc le travail **en ouvrant réellement** les 46 contrôleurs
classés « absents » et les 13 classés « partiels », avec leurs services et leurs
tables. Résultat : **la majorité de la classification tenait** (du CRUD sur de
petites tables de référence), mais **4 manques réels** s'y cachaient.

### 23.1 Référentiels articles — le manque le plus visible

**Preuve en base** : `famille=2`, `sousFamille=3` sur les articles, et *aucune
table de libellés*. Les 523 articles portent des codes numériques que rien ne
traduit. C'est ce qui avait forcé, au §10, à remplacer le filtre « famille » par
un filtre disponibilité — le contournement d'un vrai défaut, pas une solution.

4 modèles ajoutés : `FamilleArticle`, `SousFamilleArticle`, `UniteArticle`,
`CatalogueArticle` (tables `fam_art`, `sous_fam_art`, `unité_art`, `catalogue`).

- Une vue **`orphelins`** liste les codes utilisés par les articles mais absents
  des référentiels — exactement ce qui produit l'affichage « 2 ».
- Une action **`init`** crée les entrées manquantes avec un libellé provisoire
  (« Famille 2 »), à renommer ensuite. Inventer un nom métier serait pire que
  d'afficher le code.
- **Ajout par rapport à A** : la sous-famille est rattachée à sa famille. Dans A
  les deux tables sont indépendantes, ce qui rend impossible un filtrage en
  cascade et laisse des sous-familles orphelines.
- Suppression refusée si le référentiel est utilisé.

### 23.2 Charges fixes — moteur analytique (le plus important)

`charges-fixes.service.js` (68 lignes) contient un vrai calcul que B n'avait
pas : la **ventilation d'une charge fixe sur chaque ligne vendue**, au prorata
de son poids dans le chiffre du jour.

```
montant journalier = montant / nombre de jours AYANT eu des ventes
part de la ligne   = TTC de la ligne / TTC de sa journée
charge de la ligne = montant journalier × part
```

C'est ce qui permet la **marge nette réelle** par article. Le test le montre
sans ambiguïté : l'article B1 affiche **+330 de marge brute** et devient
**−545 en marge nette** une fois les charges vues. Sans ce calcul, on continue
de vendre à perte en croyant gagner.

Différences assumées avec A :
- A divise par les jours **ayant eu des ventes** (pas la durée de la période).
  Règle conservée — une journée fermée n'absorbe rien — mais **documentée**.
- A écrit ligne par ligne, sans transaction et **sans aucun moyen d'annuler** :
  une erreur de montant y reste inscrite dans les marges pour toujours. Ici tout
  est transactionnel et **réversible**, et une double répartition est refusée
  (sinon les montants se cumuleraient silencieusement).
- Les avoirs sont **exclus** de la ventilation : une charge ne se répartit pas
  sur un document qui retire du chiffre.

Champ `charge` ajouté sur `ErpDocumentLine` (colonne `charge` de
`entete_vente_articles` dans A), absent jusqu'ici.

### 23.3 Frais de mission

🔴 **Correction du §21**, où il était écrit que « A ne stocke pas les frais de
route ». Faux : la table `frais_mission` existe, rattachée à `id_day`, avec un
drapeau `carburant`.

Modèle `FraisMission` : carburant, péage, repas d'une tournée. Le carburant est
isolé — c'est le poste que le gestionnaire suit. Récapitulatif annuel comme
`getFraisByYear`. Frais non modifiables sur une tournée clôturée : le bilan de
journée a déjà été communiqué.

### 23.4 Plan comptable standard

`plan-comptable-standard.service.js` (99 lignes) : un **modèle de plan
réutilisable d'un exercice à l'autre**, absent de B.

Modèle `CompteStandard` + deux actions : reprendre le plan de l'exercice comme
modèle, et **copier le modèle dans un exercice**. La copie reprend
`insertInexistantPlanActuel` : elle n'ajoute que les comptes **absents**, sans
écraser un compte déjà paramétré et utilisé par des écritures. Vérifié : un
compte existant conserve son intitulé.

### Ce que le scan a confirmé (pas de travail nécessaire)

Sur les 59 contrôleurs rouverts, la plupart sont bien du CRUD sur de petites
tables (marque, variétés, sous-catégories, motifs d'annulation, types de panne,
jalonnements alternatifs, `param-etoiles`, `navbar-components`…), sous 10 lignes
de service chacun. Deux qui *paraissaient* substantiels ne l'étaient pas :
- `journer-travail` (26 l.) — une simple lecture de `ordre_mission`, déjà
  couverte par le §21 ;
- `grh-rubrique-employe` (78 l.) — déjà traité au §20.1.

### Vérifications en base (34 cas)
- Code famille sans libellé **détecté comme orphelin**, puis créé par l'init ✓
- Sous-famille rattachée à sa famille ✓ · suppression refusée si utilisée ✓
- Répartition : **2 journées avec ventes** (l'avoir n'en crée pas une 3ᵉ) →
  1000/2 = **500/jour** · TIC1 `500 × 300/400 = 375` · TIC2 **125** ·
  TIC3 seul de sa journée absorbe **500** · **l'avoir reçoit 0** ✓
- **Total réparti = montant de la charge** (1000) ✓
- Double répartition **refusée**, charge inchangée après le refus ✓
- Marge : B1 brute **+330** → nette **−545** ✓
- Annulation : lignes remises à zéro, charge repassée en Brouillon ✓
- Frais : total 115, **carburant isolé 85**, cascade tournée → frais ✓
- Plan standard : **seul le compte absent est créé**, l'intitulé existant
  n'est pas écrasé ✓

### 23.5 Écrans livrés

Les quatre manques ne sont pas restés à l'état d'API : chacun a son écran.

| Écran | Emplacement | Contenu |
|---|---|---|
| **Familles & unités** | STOCK → *Familles & unités* | 4 onglets (familles, sous-familles, unités, catalogue) · **bandeau d'alerte listant les codes sans libellé** avec le nombre d'articles concernés · bouton « Créer les entrées manquantes » · rattachement sous-famille → famille |
| **Charges fixes & marge** | CHARGE → *Charges fixes & marge* | Saisie et ventilation d'une charge (bouton **Ventiler** / **Annuler**) · onglet **Marge par article** : CA, coût, charges, marge brute **et nette**, lignes déficitaires en rouge, export CSV |
| **Frais de route** | `commercial/journal` | Bloc dans le journal de tournée : saisie carburant / péage / repas, total et **carburant isolé**, non modifiable sur une tournée clôturée |
| **Plan standard** | `admin/compta` → onglet *Plan standard* | Reprise du plan de l'exercice comme modèle · **copie vers l'exercice** (n'ajoute que les absents) · ajout manuel de comptes |

Deux avertissements portés par l'interface, parce qu'un chiffre juste mais mal
compris est aussi dangereux qu'un chiffre faux :
- **marge sans charges ventilées** : un bandeau prévient que la marge nette est
  alors égale à la brute et **ignore les frais de structure** ;
- **articles vendus à perte** : leur nombre est affiché en tête, et chaque ligne
  déficitaire est surlignée — c'est l'information que la marge brute masque.

### Vérification globale
`prisma migrate` appliqué · `tsc --noEmit` **clean** · `eslint` **clean** ·
`next build` **exit 0** (40 routes API) ·
**45 + 38 + 78 + 41 + 24 + 34 = 260 tests base de données, 0 échec**.
