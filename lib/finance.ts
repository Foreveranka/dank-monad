export function paymentPlan(principal:number,months:number,apr=15,start=new Date()){
 if(!Number.isFinite(principal)||principal<=0||principal>1000||!Number.isInteger(months)||months<1||months>12||!Number.isFinite(apr)||apr<0||apr>20)throw new Error('Invalid loan terms');
 const i=apr/1200,installment=i===0?principal/months:principal*i/(1-Math.pow(1+i,-months));let balance=principal;
 return Array.from({length:months},(_,n)=>{const interest=balance*i,capital=n===months-1?balance:installment-interest;balance-=capital;const due=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+n+2,0,start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds()));due.setUTCDate(Math.min(start.getUTCDate(),due.getUTCDate()));return {number:n+1,due:due.toISOString(),principal:capital,interest,total:capital+interest,balance:Math.max(0,balance)}});
}
