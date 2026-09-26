import type {EIP1193Provider} from 'viem';
type Network={chainId:number;rpc:string;explorer:string};
function errors(error:unknown):Record<string,unknown>[] {
 const result:Record<string,unknown>[]=[];const seen=new Set<unknown>();
 function visit(value:unknown){if(!value||typeof value!=='object'||seen.has(value)||result.length>=20)return;seen.add(value);const e=value as Record<string,unknown>;result.push(e);for(const key of ['cause','data','originalError','error'])visit(e[key]);}
 visit(error);return result;
}
export async function switchToTestnet(p:EIP1193Provider,network:Network){
 const chainId='0x'+network.chainId.toString(16);
 const matches=(value:unknown)=>{try{return BigInt(String(value))===BigInt(network.chainId)}catch{return false}};
 if(matches(await p.request({method:'eth_chainId'})))return;
 const switchChain=()=>p.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
 try{await switchChain()}catch(error){
  const nested=errors(error);
  // A rejected wallet prompt must never trigger another prompt automatically.
  if(nested.some(e=>Number(e.code)===4001))throw error;
  const unknown=nested.some(e=>Number(e.code)===4902||/unrecognized chain|unknown chain|chain.*not (?:been )?added|chain.*not configured/i.test(String(e.message||'')));
  if(!unknown)throw error;
  await p.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:'Monad Testnet',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:[network.rpc],blockExplorerUrls:[network.explorer]}]});
  // Adding a chain does not imply the wallet has selected it.
  if(!matches(await p.request({method:'eth_chainId'})))await switchChain();
 }
 if(!matches(await p.request({method:'eth_chainId'})))throw new Error('Please select Monad Testnet (10143) in your wallet and retry.');
}
