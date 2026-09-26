/** Amounts use the token's smallest unit. Existing commitments consume capacity. */
export function supportAllocation(score:number,capacity:bigint,used:bigint,remaining:bigint){
 const scoreCap=BigInt(score>=95?500:score>=90?200:score>=80?80:0)*1000000n;
 const totalCapacity=capacity<scoreCap?capacity:scoreCap;
 const available=totalCapacity>used?totalCapacity-used:0n;
 return {scoreCap,totalCapacity,available,amount:remaining<=0n?0n:remaining<available?remaining:available};
}
