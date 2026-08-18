import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const D="/tmp/claude-1000/-home-monta-rabota-bachir-demo1/8d1e0976-ac87-43f0-8b26-f08c29b4fbdd/scratchpad";
const b=await chromium.launch({channel:"chrome"});
const ctx=await b.newContext({viewport:{width:1600,height:1000}});
const p=await ctx.newPage();
// Capture le corps des requetes pour comprendre le format d'appel.
let exemple=null;
p.on("request",r=>{
  if(r.url().includes("application-modules")&&r.method()==="POST"&&!exemple){
    exemple={url:r.url(), body:r.postData()};
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
console.log("exemple requete:",JSON.stringify(exemple));
// Recupere le token stocke cote client.
const stock=await p.evaluate(()=>({ls:{...localStorage}}));
const cles=Object.keys(stock.ls);
console.log("cles localStorage:",cles.join(", "));
writeFileSync(D+"/prod-ls.json",JSON.stringify(stock.ls,null,1));
await b.close();
