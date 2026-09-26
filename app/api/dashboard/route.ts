import {createPublicClient,http,parseAbi,formatUnits,decodeEventLog,type Address} from 'viem';
import {monadTestnet} from 'viem/chains';
import config from '@/lib/deployment.json';
import abi from '@/lib/protocol-abi.json';
import scenarios from '@/lib/test-scenarios.json';
export const dynamic='force-dynamic';
const client=createPublicClient({chain:monadTestnet,batch:{multicall:{wait:20,batchSize:8192}},transport:http(config.rpc,{timeout:12000,retryCount:1})});
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)']);
const usd=(n:bigint)=>formatUnits(n,6);
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;const raw=params.get('page')||'1';const paymentBefore=params.get('paymentsBefore');if(paymentBefore&&!/^\d{1,12}$/.test(paymentBefore))return Response.json({error:'INVALID_BLOCK'},{status:400});if(!/^[1-9]\d{0,6}$/.test(raw))return Response.json({error:'INVALID_PAGE'},{status:400});
 try{
  const block=await client.getBlock();const blockNumber=block.number;
  const read=(fn:string,args:unknown[]=[])=>client.readContract({address:config.protocol as Address,abi,functionName:fn,args,blockNumber}) as Promise<any>;
  const [next,outstanding,phase,assets,totalShares,providerCount,pool]=await Promise.all([read('nextLoanId'),read('outstandingPrincipal'),read('phase'),read('poolAssets'),read('totalShares'),read('providerCount'),client.readContract({address:config.token as Address,abi:tokenAbi,functionName:'balanceOf',args:[config.protocol as Address],blockNumber})]);
  const providers=await Promise.all(Array.from({length:Math.min(10,Number(providerCount))},async(_,i)=>{const address=await read('liquidityProviders',[providerCount-1n-BigInt(i)]);const [shares,deposited]=await Promise.all([read('shares',[address]),read('deposits',[address])]);return{address,deposited:usd(deposited),ownership:totalShares>0n?Number(shares*100000000n/totalShares)/1000000:0,value:usd(totalShares>0n?BigInt(assets)*BigInt(shares)/BigInt(totalShares):0n)}}));
  const total=Number(next-1n),page=Number(raw),pageSize=10,pages=Math.max(1,Math.ceil(total/pageSize));if(page>pages)return Response.json({error:'INVALID_PAGE'},{status:400});
  const ids=Array.from({length:Math.min(pageSize,Math.max(0,total-(page-1)*pageSize))},(_,i)=>BigInt(total-(page-1)*pageSize-i));
  const loans=await Promise.all(ids.map(async id=>{
   const [l,schedule,quote,overdue,gs]=await Promise.all([read('loans',[id]),read('getSchedule',[id]),read('payoff',[id]),read('isOverdue',[id]),read('getGuarantors',[id])]);
   const member=await read('members',[l[0]]);
   const guarantors=await Promise.all(gs.map(async(g:string)=>{const [m,contribution]=await Promise.all([read('members',[g]),read('contributions',[id,g])]);return{address:m[0],contribution:usd(contribution)}}));
   const state=l[9]?'loss':l[8]?(l[5]>0n?'repaid':'cancelled'):l[10]?'default':overdue?'overdue':l[5]>0n?'active':block.timestamp>l[4]+604800n?'expired':'pending';
   return{id:Number(id),borrower:member[0],score:Number(member[1]),principal:usd(l[1]),outstanding:usd(l[2]),repaidPrincipal:usd(l[5]>0n?BigInt(l[1])-BigInt(l[2]):0n),payoff:usd(quote),months:Number(l[3]),createdAt:Number(l[4]),activatedAt:Number(l[5]),coverage:usd(l[6]),status:state,guarantors,schedule:schedule.map((s:any)=>({due:Number(s.due),principal:usd(s.principal),interest:usd(s.interest),penalty:usd(s.penalty),paid:s.principal+s.interest+s.penalty===0n}))};
  }));
  const fixture=scenarios as {protocol:string|null;wallets:any[]};const fixtureProfiles=fixture.protocol?.toLowerCase()===config.protocol.toLowerCase()?fixture.wallets:[];
  const fixtures=await Promise.all(fixtureProfiles.map(async f=>{
   const id=await read('memberOf',[f.address]);const member=await read('members',[id]);
   const activeId=BigInt(member[5]);const active=activeId>0n?await read('loans',[activeId]):null;
   return {...f,score:Number(member[1]),creditLimit:usd(member[2]),status:active?(active[5]>0n?'accepted':'pending'):f.status,loanId:activeId>0n?Number(activeId):f.loanId};
  }));
  // Bounded recent event window; lifetime repaid principal is read from contract state above.
  const requestedEnd=paymentBefore?BigInt(paymentBefore):blockNumber;const end=requestedEnd<blockNumber?requestedEnd:blockNumber;const first=BigInt(config.deploymentBlock);const from=end>first+999n?end-999n:first;let payments:any[]=[];let paymentError=false;
  try{const logs=[];for(let start=from;start<=end;start+=100n){const stop=start+99n<end?start+99n:end;logs.push(...await client.getLogs({address:config.protocol as Address,event:parseAbi(['event Payment(uint256 indexed loanId,address indexed payer,uint256 amount,uint256 principalPaid)'])[0],fromBlock:start,toBlock:stop}));if(stop<end)await new Promise(resolve=>setTimeout(resolve,150))}payments=logs.reverse().map(l=>({loanId:Number(l.args.loanId),payer:l.args.payer,amount:usd(l.args.amount!),principal:usd(l.args.principalPaid!),hash:l.transactionHash,block:Number(l.blockNumber)}))
   // Keep completed test repayments discoverable, verifying each receipt onchain.
   {for(const f of fixtures.filter(f=>f.repaymentHash)){
    if(payments.some(p=>p.hash===f.repaymentHash))continue;
    const receipt=await client.getTransactionReceipt({hash:f.repaymentHash});
    if(receipt.status!=='success'||receipt.to?.toLowerCase()!==config.protocol.toLowerCase())continue;
    for(const log of receipt.logs){if(log.address.toLowerCase()!==config.protocol.toLowerCase())continue;try{const decoded=decodeEventLog({abi:parseAbi(['event Payment(uint256 indexed loanId,address indexed payer,uint256 amount,uint256 principalPaid)']),data:log.data,topics:log.topics});payments.push({loanId:Number(decoded.args.loanId),payer:decoded.args.payer,amount:usd(decoded.args.amount),principal:usd(decoded.args.principalPaid),hash:receipt.transactionHash,block:Number(receipt.blockNumber)})}catch{}}
   }payments.sort((a,b)=>b.block-a.block)}
  }catch{paymentError=true}

  return Response.json({chainId:10143,protocol:config.protocol,token:config.token,block:Number(blockNumber),blockTime:Number(block.timestamp),observedAt:Date.now(),page,pages,total,pool:usd(pool),assets:usd(assets),providers,outstanding:usd(outstanding),phase:Number(phase),loans,payments,paymentError,paymentFromBlock:Number(from),paymentToBlock:Number(end),hasEarlierPayments:from>first,fixtures},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){console.error('Dashboard source error',e instanceof Error?e.message.slice(0,1000):'Unknown');return Response.json({error:'CHAIN_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
