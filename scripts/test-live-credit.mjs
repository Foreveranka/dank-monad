import fs from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,parseEther,parseAbi,formatUnits} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {monadTestnet} from 'viem/chains';
const cfg=JSON.parse(await fs.readFile(new URL('../lib/deployment.json',import.meta.url),'utf8'));
const abi=JSON.parse(await fs.readFile(new URL('../lib/protocol-abi.json',import.meta.url),'utf8'));
const client=createPublicClient({chain:monadTestnet,transport:http(cfg.rpc)});
if(await client.getChainId()!==10143)throw new Error('Wrong chain');
const adminKey=JSON.parse(await fs.readFile('/Users/mete/.config/dank-monad/testnet-deployer.json','utf8')).privateKey;
const admin=privateKeyToAccount(adminKey);const adminWallet=createWalletClient({account:admin,chain:monadTestnet,transport:http(cfg.rpc)});
const keyPath='/Users/mete/.config/dank-monad/smoke-wallets.json';let keys;try{keys=JSON.parse(await fs.readFile(keyPath,'utf8'))}catch{keys={borrower:generatePrivateKey(),guarantor:generatePrivateKey()};await fs.writeFile(keyPath,JSON.stringify(keys),{mode:0o600})}
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function approve(address,uint256) returns(bool)','function faucet()']);
const read=(fn,args=[])=>client.readContract({address:cfg.protocol,abi,functionName:fn,args});const accounts=Object.entries(keys).map(([role,key])=>({role,account:privateKeyToAccount(key)}));
const ledger='/Users/mete/Documents/Yarisma-Cuzdanlari/CUZDANLAR.md';let ledgerText=await fs.readFile(ledger,'utf8');
for(const {role,account} of accounts){if(!ledgerText.includes(account.address)){await fs.appendFile(ledger,`\n- DANK ${role} smoke-test wallet: ${account.address}. Monad TESTNET, chain ID 10143. Verification: ${new Date().toISOString().slice(0,10)}. Test transaction signer only, not a prize or user payout wallet. Local key file: ${keyPath}.\n`)}if(await client.getBalance({address:account.address})<parseEther('0.1')){const h=await adminWallet.sendTransaction({to:account.address,value:parseEther('0.15'),gas:100000n});if((await client.waitForTransactionReceipt({hash:h})).status!=='success')throw new Error('Gas funding failed')}}
const hashes=[];async function send(actor,fn,args=[],token=false){const wallet=createWalletClient({account:actor,chain:monadTestnet,transport:http(cfg.rpc)});const sim=await client.simulateContract({address:token?cfg.token:cfg.protocol,abi:token?tokenAbi:abi,functionName:fn,args,account:actor});const hash=await wallet.writeContract({...sim.request,maxFeePerGas:150000000000n,maxPriorityFeePerGas:2000000000n});const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error(fn+' reverted');hashes.push({action:fn,hash});console.log(fn,hash)}
const borrower=accounts.find(x=>x.role==='borrower').account;const guarantor=accounts.find(x=>x.role==='guarantor').account;
for(const account of [borrower,guarantor])if(BigInt(await read('memberOf',[account.address]))===0n)await send(account,'register');
const member=await read('members',[await read('memberOf',[borrower.address])]);let loanId=member[5];
if(loanId===0n){await send(borrower,'requestLoan',[10n*1000000n,1n]);loanId=(await read('members',[await read('memberOf',[borrower.address])]))[5]}
let loan=await read('loans',[loanId]);
if(loan[5]===0n){if(loan[6]===0n)await send(guarantor,'guarantee',[loanId,10n*1000000n]);await send(borrower,'activate',[loanId])}
const quote=await read('payoff',[loanId]);
const balance=await client.readContract({address:cfg.token,abi:tokenAbi,functionName:'balanceOf',args:[borrower.address]});if(balance<quote+100000n)await send(borrower,'faucet',[],true);
await send(borrower,'approve',[cfg.protocol,quote+100000n],true);await send(borrower,'repayAll',[loanId,quote+100000n]);
loan=await read('loans',[loanId]);if(!loan[8])throw new Error('Loan not closed');
const pool=await client.readContract({address:cfg.token,abi:tokenAbi,functionName:'balanceOf',args:[cfg.protocol]});
const result={chainId:10143,borrower:borrower.address,guarantor:guarantor.address,loanId:loanId.toString(),closed:loan[8],poolUSD:formatUnits(pool,6),transactions:hashes};await fs.writeFile(new URL('../lib/live-test-receipt.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
