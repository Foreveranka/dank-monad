/** Versioned pilot policy. Inputs must come from verified Monad mainnet data, never client claims. */
export const SCORE_VERSION='dank-v2-first-podium';
export const CAPS={hackathon:20,history:10,volume:10,balance:10,swaps:10,lending:10,repayment:20,liquidity:10} as const;
export type WalletMetric=Exclude<keyof typeof CAPS,'hackathon'>;
export type WalletEvidence={chainId:number;observedAt:number;complete:boolean;source:string;metrics:Partial<Record<WalletMetric,number>>;defaulted:boolean;overdue:boolean;liquidations:number;suspicious:boolean};
// Metric values: active months, eligible USD volume (90d), median daily net assets USD (90d),
// qualified swap weeks, lending USD-days, seasoned repaid loans, LP/staking USD-days.
const thresholds:Record<WalletMetric,readonly number[]>={history:[1,3,6,12],volume:[100,1000,10000,50000],balance:[25,100,500,2000],swaps:[2,4,8,12],lending:[300,3000,15000,60000],repayment:[1,2,4,8],liquidity:[300,3000,15000,60000]};
export function evaluateWallet(e:WalletEvidence,now=Date.now()){
 const fresh=Number.isFinite(e.observedAt)&&e.observedAt<=now&&now-e.observedAt<=7*86400000;
 const valid=e.chainId===143&&fresh&&e.complete&&!!e.source&&Number.isInteger(e.liquidations)&&e.liquidations>=0;
 const breakdown=(Object.keys(thresholds) as WalletMetric[]).map(key=>{const value=e.metrics[key];const known=valid&&typeof value==='number'&&Number.isFinite(value)&&value>=0;const tier=known?thresholds[key].filter(t=>value!>=t).length:0;return {key,cap:CAPS[key],points:known?Math.floor(tier/4*CAPS[key]):null,value:known?value:null}});
 const covered=breakdown.filter(x=>x.points!==null).length;
 const subtotal=breakdown.reduce((sum,x)=>sum+(x.points??0),0);
 const penalty=Number.isFinite(e.liquidations)?Math.min(20,Math.max(0,e.liquidations)*5):20;
 const blocked=e.defaulted||e.overdue;
 const review=e.suspicious||!valid||covered!==breakdown.length;
 return {version:SCORE_VERSION,breakdown,covered,totalMetrics:breakdown.length,subtotal,penalty,points:Math.max(0,subtotal-penalty),cap:80,eligible:!blocked&&!review,blocked,review,creditScore:blocked||review?null:Math.max(0,subtotal-penalty)};
}
export function hackathonPoints(rank:number){if(!Number.isInteger(rank)||rank<0||rank>3)throw new Error('Invalid placement');return [1,20,10,5][rank]}
export function nextHackathonScore(current:number,firstPodiumClaimed:boolean,rank:number){const proposed=hackathonPoints(rank);return {points:firstPodiumClaimed?current:Math.max(current,proposed),firstPodiumClaimed:firstPodiumClaimed||rank>0}}
