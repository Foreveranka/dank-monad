import assert from 'node:assert/strict';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
const base='http://localhost:5175';
for(const route of ['/','/app','/docs']){const r=await fetch(base+route);assert.equal(r.status,200);console.log(route,'OK')}
for(const [country,lang] of [['TR','tr'],['US','en'],['DE','de'],['ES','es'],['FR','fr']]){const r=await fetch(base+'/api/locale',{headers:{'cf-ipcountry':country}});const body=await r.json();assert.equal(body.language,lang);console.log(country,lang)}
const account=privateKeyToAccount(generatePrivateKey());
const request={wallet:account.address,action:'read',data:{}};
const c=await fetch(base+'/api/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const challenge=await c.json();assert.equal(c.status,200,JSON.stringify(challenge));
const signature=await account.signMessage({message:challenge.message});const body={...request,id:challenge.id,signature};
const send=(body)=>fetch(base+'/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const tampered=await send({...body,action:'adminRead'});assert.notEqual(tampered.status,200);
const good=await send(body);assert.equal(good.status,200,await good.text());
const replay=await send(body);assert.notEqual(replay.status,200);console.log('Signed read, payload tampering and replay checks passed');
const wallet=await fetch(base+'/api/wallet-score?address=0x5683d9AC05d4A89624a42Fc313E33f94E56d0A1A');const w=await wallet.json();assert.equal(wallet.status,200,JSON.stringify(w));assert.equal(w.assessment.creditScore,null);console.log('Monad snapshot read; incomplete history cannot grant credit');
