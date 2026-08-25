# Schéma de la base

Quatre fichiers, à jouer dans l'ordre. Ils recréent la base complète
(102 tables, 8 types énumérés, 284 index, 69 clés étrangères).

| Fichier | Contenu |
|---|---|
| `01-tables.sql` | types énumérés + 102 tables, clé primaire en `serial` |
| `02-index.sql` | 146 index métier |
| `03-cles-etrangeres.sql` | 69 clés étrangères |
| `04-index-cles-etrangeres.sql` | 36 index sur les colonnes de clé étrangère |

## Ordre

Index et clés étrangères sont posés **après** le chargement des données :
sur 242 071 lignes, les maintenir pendant l'insertion coûte bien plus cher
que de les construire une fois à la fin.

```bash
psql "$URL" -f db/01-tables.sql
# … chargement des données …
psql "$URL" -f db/02-index.sql
psql "$URL" -f db/03-cles-etrangeres.sql
psql "$URL" -f db/04-index-cles-etrangeres.sql
```

## Séquences

Si les données sont chargées **avec** leurs identifiants (nécessaire pour
préserver les rattachements parent-enfant), les séquences restent à 1 et la
première insertion échouerait sur un doublon. Les recaler :

```sql
SELECT setval(pg_get_serial_sequence('public.'||quote_ident(c.relname), a.attname),
              ...);  -- voir db/05-sequences.sql
```

## Cloner les données — `clone.sh`

```bash
bash db/clone.sh "postgresql://…/source" "postgresql://…/cible" /tmp
```

Le script décide table par table, à partir du catalogue PostgreSQL :

| Cas | Traitement | Nombre |
|---|---|---|
| id auto-généré, **aucune** table ne la référence | copiée **sans id** — la séquence en attribue de nouveaux, à partir de 1 | 22 |
| id auto-généré, **référencée** par d'autres tables | copiée **avec id** — les tables enfants pointent vers ces numéros | 33 |
| clé métier (`refArt`, `refDoc`, `unite`) | copiée telle quelle — référence partagée avec la production | 47 |

### Pourquoi cette distinction

Les identifiants ne sont pas contigus : les inventaires vont de 37 à 634, pas
de 1 à 598. Les régénérer les renumérote à partir de 1, alors que
`inventaire_lignes` (1 283 lignes) pointe toujours vers les anciens numéros.

Mesuré sur les données réelles : **41 lignes deviennent orphelines et les
1 242 autres sont silencieusement rattachées au mauvais inventaire** — aucune
erreur n'est levée, seuls les chiffres sont faux.

Les tables que personne ne référence n'ont pas ce problème : leurs identifiants
repartent proprement de 1 (`document_lines_ext` : 18–187136 → 1–187077).

Après le clone, jouer `05-sequences.sql` : les tables copiées avec leurs
identifiants ont laissé leur séquence à 1, et la première insertion
échouerait sur un doublon.
