// Only loaded by the integration-test child. Production never imports this file.
const token='So11111111111111111111111111111111111111112';
globalThis.fetch=async (url:any)=>{const value=String(url);if(value.endsWith('token-profiles/latest/v1'))return Response.json([{chainId:'solana',tokenAddress:token}]);if(value.includes('tokens/v1/solana/'))return Response.json([{baseToken:{address:token,symbol:'FIXTURE'},priceUsd:'2',liquidity:{usd:100000},volume:{h24:200000},priceChange:{m5:3}}]);throw Error('Unexpected test request');};
