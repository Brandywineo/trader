export const providerNames=['jev','openai','grok','x','solana'] as const;
export type Provider=typeof providerNames[number];
const endpoints={jev:'https://api.typesafe.ai/v1/models',openai:'https://api.openai.com/v1/models',grok:'https://api.x.ai/v1/models',x:'https://api.x.com/2/users/me',solana:'https://api.mainnet-beta.solana.com'};
export async function testConnection(provider:Provider, key:string) {
  // Fixed destinations prevent user-controlled server-side requests. RPC key support
  // is intentionally deferred; this probe only tests the public Solana endpoint.
  if(provider==='solana') {const r=await fetch(endpoints.solana,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getHealth'}),signal:AbortSignal.timeout(10000)}); const j:any=await r.json();return {ok:r.ok&&j.result==='ok',message:'Public RPC health probe; custom paid RPC adapter not implemented'};}
  const r=await fetch(endpoints[provider],{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
  return {ok:r.ok,message:provider==='x'?'Authenticated-user probe; requires suitable X user token/scopes. No post collection implemented.':r.ok?'Credential accepted by models endpoint; this does not verify paid inference credit.':`Provider rejected connection (HTTP ${r.status})`};
}
export async function scoreJev(key:string, state:unknown) {
 const r=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'jev-latest',state,questions:{watch:{type:'noul',instructions:'Based ONLY on this market snapshot, does it meet a speculative momentum watchlist criterion: positive five-minute price change, liquidity at least 50000 USD, and daily volume at least 100000 USD? Missing facts count as no. This is not a contract safety assessment.'}}}),signal:AbortSignal.timeout(15000)});
 if(!r.ok) throw new Error(`Jev HTTP ${r.status}`); const j:any=await r.json();const score=j.answers?.watch?.noul;
 if(!Number.isFinite(score)||score<0||score>1) throw new Error('Invalid Jev response');return {score,usage:j.usage};
}
