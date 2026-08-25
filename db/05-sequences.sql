-- Recale chaque séquence au-dessus du plus grand identifiant présent.
-- À jouer après un chargement de données effectué avec les identifiants.
DO $$
DECLARE r record; v bigint;
BEGIN
  FOR r IN
    SELECT c.relname AS t, a.attname AS c,
           pg_get_serial_sequence('public.'||quote_ident(c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r'
      AND pg_get_serial_sequence('public.'||quote_ident(c.relname), a.attname) IS NOT NULL
  LOOP
    -- On se cale au-dessus du maximum. `is_called = true` fait rendre v+1 au
    -- prochain appel : la valeur v elle-même reste libre, ce qui évite tout
    -- conflit avec une ligne insérée pendant que ce script tourne.
    EXECUTE format('SELECT COALESCE(MAX(%I),0)+1 FROM public.%I', r.c, r.t) INTO v;
    PERFORM setval(r.seq, v, true);
  END LOOP;
END $$;
