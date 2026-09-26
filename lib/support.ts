/** Amounts use the token's smallest unit. Existing commitments consume capacity. */
export function supportAllocation(score:number,capacity:bigint,used:bigint,remaining:bigint){
 const scoreCap=BigInt(score>=40?500:score>=20?200:80)*1000000n;
 const available=capacity>used?capacity-used:0n;
 const free=available<scoreCap?available:scoreCap;
 return {scoreCap,available:free,amount:remaining<=0n?0n:remaining<free?remaining:free};
}
