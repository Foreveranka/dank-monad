import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPublicClient,createWalletClient,http,parseAbi,parseEther,formatUnits,keccak256,toBytes} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {monadTestnet} from 'viem/chains';
const root=new URL('../',import.meta.url);const cfgPath=new URL('lib/deployment.json',root);
const oldConfig=JSON.parse(await fs.readFile(cfgPath,'utf8'));
const client=createPublicClient({chain:monadTestnet,transport:http(oldConfig.rpc,{timeout:20000,retryCount:2})});
assert.equal(await client.getChainId(),10143);
const admin=privateKeyToAccount(JSON.parse(await fs.readFile('/Users/mete/.config/dank-monad/testnet-deployer.json','utf8')).privateKey);
assert.equal(admin.address.toLowerCase(),oldConfig.admin.toLowerCase());
const keys=JSON.parse(await fs.readFile('/Users/mete/.config/dank-monad/six-wallets.json','utf8'));
const actors=keys.map(privateKeyToAccount);const artifact=JSON.parse(await fs.readFile(new URL('contracts/out/Dank.sol/Dank.json',root),'utf8'));const abi=artifact.abi;
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function approve(address,uint256) returns(bool)','function faucet()']);
const statePath='/Users/mete/.config/dank-monad/six-wallet-run-v3.json';let state;
try{state=JSON.parse(await fs.readFile(statePath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;state={old:oldConfig,protocol:null,transactions:[],wallets:actors.map((a,i)=>({address:a.address,score:[80,85,90,95,100,79][i],transactions:[]}))}}
const save=()=>fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const wallet=a=>createWalletClient({account:a,chain:monadTestnet,transport:http(oldConfig.rpc)});
const fees={maxFeePerGas:150000000000n,maxPriorityFeePerGas:2000000000n};
const read=(fn,args=[],address=state.protocol)=>client.readContract({address,abi,functionName:fn,args});
async function tx(actor,fn,args=[],{address=state.protocol,token=false,fixture=null}={}){
 const target=token?state.old.token:address;const activeAbi=token?tokenAbi:abi;
 const sim=await client.simulateContract({address:target,abi:activeAbi,functionName:fn,args,account:actor});
 let hash;for(let attempt=0;attempt<3;attempt++){try{hash=await wallet(actor).writeContract({...sim.request,...fees,maxPriorityFeePerGas:fees.maxPriorityFeePerGas+BigInt(Date.now()%1000000)+BigInt(attempt)});break}catch(e){if(attempt===2||!String(e).includes('insufficient balance'))throw e;await new Promise(r=>setTimeout(r,3000))}}
 const entry={action:fn,hash,address:target};state.transactions.push(entry);if(fixture)fixture.transactions.push(entry);await save();
 const receipt=await client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success',fn+' '+hash);console.log(fn,hash);return receipt;
}
if(!state.protocol){
 if(!state.deployHash){state.deployHash=await wallet(admin).deployContract({abi,bytecode:artifact.bytecode.object,args:[state.old.token,admin.address],...fees});await save()}
 const r=await client.waitForTransactionReceipt({hash:state.deployHash});assert.equal(r.status,'success');state.protocol=r.contractAddress;state.deploymentBlock=Number(r.blockNumber);await save();console.log('New protocol',state.protocol);
}
if(!state.migrated){
 assert.equal(await read('outstandingPrincipal',[],state.old.protocol),0n,'Old pool must have no outstanding loans');
 // Only move the deployer-owned, fully repaid test cohort.
 assert.equal(await read('totalDeposits',[],state.old.protocol),await read('deposits',[admin.address],state.old.protocol));
 if(!await read('paused',[],state.old.protocol))await tx(admin,'setPaused',[true],{address:state.old.protocol});
 if(Number(await read('phase',[],state.old.protocol))===1)await tx(admin,'settleCohort',[],{address:state.old.protocol});
 if(await read('cumulativeDistributable',[],state.old.protocol)>await read('claimed',[admin.address],state.old.protocol))await tx(admin,'claimCapital',[],{address:state.old.protocol});
 if(BigInt(await read('memberOf',[admin.address]))===0n)await tx(admin,'register');
 if(await read('acceptedRisk',[admin.address])!==await read('RISK_POLICY'))await tx(admin,'acceptRisk',[await read('RISK_POLICY')]);
 const target=50000000000n;const deposited=await read('deposits',[admin.address]);if(deposited<target){await tx(admin,'approve',[state.protocol,target-deposited],{token:true});await tx(admin,'depositCapital',[target-deposited])}
 if(Number(await read('phase'))===0)await tx(admin,'startLending');
 state.migrated=true;await save();
}
let history=[];try{history=JSON.parse(await fs.readFile(new URL('lib/deployments-history.json',root),'utf8'))}catch{};if(!history.some(h=>h.protocol===state.old.protocol))history.unshift({...state.old,archived:true,reason:'Replaced with score-based total capacity and LP shares',replacement:state.protocol});await fs.writeFile(new URL('lib/deployments-history.json',root),JSON.stringify(history,null,2)+'\n');
await fs.writeFile(cfgPath,JSON.stringify({...state.old,protocol:state.protocol,deploymentBlock:state.deploymentBlock,version:3},null,2)+'\n');
await fs.writeFile(new URL('lib/protocol-abi.json',root),JSON.stringify(abi,null,2)+'\n');
for(const [i,actor] of actors.entries()){
 const fixture=state.wallets[i];
 if(await client.getBalance({address:actor.address})<parseEther('0.2')){const hash=await wallet(admin).sendTransaction({to:actor.address,value:parseEther('0.5'),gas:100000n,...fees});assert.equal((await client.waitForTransactionReceipt({hash})).status,'success');fixture.gasFunding=hash;await save()}
 if(BigInt(await read('memberOf',[actor.address]))===0n)await tx(actor,'register',[],{fixture});
 const id=await read('memberOf',[actor.address]);fixture.memberId=id;
 if(!fixture.profileSet){const block=await client.getBlock();await tx(admin,'assignTestScore',[id,BigInt(fixture.score),block.timestamp+30n*86400n],{fixture});const cap=fixture.score>=95?500:fixture.score>=90?200:80;await tx(admin,'setLimits',[id,BigInt(cap)*1000000n,BigInt(cap)*1000000n],{fixture});fixture.profileSet=true;await save()}
 console.log('Profile ready',i+1,actor.address,fixture.score);
}
// The denied borrower can still supply liquidity after explicit risk consent.
const lp=state.wallets[5];
if(!lp.liquidityAdded){
 const existing=await read('deposits',[actors[5].address]);
 if(existing===0n){await tx(actors[5],'faucet',[],{token:true,fixture:lp});await tx(actors[5],'acceptRisk',[await read('RISK_POLICY')],{fixture:lp});await tx(actors[5],'approve',[state.protocol,10000000000n],{token:true,fixture:lp});await tx(actors[5],'depositCapital',[10000000000n],{fixture:lp})}
 assert.equal(await read('shares',[actors[5].address])*6n,await read('totalShares'));
 lp.liquidityAdded='10000';lp.initialOwnership='1/6';await save();
}
for(let i=0;i<5;i++){
 const f=state.wallets[i],actor=actors[i];if(!f.loanId){const member=await read('members',[f.memberId]);if(member[5]===0n)await tx(actor,'requestLoan',[BigInt([20,30,40,50,60][i])*1000000n,BigInt([1,2,3,6,12][i])],{fixture:f});f.loanId=Number((await read('members',[f.memberId]))[5]);await save()}
 let loan=await read('loans',[BigInt(f.loanId)]);
 if(loan[5]===0n){if(loan[6]<loan[1]){const j=(i+1)%5;await tx(actors[j],'guarantee',[BigInt(f.loanId),loan[1]-loan[6]],{fixture:f})}await tx(actor,'activate',[BigInt(f.loanId)],{fixture:f})}
 f.status='accepted';await save();
}
const rejected=state.wallets[5];
if(!rejected.rejectionHash){
 assert.equal(await read('canBorrow',[rejected.memberId]),false);
 let failed=false;try{await client.simulateContract({address:state.protocol,abi,functionName:'requestLoan',args:[10000000n,1n],account:actors[5]})}catch(e){if(!String(e).includes('Not eligible'))throw e;failed=true}assert(failed,'Expected eligibility revert');
 // Explicit gas bypasses estimation so the test rejection has a real onchain receipt.
 rejected.rejectionHash=await wallet(actors[5]).writeContract({address:state.protocol,abi,functionName:'requestLoan',args:[10000000n,1n],gas:150000n,...fees});await save();
}
const denial=await client.waitForTransactionReceipt({hash:rejected.rejectionHash});assert.equal(denial.status,'reverted');rejected.status='rejected';rejected.reason='SCORE_BELOW_80';await save();
for(let i=0;i<2;i++){
 const f=state.wallets[i],id=BigInt(f.loanId);if(!(await read('loans',[id]))[8]){
  const quote=await read('payoff',[id]);const balance=await client.readContract({address:state.old.token,abi:tokenAbi,functionName:'balanceOf',args:[actors[i].address]});if(balance<quote+1000000n)await tx(actors[i],'faucet',[],{token:true,fixture:f});
  await tx(actors[i],'approve',[state.protocol,quote+1000000n],{token:true,fixture:f});const r=await tx(actors[i],'repayAll',[id,quote+1000000n],{fixture:f});f.repaymentHash=r.transactionHash;
 }f.repaid=true;await save();
}
for(let i=0;i<5;i++){const l=await read('loans',[BigInt(state.wallets[i].loanId)]);assert(l[5]>0n);assert.equal(l[8],i<2)}
assert.equal(await read('nextLoanId'),6n);assert.equal(await read('outstandingPrincipal'),150000000n);assert.equal((await read('members',[rejected.memberId]))[5],0n);
const result={protocol:state.protocol,chainId:10143,verifiedAt:new Date().toISOString(),status:'complete',syntheticScores:true,wallets:state.wallets};
await fs.writeFile(new URL('lib/test-scenarios.json',root),JSON.stringify(result,null,2)+'\n');
console.log('PASS: five loans, two repayments, three active; sixth wallet rejected onchain');
