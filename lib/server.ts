import {env} from 'cloudflare:workers';
import {isAddress,keccak256,toBytes,verifyMessage,type Address} from 'viem';
export function database(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new Error('DATABASE_UNAVAILABLE');return db}
export function validOrigin(r:Request){const origin=r.headers.get('origin');return !origin||origin===new URL(r.url).origin}
export const payloadHash=(action:string,data:unknown)=>keccak256(toBytes(JSON.stringify({action,data})));
export async function authenticated(r:Request,body:any){if(!validOrigin(r)||!isAddress(body.wallet)||typeof body.signature!=='string'||typeof body.id!=='string')throw new Error('AUTH_FAILED');const db=database();const row=await db.prepare('SELECT * FROM challenges WHERE id = ? AND wallet = ? AND expires > ?').bind(body.id,body.wallet.toLowerCase(),Date.now()).first<{message:string}>();if(!row)throw new Error('AUTH_FAILED');const suffix='Action digest: '+payloadHash(body.action,body.data);if(!row.message.endsWith(suffix)||!await verifyMessage({address:body.wallet as Address,message:row.message,signature:body.signature as `0x${string}`}))throw new Error('AUTH_FAILED');const consumed=await db.prepare('DELETE FROM challenges WHERE id = ? RETURNING id').bind(body.id).first();if(!consumed)throw new Error('AUTH_FAILED');return body.wallet.toLowerCase() as Address;}
export const clean=(x:unknown,max=500)=>typeof x==='string'?x.trim().slice(0,max):'';
export function safeUrl(x:unknown){const value=clean(x,1000);try{const u=new URL(value);return u.protocol==='https:'?value:''}catch{return ''}}
