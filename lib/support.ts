/** Amounts use the token's smallest unit. Existing commitments consume capacity. */
export function supportAllocation(score:number,capacity:bigint,used:bigint,remaining:bigint){
 const scoreCap=BigInt(score>=95?500:score>=90?200:score>=80?80:0)*1000000n;
 const available=capacity>used?capacity-used:0n;
 const free=available<scoreCap?available:scoreCap;
 return {scoreCap,available:free,amount:remaining<=0n?0n:remaining<free?remaining:free};
}
