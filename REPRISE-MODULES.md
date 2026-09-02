# Reprise fonctionnelle — production → S.K.Y

Suivi écran par écran de la reprise de l'ERP `41.226.17.73:3001` dans le nouveau projet.

**Source** : arbre des modules lu via l'API de production (`application-modules`), 
actions relevées dans le code source `production/BIS/app/src`.

## Légende

| Marque | Sens |
|---|---|
| ☐ | à faire |
| 🔄 | en cours |
| ✅ | terminé et vérifié (build + audit + données réelles) |
| ⛔ | sans objet — la production ne l'expose pas |

**Barre d'outils standard** : tout écran de liste en production hérite de 
`Ajouter / Modifier / Supprimer` (soumis aux droits d'accès), plus ses actions propres.

---

## GESTION DES VENTES

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Liste Clients | `/admin/modules/vente/clients` | Valider | **4 518** (4 517 production + 41102224 « Librairie ayssrm », supprimé côté production, sans document ni règlement) |
| ✅ | Liste documents vente | `/admin/modules/vente/documents` | Ajouter, Modifier, Supprimer, Lignes, Transformer, Imprimer, Excel, Dévalider, Actualiser | 9 actions vérifiées · **17 914 documents importés** |
| ✅ | creer un client | `/admin/modules/vente/clients` | Ajouter, Enregistrer, Fermer, Modifier, Nouveau, Supprimer, Valider | POST/PUT/DELETE vérifiés |
| ✅ | Creer Avoir | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Bon de commande | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Bon de livraison | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Bon de retour | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Devis | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Facture | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Suivie commande | `/admin/modules/vente/suivie-commande` | Fermer, Imprimer, Modifier, Ouvrir | **3 366 commandes** (3 360 production + 6 saisies dans l'application) |
| ✅ | Gestion des commerciaux | `/admin/modules/vente/commerciaux` | Ajouter, Annuler, Modifier, New, Supprimer, Valider | **13 = production**, y compris le commercial 711063 au libellé vide (idem en production) |
| ✅ | Gestion des ordres missions | `/admin/modules/gestion-tourner/ordres-missions` | Ajouter, Annuler, Cloturer, Itinéraire, Modifier, Non, Nouveau, Oui | **2 629 = production** ; les relevés km alimentent le compteur véhicule |
| ✅ | Statistique de vente | `/admin/modules/vente/rapports` | — | **77 860 lignes de vente importées** (4 articles avant) : les 311 articles vendus et leurs quantités sont **identiques à la production, 0 écart** ; les 166 articles supplémentaires listés par la production ont un net à zéro |

## GESTION DES ACHATS

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | creer un fournisseur | `/admin/modules/achat/fournisseurs` | Ajouter, Catalogues fournisseur, Fermer, Modifier, Supprimer | CRUD partagé avec les clients |
| ✅ | Liste des fournisseurs | `/admin/modules/achat/fournisseurs` | Afficher, Ajouter, Fermer, Imprimer, Liste des réglements, Modifier, Rechercher, Supprimer | **50 = production** (43 avant : 7 tiers de charge rangés sous une nature « T » qui les excluait) |
| ✅ | Liste documents achat | `/admin/modules/achat/documents` | Ajouter, Annuler, Fermer, Imprimer, Modifier, Ouvrir, Rechercher, Supprimer |  |
| ✅ | Creer Avoir (achat) | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider | souche AVC vérifiée (création + suppression) |
| ✅ | Creer Bon de commande (achat) | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider | souche CMI vérifiée |
| ✅ | Creer Bon de reçeption | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Bon de retour (achat) | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider | souche RRA vérifiée |
| ✅ | Creer Demande d achat | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Devis (achat) | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider | souche DAO vérifiée |
| ✅ | Creer Facture (achat) | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider | souche FAO vérifiée |
| ✅ | Rapport | `/admin/modules/achat/rapport` | — | 35 fournisseurs agrégés, règle BRE : 437 réceptions · 1 854 975 TND TTC |

## GESTION DU STOCK

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | liste des articles | `/admin/modules/stock/produits` | Ajouter, Annuler, Appliquer, CBN, Changer Réf produit, Enregistrer, Excel, Fermer | **552** (551 production + `vx 22`, supprimé côté production mais cité par nos documents) |
| ✅ | creer un article | `/admin/modules/stock/produits` | — | CRUD complet |
| ✅ | creer inventaire | `/admin/modules/stock/inventaires` | — | Saisie du comptage, écart valorisé au PMP, validation régularisant le stock |
| ✅ | liste des inventaires | `/admin/modules/stock/inventaires` | — | **598 = production** (0 avant : l'écran lisait une table restée vide), 1 283 lignes, pagination |
| ✅ | Liste des transferts | `/admin/modules/stock/transferts` | — | 9 272 docs + 109 224 lignes importés |
| ✅ | Creer un transfert | `/admin/modules/stock/transferts` | — | formulaire + mouvement de stock réel |
| ✅ | Liste des matieres | `/admin/modules/stock/matieres` | — | **160 = production** (`Matiere_premiere = 1`) |
| ✅ | Creer une matiere premiere | `/admin/modules/stock/matieres` | — | CRUD article, nature MP |
| ✅ | Creer un produit semi-fini | `/admin/modules/stock/semifini` | — | CRUD article, nature SF |
| ✅ | Gestion des depots | `/admin/modules/stock/depots` | Ajouter, Fermer, Modifier, Non, Oui, Supprimer | CRUD référentiel + garde-fou suppression |
| ✅ | Liste des semi-fini | `/admin/modules/stock/semifini` | — | **1 = production** (`produit_semi_fini = 1`) |

## TRESORRERIE

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | liste reglements clients | `/admin/modules/tresorerie/reglements-clients` | Afficher, Ajouter, Enregistrer, Fermer, Imprimer, Modifier, Rechercher, Supprimer | **13 827 = production** (500 avant : 96 % de l'historique manquait) |
| ✅ | liste reglements fournisseurs | `/admin/modules/tresorerie/decaissements-frs` | Afficher, Ajouter, Enregistrer, Fermer, Imprimer, Modifier, Rechercher, Supprimer | **712 = production** (648 avant) |
| ✅ | creer reg. client | `/admin/modules/tresorerie/reglements-clients` | Fermer | POST : `idSource` numéroté par sens, solde tiers recalculé |
| ✅ | creer reg. fournisseur | `/admin/modules/tresorerie/decaissements-frs` | — | idem, sens F |
| ✅ | Liste comptes banquaires | `/admin/modules/tresorerie/comptes` | Ajouter, Modifier, Supprimer | 6 comptes = production |
| ✅ | Creer un compte banquaire | `/admin/modules/tresorerie/comptes` | — | POST/PUT/DELETE opérationnels |
| ✅ | Liste des borderaux | `/admin/modules/tresorerie/borderaux` | Ajouter, Modifier, Supprimer | 5 = production, colonne « Pièces » ajoutée |
| ✅ | Creer borderaux | `/admin/modules/tresorerie/borderaux` | Ajouter, Encaisser tous, Fermer, Imprimer, Liste, Nouveau, Supprimer, Valider | Total calculé depuis les pièces remises ; « Encaisser tous » passe les règlements du bordereau à *Encaissé* |
| ✅ | Gestion chéquiers | `/admin/modules/tresorerie/chequiers` | Ajouter, Modifier, Supprimer | Registre des feuilles (25 = production) au lieu des règlements par chèque ; suppression = feuille déchirée |
| ✅ | Mouvements des comptes | `/admin/modules/tresorerie/mouvements-compte` | — | Vide en production aussi (`mvt-emp/max-id` → null) |
| ✅ | Creer un mouvement bancaire | `/admin/modules/tresorerie/mouvements-compte` | — | idem |
| ✅ | extraits de comptes | `/admin/modules/tresorerie/extrait-compte` | — | Alimenté par les mêmes mouvements |
| ✅ | Liste reglements tiers | `/admin/modules/tresorerie/decaissements-tier` | — | Règlements sens F |
| ✅ | Creer Dépense | `/admin/modules/tresorerie/decaissements-tier` | — | idem |

## GPAO

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Creer ordre de fabrication | `/admin/modules/gpao/of` | — | formulaire documents type OF |
| ✅ | Liste documents OF | `/admin/modules/gpao/of` | — | **614 = production** |

## GRH

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Employers | `/admin/grh` | Valider | **7 = production** ; le nom vient du référentiel tiers, l'employé n'en portant pas en source |
| ✅ | Créer un employer | `/admin/grh` | Ajouter, Enregistrer, Postes de charge, Supprimer, Sélectionner tous, Valider | CRUD complet |
| ✅ | Gestion Pointage | `/admin/grh` | Créer une Session, Non, Oui | **12 sessions = production**, 15 pointages |
| ✅ | Créer un pointage | `/admin/grh` | Valider | Saisie par session, nom d'employé désormais affiché |
| ✅ | Gestion Crédit | `/admin/grh` | Créer | échéancier 30 j, tiers `isEmploye` |
| ✅ | Traitements | `/admin/grh` | Clôturer, Consulter | 0 bulletin de paie en production aussi (`grh_bulletin_paie` vide) — moteur de traitement prêt |
| ✅ | Paramétrages | `/admin/grh` | Attribuer à tous, Enregistrer, Fermer | 2 grilles salaire reprises (= production) ; le `grh_parametrage_generale` de production est une ligne à zéro, nos écrans rubriques / CNSS / IRPP la couvrent |

## PARC ROULANT

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Charges vehicules | `/admin/modules/parc-roulant/charges-vehicules` | — | documents FCH par véhicule |
| ✅ | Creer une vehicule | `/admin/modules/parc-roulant/flotte` | Annuler, Valider | 19 champs + entretien/échéances |

## GESTION DES CHARGES

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | liste documents charges | `/admin/modules/charge/documents` | Ajouter, Modifier, Supprimer, Imprimer | filtre `tiers IS NOT NULL` — **4/4** |
| ✅ | liste des charges | `/admin/modules/charge/charges` | Ajouter, Modifier, Supprimer | articles `kind=CH` — 4 |
| ✅ | creer une charge | `/admin/modules/charge/charges` | — |  |
| ✅ | liste des tiers | `/admin/modules/charge/tiers` | Ajouter, Modifier, Supprimer | filtre `charge=1` — **8/8** |
| ✅ | creer un tier | `/admin/modules/charge/tiers` | — |  |
| ✅ | Creer document charge | `/admin/modules/charge/documents` | — |  |

## ADMINISTRATION

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Droit d access | `/admin/modules/administration/droits` | Ajouter, Enregistrer, Modifier, Supprimer, Valider | matrice droits, POST au chargement supprimé |

---

## Bugs identifiés à corriger

| État | Écran | Bug | Cause |
|---|---|---|---|
| ✅ | charge/documents | 3 documents au lieu de 4 | filtre `typeDoc = FCH` ; la production identifie une charge par `tiers IS NOT NULL` — champ `tiers` ajouté, filtre corrigé, **4/4** |
| ✅ | charge/tiers | 7 tiers au lieu de 8 | filtre `nature = T` ; la production filtre `Charge = 1` — VIVO ENERGY est un fournisseur *et* un tiers de charge |

| ✅ | vente/documents | 5 008 documents au lieu de 17 904 | export initial tronqué — TIC 3 740/13 698, COM 1 015/3 360 · **12 907 importés** |
| ✅ | vente/documents (BL) | 6 bons de livraison au lieu de 52 | 48 références existent dans `entete_achat` **et** `entete_vente` ; notre clé `refDoc` ne pouvait en garder qu'une — suffixe `-V` sur la pièce de vente, **660 772 TND** récupérés |
| ✅ | tresorerie/reglements-clients | 500 règlements au lieu de 13 827 | export initial tronqué — **12 738 importés**, encaissements portés à 4 902 695 TND |
| ✅ | tresorerie (clients + frs) | 651 règlements écrasés silencieusement | `reglements_clients` et `reglements_fournisseurs` sont deux tables MySQL à auto-increment séparés : 651 `ID_reg` communs désignent des pièces différentes. `id` devient une clé de substitution, `idSource` garde l'identifiant d'origine (clé unique `sens + idSource`) |
| ✅ | tresorerie/chequiers | l'écran listait les règlements payés par chèque | la production affiche le registre des feuilles (`chequiers/all-cheque`) — table `cheques` alimentée (25 = production), création séquencée dans le carnet, suppression = feuille déchirée |
| ✅ | tresorerie/borderaux | aucun lien entre un bordereau et ses pièces | `ID_Bord` non repris à l'import : le bordereau ne pouvait ni détailler son contenu ni justifier son total — relation ajoutée, 10 rattachements et 1 301 lettrages repris, écart déclaré/remis affiché |
| ✅ | stock/inventaires | écran vide alors que la production compte 598 inventaires | les documents INV étaient importés comme documents d'achat, mais l'écran lit la table dédiée `inventaires`, restée vide — 598 inventaires et 1 283 lignes repris (`qte_theorique` = stock attendu, `St_physique` = comptage, `qte` = écart), liste paginée |
| ✅ | stock/produits | 523 articles au lieu de 551 | export initial antérieur aux fiches créées depuis — 29 articles importés |
| ✅ | stock/produits | 11 articles en double | la production stocke certaines références avec un espace final (« jouet », « mah ») ; l'import de complément les normalisait, créant une seconde fiche sous la même identité — 183 lignes de document ramenées sur la référence de production, doublons supprimés |
| ✅ | vente/clients | 2 399 clients au lieu de 4 517 | export initial tronqué — **2 119 clients importés**, portefeuille complet (créances, tournées et statistiques portaient sur la moitié du fichier) |
| ✅ | achat/fournisseurs | 43 fournisseurs au lieu de 50 | 7 tiers de charge (« Serine chaari », « Wassim Triki »…) rangés sous une nature « T » propre à notre base : ils disparaissaient de la liste des fournisseurs alors que la production les y garde avec `Charge = 1`, comme VIVO ENERGY — nature ramenée à `F`, le drapeau `charge` continuant de les afficher dans les tiers |
| ✅ | grh (employés, pointage, sessions) | écrans vides | les tables GRH existaient mais n'avaient jamais été alimentées — 7 employés, 12 sessions, 15 pointages, 1 catégorie et 1 échelon repris de la production |
| ✅ | grh/pointage | colonne « Employé » vide | le nom était imbriqué dans la relation `personnel`, que la grille plate ne lisait pas — mis à plat dans la réponse |
| ✅ | **toutes les listes de documents** | écrans vides ou très incomplets à l'ouverture | la période s'ouvrait sur l'exercice courant (règle de l'ERP d'origine) alors que l'historique repris couvre 2023-2026 : **20 745 des 28 392 pièces (73 %) étaient masquées** — documents charge à 0, ventes à 4 954 sur 17 916, inventaires à 44 sur 598. Ouverture désormais sans borne, bornes réelles de l'historique renvoyées par l'API et affichées, raccourcis « Tout l'historique / Année N / Année N-1 / 30 derniers jours » |
| ✅ | charge/documents (création) | une facture de charge créée disparaissait de sa propre liste | le POST n'écrivait pas `tiers` — or c'est ce champ, et non le type, qui définit une charge. Champ ajouté à la création et au formulaire (colonne « Compte de charge »), avec `libDoc`, `modePayement`, `codeMag`, `utilisateur`, `vehicule`, `commercial` également repris |
| ✅ | documents (modification) | modifier une pièce effaçait des champs non saisis | le PUT réécrivait systématiquement tous les champs : une modification partielle vidait `tiers` et la date, faisant sortir la pièce de sa liste — seuls les champs transmis sont désormais réécrits |
| ✅ | parc-roulant/flotte | 3 véhicules sur 7, dont 2 mal identifiés | le parc n'avait jamais été importé : 206TU7140 était enregistré « Peugeot 206 » alors que c'est un Citroën Jumpy. **7 = production**, avec assurance, visite et vignette réelles — les échéances alimentent enfin les notifications (8 dépassements détectés) |
| ✅ | parc-roulant / tournées | kilométrage absent sur 4 véhicules | le compteur se déduit des relevés de tournée, jamais rejoués pour les véhicules ajoutés — synchronisation relancée, **7/7 véhicules avec un relevé corroboré** |
| ✅ | gestion-tourner/ordres-missions | 2 516 tournées au lieu de 2 629 | export initial tronqué — 113 tournées importées |
| ✅ | notifications | chaque alerte affichée deux fois, avec des chiffres faux | quatre notifications de démonstration semées faisaient double emploi avec les alertes système recalculées à chaque appel, et annonçaient « 3 bons de commande en attente » (1 015 en base) ou « 1 chèque de 2500 TND échu » (aucun) — semis supprimé et lignes purgées |
| ✅ | commercial/stock camion | stock fantaisiste : 222 références, 689 532 unités, **496 120 TND** dans un seul camion | des lignes écrites par un import antérieur (jusqu'à 212 142 unités d'un même article) survivaient parce que l'import n'était pas autoritaire. Il supprime désormais ce que la production ne rapporte plus : **37 réf. · 9 662 u · 13 055 TND**, conforme à la production, sur les 9 emplacements |
| ✅ | stock par emplacement | 5 références perdues à l'import | l'importeur normalisait la référence alors que le catalogue conserve la forme de production, espace final compris (« mah », « planche educatif ») — la forme du catalogue fait foi, **0 ligne ignorée** |
| ✅ | commerciaux | 1 seul commercial sur 15 rattaché à un véhicule | l'affectation n'existe pas en base source : elle se déduit du dernier conducteur connu dans l'historique des tournées — 5 commerciaux rattachés à leur camion réel |
| ✅ | commercial/stock camion | tous les commerciaux voyaient le même camion | l'écran retombait sur le premier véhicule de la liste faute de tournée du jour : chacun consultait le stock d'un collègue — l'API expose le véhicule attribué à l'utilisateur connecté |
| ✅ | affectation commerciale | risque de confusion entre deux « Heni » | le rapprochement par prénom aurait donné à Heni Rekik le camion de HENI LAJMI : rapprochement sur le nom complet, prénom seul uniquement s'il ne désigne qu'une personne |
| ✅ | admin/etat-stock | camion attribué au mauvais commercial | l'écran déduisait le commercial du libellé du dépôt (« mokhtar 206TU7140 », resté au nom d'un ancien conducteur) ou du conducteur le plus fréquent, un cumul historique — l'affectation courante du véhicule est désormais prioritaire |
| ✅ | scripts/audit.mjs | pages signalées « bloquées en chargement » à tort | le contrôle jugeait l'écran après une attente fixe de 3,2 s, insuffisante lorsqu'une route est compilée à sa première visite en développement : 7 pages étaient signalées alors qu'elles s'affichent complètement (11 000 à 22 000 caractères, aucune erreur console) — l'audit attend maintenant la fin de l'état de chargement |
| ✅ | stock global du catalogue | 1 262 748 unités au lieu de 1 476 601 | `Article.enStock` (stock toutes localisations) n'avait jamais été rafraîchi depuis l'export initial : 170 références en écart, soit **213 853 unités**. La valorisation du tableau de bord, le compte des ruptures et la liste des stocks négatifs reposaient sur des chiffres périmés — **1 594 644 TND au prix d'achat et 973 816 TND au PMP, identiques à la production** |
| ✅ | valorisation du stock | 1 404 TND d'écart résiduel au PMP | la remise à niveau ne comparait que la quantité : quatre articles avaient le bon stock mais un PMP périmé (1,334875 contre 0,909301) — les prix sont désormais comparés eux aussi |
| ✅ | stock par emplacement (valorisation) | chaque dépôt valorisé au-dessus de la production | l'import stockait le **prix d'achat** en guise de PMP, faute de PMP dans `get-articles-by-depot` : le camion de Mokhtar ressortait à 13 422 TND contre 13 055 — le PMP vient désormais de la fiche article |
| ✅ | PMP nul traité comme absent | valorisation surévaluée sur les articles à PMP zéro | `pmp \|\| puAchat` confondait « coût nul » (valeur légitime de la production pour un article jamais entré en stock valorisé) et « non renseigné », dans l'import comme dans `stockVehicule()` — les deux distinguent maintenant les deux cas |
| ✅ | stock — dérive après import | les quantités s'écartaient de la production au fil des ventes (bouteilles 15 chez nous / 13 en production, DouDou 15/14, rolly poly 13/12 sur le camion de Mokhtar) | la production vit pendant la journée : un import ponctuel est juste à l'instant où il tourne, puis dérive. La synchronisation vit désormais **dans l'application** (`src/lib/sync-production.ts`, lecture seule côté production) : les écrans de stock la déclenchent d'eux-mêmes dès que les données datent de plus de 5 min, `/api/sync-stock` + bouton « Synchroniser » sur l'écran commercial pour forcer, `npm run sync:stock` en ligne de commande — vérifié : marqueur vieilli de 20 min, un passage sur l'écran suffit à réaligner (10 s), **551 articles et 10 emplacements identiques à la production, 0 écart** |
| ✅ | vente/rapports (par article) | 4 articles au lieu de 311 | les 17 900 documents de vente avaient leurs entêtes mais pas leurs lignes : la statistique par article, le top articles du tableau de bord et les marges ne portaient que sur les pièces saisies dans l'application — **77 860 lignes importées**, 0 échec |
| ✅ | chiffre d'affaires surévalué de 360 601 TND | deux bons de livraison comptés en double | le suffixe `-V` distingue les références présentes dans `entete_achat` **et** `entete_vente` ; deux BL avaient été dédoublés alors que leur jumeau est lui aussi une vente — même pièce enregistrée deux fois (24012025 : 3 122 unités au lieu de 1 561). Copies supprimées : **CA 4 819 861 TND contre 4 821 166 en production** (0,03 %, nos 10 pièces de test et les ventes du jour) |
| ✅ | lignes de vente — références dédoublées | un même article compté sur deux orthographes | l'import reprenait la graphie de la source, qui diffère parfois du catalogue sur l'espace final (« 1 ere sciences de la vie ») : 32 d'un côté, 3 de l'autre au lieu de 35 — **166 lignes ramenées sur la référence du catalogue** |
| ⛔ | marge brute | l'écart avec la production n'est pas corrigeable | la statistique de production valorise le coût des ventes au PMP **figé sur chaque ligne** : deux articles y portent un coût négatif (`02012026` : −3 026 229 TND) et 55 un coût nul, d'où une marge annoncée de 118,9 %. Notre calcul s'appuie sur le PMP courant de la fiche article — **60,0 %**, cohérent. Les 5 PMP négatifs de notre base sont ceux de la production (`f32` = −98,07), pour −6 005 TND de valorisation |
| ⛔ | 216 lignes de document sur article inconnu | fidèle à la production | ces références (« magic bon », « N75 », « ACCECHEC »…) ont été supprimées du catalogue de production alors que leurs pièces historiques subsistent — vérifié article par article : aucune n'existe plus dans `articles` côté production. Les conserver garde les documents lisibles |
| ✅ | commercial/stock camion | la moitié des lignes en quantité négative (−360 PCS, −626 400 TND) | un stock négatif n'est pas de la marchandise à bord : c'est une sortie enregistrée sans son entrée. La base de production en contient (104 lignes sur la flotte) mais **son écran ne les montre jamais** — sa requête filtre `d.en_stock > 0 AND a.prouit_fini = 1`. Les deux mêmes filtres sont appliqués : le camion de Mokhtar passe de 18 à **9 lignes, toutes positives, identiques à la production**, et sa valeur de 129 980 à **1 952,984 TND**. Les 5 camions correspondent au nombre de lignes de la production (28 / 39 / 23 / 29 / 9). Les anomalies restent consultables par l'administration (`/admin/etat-stock?stock=negatif`) pour être régularisées |
| ✅ | commercial/menu principal | « VÉHICULE — » alors qu'un camion est affecté | les tournées planifiées par l'application étaient créées **sans véhicule** (`/api/tournee` ne le renseignait pas), et la barre de tournée ne lisait que celui de l'ordre de mission : le camion est désormais repris à la création, les 9 tournées concernées ont été complétées, et la barre affiche le véhicule affecté même les jours sans mission — vérifié sur les 5 commerciaux (mokhtar 248TU6787, aziz 206TU7140, foued 243TU3251, sihem 243TU7638, heni 238TU1019) |
| ✅ | admin/commerciaux | **27 commerciaux au lieu de 13**, chiffre d'affaires éclaté | le regroupement se faisait sur la chaîne brute du document : « MOKHTAR », « mokhtar trabelsi » et « Mokhtar Trabelsi » comptaient pour trois vendeurs, et les documents sans commercial (portant le **login** « heni », « aziz ») pour un quatrième. Regroupement par nom complet normalisé, login résolu vers le compte, et rapprochement des fautes de saisie par distance d'édition proportionnelle (« cheli »/« chelly » = même personne). **27 → 18 lignes**, Foued 527 021 TND (1 348 docs), Aziz Chelly 176 539 (511 docs) — et surtout **« heni rekik » et « HENI LAJMI » restent deux personnes distinctes** (214 374 vs 24 367). Fiche accessible par nom ou par login |
| ✅ | documents de vente — commercial perdu | **4 821 documents sans commercial**, statistiques par vendeur fausses | un import antérieur n'avait pas repris `Raison_social_com` : « sky edition » ressortait à 58 594 TND au lieu de 544 726, Foued à 527 021 au lieu de 525 425, et le périmètre des tournées ne couvrait qu'une partie de l'activité. Champ restauré depuis la production sans rien écraser — **tous les commerciaux correspondent désormais à la production** (sky edition 544 726 = 544 726, Foued 525 425 = 525 425, Aziz 176 108 = 176 108). Les 646 documents restants n'ont pas de commercial en production non plus. Le CA global est inchangé (4 819 861 TND) : la correction réattribue, elle ne crée pas |
| ✅ | commercial/tableau de bord | **4 518 clients affichés à chaque commercial** | le compteur de clients ignorait le périmètre commercial et renvoyait le fichier société entier, alors que le CA et les documents étaient bien filtrés : chacun voit désormais son portefeuille (mokhtar 722, foued 701, sihem 480, heni 442, aziz 237 — conformes au référentiel clients), l'admin gardant les 4 518 |
| ✅ | commercial/dernier ticket | historique plafonné à 100 tickets, annoncés comme total | l'API retournait `take: 100` avec `total = rows.length` : le commercial lisait « Ticket 1 sur 100 » alors qu'il en a **1 602**, et la navigation s'arrêtait au centième. Liste paginée (17 pages), total réel affiché, chargement de la page suivante à la volée — vérifié jusqu'au ticket 101 |
| ✅ | admin/ordres de mission | liste plafonnée à 200 tournées sur 2 631 | même défaut que les tickets : `take: 200` avec `total = rows.length`, sept huitièmes de l'historique invisibles. API paginée **et** pagination à l'écran (« 2 631 tournées · Page 1/14 »), retour à la première page à chaque changement de filtre, périmètre commercial préservé (46 tournées pour Mokhtar) |
| ✅ | admin/comptabilité | l'écran affichait 12 comptes et **2 écritures** au lieu de 145 | deux modules comptables coexistaient : `/api/compta`, une ébauche branchée sur des tables de démonstration (`accounts`, `journal_entries`), et `/api/comptabilite`, le module réel (plan, journaux, grand-livre, balance, bilan) alimenté par l'ERP. L'écran interrogeait l'ébauche. Rebranché sur le module réel : **10 comptes · 49 écritures (145 lignes) · balance équilibrée à 26 515,033 TND · résultat 19 368 TND**, les lignes plates étant regroupées par pièce comme dans un journal |
| ✅ | commercial/stock camion — valorisation | valeurs incohérentes, dont **MIRACLE 12pcs à 0,000 TND** | le chargement était valorisé au **PMP** (coût d'achat moyen), nul pour les articles jamais entrés en stock valorisé et sans rapport avec ce que le camion transporte. L'application mobile d'origine le valorise au **prix de vente** (`art.valeur_ht = row.tarif1_ht * row.qteRte`) : un camion porte de la marchandise à vendre. Bascule sur `tarif1Ht` — **4 422,437 TND HT, identique à la production**, ligne à ligne, sur les 4 camions chargés (238TU1019 8 870,550 · 243TU3251 5 531,470 · 243TU7638 5 780,478 · 248TU6787 4 422,437). Le coût reste disponible (`valeurCout`) pour la marge |
| ✅ | synchronisation — prix de vente figés | tarifs périmés (BALLON 19,968 au lieu de 22,464) | la synchronisation reprenait le stock et les coûts mais **pas** `tarif1_ht`, `Taux_tva` ni `Taux_fodec` : les prix dataient de l'import initial, faussant la valorisation du camion et le catalogue de vente. Les trois suivent désormais la production |
| ✅ | valeur TTC | 28,586 au lieu de 28,872 sur KIDS ZONE | le FODEC (1 %) entre dans la base de TVA en Tunisie : il manquait au calcul TTC — **TTC 5 295,917 contre 5 295,936 en production** (2 centimes d'arrondi) |
| ✅ | commercial/catalogue — mauvais camion | catalogue **vide** pour Mokhtar | l'emplacement du commercial était résolu par le **préfixe du libellé de dépôt** avant la plaque : « mokhtar 206TU7140 » désigne aujourd'hui le camion d'Aziz, et Mokhtar recevait donc le catalogue d'un véhicule qui n'est plus le sien — vide. La plaque affectée fait désormais foi, le libellé ne servant qu'à défaut : mokhtar → 248TU6787 (9 articles), foued → 243TU3251 (22), sihem → 243TU7638 (29), heni → 238TU1019 (40) |
| ✅ | catalogue — prix TTC | FODEC absent du calcul | même correction que la valeur embarquée : **tous les prix HT et TTC sont désormais identiques à la production** (KIDS ZONE 24,022 / 28,872, DouDou 44,929 / 54,000) |
| ✅ | écrans commerciaux — rechargements en boucle | **toute la page se rechargeait toutes les 30 s** (salves `sync-stock`, `panier`, `notifications`, `position`… visibles dans les journaux) | le GPS émet un point toutes les 30 s (`maximumAge: 30_000`) ; chaque point appelait `setPosition`, changeait la valeur du contexte partagé et **re-rendait tout l'arbre de la tournée** — y compris les écrans qui n'utilisent pas la position, qui refaisaient alors tous leurs appels réseau. Le contexte est scindé : `CtxClient` (client en cours) et `CtxPosition` (GPS). Les écrans sans distance passent par `useClientSeul()`, la modale de création par `usePositionGps()`. **Plus aucun appel répété sur 75 s** (stock camion, catalogue, clients), et le suivi GPS reste intact : 1 remontée à l'arrivée, 1 après un déplacement réel de 2,5 km, aucune à l'arrêt |
| ✅ | commercial/planning — tournée à 59 km | à Hammamet, avec 23 clients à moins de 15 km, le plan envoyait à **Akouda / Sousse** et « Regénérer » ne changeait rien | le planificateur cherchait le **meilleur amas** du portefeuille au lieu de servir ce qui entoure le commercial : l'amas de Sousse étant plus dense, il l'emportait malgré 59 km d'approche, et la pénalité de remplissage (5 visites manquantes × 15 km = 75 km) achevait d'écraser le secteur local. Quand il y a de quoi remplir la journée autour de soi (76 clients dans 40 km ici), ce sont ces clients qui sont retenus ; la recherche d'amas ne reprend la main que faute de clients sur place. **Depuis Hammamet : 8 Hammamet + 3 Nabeul, première visite à 673 m** — et le comportement reste correct depuis Tunis (7 Tunis), Bizerte (11 Bizerte) et Sousse (10 Sousse) |
| ✅ | commercial/planning — plan périmé au rechargement | rouvrir la page gardait la tournée d'un autre point de départ, sans le signaler | une tournée reste volontairement valable la journée (la refaire d'office effacerait les visites déjà faites), mais l'écran **prévient désormais** quand elle commence à plus de 20 km : « Cette tournée commence à 53,8 km de vous », avec un bouton **Regénérer ici** — vérifié, l'itinéraire repart alors du client à 673 m |
| ✅ | commercial/planning — génération automatique inopérante | ouvrir la page sans tournée laissait un planning vide | l'effet armait son garde-fou (`autoGen`) **avant** l'appel différé, puis son nettoyage annulait le `setTimeout` au changement d'état : la génération ne partait jamais et ne pouvait plus repartir. Le timeout n'est plus annulé |
| ✅ | commercial/planning — plan bâti depuis le dépôt | la génération automatique repartait de Sousse malgré un GPS actif (tournée à 186 km) | `genererTournee` lisait `position` dans sa closure, figée au rendu où le GPS n'avait pas encore répondu. La position est désormais lue **à l'instant de l'appel** (`positionRef`) — vérifié : `depart = {36.4, 10.6167}`, première visite à 673 m |
| ✅ | commercial/panier — prix facturé | KIDS ZONE facturé **28,586** au lieu de 28,872 | le panier calculait `TTC = HT × (1 + TVA)` en ignorant le FODEC, alors que l'ERP d'origine raisonne en **TTC** (`t1_ttc` au catalogue, `Mt_tva = valeur_ttc − valeur_ht`). Le taux de FODEC est désormais porté par la ligne de panier et transmis à la commande — **Net à payer 28,872 TND, identique à la production** |
| ✅ | commercial/panier — « Valider le panier → Ticket » | le ticket était créé mais laissé **En cours** : ni sortie de stock, ni débit client, contrairement à ce qu'annonce l'écran | la validation n'était jamais déclenchée. Un ticket (`TIC`, `tStock: S` / `tSolde: D`) est encaissé sur place : il est maintenant validé dans la foulée — vérifié sur 2 unités : **stock camion 10 → 8, solde client 0 → 57,744 TND**, mouvement de stock enregistré. Une commande (COM) reste, elle, à valider par l'administration |
| ✅ | commercial/catalogue — remise par article | la ligne de prix de l'ERP d'origine était absente | reproduite à l'identique — **`[prix TTC catalogue, grisé]  %  [remise]  $  [net]`** — plus le **total de ligne** (`net × qté`) à côté du sélecteur de quantité. Les deux champs saisissables sont liés (`net = t1_ttc × (1 − remise/100)`, `remise = 100 − net × 100 / t1_ttc`), plafonnés par `remiseMax` et revérifiés côté serveur. Vérifié à l'écran : base 39,000 → **remise 10 % → net 35,100**, total de ligne 35,100 |
| ✅ | commercial/panier — étape de règlement | le ticket était émis sans passer par le paiement | reprise de la séquence de `Panier-component.js` : **Espèce / Chèque / Traite / Retenu**, montant encaissé, n° de pièce et échéance pour les effets, reste à payer affiché. Un chèque est enregistré « En cours » avec son échéance (il n'entre en caisse qu'à sa date) ; un encaissement partiel laisse le solde au débit du client. Vérifié bout en bout : encaissement de 30 TND sur 39,000 → **stock camion 14 → 13**, reste 9,000 TND au débit |
| ✅ | ticket imprimé — règlement absent | le ticket sortait sans **mode de paiement** ni **montant réglé**, et le document restait dû en totalité malgré l'encaissement | le règlement était bien enregistré mais n'était rattaché ni au document (`modePayement`, `totalRegle`, `soldeDoc` jamais mis à jour) ni au ticket (`numDoc` vide, d'où « réglé : 0 » à l'impression). Les deux liens sont posés — vérifié : ticket 51,970 TND, encaissement de 40 en espèces → **mode « Espèce » · réglé 40 · reste 11,970**, et solde client 11,970 (pas de double comptage) |
| ✅ | commercial/panier — total affiché | le panier annonçait **38,614** pour un ticket émis à 39,000 | les totaux d'écran ignoraient le FODEC et les remises de ligne, contrairement au document. Alignés sur le calcul serveur — **Net à payer 39,000 TND, identique au `t1_ttc` de la production** |

**Avancement : 68/68 écrans terminés — tous les modules repris et vérifiés sur les données réelles ; le stock se resynchronise seul sur la production.**

### Contrôle de cohérence avec la production

Comparaison directe, écran par écran, des volumes S.K.Y et production :

| Donnée | Production | S.K.Y | |
|---|---|---|---|
| Documents de vente | 17 905 | 17 916 | +11 saisis dans notre application (tests commercial Mokhtar) |
| Documents d'achat | 10 476 | 10 476 | ✅ |
| Articles | 551 | 552 | +`vx 22`, supprimé côté production mais cité par nos documents |
| Clients | 4 517 | 4 518 | +41102224, supprimé côté production, sans document ni règlement |
| Fournisseurs | 50 | 50 | ✅ |
| Tiers de charge | 8 | 8 | ✅ |
| Commerciaux | 13 | 13 | ✅ |
| Règlements clients | 13 827 | 13 827 | ✅ |
| Règlements fournisseurs | 712 | 712 | ✅ |
| Comptes bancaires | 6 | 6 | ✅ |
| Bordereaux | 5 | 5 | ✅ |
| Feuilles de chèque | 25 | 25 | ✅ |
| Inventaires | 598 | 598 | ✅ |
| Véhicules | 7 | 7 | ✅ |
| Ordres de mission | 2 629 | 2 629 | ✅ |
| Employés GRH | 7 | 7 | ✅ |
| Sessions de paie | 12 | 12 | ✅ |
| Stock global (catalogue) | 1 476 601 u · 1 594 644 TND | 1 476 601 · 1 594 644 | ✅ (PMP : 973 816 = 973 816) |
| Stock — Dépôt principale | 358 réf. · 1 433 741 u | 358 · 1 433 741 | ✅ |
| Stock — 206TU7140 (Aziz) | 37 réf. · 9 662 u | 37 · 9 662 | ✅ |
| Stock — 238TU1019 (Heni) | 37 réf. · 2 263 u | 37 · 2 263 | ✅ |
| Stock — 243TU3251 (Foued) | 37 réf. · 4 838 u | 37 · 4 838 | ✅ |
| Stock — 243TU7638 (Sihem) | 36 réf. · 3 467 u | 36 · 3 467 | ✅ |
| Stock — 248TU6787 (Mokhtar) | 18 réf. · −940 u | 18 · −940 | ✅ |
| Stock — doblo252TU6847 | 32 réf. · 1 172 u | 32 · 1 172 | ✅ |
| Stock — Magasin Négoce | 11 réf. · 614 u | 11 · 614 | ✅ |
| Stock — HENI 252TU6756 | 3 réf. · −149 u | 3 · −149 | ✅ |
| Mouvements de compte | 0 | 0 | vide en production aussi |
| Machines (GMAO) | 0 | 0 | vide en production aussi |
| Tickets SAV (CRM) | 0 | 0 | vide en production aussi |

Toutes les données sont lues et écrites dans PostgreSQL : aucun écran ne sert
de valeurs en dur.

### Points restant à trancher

- **252TU6847** (32 réf.) et **252TU6756** (3 réf.) n'ont pas de commercial
  rattaché : leur dernier conducteur est « HENI LAJMI », qui n'a pas de compte
  utilisateur, et « heni rekik », déjà affecté à 238TU1019. Créer un compte pour
  HENI LAJMI rattacherait 252TU6847.
- **11 comptes commerciaux sans véhicule** (jamil, walid, ghassen, ahmad,
  souhaib, brahim, soumaya, iyed, ilyes, hichem, zied) : aucune tournée récente
  à leur nom, donc aucun camion à leur attribuer. Ils se connectent et
  travaillent normalement, mais sans stock embarqué.
- Le parc compte 7 véhicules ; 5 sont affectés.

## Structure de la base — identifiants

Les 24 tables issues du squelette de départ portaient un identifiant textuel
(cuid : `cmqs2plif000s03g8qywpgsj9`). Converties en **entier auto-incrémenté**
(migration `20260824120000_identifiants_serial`), clés étrangères et index
repris à l'identique, dans l'ordre chronologique de création.

Restent volontairement en texte les **clés métier partagées avec la production**,
qui servent de référence commune avec l'ERP d'origine et ses scripts de synchronisation :
`articles_ext.refArt` (`n29`), `documents_ext.refDoc` (`BRT240086`),
`unite_art.unite`, `gpao_nomenclatures.refArt`.

Les 74 tables de la reprise ERP étaient déjà en `integer` auto-incrémenté.

Vérifié : 0 ligne perdue, tous les liens résolus (commercial → utilisateur → véhicule),
24 séquences calées au-dessus du maximum, audit 83 routes × 4 rôles à 0 anomalie,
0 erreur TypeScript.

## Base `bechir` — reconstruction et performance

La base de travail est désormais **`bechir`** (`bechir1` conservée comme source).
102 tables recréées, clé primaire déclarée `serial`, puis données clonées depuis
`bechir1` : **242 071 lignes, 0 échec**.

### Règle de clonage des identifiants

| Cas | Traitement | Nombre |
|---|---|---|
| id auto-généré, aucune table ne la référence | **id régénéré** à partir de 1 | 22 |
| id auto-généré, référencée par d'autres tables | **id conservé** — sinon les enfants pointent dans le vide | 33 |
| clé métier (`refArt`, `refDoc`, `unite`) | copiée telle quelle | 47 |

Régénérer les identifiants d'une table référencée casse les rattachements :
mesuré sur `inventaires` (id 37–634, pas 1–598), une copie sans id produit
**41 lignes orphelines** et rattache silencieusement les 1 242 autres au mauvais
inventaire — aucune erreur levée, seuls les chiffres sont faux.

Résultat : `document_lines_ext` passe de 18–187136 à **1–187077**,
`stock_depots` de 87–5536 à **1–472**, tandis que `inventaires` et
`erp_missions` gardent leur numérotation. **0 orpheline, 69 clés étrangères validées.**

### Performance

36 colonnes de clé étrangère n'avaient aucun index : chaque jointure y faisait
un balayage complet. Index créés, mesuré sur la jointure
`documents_ext` ↔ `erp_missions` :

| | `bechir1` | `bechir` |
|---|---|---|
| Plan | `Seq Scan` | `Index Only Scan` |
| Blocs lus | 985 | **26** |
| Temps du nœud | 7,251 ms | **0,538 ms** |

Total : 284 index, 69 clés étrangères, 89 séquences, 8 types énumérés.

Le schéma est versionné dans `db/` (voir `db/README.md`) : structure, index,
clés étrangères, séquences et script de clonage. Reconstruction complète
vérifiée en **18 s** depuis ces seuls fichiers.

## Réalignement sur la production — 24 août 2026

Comparaison chiffre par chiffre avec `41.226.17.73:3050`. Six anomalies trouvées et corrigées.

### 1. Chiffre d'affaires surévalué de 1 123 466 TND

Nos **145 factures d'achat** (`FAO…`, fournisseurs Graphy Print, EPI…) portent le
même `typeDoc` **FC** que les factures client et entraient dans le CA. Quatre
calculs ne filtraient pas sur `nature` : `charges-fixes.ts` (×3) et `projets`.

CA : **6 012 530,56 → 4 889 064,57**, identique à la production au centime.

### 2. Stock du dépôt principal : 524 749 unités manquantes

545 références présentes en production étaient absentes de notre catalogue.
Deux causes distinctes :
- **29 articles** créés en production depuis notre import → importés (catalogue 552 → 592) ;
- **517 lignes de stock sans fiche article** — la production elle-même ne les
  affiche pas (son écran joint `article`), c'est un résidu de sa propre base.

### 3. Documents en retard

97 documents créés en production entre le 19 et le 24 août manquaient, et
4 tickets avaient été modifiés après notre import (l'importeur préserve
l'existant). Importés puis réalignés sur les montants de production.

### 4. Affectations commercial ↔ véhicule

La référence est le **`Code_mag` du compte utilisateur en production** : c'est le
dépôt depuis lequel l'application mobile fait vendre le commercial.

| Compte | `Code_mag` | Véhicule |
|---|---|---|
| MOKHTAR | 13 | 248TU6787 |
| aziz | 2 | 206TU7140 |
| heni | 7 | 238TU1019 |
| sihem | 10 | 243TU7638 |
| FOUED | 9 | 243TU3251 |

L'historique des documents dit qui a *conduit* un camion, ce qui n'est pas
l'affectation déclarée — s'y fier menait à une conclusion inverse. Les libellés
d'emplacement portent d'anciens noms de conducteur (« AZIZ 248TU6787 » est le
camion de Mokhtar) : trompeurs à l'écran, mais fidèles à la production.

Vérifié : stock camion à **écart 0,00 pour les 5 commerciaux**.

### 5. Camions listés comme dépôts

Les `Code_mag` de la production mélangent entrepôts et camions.
`/api/mouvements-depot?vue=emplacements` sépare désormais les **3 vrais dépôts**
(Dépôt principale, Magasin 1, Magasin Négoce) des **7 camions**.

### 6. Transfert de stock refusé à tort

Deux formes d'une même référence coexistent au catalogue (`planche educatif` et
`planche educatif ` avec espace final). `creerMouvement` cherchait la forme
saisie, trouvait 0 et refusait le mouvement alors que le stock existait sous
l'autre forme. La résolution privilégie maintenant la forme qui porte
réellement du stock à la source.

Vérifié : transfert dépôt → camion de 2 unités, stock décrémenté puis restitué.

### Contrôle final

| | Production | Nous |
|---|---|---|
| CA | 4 889 064,57 | **4 889 064,57** |
| Dépôt principale | 1 397 755 | **1 397 755** |
| 5 camions commerciaux | — | **écart 0,00** |

Le stock de production bouge en continu (mesuré : 2 100 → 2 150 → 2 178 → 2 199
sur le 238TU1019 en quelques minutes). Les écarts constatés entre deux mesures
sont de l'activité réelle, pas un défaut : contrôlé immédiatement après
`npm run sync:stock`, l'écart est nul sur tous les emplacements.

### 7. Modules et documents complétés

| Module | Production | Avant | Après |
|---|---|---|---|
| Réclamations client | 291 | 0 | **291** |
| Frais de mission | 61 | 0 | **61** |
| Charges fixes | 30 | 0 | **30** |
| Composants nomenclature | 675 | 0 | **648** |
| Chéquiers | 25 | 2 | **27** |
| Documents d'achat | 10 613 | 10 476 | **10 619** |

Les 27 composants et 3 nomenclatures écartés portent des références absentes du
catalogue ; les 6 documents d'achat en plus sont nos doublons `-V` (une même
référence porte un bon de réception d'achat *et* un bon de livraison de vente).

Scripts ajoutés : `prisma/import-modules-manquants.ts`,
`prisma/import-achats-complement.ts` — tous deux rejouables.

## Scan intégral pour la mise en production — 24 août 2026

Balayage des **63 écrans de module** × **4 rôles** au navigateur, puis test des
actions d'écriture (créer / modifier / supprimer / valider / dévalider).

### Bugs bloquants corrigés

**1. Vente depuis le dépôt : le stock ne bougeait pas**

`validerDocument` n'écrivait dans `stock_depots` que si le document nommait un
véhicule. Une vente saisie au bureau décrémentait le compteur global de
l'article sans toucher le dépôt — les deux chiffres s'éloignaient à chaque
document. Le mouvement s'impute désormais au dépôt principal à défaut de
véhicule, à la validation **comme à la dévalidation** (sans quoi une
dévalidation n'aurait pas restitué le stock).

Vérifié : 8 231 → 8 228 → 8 231, solde client 0 → 35,70 → 0.

**2. 20 articles invendables alors que le stock existait**

Le contrôle de disponibilité lisait `Article.enStock`. Or ce compteur diverge de
la somme des emplacements sur **161 articles** — un écart hérité de la
production, qui ne tient pas les deux ensemble (l'article affiche −5 131 quand
le dépôt en porte 8 228). Le stock par emplacement est le seul chiffre
vérifiable : c'est lui qui fait foi désormais.

À noter : la production **ne contrôle pas** le stock à la validation (aucun
message de ce type dans son code) et laisse le stock devenir négatif. Notre
contrôle reste plus strict, mais il lit maintenant la bonne source.

**3. Création de tiers en échec**

L'identifiant venait de `Date.now()/1000` : deux créations dans la même seconde
produisaient le même numéro et la seconde échouait sur la contrainte d'unicité.
Remplacé par le premier identifiant réellement libre.

**4. Référentiels articles vides**

`fam_art`, `sous_fam_art` et `unite_art` étaient à zéro : les colonnes famille
et unité affichaient des numéros nus et les filtres de la fiche article
n'avaient rien à proposer. Importés — **21 familles, 43 sous-familles,
7 unités**, 0 rattachement orphelin.

**5. « Top tiers » faussé sur le rapport achats**

Les transferts internes (TR, 9 370 documents sans tiers par nature) occupaient
la première place avec un libellé vide et 30,8 M TND. Le classement ne retient
plus que les documents désignant réellement un tiers.

### État des 63 écrans

**0 erreur console, 0 appel API en échec.** Les 9 écrans sans tableau sont des
synthèses (rapport achats, balance de trésorerie, CBN…) ou des modules vides en
production aussi (`numeros_serie`, `vehicules_operations`, `opportunites`
n'existent même pas côté production).

Scripts ajoutés : `prisma/import-referentiels-articles.ts`,
`scripts/scan-ecrans.mjs`, `scripts/scan-roles.mjs`.

### Bugs trouvés au test des boutons

**6. Séquences en retard : toute création échouait sur 7 tables**

Les tables importées avec leurs identifiants ont laissé leur séquence à sa
valeur d'origine : `ligne_mission` en était à 697 pour un maximum de 21 954.
Conséquence visible : **`/api/tournee` renvoyait 500** et le planning du
commercial ne se générait plus. Idem pour réclamations, charges fixes, frais de
mission, chéquiers, nomenclature et positions GPS.

Corrigé par `db/05-sequences.sql`, à rejouer après tout import.
Vérifié : tournée régénérée, 12 clients, nouvelles lignes en 21956+.

**7. Défauts de rendu React (4 erreurs de lint qui n'étaient pas cosmétiques)**

- `BISAssistant` : message d'accueil posé par un effet (rendu supplémentaire à
  chaque montage) et `Math.random()` appelé pendant le rendu ;
- `admin/dashboard` : thème lu depuis `localStorage` dans un effet — d'où un
  flash du thème par défaut à chaque chargement ;
- `admin/synthese` : `setLoading(true)` synchrone dans l'effet.

C'est le motif qui produisait les rechargements en cascade signalés plus tôt.
Lint : **22 → 16** erreurs, les 16 restantes étant des `any` et des apostrophes
sans effet fonctionnel.

### Actions vérifiées de bout en bout

Créer / modifier / supprimer testés sur : tiers, article, véhicule, compte
bancaire, référentiel dépôt, réclamation, charge fixe — **7 modules, 200 sur
toutes les opérations**, données de test supprimées après contrôle.

Cycle document complet : création → lignes → validation → dévalidation, avec
vérification du stock (8 231 → 8 228 → 8 231) et du solde client (0 → 35,70 → 0).

### Contrôle final

| | Production | Nous |
|---|---|---|
| CA | 4 889 064,57 | **4 889 064,57** |
| Stock, 9 emplacements | — | **écart 0,00** |
| Réclamations / charges / frais | 291 / 30 / 61 | **291 / 30 / 61** |
| Familles / sous-familles / unités | 21 / 43 / 7 | **21 / 43 / 7** |

### Boutons : impression et export

**8. Le bouton « Imprimer » sortait toute l'interface**

`window.print()` était appelé sans gabarit : le menu latéral, la barre de
filtres et les boutons d'action partaient sur le papier avec le tableau. Deux
gabarits existaient déjà (traite A4 paysage, ticket rouleau 80 mm) mais aucun
pour les écrans de module.

Ajouté : `@media print` masque le chrome de l'application (`aside`, `nav`,
`[data-impression="masquer"]`) et n'imprime que `[data-impression="contenu"]`,
avec en-têtes de tableau répétés et lignes non coupées entre deux pages.

Vérifié en mode impression : menu 0, boutons 0, contenu visible, 50 lignes.

**9. L'export Excel ne sortait que la page affichée**

`exportExcel` ne lisait que `rows`, soit 50 lignes sur 4 568 clients. Il
parcourt maintenant toutes les pages avec les filtres courants, le bouton
affichant « Export… » pendant le parcours.

Vérifié : 50 lignes à l'écran → **4 518 lignes exportées**, BOM UTF-8 conservé
pour Excel.

### Actions de liste vérifiées

Recherche, tri, pagination et filtre de période testés sur clients, documents et
articles — tous corrects (`search=market` → 162, `dateDu`/`dateAu` sur 2026 →
5 059 documents, chiffres confirmés en base).

## Remise du catalogue commercial — 24 août 2026

### Le bug : Net à payer au prix catalogue

Panier avec 10 % de remise : les lignes valaient 35,100 et 19,800, mais l'écran
affichait **61,000 TND** — le total au tarif plein (39,000 + 22,000).

La remise était pourtant bien enregistrée (`remise = 10` en base) et l'API
renvoyait déjà 54,900. Le défaut était côté affichage, en trois points :

1. **Au rechargement**, le panier reconstruit depuis le serveur ne reprenait
   **ni `remise` ni `tauxFodec`** — le calcul repartait du prix catalogue ;
2. **`addToCart`** n'attachait pas la remise saisie à la ligne locale ;
3. **Le total par ligne** côté serveur ignorait remise et FODEC.

### La remise était invisible sur les lignes

Le récapitulatif affichait `32,449 × 1` — le **PU HT catalogue** — alors que la
production affiche `net × qteCmd`, le net étant le prix TTC remisé (`pu_ttc`).
Les lignes ne totalisaient donc pas le « Net à payer ».

Formule reprise du bundle de production
(`bisSecure/server/bis-dist/build/static/js/main.90cdc4d9.js`) :

```
remise = 100 − 100 × saisie / t1_ttc        (saisie du net → %)
pu_ttc = ht_value − ht_value × remise / 100 (saisie du % → net)
ligne  = net × qteCmd
tot_remise = Σ MT_Remise
```

### Ce que les deux écrans affichent maintenant

| | Avant | Après |
|---|---|---|
| Ligne FARTOUNA | 32,449 × 1 → 32,449 | ~~39,000~~ **35,100** × 1 · −10 % |
| Ligne foot-ball | 18,487 × 1 → 18,487 | ~~22,000~~ **19,800** × 1 · −10 % |
| Remise | absente | **− 6,100 TND** |
| Net à payer | 61,000 | **54,900** |

Le panneau du catalogue montre le prix plein barré, le net, le badge `−10 %` et
le montant de remise par ligne. L'écran `/commercial/panier` a une colonne
**Remise** dédiée et la ligne « Remise » en pied, comme `tot_remise` en production.

### Parcours ticket vérifié de bout en bout

Ticket **TIC260001** émis à 54,899 TTC avec 40 TND en espèces :
stock camion 14 → 13 et 15 → 14, compte client débité de 14,899, document
« Validé » portant mode **Espèce**, réglé **40**, reste **14,899**. Le ticket
imprimé reprend les lignes remisées (19,799 et 35,100), la remise 5,094 et le
FODEC 0,292. Données de test supprimées, stock resynchronisé.

## Libellés de véhicule trompeurs — 24 août 2026

L'écran du commercial affichait « Stock du véhicule **AZIZ 248TU6787** » pour
Mokhtar Trabelsi, ce qui laissait croire à une mauvaise affectation.

### Ce que disent les sources de production

| Source | Réponse |
|---|---|
| Compte utilisateur (`Code_mag`) | MOKHTAR → 13 → **248TU6787** |
| App mobile (`y.user.Code_mag`) | le dépôt vient du compte |
| Ordres de mission | 5 dernières tournées de Mokhtar (6→21 août) : **248TU6787**, dont celle « En cours » |

**L'affectation était donc correcte.** Mokhtar a changé de véhicule début août :
206TU7140 auparavant (61 ordres), 248TU6787 désormais.

### Le vrai défaut : deux libellés inversés

Les libellés d'emplacement de la production portent d'anciens noms de conducteur,
et deux sont exactement croisés :

| Libellé | Conducteur réel |
|---|---|
| « AZIZ 248TU6787 » | **Mokhtar Trabelsi** |
| « mokhtar 206TU7140 » | **Aziz Chelly** |

Ces libellés viennent de la production et servent de clé aux lignes de stock :
les renommer en base couperait le lien avec la synchronisation. `/api/catalogue`
expose donc désormais la **plaque** (`plaque: "248TU6787"`) à côté du libellé, et
l'écran affiche la plaque seule — donnée non ambiguë.

Vérifié : le stock du camion est exact, **7 articles aux quantités identiques à
la production** (80, 15, 14, 8, 6, 6, 4).

### Affectations actuelles, confirmées par les ordres de mission en cours

| Commercial | Véhicule |
|---|---|
| mokhtar trabelsi | 248TU6787 |
| aziz chelly | 206TU7140 |
| SIHEM HARABI | 243TU7638 |
| heni rekik | 238TU1019 |
| Foued Fakhfekh | 243TU3251 |
| HENI LAJMI | 252TU6847 |

## Boîtes de dialogue — SweetAlert2

Les `confirm()` et `alert()` du navigateur affichaient « **localhost:3000 says** »,
ignoraient le thème et n'offraient que « OK / Cancel ».

**31 appels natifs remplacés dans 19 fichiers** par `src/lib/alertes.ts`, qui
expose quatre fonctions : `confirmer`, `erreur`, `succes`, `info`.

Ce que cela change concrètement :

| | Avant | Après |
|---|---|---|
| En-tête | « localhost:3000 says » | **« Vider le panier »** |
| Message | « Vider le panier (3 article(s)) ? » | « 3 article(s) seront retirés du panier. » |
| Boutons | OK / Cancel | **« Vider le panier » / « Annuler »** |
| Apparence | dialogue système | couleurs du thème, coins arrondis |

Le bouton nomme l'action plutôt que « OK » : à sa lecture, on sait ce qui va se
passer. Les actions destructrices passent `danger: true` (icône d'avertissement,
bouton rouge, focus par défaut sur « Annuler »).

Détails techniques : la palette est lue depuis les variables CSS
(`--bg-card`, `--text-primary`) à chaque ouverture, donc le dialogue suit le
thème clair/sombre ; `.swal2-container` est en `z-index: 9999` pour passer
au-dessus des panneaux latéraux de l'application.

Vérifié au navigateur : popup affichée, **aucun dialogue natif déclenché**,
63 écrans de module et 34 pages des 4 rôles sans erreur console.

## Objectifs par vendeur — rapprochement et saisie

### Le bug : 7 vendeurs sur 8 à 0 %

La modale « Objectif du mois » affichait 113,5 % au global mais un objectif de
**0 TND pour presque tous les vendeurs**, alors que 56 objectifs existent en base.

Cause : les objectifs sont saisis sous une forme abrégée que les documents
n'emploient pas.

| Objectif | Document |
|---|---|
| `FOUED` | `Foued Fakhfekh` |
| `sihem` | `SIHEM HARABI` |
| `MOKHTAR` | `mokhtar trabelsi` |
| `HENI LAJMI` | `HENI LAJMI` ← seul identique |

Le rapprochement se faisait sur le nom brut (`objectifs.find(x => x.vendeur === vendeur)`),
d'où le seul 94,1 % affiché — celui de HENI LAJMI, identique par hasard.

### La correction, et le piège des homonymes

Regrouper par prénom ne suffit pas : **`heni rekik` et `HENI LAJMI` sont deux
personnes**, qui coexistent le même mois avec des objectifs distincts
(20 427 et 12 225). Un premier essai les avait fusionnés sur une seule ligne.

`src/lib/objectifs-vendeurs.ts` retient donc le nom complet dès qu'il y en a un,
et ne rattache un prénom isolé que si le rapprochement est sans ambiguïté — un
prénom ambigu revient au vendeur qui n'a pas déjà son propre objectif.

Les deux API concernées (`/api/objectifs` et `/api/insights`) partagent ce module.

| Vendeur | Avant | Après |
|---|---|---|
| Foued Fakhfekh | 0 % | **110,1 %** |
| mokhtar trabelsi | 0 % | **108,8 %** |
| SIHEM HARABI | 0 % | **120,5 %** |
| heni rekik | 0 % | **115,4 %** |
| aziz chelly | 0 % | **114,9 %** |
| HENI LAJMI | 94,1 % | 94,1 % |
| HICHEM KRIAA | 0 % | **90,9 %** |

### Saisie des objectifs par l'administrateur

Chaque ligne de la modale porte maintenant un champ **Objectif TND** et un bouton
**Fixer**, qui appelle le `PUT /api/objectifs` existant (réservé ADMIN/MANAGER).
Un vendeur sans objectif est signalé « objectif non fixé ».

Vérifié : IYED KACEM passe de `0 TND · 0 %` à `6 000 TND · 82,7 %`, taux
recalculé et affiché immédiatement.

### Carte « Objectifs par vendeur » sur `/admin/synthese`

La saisie demandée se trouve désormais sur l'écran de pilotage lui-même, et non
dans une modale du tableau de bord.

La carte porte :

- un **sélecteur mois / année** — l'écran s'ouvre sur le mois courant, ce qui est
  le moment où l'on fixe les objectifs ;
- quatre indicateurs de période : réalisé, objectif, atteinte, nombre de vendeurs
  sans objectif ;
- une ligne par vendeur avec sa barre de progression, son écart en TND, un champ
  **Objectif TND** et un bouton **Fixer** ;
- la mention « objectif non fixé » en orange pour ceux qui n'en ont pas.

L'enregistrement appelle le `PUT /api/objectifs` existant (ADMIN/MANAGER), puis
recharge la carte : le taux se recalcule immédiatement, et une confirmation
SweetAlert2 s'affiche.

Vérifié : août 2026 ouvre sur 6 vendeurs sans objectif ; le passage à juin 2026
affiche les objectifs existants avec leurs taux (110 %, 109 %, 121 %, 115 %,
115 %, 94 %) et les écarts ; la saisie de 7 000 TND pour IYED KACEM est bien
enregistrée en base.

`MOIS_LONGS` était dupliqué dans le tableau de bord : la constante vit maintenant
dans `src/lib/vente-stats.ts`, aux côtés de `MOIS_COURTS`.

### Objectif global et vue annuelle

**Objectif global réparti** — `POST /api/objectifs { total, mois, annee, mode }`.
L'administrateur saisit un montant unique, réparti entre les vendeurs selon deux
clés au choix :

| Mode | Règle | Quand l'employer |
|---|---|---|
| **Au prorata du réalisé** (défaut) | part proportionnelle au chiffre de la période | cas usuel : on demande davantage à qui vend davantage, et personne ne reçoit un objectif hors de portée de sa tournée |
| **À parts égales** | même montant pour tous | début d'exercice, ou secteurs redécoupés — l'historique ne dit plus rien |

Les objectifs de production étant saisis à la main sans règle mécanique, aucune
clé ne s'imposait : les deux sont donc offertes, avec l'effet expliqué sous le
champ.

Le reliquat d'arrondi va au plus gros contributeur, pour que la somme des parts
tombe exactement sur le total demandé (vérifié : 300 000 TND répartis en
101 710 + 88 825 + 39 045 + 34 742 + 24 137 + 11 541 = 300 000).

**Vue annuelle** — `mois = 0` cumule les douze mois. Le stockage reste mensuel :
un objectif annuel de 120 000 TND est ventilé en 12 × 10 000, et la vue annuelle
le recompose. Vérifié dans les deux sens (120 000 en annuel, 10 000 en mars).

Vérifié à l'écran : saisie de 300 000 TND sur août 2026 → objectif 300 000,
atteinte 73 %, plus aucun vendeur sans objectif.

## Catalogue commercial — second stock manquant

L'application de production affiche **deux pastilles** par carte article ; la
nôtre n'en montrait qu'une.

| Pastille | Champ de production | Sens |
|---|---|---|
| icône camion | `stock_depot` | ce que le commercial a à bord |
| icône magasin | `en_stock_prinsipal` | stock global de l'article, tous emplacements |

Le second est `article.en_stock` — le compteur global, pas le stock du dépôt
principal. C'est ce qui explique les valeurs négatives visibles sur l'écran
d'origine (−383, −339) : le compteur global diverge de la somme des
emplacements sur 161 articles, un écart hérité de la production.

`/api/catalogue` exposait déjà `stockGlobal` avec la bonne valeur ; seul
l'affichage l'ignorait. Ajouté avec les seuils de couleur de la production —
vert ≥ 5, orange 1 à 4, rouge en dessous.

Vérifié, les 7 articles du camion de Mokhtar :

| Article | À bord | Dépôt | Production |
|---|---|---|---|
| FARTOUNA 12PCS 26 | 14 | 87 | 14 / 87 |
| foot-ball | 15 | −383 | 15 / −383 |
| KIDS ZONE | 8 | −339 | 8 / −339 |
| mini box 9pcs | 4 | 62 | 4 / 62 |
| papier cadeaux | 80 | 200 | 80 / 200 |
| Surprise DouDou | 6 | 383,5 | 6 / 383.5 |
| surprise rolly poly | 6 | 2 792 | 6 / 2792 |

## Vérification du stock de tous les commerciaux

Comparaison exhaustive avec la production, **ligne à ligne** sur les 9 emplacements
(et non plus seulement sur les totaux).

### Le stock lui-même était juste

| Commercial | Emplacement | Références | Résultat |
|---|---|---|---|
| Mokhtar Trabelsi | AZIZ 248TU6787 | 16 | identique |
| Aziz Chelly | mokhtar 206TU7140 | 58 | identique |
| Sihem Harabi | 243TU7638 | 13 | identique |
| Heni Rekik | 238TU1019 | 54 | identique |
| Foued Fakhfekh | FOUED 243TU3251 | 64 | identique |

**0 quantité divergente, 0 ligne en trop.** Les 494 lignes présentes en
production et absentes chez nous n'ont **aucune fiche article** dans sa propre
base : son écran, qui joint l'article, ne les affiche pas non plus. Vérifié —
même nombre de lignes et mêmes totaux au centime sur les 9 emplacements.

Le catalogue de chaque commercial correspond aussi à
`get-articles-by-depot-positive` de la production : **7, 56, 9, 53, 64** articles.

### Deux troncatures corrigées

**`etatParEmplacement` — `take: 500`.** Le tri étant alphabétique, la coupe
tombait en plein milieu : « mokhtar 206TU7140 » et « Magasin Négoce »
disparaissaient de l'écran admin, et FOUED n'affichait que 46 de ses
64 références. Porté à 5 000 (590 lignes réelles).

Après correction, les 9 emplacements correspondent à la production :
1 397 109 · 2 699 · 2 816 · 6 202 · −184 · −895 · 614 · −5 · −149.

**Suggestions de réapprovisionnement — `take: 200`.** Sur 556 articles
vendables, la liste s'arrêtait à la lettre « C » : le commercial ne pouvait
demander que le début du catalogue. Porté à 1 000 — **556 articles proposés**.

## Notifications cloisonnées par rôle

Un commercial recevait **les mêmes 19 alertes que l'administrateur** : « 5 006
documents de vente en attente de validation », les visites techniques de tous
les véhicules, les créances de tout le fichier client. Des alertes sur
lesquelles il ne peut rien agir, qui noient les siennes.

Les deux sources (`/api/notifications` et `/api/alertes`) construisaient leurs
requêtes sans jamais regarder le rôle.

### Périmètre appliqué

| Alerte | ADMIN / MANAGER | COMMERCIAL | CLIENT |
|---|---|---|---|
| Rupture de stock | catalogue entier | **son camion** | — |
| Documents à valider | oui | — | — |
| Échéances véhicule | tout le parc | **son véhicule** | — |
| Impayés | tous | **ses clients** | **ses documents** |
| Créances élevées | tous | **ses clients** | — |

Le message s'adapte au périmètre : « Rupture dans votre camion — 9 référence(s)
épuisée(s) dans AZIZ 248TU6787 » plutôt que « 290 article(s) à zéro en stock ».

### Vérifié

| Rôle | Avant | Après |
|---|---|---|
| admin | 19 | 19 |
| manager | 19 | 19 |
| **mokhtar** | **19** | **6** |
| **client** | **19** | **3** |

Contrôles croisés : les impayés de Mokhtar portent bien `commercial = MOKHTAR`
(TIC240095, TIC240096), ceux du client son `codeCli = 41101016`. Foued voit des
documents différents (TIC240002/6/7) et **aucune** alerte de créance élevée — il
n'a effectivement aucun client au-dessus de 5 000 TND, seuls Mokhtar (6) et Aziz
(1) en ont.

Le cloisonnement s'appuie sur `filtrePortefeuille`, déjà employé ailleurs : il
suit automatiquement les affectations, sans liste à tenir à jour.

## Scan comparatif des deux plateformes

148 routes de production relevées et confrontées à notre projet.

### Ce qui manquait — ajouté

**1. Colonnes de recouvrement sur la liste clients** (droits `liste-clients`)

`encours`, `impayé` et `risque` étaient absents. Formules de `clients.service.js` :
`encours` = règlements « En cours » (remis, pas encore encaissés),
`impayé` = règlements « impayé » ou « Préavis ».

Vérifié : *aziza de commerce de detail* → encours **338 727 TND**, risque « Moyen ».
103 clients ont un encours.

**2. Cinq référentiels vides**

| Référentiel | Production | Avant | Après |
|---|---|---|---|
| type-reclamation | 7 | 0 | **7** |
| modele-impression | 14 | 0 | **14** |
| formule (GPAO) | 7 | 0 | **7** |
| emplacements trésorerie | 6 | 2 | **8** |

**3. Identité fiscale de la société**

La production la stocke dans l'en-tête HTML de facture (`societe.entete_page`),
logo en base64 compris. En sont extraits l'adresse et surtout le **matricule
fiscal `1584153T/A/M/000`** — mention obligatoire sur une facture tunisienne,
que notre ticket savait afficher mais dont la valeur manquait.

**4. Trois écrans refusés au commercial**

`etatImpayerParClient`, `parcRoulant` et `tresorerie` figurent dans son
application mobile ; chez nous ils renvoyaient **403**. Ouverts en lecture,
cloisonnés au portefeuille — l'écriture reste à l'administration.

| | admin | mokhtar | foued | sihem |
|---|---|---|---|---|
| Créances | 16 629 doc. | **1 661** | **3 627** | **1 724** |

### Vérifié présent, par test réel

- **6 axes de rapport de vente** (article, commercial, client, gouvernorat, famille, statistiques)
- **liste-documents-vente** : recherche par période, type, client, commercial ; lignes ; transformation
- **create-devis/AVC** : 8 champs d'en-tête modifiables, et par ligne prix HT, remise, TVA, FODEC
- **save-regulation-state** : `En cours` → `Encaissé` → restauré
- **get-article-historique**, **document-lines** (équivalent de `document-data-for-print`)

Vides en production aussi, donc fidèles : charges véhicule (0), numéros de série
(module absent), séries de vente.

Un premier `grep` avait signalé « Ajouter », « Supprimer », « Imprimer » comme
absents : c'était le grep qui ciblait mal, les tests API les montrent tous
opérationnels.

## Test fonctionnel des modules — cycles complets vérifiés en base

Chaque module testé par son cycle réel, avec contrôle du stock et des soldes
avant/après, puis retour à l'état initial.

| Module | Cycle testé | Résultat |
|---|---|---|
| **Vente** | création → lignes → validation | stock 80 → 75, client débité 64,26 (FODEC inclus) |
| **Vente** | dévalidation | stock 80, solde 0 — symétrie exacte |
| **Vente** | transformation BL → FAC | `FAO260001` créée, lien source/cible posé, montant conservé |
| **Achat** | réception BRE | stock 2 → 12, fournisseur crédité |
| **Trésorerie** | règlement client 100 TND | solde 58 821,73 → 58 721,73 |
| **Trésorerie** | suppression du règlement | solde restauré à 58 821,73 |
| **Inventaire** | création → validation | créé en « Brouillon », écart 13,089 TND, stock régularisé 55 → 58 |
| **Gestion tourner** | bon de sortie BST | dépôt 55 → 50, camion 20 → 25 |
| **Gestion tourner** | bon de retour BRT | retour exact à 55 / 20 |

**Contrôles métier confirmés** : la transformation BL → FC est refusée (« cibles
possibles : FAC »), et la validation d'inventaire alerte si le stock a bougé
depuis la saisie.

### Lecture vérifiée sur tous les modules

CRM (291 réclamations), GRH (7 employés, pointage, contrats), Comptabilité
(**équilibrée : débit = crédit = 26 515,03**), GPAO (55 nomenclatures), Projets,
Charges fixes (30), Objectifs.

Les 9 écrans du commercial et ceux des rôles manager et client répondent tous.
Le client est bien refusé sur `/api/creances` (il a son espace dédié).

Vides en production aussi, donc fidèles : GMAO (0 machine), enregistrements
vocaux (0).

### Deux fausses alertes de ma part

- **« Inventaire validé — non modifiable »** : j'utilisais `stPhysique` au lieu
  de `qteComptee` et un `PUT` au lieu de `POST vue=valider`. Avec les bons noms,
  le cycle fonctionne parfaitement.
- **Journal de caisse vide** : j'interrogeais `/api/enregistrements` (vocaux)
  au lieu de `/api/missions?vue=jour`. Le journal remonte bien la mission du
  jour, les frais et la réconciliation.

### Une erreur de nettoyage, corrigée

Mon `DELETE ... LIKE 'BST2600%'` a emporté **4 bons de sortie antérieurs** à mes
tests (créés le 31/07 par le compte « ZZC-vendeur »). Restaurés depuis la
sauvegarde ; les 102 tables ont retrouvé leur volumétrie exacte.

### Trois validations trop strictes — corrigées

Un même défaut à trois endroits : une liste de valeurs figée dans le code, qui
refusait des valeurs pourtant portées par les données de production.

**1. Types de réclamation inventés**

La route validait contre « Produit endommagé », « Erreur de quantité »… — des
libellés sans rapport avec la production, dont les types décrivent des motifs de
non-vente : « Pas intéresser », « achete chez concurent », « Sur stockage ».
Saisir un type du référentiel était refusé (`Type inconnu : Sur stockage`).

Les types viennent désormais du référentiel `type-reclamation`, avec repli sur
la liste d'origine s'il est vide. Vérifié : les 7 types de production sont
proposés et acceptés.

**2. État de projet « encours »**

Le seul projet de production porte `encours` ; la validation attendait
« En cours » et refusait la création. La comparaison ignore maintenant espaces,
casse et accents : `encours` → **« En cours »**.

**3. État de tournée « Cloturé » — 2 610 missions concernées**

`estCloturee()` reconnaissait déjà les deux orthographes, mais la validation du
`PUT` comparait la chaîne exacte : **modifier une tournée en lui laissant son
propre état était refusé** (`État invalide : Cloturé`).

Vérifié : le PUT accepte « Cloturé » et le normalise en « Clôturée ».

### Modules restants vérifiés

Transferts, traites, bordereaux, chéquiers, mouvements de compte, droits
d'accès, utilisateurs, séries, insights — tous en 200.

Charges fixes : cycle création/suppression complet, base restaurée à 30.

Vides en production aussi : traites (module absent), séries, opportunités CRM,
contrats et congés GRH.

### Rapports de vente : fuite de données entre commerciaux

`/api/rapports-vente` acceptait le rôle COMMERCIAL sans appliquer de périmètre :
**Mokhtar voyait le chiffre d'affaires de ses 19 collègues**, tous axes confondus.

Corrigé sur les trois requêtes de la route (documents, créances, clients).

| Axe | admin | mokhtar | foued |
|---|---|---|---|
| commercial | 19 lignes | **1** | **1** |
| article | 206 | **40** | — |
| client | 1 915 | **164** | — |
| gouvernorat | 30 | **14** | — |
| famille | 13 | **9** | — |
| créances | 16 629 doc. / 12 214 473 TND | **1 661 / 1 075 119** | **3 627 / 3 019 020** |

### Parcours commercial complet, vérifié de bout en bout

Panier (remise 10 %) → ticket → encaissement partiel :

| Étape | Résultat |
|---|---|
| Totaux panier | HT 43,24 · remise 4,804 · TVA 8,73 · TTC 51,97 |
| Ticket émis | TIC260001, validé |
| Stock camion | 8 → **6** |
| Encaissement | 40 TND espèces, reste **11,97** |
| Solde client | **11,97** au débit |
| Ticket imprimé | société + **MF 1584153T/A/M/000**, ligne remisée, tous les totaux |

Contrôle arithmétique : 43,24 + 8,298 + 0,432 = **51,970**, écart **0,0000**.

Planning et tournée : régénération depuis une position GPS, 12 clients, départ
correctement pris en compte (Tunis → clients de Tunis).

Base entièrement restaurée après chaque test : 28 641 documents, 14 539
règlements, 19 530 lignes de mission, 2 632 missions, 0 mouvement résiduel.

### Deux failles de cloisonnement entre commerciaux

Après le correctif des rapports de vente, un balayage des routes ouvertes au
rôle COMMERCIAL en a révélé deux autres.

**1. Lecture du détail d'un document étranger** (`/api/erp/document-lines`)

En devinant une référence, un commercial lisait le document d'un collègue :
client, lignes et montant. Vérifié — Mokhtar accédait à `CMI242806` de Foued,
5 lignes, **3 078,72 TND**.

**2. Transformation d'un document étranger** (`/api/erp/document-transform`)

Plus grave : ce n'était pas qu'une lecture. Mokhtar a pu **transformer en bon de
livraison** un document de Foued — une écriture sur un portefeuille qui n'est pas
le sien. Le document créé a été supprimé et le lien `transformeEn` rétabli.

Les deux routes contrôlent maintenant `memeCommercial(document.commercial, user)`.

| Test | Avant | Après |
|---|---|---|
| Mokhtar lit le document de Foued | 200 + détail complet | **403** |
| Mokhtar transforme celui de Foued | 200, document créé | **403** |
| Mokhtar sur ses propres documents | 200 | **200** |
| Admin sur n'importe quel document | 200 | **200** |

Les quatre autres routes ouvertes au commercial sans périmètre sont légitimes :
`etat-stock`, `sync-stock` et `vehicules` portent des données communes, `series`
refuse déjà l'accès (403).

### Contrôle des permissions par rôle

Balayage des écritures sensibles pour chaque rôle.

| Action | ADMIN | MANAGER | COMMERCIAL | CLIENT |
|---|---|---|---|---|
| Supprimer un utilisateur | oui | **403** | **403** | **403** |
| Modifier les droits | oui | **403** | **403** | **403** |
| Créer un article | oui | oui | **403** | **403** |
| Supprimer un tiers | oui | oui | **403** | **403** |
| Valider un document | oui | oui | **403** | **403** |
| Lire un document quelconque | oui | oui | **son portefeuille** | **403** |

Le rôle CLIENT est verrouillé sur toutes les routes ERP (403) et son espace
dédié ne renvoie que ses propres documents — 30 documents, **0 fuite**.

### État final de la base après tous les tests

Les 102 tables ont retrouvé leur volumétrie, aux trois exceptions attendues :

- `gps_positions` — le suivi GPS écrit en continu ;
- `erp_missions` / `ligne_mission` — la tournée créée par mes premiers tests a
  été supprimée, la base est donc plus propre que la sauvegarde intermédiaire ;
- `ref_tables` — horodatage de la dernière synchronisation de stock.

| Table | Lignes |
|---|---|
| documents_ext | 28 641 |
| document_lines_ext | 187 070 |
| partners / articles_ext | 4 568 / 592 |
| erp_reglements | 14 539 |
| erp_missions / ligne_mission | 2 632 / 19 530 |
| inventaires / réclamations | 598 / 291 |
| stock_movements_ext | **0** |

## Resynchronisation complète sur la production — 25 août 2026

Connexion aux trois accès (Admin PC, Mokhtar mobile, Admin mobile) et
comparaison exhaustive.

### Observation sur la production

**Elle ne cloisonne rien** : le compte Mokhtar accède exactement aux mêmes
données que l'Admin — 13 897 règlements, 4 529 clients, tous les documents.
Notre projet est donc plus strict que l'original sur ce point.

### Écarts comblés

| Donnée | Production | Avant | Après |
|---|---|---|---|
| Règlements clients | 13 897 | 13 827 | **13 897** |
| Règlements fournisseurs | 718 | 712 | **718** |
| Ordres de mission | 2 648 | 2 632 | **2 648** |
| Clients | 4 529 | 4 518 | **4 530** ¹ |
| Documents de vente | 18 023 | 18 016 | **18 023** |

¹ 4 529 + le client 41102224, supprimé côté production mais cité par nos documents.

**CA : 4 892 020,37 — identique au centime.**

### Un règlement supprimé en production

`idSource 14464` (429,62 TND, ticket TIC254030) existait chez nous mais plus en
production, où le ticket porte `total_regle = 0`. Supprimé pour rester fidèle.

### 11 articles fantômes supprimés

La production écrit certaines références **avec un espace final**
(« planche educatif  », « mah  »). Un import antérieur avait créé une seconde
fiche sans l'espace : **11 doublons** portant 0 ligne, 0 stock, 0 mouvement.

C'est ce qui brouillait la résolution de référence et faisait échouer un
transfert de stock. Supprimés après vérification qu'aucun n'était utilisé.

**581 articles** = les 580 de production + `vx 22` (supprimé côté production
mais cité par nos documents).

### Stock, après resynchronisation

Dépôt principale 1 397 109 · FOUED 6 202 · mokhtar 206TU7140 2 699 ·
238TU1019 2 816 · AZIZ 248TU6787 −895 · 243TU7638 −184 · Magasin Négoce 614 ·
HENI 252TU6756 −149 · doblo252TU6847 −5.

### Contrôle d'intégrité après resynchronisation

| Contrôle | Résultat |
|---|---|
| Lignes de document orphelines | **0** |
| Lignes de mission orphelines | **0** |
| Règlements sans tiers | **0** |
| Stock sans article | **0** |
| Lignes citant un doublon supprimé | **0** |

**216 lignes citent un article inexistant** — 32 références qui n'ont pas de
fiche **en production non plus** (`magic bon`, `f 32`, `support goblet`…) : des
articles retirés de son catalogue mais encore cités par ses anciens documents.
Incohérence héritée, reproduite fidèlement.

Vérifié que la suppression des 11 doublons n'a rien cassé : aucune ligne ne les
cite, aucun stock orphelin.

### Six commandes conservées

`CMI260001` à `CMI260006` (31/07 et 05/08) n'existent pas en production mais
portent des lignes et des clients réels — **commandes saisies dans
l'application**, pas des résidus de test. De type COM, elles n'entrent pas dans
le calcul du CA, qui reste identique à la production.

### Écrans vérifiés après synchronisation

| Écran | Lignes |
|---|---|
| clients | 4 530 |
| articles | 581 |
| documents de vente | 18 029 (dont 47 doublons `-V` légitimes) |
| règlements clients | 13 897 |
| missions | 2 648 |
| réclamations | 291 |

Les six écrans du commercial répondent, cloisonnement en place : `stats` ne
montre que « mokhtar trabelsi », les notifications portent sur son camion.

### Contrôle de cohérence final

| Contrôle | Résultat |
|---|---|
| Écritures comptables | débit = crédit = **26 515,03**, équilibré |
| Tiers au solde incohérent | **0** sur 4 580 |
| Mouvements de stock résiduels | **0** |
| Audit 83 routes × 4 rôles | **0 anomalie** |

**9 434 documents au TTC ≠ HT + TVA + timbre + FODEC** — le compte est
**exactement le même en production** (9 434 sur 18 023). Elle ne renseigne pas
`totfodec` sur ces documents tout en l'incluant dans le TTC. Reprise fidèle au
document près.

## Tournée générée au mauvais endroit — position réseau prise pour du GPS

Sur mobile à Radès, « Clients à proximité » montrait les bons clients (36 m,
784 m) mais la tournée générée partait de Tunis/Bab Laassal et « Regénérer »
redonnait la même. Le planificateur lui-même était juste : rejoué avec la
vraie position, il retenait bien les 12 clients de Radès. **La position qu'on
lui donnait était fausse.**

### Mécanisme

Sur téléphone, la première position livrée vient de l'antenne réseau
(précision 2–3 km), le fix GPS (10–20 m) n'arrive qu'après. Trois défauts
s'enchaînaient :

1. `getCurrentPosition` / `watchPosition` acceptaient un point mis en cache
   (`maximumAge` 60 s / 30 s) et **ne regardaient jamais `accuracy`** ;
2. la génération automatique se déclenchait sur ce premier point grossier,
   puis le verrou `autoGen` empêchait toute correction à l'arrivée du GPS ;
3. « Regénérer » relisait `positionRef` — encore le point en cache.

Reproduit exactement : position réseau (36.8065, 10.1815, ±3 000 m) →
*Romdhani, Chop walid, Librairie R BISSE — Tunis* (la capture desktop) ;
GPS (36.7637, 10.2769, ±15 m) → *Mohamed ghamgui, Ste ghannem, Chop houssem —
Radès* (la capture mobile).

### Correctif, aux trois niveaux

- **Lecture GPS** (`client-actif.tsx`) : `maximumAge: 0` — un fix neuf, jamais
  le cache ; et `watchPosition` **ne dégrade plus la précision** (un point à
  3 km n'écrase pas un point à 15 m).
- **Planning** : la génération automatique attend un fix ≤ 300 m ;
  « Regénérer » demande un fix neuf via `positionFraiche()` et, faute de fix
  exploitable, affiche « Position GPS trop imprécise — sortez à découvert »
  **sans appeler le serveur** (qui serait retombé sur le dépôt de Sousse).
- **Serveur** (`/api/tournee`) : un départ de précision > 300 m est **refusé**
  (400 explicite) — rien ne peut contourner le client.

### Vérifié

| Test | Résultat |
|---|---|
| Départ réseau ±3 000 m | **400** « Position trop imprécise (±3000 m) » |
| Départ GPS ±15 m | 12 clients de Radès |
| Écran réel, géoloc forcée Radès, clic Regénérer | **Mohamed ghamgui 4 m, Ste ghannem 775 m…** — 0 erreur console |

Aucun point GPS de Mokhtar n'était remonté depuis juin (les seuls en base sont
des données de démo vers Béja) : la remontée fonctionne, mais une position
est désormais refusée si elle est trop imprécise.

## Carte du portefeuille sur « Mes clients » (commercial)

Demande : voir sur `/commercial/clients` une carte de tous ses clients autour
de sa position, comme celle du planning.

- **API** `GET /api/clients?geo=1` : tous les clients géolocalisés du
  portefeuille (sans la limite de 200 de la liste), champs minimaux ; les
  coordonnées (0,0) de l'import sont écartées. Mokhtar : **714** clients.
- **Composant** `src/components/map/PortefeuilleMap.tsx` (nouveau — le nom
  `ClientsMap` était déjà pris par la page Carte GPS) : centré sur le
  commercial (point violet « Vous êtes ici ») ; orange = solde dû, bleu = à
  jour, jaune = client en visite ; le clic ouvre la fiche client. Le cadrage
  n'est fait qu'une fois, l'utilisateur garde ensuite la main sur le zoom.
- **Page** : carte repliable au-dessus de la liste, indépendante des filtres.

### Au passage — fond de carte cassé partout

Les tuiles Carto (`basemaps.cartocdn.com`) affichaient **« API KEY REQUIRED »**
sur les 4 cartes (planning, Carte GPS, admin, portefeuille) : le fournisseur
exige désormais une clé. Basculé sur les tuiles OpenStreetMap, sans clé.

Vérifié (Playwright, Mokhtar, géoloc forcée Radès) : 715 marqueurs (714 +
position), tuile OSM chargée, clic → fiche « Librerie najoua », 0 erreur.

### Carte filtrée avec la liste

Demande : choisir « Beja » doit ne montrer sur la carte que les clients de Beja
et zoomer dessus. `GET /api/clients?geo=1` accepte désormais `gouvernorat` et
`search` (mêmes règles que la liste) ; la page recharge les points à chaque
changement de filtre (délai 250 ms comme la liste) ; la carte recadre sur les
clients filtrés (zoom max 15), et revient sur la position du commercial quand
le filtre est retiré. Vérifié : Tous → 714 points zoom 13 ; Beja → 5 points
zoom 10 ; retour Tous → 714 points, recentré. 0 erreur.

## Fiche client complète du commercial (`/commercial/clients/[id]`)

Demande : dans la modale, un bouton Itinéraire, et le nom du client cliquable
vers une fiche montrant les tickets, commandes et factures du mois.

- **Modale** : nom cliquable → fiche ; boutons « Itinéraire » (Google Maps
  vers les coordonnées du client, masqué si le client est à (0,0)/null) et
  « Fiche complète du mois ».
- **API** `GET /api/clients/fiche?codeCli=&mois=&annee=` : client, totaux du
  mois (CA règle ERP Σ(BL,TIC,FC)−Σ(BR,AV) nature Vente, commandes, encaissé,
  visites), et les documents **avec leurs lignes** (article, qté, PU HT,
  remise, TTC), règlements (`erp_reglements` sens C), visites (`ligne_mission`).
  Cloisonnement : 403 sur un client d'un autre commercial (vérifié : Fatnasi →
  Jamil), 404 si inexistant.
- **Page** : en-tête (adresse, tél, Itinéraire, Appeler, Passer commande,
  débit/crédit/solde), sélecteur mois/année, 4 KPI, onglets Tickets /
  Commandes / Factures / Retours-avoirs / Encaissements / Visites, chaque
  document dépliable sur ses lignes avec pied HT/remise/TVA/TTC.

Données : 69 tickets de 2026 (sur 3 761) n'ont aucune ligne en base — hérité
de la production (ex. TIC254105, 1 100 TND) ; la fiche affiche « 0 article ».
Vérifié (Mokhtar, AGIL BEJA SUD, août 2026) : CA 1 493,002 = 3 tickets,
1 commande 140,990, 3 encaissements 3 132,433 ; lignes de TIC254012 affichées ;
rendu mobile 390 px ; 0 erreur.

### Compte client calculé, pas stocké (« scalable »)

Demande : la fiche ne doit pas dépendre de valeurs figées en base.

Constat : `partners.debit/credit/soldeFin` sont des **compteurs** entretenus
au fil des écritures (validation de document, règlement) — et hérités de la
production avec leurs dérives. La production elle-même a un extrait de compte
recalculé en direct (`clients.service.js › getFournisseurMouvements`) :
débit = tickets/BL non facturés + factures ; crédit = retours/avoirs non
facturés + règlements ; solde = solde initial + débit − crédit.

Vérifié sur la base : cette règle reproduit `soldeFin` pour **4 458 clients
sur 4 530** (98,4 %). Les 72 autres (dont AGIL BEJA SUD : stocké 9 703,241,
calculé 4 719,329) sont des compteurs désynchronisés en production.

Fait dans `/api/clients/fiche` :
- `compte` = débit / crédit / solde **recalculés à chaque appel** depuis
  `documents_ext` + `erp_reglements` ; `soldeStocke` et `ecart` exposés — la
  page affiche l'écart avec un avertissement « dérive héritée ».
- `extrait` : mouvements du mois avec solde courant, à partir d'un solde
  d'ouverture calculé sur tout l'historique → onglet « Extrait de compte ».
- `periode.annees` : années déduites de la première transaction du client.

Rien à entretenir : un ticket ou un règlement créé demain apparaît dans le
compte sans qu'aucun compteur n'ait à être mis à jour.

### « Les données ne viennent pas » — fiche ouverte sur un mois vide

Chop habib Ksar sa3id (41105585) : la fiche affichait 0 partout. Les données
existaient — un ticket et un règlement le 11/07/2026 — mais la fiche s'ouvrait
sur le mois courant (août). Correctif : sans période imposée, l'API prend le
mois courant **ou, s'il est vide, le dernier mois d'activité du client**
(`periode.auto`, `periode.derniereActivite`) ; la page l'annonce dans un
bandeau et le choix manuel du mois prime. Les visites sans date propre
prennent la date de leur tournée (`mission.dateOrdre`) au lieu de disparaître.

## Nouveau client : adresse déduite de la position (comme l'ancien mobile)

Demande : au clic sur « Actualiser », l'adresse complète doit se remplir toute
seule, au format de l'ancienne plateforme (« El Ghazela, Délégation Raoued,
Gouvernorat Ariana, 1083, Tunisie »).

L'ancien mobile (bundle `main.*.js`) appelle
`nominatim.openstreetmap.org/reverse` et découpe : `adresse = display_name`,
`ville = state_district` sans « Délégation », `gouvernorat = state` sans
« Gouvernorat ». Reproduit à l'identique :

- `GET /api/geo/adresse?lat=&lng=` : proxy Nominatim (User-Agent applicatif
  exigé par le service, `accept-language=fr`, cache mémoire à ~10 m, délai
  8 s, 502 explicite en cas d'indisponibilité).
- `NouveauClientModal` : à chaque nouvelle position (ouverture ou
  « Actualiser »), remplit adresse / ville / gouvernorat avec une indication
  « déduits de la position — modifiables » ; en cas d'échec, message et saisie
  manuelle.

## Modifier un client depuis le terrain (commercial)

Demande : l'écran « Modifier un client » de l'ancien mobile, avec correction
de la position et recalcul de l'adresse.

- **API** `PUT /api/clients` : raison sociale, code TVA / clé / catégorie,
  registre de commerce, famille, adresse, téléphone, e-mail, coordonnées,
  gouvernorat, ville. Un commercial ne modifie que son portefeuille (403
  sinon) ; coordonnées (0,0) ou hors Tunisie refusées (400) ; débit / crédit /
  solde / commercial affecté **jamais** modifiables par cette voie.
- **`ModifierClientModal`** : formulaire pré-rempli ; « Utiliser ma position »
  reprend la position GPS actuelle (fix neuf, `maximumAge: 0`) et en déduit
  adresse / ville / gouvernorat via `/api/geo/adresse` ; corriger la
  longitude / latitude à la main déclenche la même déduction. Ouvrir la fiche
  ne réécrit jamais l'adresse existante.
- Boutons « Modifier » sur chaque carte de « Mes clients » et dans la fiche
  rapide ; liste et carte mises à jour sans rechargement. Les familles
  viennent de `ref_tables` (famille-cli), les gouvernorats de la base.

Vérifié (Mokhtar, ste medinart 41100133, base de dev, puis restauré) :
pré-remplissage TVA 1428436/F · A · M · librairie ; « Utiliser ma position »
avec un fix à Tunis → 36.8065 / 10.1815 et « 29, Avenue du Ghana, Lafayette,
Les Jardins, Délégation Bab Bhar, Tunis, Gouvernorat Tunis, 1017, Tunisie »,
ville Tunis, gouvernorat Tunis ; enregistrement ; carte mise à jour ; 403 sur
un client de Jamil ; 400 sur (0,0). Le gouvernorat déduit prend la graphie
déjà en base (« TUNIS ») pour rester filtrable.

**Incident de test, corrigé** : le premier essai d'enregistrement a vidé
Code TVA / Clé / Catégorie de ste medinart — la liste ne chargeait pas ces
colonnes, la modale les renvoyait vides, le PUT les a enregistrées vides.
Valeurs restaurées (`1428436/F`, `A`, `M`) ; la liste charge désormais
`codeTva`, `cletva`, `categorieTva`, `registreCom`. Leçon : un formulaire de
modification doit être alimenté par les mêmes colonnes qu'il renvoie.

Note de test : Chrome émulé (Playwright) ne répond à `getCurrentPosition`
que lorsqu'une nouvelle position est poussée — sur téléphone le GPS répond
toujours ; le test simule donc un fix après le clic.

## Carte GIS admin : la couche Zones se détaille au zoom

Demande : dans « Supervision Cartographique GIS », onglet Zones, voir les
clients en zoomant et ouvrir leur fiche d'un clic.

- `TunisiaMap` : au-delà du zoom 11 (`ZOOM_CLIENTS`), la couche Zones remplace
  les agrégats par gouvernorat par les **clients de la zone visible** (rouge =
  solde débiteur, vert = soldé). Chaque bulle — couches Zones et Clients —
  porte « Ouvrir la fiche client → » vers `/commercial/clients/[id]`. La bulle
  des agrégats et la légende invitent à zoomer.
- Le recadrage automatique n'a plus lieu qu'au changement de couche ou de
  données (signature mémorisée) : zoomer ne déclenche plus de recadrage —
  indispensable, le redessin est désormais lié au zoom.
- `AppLayout` de la section commerciale : ADMIN et MANAGER admis (production :
  l'admin utilise la plateforme mobile) ; chaque API garde son périmètre par
  rôle. Avant, le lien renvoyait l'admin sur /login.

Vérifié (admin) : 25 agrégats → zoom sur Tunis → 48 clients ; clic →
« Librairie meher » → fiche `/commercial/clients/41102184`, indicateurs
présents ; 0 erreur console.

### Correction : la fiche depuis l'admin reste dans l'admin

Retour utilisateur : le lien de la carte GIS ouvrait la fiche sur la
plateforme commerciale — faux cadre pour un administrateur.

- La fiche est extraite en composant partagé
  `src/components/clients/FicheClient.tsx` (`onCommander` optionnel).
- **Admin** : `/admin/modules/vente/clients/[id]` — sans « Passer commande »,
  retour « Clients — module Vente ». Les bulles de la carte GIS (Zones
  zoomée et Clients) pointent dessus.
- **Tableau Vente › Clients** (`ModuleView`) : bouton **Fiche** dans la barre
  d'action, actif sur la ligne sélectionnée.
- **Commercial** : `/commercial/clients/[id]` enveloppe le même composant avec
  « Passer commande » (client actif + catalogue). La garde de la section
  commerciale revient à COMMERCIAL seul (l'ouverture ADMIN/MANAGER de la
  veille est annulée — plus nécessaire).

## Ticket de caisse : copie conforme de l'ancien mobile

Retour utilisateur : le ticket imprimé ne ressemblait pas à celui de l'ancien
projet. Source retrouvée (non minifiée) :
`bis-dist/src/components/dernier-ticket/dernierTicketPopup.js`.

Différences majeures corrigées dans `TicketVente` :
- **En-tête = le bloc HTML `entete_page` de la fiche société** (logo SKY en
  base64) — récupéré depuis la production (`POST /societe/societe`, lecture
  seule) et importé dans `ref_tables` (`param` / `societe.entete_page`,
  12 001 o). Repli texte si absent.
- Lignes « Commercial: / N° ticket : / Date : » (date `dd-MM-yyyy T hh:mm:ss`),
  « Ticket caisse » centré en gras (= `Lib_doc`).
- **Cadre client bordé** : Client / Adresse / MF / RC.
- Tableau ARTICLE 43 % · Qté 9 % · PU TTC 18 % centré · MT TTC 18 % droite ;
  ligne « REM : x % » sous chaque article remisé ; PU TTC net de remise.
- Totaux à droite (45/25/20 %) : Montant HT, « Taux tva : 19% » (taux des
  lignes si uniforme), tva, Net à payer ; puis « Mode de paiement » et les
  règlements du document (`erp_reglements`, déjà servis par l'API).
- **Cadres de signature « Sig.Commercial / Décharge client »**.
- Impression par fenêtre dédiée avec la feuille de style de l'original
  (`@page`/body 302,3 px), plus par window.print de la page.
- Disparus car absents de l'original : Fodec/Timbre en lignes séparées,
  « Arrêté … en toutes lettres », « Merci de votre confiance », Reste dû.
- `/api/tickets` : `registreComClient` ajouté.

Vérifié (Mokhtar, TIC260003) : aperçu et fenêtre d'impression = logo SKY,
en-tête société, Commercial/N°/Date, cadre client, 2 articles, HT 225.884,
19 %, tva 43.347, Net 271.490, Espèce 271.490, signatures. 0 erreur.

### Reçu de recouvrement : copie conforme, et il manquait tout

Même demande que le ticket, pour le Recouvrement. Constat : notre écran
n'imprimait **aucun reçu**. Source d'origine :
`bis-dist/src/pages/stock/recouvrement.js` — même squelette que le ticket :
logo (`entete_page`), « Commercial: / Date : », **Recouvrement** centré, cadre
client (Client / Adresse / MF / RC), « Montant : », « Mode de paiement » avec
les lignes de règlement, cadres « Sig.Commercial / Décharge client », pied.

Fait :
- `RecuReglement` (nouveau composant), affiché automatiquement après un
  encaissement réussi — comme l'ancien mobile qui imprimait dans la foulée ;
  impression en fenêtre dédiée 302,3 px.
- `GET /api/tickets?vue=societe` : en-tête d'impression seul (pour les reçus).
- `POST /api/reglements` renvoie `commercial` et `datePay` pour le reçu.

Vérifié (Mokhtar, Librairie R BISSE nabil, 1,000 TND Espèces) : reçu complet
avec logo, rattaché à la tournée du jour (dayId 2875), fenêtre d'impression
ouverte, 0 erreur. Règlement de test supprimé et compteurs du client restaurés
à l'identique (17|0|17).

### Dernier ticket : filtre par client

Demande : choisir un client et voir son dernier ticket. Ajouts :
`GET /api/tickets` accepte `codeCli` (vues dernier + liste) et une vue
`clients` (clients du commercial ayant des tickets, avec leur nombre, triés
du plus servi au moins servi — 632 pour Mokhtar). Sur l'écran, un sélecteur
« Tous les clients / <client> · N tickets » ; le choix recharge le dernier
ticket du client et borne Précédent/Suivant à ses tickets. Le filtre reste
visible quand le client n'a aucun ticket.

## Resynchronisation complète depuis la production (31/08/2026)

Demande : remettre toute la base à l'état actuel de la production (nouveaux
tickets, missions, stock des véhicules).

La prod est MySQL, accessible seulement via son API JSON (port 3306 fermé).
Chaque table est exposée par `POST /<route>/` = `SELECT * FROM <table>`.
`scripts/resync-prod.py` : tire les données (en-têtes ventes/achats en masse,
lignes document par document via get-articles-vente/-achat, missions,
ligne_mission, reg_clients, articles, clients, vehicules, frais_mission,
stock get-all-articles-by-depot), puis reconstruit les tables métier en
conservant les identifiants porteurs (id_day, refDoc, refArt, ID_reg décalé
pour ne pas heurter les règlements fournisseur). Écrit UNIQUEMENT en local.
Sauvegarde préalable : `db/backups/bechir1-avant-resync-*.dump`.

Chargé : partners(C) 4 540, articles 588, documents 28 847, lignes 194 271,
missions 2 667 (id→2890), ligne_mission 19 624, règlements client 13 961,
stock_depots 5 927, véhicules 7.

Vérifié :
- **CA = 4 948 027,15 TND**, identique à la prod au centime (règle
  Σ(BL,TIC,FC)−Σ(BR,AV) nature Vente).
- Dernier ticket **TIC254182 du 31/08 17:25** (= le plus récent de la prod).
- Codes mission OM-2888… remontent ; stock par emplacement pour chaque
  véhicule ; dashboard admin et écran Mokhtar OK, 0 erreur.
- Dépôts orphelins (véhicules supprimés, code_depot 4/5/6/8/11/12/16 absents
  de `magasins`) : leur stock non nul est conservé sous « Dépôt N », le bruit
  à zéro est écarté — comme la prod qui ne les liste pas.

Séquences recalées (05-sequences.sql + ligne_mission/frais/vehicles).
Les tables non métier (objectifs, param, compta, GPAO, GRH, positions GPS)
sont conservées telles quelles.

## Notifications — correction après resync (données par utilisateur)

La resync avait cassé deux choses :

1. **`commercials.vehicleId` vidé** : le lien commercial→véhicule n'était plus
   rétabli, donc `emplacementVehicule()` ne trouvait aucun camion et tous les
   commerciaux recevaient l'alerte stock du **catalogue** (« 288 à zéro »).
   Rétabli depuis la source de vérité (Code_mag du compte prod) :
   Mokhtar→248TU6787, Foued→243TU3251, Heni→238TU1019, Sihem→243TU7638,
   Aziz→206TU7140.

2. **Alerte rupture branchée sur `article.enStock`** (valeur héritée figée)
   au lieu du stock réel de `stock_depots`. Reformulée en **stock négatif**
   (vente à découvert = vraie anomalie), comme la prod (`en_stock<=st_min`) :
   « tout ce qui est à zéro » remontait 500+ articles jamais chargés dans un
   camion et noyait le signal.

Résultat par rôle (vérifié) :
- Admin/Manager : 122 négatifs au dépôt principal + 14 échéances véhicules
  (parc entier) + impayés. Plus rien « à valider » (resync = tous validés).
- Mokhtar : 6 négatifs dans SON camion 248TU6787, SON véhicule seul
  (assurance/vignette expirées), ses impayés.
- Foued : 0 négatif → pas d'alerte stock ; son véhicule ; ses impayés.
- Client : ses impayés uniquement.

Le périmètre par rôle de `/api/notifications` était déjà correct ; seules les
deux dépendances de données ci-dessus étaient à réparer.

## Code mission vide après resync — mission « En cours » vs date du jour

Le bandeau du menu commercial affichait « CODE MISSION — » : `/api/tournee`
(et `/api/missions?vue=jour`) ne cherchait la mission que pour la **date du
jour**. Les données resynchronisées s'arrêtent au 31/08 ; on est le 01/09,
donc aucune mission « aujourd'hui ». Or la tournée 2888 de Mokhtar est « En
cours » (non clôturée) : c'est sa tournée active.

Correctif (les deux routes) : à défaut de mission datée d'aujourd'hui, on
retombe sur la mission **« En cours »** du commercial (la plus récente). Une
date explicite (filtre du journal) fige toujours la recherche sur ce jour.
`vue=jour` passe aussi au rapprochement par prénom (`cleCommercial`) comme
`/api/tournee`, au lieu d'un `contains` du nom complet.

Vérifié : bandeau → OM-2888, véhicule 248TU6787, 12 clients planifiés ;
journal vue=jour → mission OM-2888, 12 visites. 0 erreur.

## Quantités fausses sur le ticket (12 / 9 / 10 au lieu de 2 / 1 / 1)

Ticket réel TIC254186 : FARTOUNA ×2, mini box ×1, rolly poly ×1. Notre
TIC260001 : ×12, ×9, ×10. Reproduit par l'API : 2 taps + saisie de la remise
« 16.92 » → quantité serveur **7**.

Cause : à chaque frappe dans le champ remise, le catalogue envoyait
`POST /api/panier {vue:"ligne", qte:0, remise}` ; le serveur faisait
`num(body.qte) || 1` → le 0 devenait **1** et s'**ajoutait** à la ligne. Cinq
frappes = +5 unités, invisibles à l'écran (état local intact) mais présentes
sur le ticket, émis depuis le panier serveur.

Correctifs :
- serveur : `qte` absent → 1 ; `qte: 0` explicite → **remise seule**, la
  quantité n'est pas touchée (404 si la ligne n'existe pas) ;
- catalogue : la quantité locale se recale sur `row.qte` renvoyé par le
  serveur (ajout et ±), plus de dérive possible ;
- `TicketCorps` : corps du ticket partagé entre l'impression (`TicketVente`)
  et l'aperçu de « Dernier ticket » — ce qu'on voit est ce qu'on imprime.

Vérifié (écran, Mokhtar) : 2 ajouts + « 16.92 » tapé → qte 2, 64,802 TND —
la ligne exacte du ticket réel.

### Effets de bord de la resync, corrigés au passage
- Tri `dateDoc desc` : un BL à date vide (« 0000-00-00 » → NULL) passait en
  tête (NULLs premiers en Postgres). `nulls: "last"` sur tickets et dashboard.
- **Deux jeux de lignes de stock par camion** : la synchro continue de l'app
  (`sync-production.ts`, toutes les 5 min depuis les écrans de stock) écrit
  sous les libellés de `ref_tables` kind=depot (anciens : « AZIZ 248TU6787 »),
  la resync sous ceux de la prod (« 248TU6787 »). Le catalogue prenait le
  mauvais (« À bord : 13 » au lieu de 20). Libellés `ref_tables` alignés sur
  `magasins` de la prod, lignes renommées en place, synchro forcée : 10
  dépôts, un seul jeu. `resync-prod.py` aligne désormais lui-même
  `ref_tables` et ignore les dépôts absents de `magasins` (comme la synchro).
- Incident : le scratchpad ayant été vidé, une suppression a retiré les lignes
  aux nouveaux libellés au lieu des anciens ; sans conséquence, la synchro
  continue a tout reconstruit depuis la prod. `scripts/pull-prod.sh` recréé
  (tirage reproductible) ; `resync-prod.py` documente ses entrées.

### Resync : `kind` des articles perdu → « Stock camion » vide
`resync-prod.py` écrivait `kind = "article"` pour tous ; l'écran « Stock
camion » (`stockVehicule`) ne montre que `kind = "P"` (produit fini, règle
de l'ERP : `prouit_fini = 1`). Rétabli depuis la prod avec la règle des
importeurs d'origine (`prisma/import-articles.ts`) : CH si charge, SF si
semi-fini, MP si matière première, sinon P → 423 P / 160 MP / 4 CH / 1 SF.
`resync-prod.py` applique désormais cette règle.

**Référence** : les importeurs de la première migration existent toujours dans
`prisma/import-external.ts` et `prisma/import-articles.ts` — mapping
colonne par colonne faisant foi pour toute resync future.

### Nettoyage des pièces de test (décision utilisateur)
Supprimés : TIC260001 (brouillon, quantités du bug) et TIC260002 (validé),
leurs 6 lignes, les 2 règlements (170,201 + 111), 3 mouvements de stock,
paniers de test, mission locale 2891 (auto-générée par le planning, absente
de la prod) et ses 12 visites, paniers orphelins. Compteurs clients remis :
Librairie R BISSE nabil 0/0/0, Ste anouar express grombalia crédit −170,201.
Séquence missions recalée (max prod = 2890). Bandeau → OM-2888.

À décider : les tournées sont créées en prod par l'admin ; notre planning
peut en générer une localement (« Regénérer »), qui prend le pas sur celle
de la prod dans le bandeau et dont l'id peut entrer en collision avec le
prochain id prod. Piste : synchroniser les missions depuis la prod en continu
(comme le stock) et ne générer localement qu'à défaut.

## Catalogue : le champ prix « bloquait » la saisie

`majRemise` validait à chaque frappe : plafond de remise dépassé sur une
valeur intermédiaire (« 5 » pour écrire « 50.000 » = 90 % de remise) → champ
vidé, toast. Impossible de taper un prix chiffre par chiffre ; un prix
au-dessus du tarif donnait une remise négative acceptée.

Correctif : pendant la frappe, seuls les deux champs (% ↔ prix net) sont
reliés ; la validation (plafond de l'article, prix jamais au-dessus du tarif)
et l'envoi au panier se font à la **sortie du champ** ou sur **Entrée**
(`validerRemise`). Champs `type="text"` + `inputMode="decimal"`, virgule
acceptée, sélection du contenu au focus.
