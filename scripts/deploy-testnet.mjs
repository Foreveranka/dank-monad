import fs from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {monadTestnet} from 'viem/chains';
// A local key file outside source control, never read from a web route or exported to the frontend.
const file=process.env.DANK_DEPLOYER_FILE || '/Users/mete/.config/dank-monad/testnet-deployer.json';
const keyFile=JSON.parse(await fs.readFile(file,'utf8'));
const account=privateKeyToAccount(keyFile.privateKey);
const path=new URL('../lib/deployment.json',import.meta.url);
const config=JSON.parse(await fs.readFile(path,'utf8'));
if(account.address.toLowerCase()!==config.admin.toLowerCase())throw new Error('Wrong deployer wallet');
const client=createPublicClient({chain:monadTestnet,transport:http(config.rpc)});
const wallet=createWalletClient({account,chain:monadTestnet,transport:http(config.rpc)});
if(await client.getChainId()!==10143)throw new Error('Wrong network; only Monad Testnet allowed');
const balance=await client.getBalance({address:account.address});
if(balance===0n)throw new Error('Test MON required for deployment: '+account.address);
console.log('Deployer:',account.address,'Test MON:',formatEther(balance));
async function deploy(name,args){const artifact=JSON.parse(await fs.readFile(new URL('../contracts/out/'+name+'.sol/'+name+'.json',import.meta.url),'utf8'));const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode.object,args});console.log(name,'transaction:',hash);const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success'||!receipt.contractAddress)throw new Error('Deployment failed');return receipt.contractAddress}
async function checkpoint(){await fs.writeFile(path,JSON.stringify(config,null,2)+'\n')}
if(!config.token){config.token=await deploy('TestUSD',[]);await checkpoint()}
if(!config.protocol){config.protocol=await deploy('Dank',[config.token,account.address]);await checkpoint()}
if(!await client.getCode({address:config.token})||!await client.getCode({address:config.protocol}))throw new Error('Contract missing');
config.deployed=true;await checkpoint();console.log('Monad testnet contracts ready:',config.protocol,config.token);
