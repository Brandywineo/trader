import {createHash} from 'node:crypto';
// Coarse buckets prevent minor quote noise from triggering another paid evaluation.
export function fingerprint(state:any){const m=state.market;return createHash('sha256').update(JSON.stringify({token:m.token,price:Math.round(Math.log(m.price)*20),liquidity:Math.round(Math.log(m.liquidity)*10),volume:Math.round(Math.log(m.volume)*10),change:Math.round(m.change/2),chain:state.chain,social:state.social})).digest('hex');}
export function reuseDecision(previous:any,hash:string,now=Date.now()){
 if(!previous)return 'new';
 const age=now-previous.at;
 if(age<1800000&&previous.fingerprint===hash&&Number.isFinite(previous.score))return 'cached';
 if(age<900000)return 'cooldown';
 return 'new';
}
export function scoreThreshold(input:unknown){if(typeof input!=='number'||!Number.isFinite(input)||input<0.5||input>1)throw Error('AI threshold must be between 0.5 and 1');return input;}
