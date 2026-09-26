import fs from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,parseAbi,formatUnits} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {monadTestnet} from 'viem/chains';
const config=JSON.parse(await fs.readFile(new URL('../lib/deployment.json',import.meta.url),'utf8'));
if(!config.deployed||config.chainId!==10143)throw new Error('Deploy to Monad Testnet first');
const {privateKey}=JSON.parse(await fs.readFile(process.env.DANK_DEPLOYER_FILE||'/Users/mete/.config/dank-monad/testnet-deployer.json','utf8'));
const account=privateKeyToAccount(privateKey);
if(account.address.toLowerCase()!==config.admin.toLowerCase())throw new Error('Wrong deployer');
const client=createPublicClient({chain:monadTestnet,transport:http(config.rpc)});
const wallet=createWalletClient({account,chain:monadTestnet,transport:http(config.rpc)});
if(await client.getChainId()!==10143)throw new Error('Wrong chain');
const abi=JSON.parse(await fs.readFile(new URL('../lib/protocol-abi.json',import.meta.url),'utf8'));
const tokenAbi=parseAbi(['function faucet()','function balanceOf(address) view returns (uint256)','function approve(address,uint256) returns (bool)','function symbol() view returns (string)']);
const read=(fn,args=[])=>client.readContract({address:config.protocol,abi,functionName:fn,args});
const tokenRead=(fn,args=[])=>client.readContract({address:config.token,abi:tokenAbi,functionName:fn,args});
const hashes=[];
async function send(fn,args=[],token=false){const simulated=await client.simulateContract({address:token?config.token:config.protocol,abi:token?tokenAbi:abi,functionName:fn,args,account});const hash=await wallet.writeContract(simulated.request);const r=await client.waitForTransactionReceipt({hash});if(r.status!=='success')throw new Error('Reverted '+hash);hashes.push({action:fn,hash});console.log(fn,hash)}
if(await tokenRead('symbol')!=='USD')throw new Error('Unexpected token');
const target=50000n*1000000n;
const deposited=await read('deposits',[account.address]);
if(deposited<target){if(await read('phase')!==0)throw new Error('Funding phase is already closed');const member=await read('memberOf',[account.address]);if(BigInt(member)===0n)await send('register');const remaining=target-deposited;let current=await tokenRead('balanceOf',[account.address]);while(current<remaining){await send('faucet',[],true);current=await tokenRead('balanceOf',[account.address])}await send('approve',[config.protocol,remaining],true);await send('depositCapital',[remaining])}
if(await read('phase')===0)await send('startLending');
const result={chainId:10143,token:config.token,protocol:config.protocol,funder:account.address,deposited:formatUnits(await read('deposits',[account.address]),6),poolBalance:formatUnits(await tokenRead('balanceOf',[config.protocol]),6),phase:Number(await read('phase')),verifiedAt:new Date().toISOString(),transactions:hashes};
await fs.writeFile(new URL('../lib/pool-bootstrap.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
