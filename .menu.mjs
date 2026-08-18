import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const D="/tmp/claude-1000/-home-monta-rabota-bachir-demo1/8d1e0976-ac87-43f0-8b26-f08c29b4fbdd/scratchpad";
const b=await chromium.launch({channel:"chrome"});
const ctx=await b.newContext({viewport:{width:1600,height:1000}});
const p=await ctx.newPage();
// Capture la configuration du menu servie par l'API de production : c'est la
// source de verite (le menu est pilote par la base, pas par le code).
const captures={};
p.on("response",async r=>{
  const u=r.url();
  if(u.includes(":3050")&&r.status()===200&&/application-modules|navbar_components|component/i.test(u)){
    try{const j=await r.json(); captures[u.split(":3050/")[1]?.slice(0,60)+"#"+Math.random().toString(36).slice(2,6)]=j;}catch{}
  }
});
await p.goto("http://41.226.17.73:3001/",{waitUntil:"networkidle",timeout:60000});
await p.waitForTimeout(2500);
await p.locator("#mui-1").fill("Sky@com");
await p.locator("#login").fill("Admin");
await p.locator("#password").fill("0502765210");
await p.locator("#db").fill("bis");
await p.waitForTimeout(900);
await p.evaluate(()=>{[...document.querySelectorAll("button")].find(x=>/Se\s*Connecter/i.test(x.innerText||""))?.click();});
await p.waitForTimeout(12000);
writeFileSync(D+"/prod-menu-config.json",JSON.stringify(captures,null,1));
for(const [k,v] of Object.entries(captures)){
  const rows=Array.isArray(v)?v:(v?.rows??v?.data??[]);
  console.log("###",k,"->",Array.isArray(rows)?rows.length+" lignes":typeof v);
  if(Array.isArray(rows)&&rows.length) console.log("   champs:",Object.keys(rows[0]).join(", "));
}
await b.close();
