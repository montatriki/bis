set -e
SRC="$1"; DST="$2"; SCR="$3"
ok=0; ko=0; tot=0; nsans=0; navec=0
for t in $(psql "$SRC" -tAc "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where c.relkind='r' order by c.relname"); do
  n=$(psql "$SRC" -tAc "select count(*) from \"$t\"")
  [ "$n" = "0" ] && { ok=$((ok+1)); continue; }

  # La table est-elle référencée par une autre ? Si oui, ses id sont porteurs
  # de sens : les régénérer casserait les rattachements des tables enfants.
  refs=$(psql "$SRC" -tAc "select count(*) from pg_constraint fk join pg_class p on p.oid=fk.confrelid join pg_namespace ns on ns.oid=p.relnamespace and ns.nspname='public' where fk.contype='f' and p.relname='$t'")
  auto=$(psql "$SRC" -tAc "select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace ns on ns.oid=c.relnamespace and ns.nspname='public' where c.relname='$t' and a.attname='id' and a.attnum>0 and a.atthasdef")

  if [ "$auto" -gt 0 ] && [ "$refs" -eq 0 ]; then
    # id régénéré : on ne transporte pas la colonne
    cl=$(psql "$SRC" -tAc "select string_agg('\"'||attname||'\"',',' order by attnum) from pg_attribute where attrelid='public.\"$t\"'::regclass and attnum>0 and not attisdropped and attname<>'id'")
    mode="sans id"; nsans=$((nsans+1))
  else
    cl=$(psql "$SRC" -tAc "select string_agg('\"'||attname||'\"',',' order by attnum) from pg_attribute where attrelid='public.\"$t\"'::regclass and attnum>0 and not attisdropped")
    mode="avec id"; navec=$((navec+1))
  fi

  if psql "$SRC" -c "\copy (select $cl from \"$t\") to stdout (format csv)" 2>/dev/null \
     | psql "$DST" -c "\copy \"$t\" ($cl) from stdin (format csv)" >/dev/null 2>$SCR/e.txt; then
    ok=$((ok+1)); tot=$((tot+n))
  else
    printf "  ECHEC %-26s %8s  %s\n" "$t" "$n" "$(head -c 100 $SCR/e.txt | tr '\n' ' ')"; ko=$((ko+1))
  fi
done
echo "tables ok: $ok  echecs: $ko  lignes: $tot   (sans id: $nsans, avec id: $navec)"
