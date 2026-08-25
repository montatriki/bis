import { chromium } from "playwright-core";
import fs from "node:fs";
const ecrans = fs.readFileSync(process.argv[2],"utf8").trim().split("\n");
const b = await chromium.launch({ executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:1500,height:1000}, locale:"fr-FR" });
await ctx.request.post("http://localhost:3000/api/auth",{data:{login:"admin",password:"admin123"}});
const out=[];
for (const e of ecrans) {
  const p = await ctx.newPage();
  const errs=[], api=[];
  p.on("console", m => { if (m.type()==="error" && !/original-stack-frames|Download the React/.test(m.text())) errs.push(m.text().slice(0,110)); });
  p.on("response", r => { const u=r.url(); if (u.includes("/api/")) api.push(`${r.status()} ${u.replace("http://localhost:3000","").slice(0,70)}`); });
  let txt="", rows=0;
  try {
    await p.goto("http://localhost:3000/admin/modules/"+e,{waitUntil:"domcontentloaded",timeout:150000});
    for (let i=0;i<15;i++){ txt=await p.innerText("body"); if(!/Chargement/.test(txt)||txt.length>1500) break; await p.waitForTimeout(1500); }
    await p.waitForTimeout(2500);
    txt = await p.innerText("body");
    rows = await p.locator("tbody tr").count().catch(()=>0);
  } catch(err){ errs.push("NAV "+String(err.message).slice(0,70)); }
  const ko = api.filter(a=>!a.startsWith("200")&&!a.startsWith("30"));
  const vide = rows===0 && !/Aucun|aucune|vide|0 ligne/i.test(txt);
  out.push({e,rows,len:txt.length,errs:[...new Set(errs)],apiKo:[...new Set(ko)],vide});
  const t = ko.length||errs.length ? "PROBLEME" : (rows===0 ? "0 ligne" : "ok");
  console.log(`${t.padEnd(9)} ${e.padEnd(38)} ${String(rows).padStart(5)} lignes  ${txt.length} car ${ko[0]??""} ${errs[0]??""}`);
  await p.close();
}
fs.writeFileSync(process.argv[3], JSON.stringify(out,null,1));
await b.close();
