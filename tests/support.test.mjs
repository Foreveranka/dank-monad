import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportAllocation} from '../lib/support.ts';
const usd=n=>BigInt(n)*1000000n;
const allocate=(score,used,need,capacity=500)=>supportAllocation(score,usd(capacity),usd(used),usd(need));
test('existing commitments consume the total score allowance',()=>{
 assert.equal(allocate(83,400,330).amount,0n);
 assert.equal(allocate(83,30,330).amount,usd(50));
 assert.equal(allocate(83,80,330).amount,0n);
});
test('all tier boundaries respect the 80-point minimum',()=>{
 for(const [score,cap] of [[0,0],[79,0],[80,80],[89,80],[90,200],[94,200],[95,500],[100,500]])assert.equal(allocate(score,0,500).amount,usd(cap));
});
test('multiple loans cannot multiply support capacity',()=>{
 const first=allocate(83,0,50).amount;
 const second=supportAllocation(83,usd(500),first,usd(50)).amount;
 assert.equal(first+second,usd(80));
 assert.equal(supportAllocation(83,usd(500),first+second,usd(50)).amount,0n);
});
test('lower assigned limit and remaining loan need still apply',()=>{
 assert.equal(allocate(100,20,500,80).amount,usd(60));
 assert.equal(allocate(100,20,15).amount,usd(15));
 assert.equal(allocate(100,0,0).amount,0n);
});
