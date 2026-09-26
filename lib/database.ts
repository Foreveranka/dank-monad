import {neon} from '@neondatabase/serverless';
function connection(){const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_UNAVAILABLE');return neon(url)}
class Statement {
 constructor(readonly text:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new Statement(this.text,values)}
 query(){let i=0;const text=this.text.replace(/\?/g,()=>'$'+(++i));return connection().query(text,this.values)}
 async first<T=Record<string,unknown>>(){const rows=await this.query();return (rows[0] as T)||null}
 async all(){return {results:await this.query()}}
 async run(){await this.query();return {success:true}}
}
export function database(){return {prepare:(text:string)=>new Statement(text),batch:(statements:Statement[])=>connection().transaction(statements.map(s=>s.query()))}}
