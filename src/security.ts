import { randomBytes, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
export function hashPassword(password: string) { const salt=randomBytes(16).toString('hex'); return salt+':'+scryptSync(password,salt,64).toString('hex'); }
export function verifyPassword(password: string, stored: string) { const [salt,hash]=stored.split(':'); if(!salt || !hash) return false; const a=Buffer.from(hash,'hex'),b=scryptSync(password,salt,64); return a.length===b.length && timingSafeEqual(a,b); }
export function encrypt(value: string, key: Buffer) { const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key,iv); const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64')).join('.'); }
export function decrypt(value: string, key: Buffer) { const [iv,tag,body]=value.split('.').map(x=>Buffer.from(x,'base64')); const cipher=createDecipheriv('aes-256-gcm',key,iv); cipher.setAuthTag(tag); return Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8'); }
export function validOrigin(origin: string|undefined, expected: string) { return origin===expected; }
