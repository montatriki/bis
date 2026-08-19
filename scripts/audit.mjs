import { chromium } from "playwright-core";
import fs from "node:fs";

const ERP = JSON.parse(fs.readFileSync(new URL("./erp-routes.json", import.meta.url), "utf8"));
const ROLES = {
  ADMIN: { login:"admin", pwd:"admin123", pages:[
    "/admin/dashboard","/admin/synthese","/admin/etat-stock","/admin/missions","/admin/commerciaux",
    "/admin/commerciaux/FOUED","/admin/compta","/admin/grh","/admin/rapports-admin","/admin/users",
    "/admin/recordings", ...ERP ]},
  MANAGER: { login:"manager", pwd:"manager123", pages:[
    "/manager/dashboard","/manager/missions","/manager/objectifs","/manager/rapports",
    "/manager/supervision","/manager/validation" ]},
  COMMERCIAL: { login:"mokhtar", pwd:"007", pages:[
    "/commercial/dashboard","/commercial/clients","/commercial/map","/commercial/planning",
    "/commercial/catalogue","/commercial/panier","/commercial/recouvrement","/commercial/retour-stock",
    "/commercial/approvisionnement","/commercial/journal","/commercial/dernier-ticket",
    "/commercial/reclamation","/commercial/mot-de-passe" ]},
  CLIENT: { login:"client", pwd:"client123", pages:[
    "/client/dashboard","/client/commander","/client/historique","/client/suivi" ]},
};

const b = await chromium.launch({ executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"] });
const findings = [];

for (const [role, cfg] of Object.entries(ROLES)) {
  const ctx = await b.newContext({ viewport:{width:1400,height:1000},
    geolocation:{latitude:36.8899,longitude:10.1804}, permissions:["geolocation"], locale:"fr-FR" });
  const r = await ctx.request.post("http://localhost:3000/api/auth",{data:{login:cfg.login,password:cfg.pwd}});
  if (!r.ok()) { console.log(`!! login failed ${role}`); continue; }

  let n = 0;
  for (const path of cfg.pages) {
    n++;
    const p = await ctx.newPage(); const errs = [];
    // Un audit ne doit rien modifier : toute écriture déclenchée par un
    // rendu (auto-save, effet au montage) est bloquée et signalée.
    await p.route("**/*", (route) => {
      const m = route.request().method();
      const url = route.request().url();
      // Le suivi GPS écrit par conception : l'app terrain remonte la position
      // du commercial à chaque point. Le bloquer ferait remonter une anomalie
      // sur chaque écran commercial alors que c'est le comportement attendu.
      // Écritures voulues au chargement : le suivi GPS remonte la position du
      // commercial, et le planning génère la tournée du jour si elle manque.
      const suiviGps = url.includes("/api/position") || url.includes("/api/tournee");
      if (!suiviGps && (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE")) {
        errs.push("ECRITURE_BLOQUEE " + m + " " + url.replace("http://localhost:3000", ""));
        return route.abort();
      }
      return route.continue();
    });
    p.on("pageerror", e => errs.push("JS: "+String(e).split("\n")[0].slice(0,120)));
    p.on("console", m => { if (m.type()==="error") errs.push("CONSOLE: "+m.text().slice(0,120)); });
    p.on("response", res => { if (res.status()>=400 && !res.url().includes("favicon"))
      errs.push(`HTTP${res.status()}: ${res.url().replace("http://localhost:3000","")}`); });
    let txt = "";
    try {
      // En développement, la première visite d'une route déclenche sa
      // compilation : jusqu'à 33 s observées sur /admin/compta, alors que la
      // même page répond en 0,3 s ensuite. Le délai par défaut (30 s) faisait
      // remonter cette compilation comme une page vide.
      await p.goto("http://localhost:3000"+path,{waitUntil:"domcontentloaded",timeout:120000});
      await p.waitForTimeout(3200);
      // Une attente fixe signalait à tort des pages « bloquées en chargement » :
      // en développement, la première visite d'une route déclenche sa
      // compilation, qui dépasse largement ce délai. On laisse donc l'écran
      // sortir de son état de chargement avant de conclure, dans une limite
      // raisonnable.
      for (let i = 0; i < 12; i++) {
        txt = await p.innerText("body");
        if (!(/Chargement/.test(txt) && txt.trim().length < 400)) break;
        await p.waitForTimeout(2000);
      }
      txt = await p.innerText("body");
    } catch (e) {
      errs.push("NAV: " + String(e.message ?? e).slice(0, 80));
    }
    // Signaux de page silencieusement cassée
    const flags = [];
    if (txt.trim().length < 80) flags.push("PAGE_VIDE");
    if (/NaN|Infinity|undefined TND|null TND/.test(txt)) flags.push("CALCUL_INVALIDE");
    if (/Chargement/.test(txt) && txt.trim().length < 400) flags.push("BLOQUE_EN_CHARGEMENT");
    // On ne veut que les échecs techniques. Les écrans d'analyse emploient
    // « impossible » dans leurs commentaires métier (stock négatif, écarts
    // d'inventaire) : la formulation seule ne suffit pas à conclure.
    if (/Chargement impossible|Erreur de chargement|Une erreur est survenue|Échec (de|du) |Erreur \d{3}/i.test(txt))
      flags.push("MESSAGE_ERREUR");
    const rows = await p.locator("tbody tr").count().catch(()=>0);
    const uniq = [...new Set(errs)];
    if (uniq.length || flags.length) findings.push({ role, path, errs:uniq.slice(0,3), flags, rows });
    await p.close().catch(()=>{});
  }
  await ctx.close();
}
fs.writeFileSync(new URL("./findings.json", import.meta.url), JSON.stringify(findings,null,1));
console.log("pages avec anomalie:", findings.length);
for (const f of findings) console.log(`${f.role.padEnd(10)} ${f.path.padEnd(46)} ${f.flags.join(",").padEnd(22)} ${f.errs[0]??""}`);
await b.close();
