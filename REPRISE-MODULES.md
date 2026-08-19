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
