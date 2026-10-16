import {fillSell} from './paper.ts';
export function tradeFocus(positions:any[]){return positions.find(p=>!p.closed)||positions[0]||null;}
export function tradeView(p:any,quotes:any[],now=Date.now()){
 const quote=quotes.find(q=>q.token===p.token);const fresh=quote&&Number.isFinite(quote.price)&&quote.price>0&&now-quote.quoteAt<=120000;
 return {token:p.token,symbol:p.symbol,cost:p.cost,entry:p.entry,stop:p.entry*.95,target:p.entry*1.1,opened:p.opened,closed:p.closed||null,reason:p.reason||null,currentPrice:fresh?quote.price:null,quoteStale:!fresh,pnl:p.closed?p.proceeds-p.cost:fresh?fillSell(p.quantity,quote.price)-p.cost:null,evidence:p.entry_evidence?JSON.parse(p.entry_evidence):null};
}
