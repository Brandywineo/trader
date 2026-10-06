import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {hashPassword} from './security.ts';
if(existsSync('.env')) throw new Error('.env already exists; refusing to overwrite encryption key.');
const rl=createInterface({input:process.stdin,output:process.stdout});
const origin=await rl.question('HTTPS app origin (for local testing http://localhost:9010): ');
const url=new URL(origin); if(!['http:','https:'].includes(url.protocol)||url.origin!==origin) throw new Error('Enter an origin without trailing slash or path.');
// Generate rather than echo an entered password through terminal input.
const password=randomBytes(18).toString('base64url');
writeFileSync('.env',`HOST=127.0.0.1\nPORT=9010\nAPP_ORIGIN=${origin}\nOWNER_PASSWORD_HASH=${hashPassword(password)}\nENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nDATA_DIR=./data\n`,{mode:0o600});
console.log('Owner password (store securely):',password);rl.close();
