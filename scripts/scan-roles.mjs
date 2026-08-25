import { chromium } from "playwright-core";
const ROLES = {
  COMMERCIAL: { login:"mokhtar", pwd:"007", pages:[
    "/commercial/dashboard","/commercial/clients","/commercial/map","/commercial/planning",
    "/commercial/catalogue","/commercial/panier","/commercial/recouvrement","/commercial/retour-stock",
    "/commercial/approvisionnement","/commercial/journal","/commercial/dernier-ticket",
    "/commercial/reclamation","/commercial/mot-de-passe"]},
  MANAGER: { login:"manager", pwd:"manager123", pages:[
    "/manager/dashboard","/manager/missions","/manager/objectifs","/manager/rapports",
    "/manager/supervision","/manager/validation"]},
  CLIENT: { login:"client", pwd:"client123", pages:[
    "/client/dashboard","/client/commander","/client/historique","/client/suivi"]},
  ADMIN: { login:"admin", pwd:"admin123", pages:[
    "/admin/dashboard","/admin/synthese","/admin/etat-stock","/admin/missions","/admin/commerciaux",
    "/admin/compta","/admin/grh","/admin/rapports-admin","/admin/users","/admin/traites","/admin/recordings"]},
};
const b = await chromium.launch({ executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"] });
for (const [role,cfg] of Object.entries(ROLES)) {
  const ctx = await b.newContext({ viewport:{width:1500,height:1000},
    geolocation:{latitude:36.4,longitude:10.61}, permissions:["geolocation"], locale:"fr-FR" });
  await ctx.request.post("http://localhost:3000/api/auth",{data:{login:cfg.login,password:cfg.pwd}});
  for (const path of cfg.pages) {
    const p = await ctx.newPage(); const errs=[], ko=[];
    p.on("console", m=>{ if(m.type()==="error" && !/original-stack-frames|Download the React/.test(m.text())) errs.push(m.text().slice(0,100)); });
    p.on("response", r=>{ const u=r.url(); if(u.includes("/api/") && r.status()>=400) ko.push(`${r.status()} ${u.replace("http://localhost:3000","").slice(0,60)}`); });
    let txt="", rows=0;
    try{
      await p.goto("http://localhost:3000"+path,{waitUntil:"domcontentloaded",timeout:150000});
      for(let i=0;i<14;i++){ txt=await p.innerText("body"); if(!/Chargement/.test(txt)||txt.length>1200) break; await p.waitForTimeout(1500);}
      await p.waitForTimeout(2500); txt=await p.innerText("body");
      rows=await p.locator("tbody tr").count().catch(()=>0);
    }catch(e){ errs.push("NAV "+String(e.message).slice(0,60)); }
    const bad = ko.length||errs.length;
    const nan = /NaN|Infinity|undefined TND|null TND/.test(txt);
    if (bad||nan||txt.length<300) console.log(`${(bad?"PROBLEME":nan?"NaN":"court").padEnd(9)} ${role.padEnd(11)} ${path.padEnd(32)} ${rows} lg ${txt.length} car ${ko[0]??""} ${errs[0]??""}`);
    else console.log(`ok        ${role.padEnd(11)} ${path.padEnd(32)} ${rows} lg ${txt.length} car`);
    await p.close();
  }
  await ctx.close();
}
await b.close();
