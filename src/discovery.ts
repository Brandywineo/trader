import {validAddress} from './market-chart.ts';
import {safeFailure} from './pools.ts';
// Each source has equal opportunity; remembered candidates rotate instead of disappearing.
export class Discovery {
  remembered=new Map<string,number>(); cursor=0; refreshed=0; sources:any[]=[];
  async read(market:(path:string)=>Promise<any>,now=Date.now()) {
    if(!this.refreshed||now-this.refreshed>=300000){
      const paths=['token-profiles/latest/v1','token-profiles/recent-updates/v1','latest/dex/search?q=SOL'];
      const results=await Promise.allSettled(paths.map(p=>market(p)));
      const lists=results.map((r,i)=>{if(r.status==='rejected'){this.sources[i]={source:paths[i],status:safeFailure(r.reason),tokens:0};return [];}
        const rows=i===2?r.value?.pairs:r.value;
        if(!Array.isArray(rows)){this.sources[i]={source:paths[i],status:'invalid_response',tokens:0};return [];}
        const tokens=[...new Set(rows.filter((p:any)=>p.chainId==='solana').map((p:any)=>i===2?p.baseToken?.address:p.tokenAddress).filter(validAddress))] as string[];
        this.sources[i]={source:paths[i],status:'ok',tokens:tokens.length};return tokens;});
      for(let n=0;n<Math.max(...lists.map(l=>l.length));n++)for(const list of lists)if(list[n])this.remembered.set(list[n],now);
      for(const [t,at]of this.remembered)if(now-at>21600000)this.remembered.delete(t);
      while(this.remembered.size>180)this.remembered.delete(this.remembered.keys().next().value!);
      this.refreshed=now;
    }
    const all=[...this.remembered.keys()];const tokens=Array.from({length:Math.min(90,all.length)},(_,i)=>all[(this.cursor+i)%all.length]);this.cursor=all.length?(this.cursor+90)%all.length:0;
    return {tokens,sources:this.sources,remembered:all.length};
  }
}
export const batches=(tokens:string[],size=30)=>Array.from({length:Math.ceil(tokens.length/size)},(_,i)=>tokens.slice(i*size,(i+1)*size));
