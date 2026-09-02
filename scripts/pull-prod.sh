#!/usr/bin/env bash
# Tire les données de production (lecture seule, via l'API JSON) dans $SCR,
# pour scripts/resync-prod.py. Usage : SCR=/chemin bash scripts/pull-prod.sh
set -e
: "${SCR:?SCR requis}"; mkdir -p "$SCR/lignes" "$SCR/lignes-achat"
API=${PROD_API_URL:-http://41.226.17.73:3050}
TOKEN=$(curl -s -m 20 -X POST "$API/users/generateToken" -H 'content-type: application/json' -d '{"login":"Mokhtar","password":"007","db":"bis"}')
echo "$TOKEN" > "$SCR/token.txt"
pull() { curl -s -m 300 -X POST "$API/$1" -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}" -o "$SCR/$2.json" -w "$2: http=%{http_code} taille=%{size_download}\n"; }
pull documents-ventes/ dv;  pull documents-achats/ da
pull ordre_mission/ src-missions; pull ligne_mission/ src-ligne_mission; pull reglements-clients/ src-reg_clients
pull articles/ src-articles;  pull clients/ src-clients;  pull fournisseurs/ src-fournisseurs
pull vehicules/ src-vehicules; pull frais_mission/ src-frais_mission; pull depots/ src-depots; pull users/ src-users
pull depots/get-all-articles-by-depot src-stock; pull societe/societe ste
export TOKEN SCR API
# lignes : une requête par document (12 en parallèle), reprise possible
python3 -c "import json;[print(x['Ref_doc']) for x in json.load(open('$SCR/dv.json')) if x.get('Ref_doc')]" | sort -u | xargs -P 12 -I{} bash -c '
  f="$SCR/lignes/{}.json"; [ -s "$f" ] && exit 0
  curl -s -m 30 -X POST "$API/documents-ventes/get-articles-vente/{}" -H "content-type: application/json" -d "{\"token\":\"$TOKEN\"}" -o "$f"'
python3 -c "import json;[print(x['Ref_doc']) for x in json.load(open('$SCR/da.json')) if x.get('Ref_doc')]" | sort -u | xargs -P 12 -I{} bash -c '
  f="$SCR/lignes-achat/{}.json"; [ -s "$f" ] && exit 0
  curl -s -m 30 -X POST "$API/documents-achats/get-articles-achat/{}" -H "content-type: application/json" -d "{\"token\":\"$TOKEN\"}" -o "$f"'
echo "lignes vente: $(ls $SCR/lignes | wc -l) | lignes achat: $(ls $SCR/lignes-achat | wc -l)"
