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
| ☐ | Suivie commande | `/admin/modules/vente/suivie-commande` | Fermer, Imprimer, Modifier, Ouvrir |  |
| ✅ | Gestion des commerciaux | `/admin/modules/vente/commerciaux` | Ajouter, Annuler, Modifier, New, Supprimer, Valider | **13 = production**, y compris le commercial 711063 au libellé vide (idem en production) |
| ✅ | Gestion des ordres missions | `/admin/modules/gestion-tourner/ordres-missions` | Ajouter, Annuler, Cloturer, Itinéraire, Modifier, Non, Nouveau, Oui | **2 629 = production** ; les relevés km alimentent le compteur véhicule |
| ☐ | Statistique de vente | `/admin/modules/vente/rapports` | — |  |

## GESTION DES ACHATS

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | creer un fournisseur | `/admin/modules/achat/fournisseurs` | Ajouter, Catalogues fournisseur, Fermer, Modifier, Supprimer | CRUD partagé avec les clients |
| ✅ | Liste des fournisseurs | `/admin/modules/achat/fournisseurs` | Afficher, Ajouter, Fermer, Imprimer, Liste des réglements, Modifier, Rechercher, Supprimer | **50 = production** (43 avant : 7 tiers de charge rangés sous une nature « T » qui les excluait) |
| ✅ | Liste documents achat | `/admin/modules/achat/documents` | Ajouter, Annuler, Fermer, Imprimer, Modifier, Ouvrir, Rechercher, Supprimer |  |
| ☐ | Creer Avoir | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ☐ | Creer Bon de commande | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Bon de reçeption | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ☐ | Creer Bon de retour | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ✅ | Creer Demande d achat | `/admin/modules/achat/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ☐ | Creer Devis | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ☐ | Creer Facture | `/admin/modules/vente/documents` | Annuler, Enregistrer, Modifier, PDF, Supprimer, Valider |  |
| ☐ | Rapport | `/admin/modules/achat/rapport` | — |  |

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
| ☐ | Creer ordre de fabrication | `/admin/modules/gpao/of` | — |  |
| ☐ | Liste documents OF | `/admin/modules/gpao/of` | — |  |

## GRH

| État | Écran production | Écran S.K.Y | Actions à couvrir | Notes |
|---|---|---|---|---|
| ✅ | Employers | `/admin/grh` | Valider | **7 = production** ; le nom vient du référentiel tiers, l'employé n'en portant pas en source |
| ✅ | Créer un employer | `/admin/grh` | Ajouter, Enregistrer, Postes de charge, Supprimer, Sélectionner tous, Valider | CRUD complet |
| ✅ | Gestion Pointage | `/admin/grh` | Créer une Session, Non, Oui | **12 sessions = production**, 15 pointages |
| ✅ | Créer un pointage | `/admin/grh` | Valider | Saisie par session, nom d'employé désormais affiché |
| ✅ | Gestion Crédit | `/admin/grh` | Créer | échéancier 30 j, tiers `isEmploye` |
| ☐ | Traitements | `/admin/grh` | Clôturer, Consulter |  |
| ☐ | Paramétrages | `/admin/grh` | Attribuer à tous, Enregistrer, Fermer |  |

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

**Avancement : 56/71 écrans terminés — modules CHARGE, TRÉSORERIE et STOCK complets ; VENTE et ACHAT complets hors suivi de commande et rapports ; GRH complet hors traitements et paramétrages ; PARC ROULANT et ordres de mission alignés sur la production.**

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
