import {SOL,gecko} from './market-chart.ts';
import {validWallet,USDC} from './wallet.ts';
import {safeFailure} from './pools.ts';
const reserves=new Set([SOL,USDC]);
// Identity is the mint and pool address, never the token symbol or pool name.
export function poolIdentities(payload:any){
 if(!Array.isArray(payload?.data)||!Array.isArray(payload?.included))throw Error('Invalid pool response');
 const metadata=new Map(payload.included.filter((x:any)=>x.type==='token').map((x:any)=>[x.id,x.attributes?.address]));
 const pools=new Map<string,Set<string>>();let rejected=0;
 for(const p of payload.data){
  const address=p.attributes?.address;
  const token=(role:string)=>{const id=p.relationships?.[role+'_token']?.data?.id;const mint=typeof id==='string'&&id.startsWith('solana_')?id.slice(7):null;return validWallet(mint)&&metadata.get(id)===mint?mint:null;};
  const base=token('base'),quote=token('quote');
  if(p.type!=='pool'||!validWallet(address)||p.id!=='solana_'+address||!base||!quote){rejected++;continue;}
  const mint=reserves.has(base)?quote:base;if(reserves.has(mint))continue;
  if(!pools.has(mint))pools.set(mint,new Set());pools.get(mint)!.add(address);
 }
 return {pools,rejected};
}
export function poolMatches(pair:any,pools:Map<string,Set<string>>){const allowed=pools.get(pair.baseToken?.address);return !allowed||(pair.chainId==='solana'&&allowed.has(pair.pairAddress));}
// Sources are interleaved, then a bounded six-hour list rotates through fresh quote batches.
export class Discovery {
 remembered=new Map<string,number>();poolIds=new Map<string,Set<string>>();cursor=0;refreshed=0;sources:any[]=[];
 async read(market:(path:string)=>Promise<any>,now=Date.now(),poolFeed:(path:string)=>Promise<any>=gecko){
  if(!this.refreshed||now-this.refreshed>=300000){
   const paths=['token-profiles/latest/v1','token-profiles/recent-updates/v1','networks/solana/trending_pools?include=base_token,quote_token&page=1','networks/solana/pools?include=base_token,quote_token&page=1'];
   const results=await Promise.allSettled(paths.map((p,i)=>i<2?market(p):poolFeed(p)));
   const freshPools=new Map<string,Set<string>>();
   const lists=results.map((r,i)=>{const source=i<2?'dexscreener/'+paths[i]:'geckoterminal/'+paths[i].split('?')[0];
    if(r.status==='rejected'){this.sources[i]={source,status:safeFailure(r.reason),tokens:0};return [];}
    try{let tokens:string[],rejected=0;
     if(i<2){if(!Array.isArray(r.value))throw Error('Invalid profile response');tokens=[...new Set(r.value.filter((p:any)=>p.chainId==='solana').map((p:any)=>p.tokenAddress).filter(validWallet))] as string[];}
     else{const parsed=poolIdentities(r.value);tokens=[...parsed.pools.keys()];rejected=parsed.rejected;for(const [t,ids]of parsed.pools){if(!freshPools.has(t))freshPools.set(t,new Set());for(const id of ids)freshPools.get(t)!.add(id);}}
     this.sources[i]={source,status:'ok',tokens:tokens.length,rejected};return tokens;
    }catch(e){this.sources[i]={source,status:safeFailure(e),tokens:0};return [];}
   });
   for(const [t,ids]of freshPools)this.poolIds.set(t,ids);
   for(let n=0;n<Math.max(...lists.map(l=>l.length));n++)for(const list of lists)if(list[n])this.remembered.set(list[n],now);
   for(const [t,at]of this.remembered)if(now-at>21600000){this.remembered.delete(t);this.poolIds.delete(t);}
   while(this.remembered.size>180){const t=this.remembered.keys().next().value!;this.remembered.delete(t);this.poolIds.delete(t);}
   this.refreshed=now;
  }
  const all=[...this.remembered.keys()];const tokens=Array.from({length:Math.min(90,all.length)},(_,i)=>all[(this.cursor+i)%all.length]);this.cursor=all.length?(this.cursor+90)%all.length:0;
  return {tokens,sources:this.sources,remembered:all.length,pools:this.poolIds};
 }
}
export const batches=(tokens:string[],size=30)=>Array.from({length:Math.ceil(tokens.length/size)},(_,i)=>tokens.slice(i*size,(i+1)*size));
