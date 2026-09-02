#!/usr/bin/env python3
# Resynchronisation complète de la base depuis la production (données tirées
# via l'API JSON dans $SCR). Reconstruit les tables « métier » à l'identique de
# la prod, en conservant les identifiants porteurs de sens (id_day des missions,
# ID_reg des règlements, refDoc/refArt) pour préserver les rattachements.
#
# Écrit UNIQUEMENT dans la base locale (DATABASE_URL). Ne touche jamais la prod.
import json, os, glob, sys
import psycopg2, psycopg2.extras

SCR = os.environ["SCR"]
DB  = os.environ["DB"]
def load(name): return json.load(open(f"{SCR}/{name}.json", encoding="utf-8"))

def s(v):
    if v is None: return None
    v = str(v).strip()
    return v or None
def num(v, d=0.0):
    try:
        if v in (None, "", "0000-00-00"): return d
        return float(v)
    except (ValueError, TypeError): return d
def dt(v):
    # MySQL '0000-00-00' → NULL ; sinon la chaîne telle quelle (Postgres la lit).
    if not v or str(v).startswith("0000-00-00"): return None
    return str(v)
def bol(v): return bool(num(v, 0))

conn = psycopg2.connect(DB); conn.autocommit = False
cur = conn.cursor()
def exec_many(sql, rows, page=2000):
    for i in range(0, len(rows), page):
        psycopg2.extras.execute_values(cur, sql, rows[i:i+page], page_size=page)

import datetime
NOW = datetime.datetime.now()
rap = {}

# ── depots : code_depot -> libellé (pour le stock) ───────────────────────────
depots = load("src-depots")
CODE2EMP = {d["Code_mag"]: (s(d["Libelle_mag"]) or f"Dépôt {d['Code_mag']}") for d in depots}

# ── partners (clients) : nature 'C' ──────────────────────────────────────────
def import_clients():
    clients = load("src-clients")
    seen = set(); rows = []
    for c in clients:
        cid = c.get("Code_cli")
        if cid is None or cid in seen: continue
        seen.add(cid)
        rows.append((
            cid, "C", s(c.get("Raison_social")) or f"Client {cid}", s(c.get("adr_cli")), s(c.get("tel")),
            None, s(c.get("site_web")), s(c.get("ville")), s(c.get("gouvernorat")),
            s(c.get("codetva")), s(c.get("cletva")), s(c.get("categorietva")), s(c.get("MF")),
            s(c.get("Fam_cli")), s(c.get("Sous_fam_cli")),
            num(c.get("solde_ini")), num(c.get("debit")), num(c.get("credit")), num(c.get("solde_fin")),
            num(c.get("plafond_encour")) or None, num(c.get("Remise_def")),
            s(c.get("commercial")),
            num(c.get("longitude")) or None, num(c.get("latitude")) or None,
            int(num(c.get("bloq"))), int(num(c.get("exo"))), int(num(c.get("assuj"))), 0,
            s(c.get("registre_com")), dt(c.get("date_creation")), None, None, num(c.get("charge")),
        ))
    cur.execute("DELETE FROM partners WHERE nature='C'")
    exec_many("""INSERT INTO partners (id,nature,"raisonSocial",adresse,tel,fax,email,ville,gouvernorat,
        "codeTva",cletva,"categorieTva","matriculeF",famille,"sousFamille",
        "soldeIni",debit,credit,"soldeFin",plafond,"remiseDef",commercial,longitude,latitude,
        archiver,exo,assuj,"isEmploye","registreCom","dateCreation","creePar",photo,charge) VALUES %s
        ON CONFLICT (id) DO NOTHING""", rows)
    rap["partners(C)"] = len(rows)

# ── articles_ext ─────────────────────────────────────────────────────────────
def import_articles():
    arts = load("src-articles")
    seen=set(); rows=[]
    for a in arts:
        ref = s(a.get("ref_art"))
        if not ref or ref in seen: continue
        seen.add(ref)
        rows.append((
            ref, s(a.get("code_barre")), s(a.get("des_art")), s(a.get("caract_art")),
            s(a.get("catalogue")), s(a.get("code_catalogue")), s(a.get("Code_fam")), s(a.get("Code_sou_fam")),
            s(a.get("Unité")), num(a.get("pu_achat")), num(a.get("pu_achat_ttc")), num(a.get("pmp")), num(a.get("dpa")),
            num(a.get("pu_inv")), num(a.get("tarif1_ht")), num(a.get("tarif2_ht")), num(a.get("tarif3_ht")),
            num(a.get("ma_tarif1")), num(a.get("Taux_tva")), num(a.get("Taux_fodec")),
            num(a.get("stock_ini")), num(a.get("entrer")), num(a.get("sortie")), num(a.get("en_stock")),
            int(num(a.get("vendable"),1)), int(num(a.get("achetable"),1)), int(num(a.get("service"))),
            int(num(a.get("archiver"))), s(a.get("ref_origine")),
            # Même règle que prisma/import-articles.ts : SF / MP / CH, sinon P (produit fini).
            "SF" if num(a.get("produit_semi_fini")) else "MP" if num(a.get("Matiere_premiere")) else "CH" if num(a.get("charge")) else "P",
            None,None,None,None,None, num(a.get("commission")), num(a.get("conversion"),1),
            int(num(a.get("prouit_fini"))), int(num(a.get("fifo"))), num(a.get("Taux_fodec")),
            int(num(a.get("ger_serie"))), int(num(a.get("ges_lot"))), int(num(a.get("lifo"))),
            num(a.get("ma_tarif1")), s(a.get("id_marque")), num(a.get("rem_max")),
            int(num(a.get("remiseparqte"))), s(a.get("id_sous_categorie")),
            num(a.get("st_max")), num(a.get("st_min")), s(a.get("unite_entree")),
        ))
    cur.execute("DELETE FROM articles_ext")
    exec_many("""INSERT INTO articles_ext ("refArt","codeBarre",designation,caract,catalogue,"codeCatalogue",
        famille,"sousFamille",unite,"puAchat","puAchatTtc",pmp,dpa,"puInv","tarif1Ht","tarif2Ht","tarif3Ht",
        "maTarif1","tauxTva","tauxFodec","stockIni",entrer,sortie,"enStock",vendable,achetable,service,archiver,
        "refOrigine",kind,"cmpteAchatImp","cmpteAchatLoc","cmpteVente","cmpteVenteExo","cmpteVenteExp",
        commission,conversion,fab,fifo,"fodecAchat","gerSerie","gesLot",lifo,"margePct",marque,"remiseMax",
        "remiseParQte","sousCategorie","stMax","stMin","uniteEntree") VALUES %s ON CONFLICT ("refArt") DO NOTHING""", rows)
    rap["articles_ext"] = len(rows)

# ── documents_ext (ventes + achats) ──────────────────────────────────────────
def import_documents(valid_days):
    cur.execute("DELETE FROM document_lines_ext")
    cur.execute("DELETE FROM documents_ext")
    total_docs = total_lignes = 0
    for dump, nature, ldir, route in [("dv","Vente","lignes","get-articles-vente"),
                                      ("da","Achat","lignes-achat","get-articles-achat")]:
        docs = load(dump); seen=set(); drows=[]
        for d in docs:
            ref = s(d.get("Ref_doc"))
            if not ref or ref in seen: continue
            seen.add(ref)
            drows.append((
                ref, nature, s(d.get("Type_doc")), s(d.get("Cara_doc")), s(d.get("Lib_doc")),
                dt(d.get("Date_doc")), d.get("Code_cli"), s(d.get("Raison_social")), s(d.get("adr_cli")),
                s(d.get("MF")), d.get("Num_Seq"), num(d.get("tht_brut")), num(d.get("tot_remise")),
                num(d.get("tht_net")), num(d.get("tot_tva")), num(d.get("timbre")), num(d.get("totfodec")),
                num(d.get("ttc_net")), num(d.get("Solde_doc")), num(d.get("totalRegle")),
                s(d.get("Etat_av")) or s(d.get("etat")), s(d.get("ModePay")), d.get("Code_mag"),
                s(d.get("Utilisateur")), s(d.get("matricule")), s(d.get("Raison_social_com")),
                dt(d.get("echeance")), s(d.get("couleur")), dt(d.get("date_valide")),
                True,  # valide : les documents importés sont déjà émis
                s(d.get("Doc_source")), s(d.get("transforme_en")), (lambda dd: dd if dd in valid_days else None)(d.get("ID_journee") or d.get("dayID") or d.get("id_day")),
                None, None, bol(d.get("generer")), bol(d.get("Facturer")), bol(d.get("comptabiliser")),
                s(d.get("tiers")),
            ))
        exec_many("""INSERT INTO documents_ext ("refDoc",nature,"typeDoc","caraDoc","libDoc","dateDoc","codeCli",
            "raisonSocial","adrCli",mf,"numSeq","thtBrut","totRemise","thtNet","totTva",timbre,"totFodec","ttcNet",
            "soldeDoc","totalRegle",etat,"modePayement","codeMag",utilisateur,vehicule,commercial,echeance,couleur,
            "dateValide",valide,"docSource","transformeEn","dayId","transferFrom","transferTo",generer,facturer,
            comptabiliser,tiers) VALUES %s ON CONFLICT ("refDoc") DO NOTHING""", drows)
        total_docs += len(drows)

        # lignes : un fichier par référence
        lrows=[]
        for ref in seen:
            f = f"{SCR}/{ldir}/{ref}.json"
            if not os.path.exists(f): continue
            try: data = json.load(open(f, encoding="utf-8"))
            except Exception: continue
            arts = data.get("articles") if isinstance(data, dict) else data
            if not isinstance(arts, list): continue
            for a in arts:
                lrows.append((
                    ref, s(a.get("Ref_art")), s(a.get("des_art")) or s(a.get("Ref_art")) or "?", s(a.get("unitvente")),
                    num(a.get("qte")), num(a.get("pu_ht")), num(a.get("Remise")), num(a.get("tva")),
                    num(a.get("fodec")), num(a.get("valeur_ht")), num(a.get("valeur_ht")), num(a.get("Mt_tva")),
                    num(a.get("valeur_ttc")), int(num(a.get("Num_Order"))), s(a.get("Doc_liee")), num(a.get("charge")),
                ))
        exec_many("""INSERT INTO document_lines_ext ("refDoc","refArt",designation,unite,qte,"puHt",remise,"tauxTva",
            "tauxFodec","thtBrut","thtNet","totTva","ttcNet",ordre,"docLiee",charge) VALUES %s""", lrows)
        total_lignes += len(lrows)
    rap["documents_ext"] = total_docs
    rap["document_lines_ext"] = total_lignes

# ── erp_missions (id = id_day) ───────────────────────────────────────────────
def import_missions():
    miss = load("src-missions")
    rows=[]
    for m in miss:
        rows.append((
            m.get("id_day"), s(m.get("utilisateur")), s(m.get("commercial")), s(m.get("vehicule")),
            dt(m.get("date_ordre")), int(num(m.get("km_depart"))), int(num(m.get("km_arrive"))),
            s(m.get("etat")), dt(m.get("du")), dt(m.get("au")), 0.0,
        ))
    cur.execute("DELETE FROM erp_missions")
    exec_many("""INSERT INTO erp_missions (id,utilisateur,commercial,vehicule,"dateOrdre","kmDepart","kmArrive",
        etat,du,au,"objectifCA") VALUES %s ON CONFLICT (id) DO NOTHING""", rows)
    rap["erp_missions"] = len(rows)

# ── ligne_mission (id conservé) ──────────────────────────────────────────────
def import_ligne_mission(valid_days):
    lm = load("src-ligne_mission")
    rows=[]
    for l in lm:
        day = l.get("id_day")
        if day not in valid_days: continue  # sinon viole la FK vers erp_missions
        rows.append((
            l.get("id"), day, l.get("code_cli"), s(l.get("client_nom")), s(l.get("motif")),
            num(l.get("objectif")), int(num(l.get("num_ordre"))), s(l.get("etat")) or "À visiter",
            s(l.get("heure_prevue")), dt(l.get("date_visite")),
            num(l.get("latitude")) or None, num(l.get("longitude")) or None, s(l.get("commentaire")), NOW,
        ))
    cur.execute("DELETE FROM ligne_mission")
    exec_many("""INSERT INTO ligne_mission (id,"dayId","codeCli","clientNom",motif,objectif,"numOrdre",etat,
        "heurePrevue","dateVisite",latitude,longitude,commentaire,"updatedAt") VALUES %s ON CONFLICT (id) DO NOTHING""", rows)
    rap["ligne_mission"] = len(rows)

# ── erp_reglements (sens C ; idSource = ID_reg) ──────────────────────────────
def import_reglements(valid_days):
    reg = load("src-reg_clients")
    # Le PK id est partagé entre règlements client et fournisseur. Les
    # fournisseurs (sens F) occupent déjà des id ; on décale les clients
    # au-dessus du max existant pour éviter toute collision. idSource garde
    # l'ID_reg d'origine (traçabilité vers la prod).
    cur.execute("SELECT COALESCE(MAX(id),0) FROM erp_reglements")
    OFFSET = cur.fetchone()[0] + 1
    rows=[]; ids=set()
    for r in reg:
        src = r.get("ID_reg")
        if src is None or src in ids: continue
        ids.add(src)
        day = r.get("dayID")
        if day is not None and day not in valid_days: day = None
        rows.append((
            OFFSET + src, "C", src, dt(r.get("Date_pay")), num(r.get("montant")), s(r.get("Echéance")),
            s(r.get("Num_piece")), s(r.get("Num_Doc")), s(r.get("Etat_Rég")), s(r.get("ModePay")),
            r.get("Code_cli"), None, s(r.get("Utilisateur")), s(r.get("banque_cli")),
            r.get("Id_emplac"), s(r.get("Commentaire")), day, s(r.get("lettrage")),
        ))
    cur.execute("DELETE FROM erp_reglements WHERE sens='C'")
    exec_many("""INSERT INTO erp_reglements (id,sens,"idSource","datePay",montant,echeance,"numPiece","numDoc",
        etat,"modePay","tiersCode","tiersNom",utilisateur,banque,"idEmplac",commentaire,"dayId",lettrage) VALUES %s
        ON CONFLICT (sens,"idSource") DO NOTHING""", rows)
    rap["erp_reglements(C)"] = len(rows)

# ── frais_mission ────────────────────────────────────────────────────────────
def import_frais(valid_days):
    fr = load("src-frais_mission")
    rows=[]
    for f in fr:
        if f.get("id_day") not in valid_days: continue
        rows.append((f.get("id"), f.get("id_day"), s(f.get("ref_art")), None,
                     num(f.get("montant")), num(f.get("pu_achat")), False))
    cur.execute("DELETE FROM frais_mission")
    exec_many("""INSERT INTO frais_mission (id,"dayId","refArt",libelle,montant,"puAchat",carburant)
        VALUES %s ON CONFLICT (id) DO NOTHING""", rows)
    rap["frais_mission"] = len(rows)

# ── stock_depots (code_depot -> emplacement) ─────────────────────────────────
def import_stock(valid_arts):
    st = load("src-stock")
    rows=[]; seen=set()
    for x in st:
        ref = s(x.get("reference_article"))
        cd = x.get("code_depot")
        # Seuls les dépôts de la table `magasins` existent : la synchro continue
        # de l'application (`src/lib/sync-production.ts`) n'entretient que ceux
        # de `ref_tables` kind=depot, dont les libellés doivent être identiques.
        emp = CODE2EMP.get(cd)
        if not ref or not emp or ref not in valid_arts: continue
        k=(ref,emp)
        if k in seen: continue
        seen.add(k)
        rows.append((ref, emp, num(x.get("en_stock")), num(x.get("pmp")), NOW))
    for code, lib in CODE2EMP.items():
        cur.execute("UPDATE ref_tables SET label=%s WHERE kind='depot' AND code=%s", (lib, str(code)))
        cur.execute("INSERT INTO ref_tables (kind,code,label) SELECT 'depot',%s,%s WHERE NOT EXISTS (SELECT 1 FROM ref_tables WHERE kind='depot' AND code=%s)", (str(code), lib, str(code)))
    cur.execute("DELETE FROM stock_depots")
    exec_many("""INSERT INTO stock_depots ("refArt",emplacement,quantite,pmp,"updatedAt") VALUES %s""", rows)
    rap["stock_depots"] = len(rows)

# ── vehicles ─────────────────────────────────────────────────────────────────
def import_vehicules():
    vh = load("src-vehicules")
    rows=[]
    for v in vh:
        rows.append((
            v.get("id_veh"), s(v.get("Matricule")), s(v.get("Marque")), s(v.get("Type")),
            int(num(v.get("AnneModel"))) or None, "ACTIVE", dt(v.get("date_fin_assurance")),
            dt(v.get("date_fin_visite")), dt(v.get("date_fin_taxe")),
            s(v.get("NChassis")), s(v.get("Type")), s(v.get("Couleur")), s(v.get("assureur")),
            dt(v.get("date_debut_assurance")), dt(v.get("date_liv_visite")), dt(v.get("date_pay_taxe")),
            num(v.get("MoyKM")), num(v.get("consom_moy_j")), num(v.get("consom_carbur")),
        ))
    cur.execute("DELETE FROM vehicles")
    exec_many("""INSERT INTO vehicles (id,plate,brand,model,year,status,"insuranceExpiry","controlExpiry",
        "taxExpiry",chassis,"typeVehicule",couleur,assureur,"insuranceStart","controlStart","taxPaidAt",
        "kmMoyen","consoMoyenneJour","consoCarburant") VALUES %s ON CONFLICT (id) DO NOTHING""", rows)
    rap["vehicles"] = len(rows)

try:
    import_clients()
    import_articles()
    valid_arts = {r[0] for r in cur.execute("SELECT \"refArt\" FROM articles_ext") or cur.fetchall()}
    cur.execute('SELECT "refArt" FROM articles_ext'); valid_arts = {r[0] for r in cur.fetchall()}
    import_vehicules()
    import_missions()
    cur.execute("SELECT id FROM erp_missions"); valid_days = {r[0] for r in cur.fetchall()}
    import_ligne_mission(valid_days)
    import_reglements(valid_days)
    import_frais(valid_days)
    import_documents(valid_days)
    import_stock(valid_arts)
    conn.commit()
    print("OK — resync commit")
    for k,v in rap.items(): print(f"  {k}: {v}")
except Exception as e:
    conn.rollback()
    print("ROLLBACK:", type(e).__name__, str(e)[:400]); sys.exit(1)
finally:
    cur.close(); conn.close()
