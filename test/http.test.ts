import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomBytes} from 'node:crypto';import {once} from 'node:events';import {hashPassword} from '../src/security.ts';
test('HTTP owner boundary, secret redaction, settings and start safety',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'trader-test-'));const port=19000+Math.floor(Math.random()*10000),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','./test/mock-feed.ts','src/server.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_ORIGIN:origin,OWNER_PASSWORD_HASH:hashPassword('test-password'),ENCRYPTION_KEY:randomBytes(32).toString('hex'),DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
 try{await new Promise<void>((ok,no)=>{const timeout=setTimeout(()=>no(Error('Startup timed out '+stderr)),5000);child.once('exit',()=>{clearTimeout(timeout);no(Error('Startup failed '+stderr))});child.stdout.on('data',b=>{if(b.toString().includes('listening')){clearTimeout(timeout);ok()}})});
 const post=(path:string,body:any,headers:any={})=>fetch(origin+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(origin+'/api/state')).status,401);
 const publicPage=await(await fetch(origin+'/')).text();assert(publicPage.includes('AGENT OPERATIONS FLOOR'));assert(!publicPage.includes('id="password"'));
 const ownerPage=await(await fetch(origin+'/owner')).text();assert(ownerPage.includes('Owner sign in'));
 const publicInitial=await(await fetch(origin+'/api/public')).json();assert.equal(publicInitial.mode,'paper');assert.equal(publicInitial.running,false);assert(!('connections' in publicInitial));assert(!('settings' in publicInitial));assert(!('csrf' in publicInitial));
 assert.equal((await post('login',{password:'test-password'},{Origin:'https://evil.test'})).status,403);
 assert.equal((await post('login',{password:'wrong'})).status,401);
 const login=await post('login',{password:'test-password'});assert.equal(login.status,200);const csrf=(await login.json()).csrf;const cookie=login.headers.get('set-cookie')!.split(';')[0];assert(login.headers.get('set-cookie')!.includes('HttpOnly'));
 const auth={Cookie:cookie,'X-CSRF-Token':csrf};assert.equal((await post('stop',{}, {Cookie:cookie})).status,403);
 const secret='test-secret-do-not-return';assert.equal((await post('connections',{name:'jev',key:secret},auth)).status,200);
 let state=await(await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(state.connections.find((x:any)=>x.name==='jev').configured,true);assert(!JSON.stringify(state).includes(secret));
 const publicAfterKey=await(await fetch(origin+'/api/public')).json();assert(!JSON.stringify(publicAfterKey).includes(secret));assert(!JSON.stringify(publicAfterKey).includes('credential'));assert(!('connections' in publicAfterKey));assert(!readFileSync(join(dir,'trader.db')).includes(Buffer.from(secret)));
 assert.equal((await post('settings',{aiEnabled:true,aiDailyLimit:2},auth)).status,200);
 assert.equal((await post('start',{mode:'paper'},auth)).status,400); // Untested credential cannot start paid scoring.
 assert.equal((await post('start',{mode:'live'},auth)).status,400);
 assert.equal((await post('settings',{aiEnabled:false,aiDailyLimit:-1},auth)).status,400);
 assert.equal((await post('settings',{aiEnabled:false,aiDailyLimit:0},auth)).status,200);
 assert.equal((await post('start',{mode:'paper'},auth)).status,200);
 await new Promise(r=>setTimeout(r,100));
 const running=await(await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(running.running,true);assert.equal(running.positions.length,1);assert.equal(running.settings.cash,975);assert.equal(running.aiCallsToday,0);
 const publicRunning=await(await fetch(origin+'/api/public')).json();assert.equal(publicRunning.openPositions.length,1);assert.equal(publicRunning.history.length,1);assert.equal(publicRunning.history[0].symbol,'FIXTURE');assert.equal(publicRunning.scanned,1);assert(publicRunning.visualEvents.some((e:any)=>e.role==='scan'));assert(publicRunning.visualEvents.some((e:any)=>e.role==='vet'));assert(publicRunning.visualEvents.some((e:any)=>e.role==='fills'));assert(publicRunning.visualEvents.every((e:any,i:number,a:any[])=>i===0||e.id>a[i-1].id));assert(!('token' in publicRunning.openPositions[0]));assert(!('aiCallsToday' in publicRunning));
 assert.equal((await post('start',{mode:'paper'})).status,401);
 assert.equal((await post('connections',{name:'jev',key:'changed'},auth)).status,409);
 assert.equal((await post('stop',{},auth)).status,200);
 assert.equal((await post('connections/delete',{name:'jev'},auth)).status,200);
 state=await(await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(state.running,false);assert.equal(state.aiCallsToday,0);
 assert.equal((await post('logout',{},auth)).status,200);assert.equal((await fetch(origin+'/api/state',{headers:{Cookie:cookie}})).status,401);
 }finally{const exited=once(child,'exit');child.kill('SIGTERM');await exited;rmSync(dir,{recursive:true,force:true});}
});
