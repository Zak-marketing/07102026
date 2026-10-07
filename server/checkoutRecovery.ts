import {createHash, randomBytes} from 'node:crypto';
import {mkdir, readdir, readFile, writeFile, unlink, stat} from 'node:fs/promises';
import path from 'node:path';
import {recoveryBucket,cloudRecoveryWrite,cloudRecoveryRead,cloudRecoveryDelete} from './recoveryCloudStorage.ts';

const TTL = 24 * 3600_000;
const MAX_CIPHER = 28 * 1024 * 1024;
export interface EncryptedCheckout {cipher: string; iv: string; encoding: 'json' | 'gzip'}
interface RecoveryRecord {session: string; owner: string; expires: number; encrypted: EncryptedCheckout}
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const folder = () => path.resolve(process.env.AURASLIM_DATA_DIR || '.auraslim-data', 'checkout-recovery');
const filename = (token: string) => path.join(folder(), hash(token) + '.json');
export function validEncryptedCheckout(value: unknown): value is EncryptedCheckout {
  const v = value as EncryptedCheckout | undefined;
  return !!v && typeof v.cipher === 'string' && v.cipher.length >= 24 && v.cipher.length <= MAX_CIPHER &&
    v.cipher.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(v.cipher) && typeof v.iv === 'string' && /^[a-f0-9]{24}$/.test(v.iv) && ['json', 'gzip'].includes(v.encoding);
}
export const newRecoveryToken = () => randomBytes(32).toString('hex');
export async function saveCheckoutRecovery(token: string, session: string, owner: string, encrypted: EncryptedCheckout) {
  if (!validToken(token) || !validEncryptedCheckout(encrypted)) throw new Error('Invalid encrypted recovery');
  const record: RecoveryRecord = {session, owner, encrypted, expires: Date.now() + TTL};
  if(recoveryBucket()) {await cloudRecoveryWrite(hash(token),JSON.stringify(record));return;}
  await mkdir(folder(), {recursive: true, mode: 0o700});
  // Expiry is enforced on reads and by periodic cleanup, including after restarts.
  const files = (await readdir(folder())).filter(f => /^[a-f0-9]{64}\.json$/.test(f));
  let count = 0, storedBytes=0;
  for (const file of files) {
    const filePath = path.join(folder(), file);
    try {const entry = JSON.parse(await readFile(filePath, 'utf8')) as RecoveryRecord;
      if (entry.expires <= Date.now()) await unlink(filePath);
      else {storedBytes+=(await stat(filePath)).size;if (entry.owner === owner) count++;}
    } catch {await unlink(filePath).catch(() => {});}
  }
  if (count >= 5) throw new Error('Recovery quota');
  if(storedBytes+encrypted.cipher.length>256*1024*1024)throw new Error('Recovery storage quota');
  await writeFile(filename(token), JSON.stringify(record), {mode: 0o600, flag: 'wx'});
}
export async function readCheckoutRecovery(token: unknown, session: string) {
  if (!validToken(token)) return null;
  let raw: string | null;
  if(recoveryBucket()) raw=await cloudRecoveryRead(hash(token));
  else {try {raw=await readFile(filename(token),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
  if(!raw)return null;
  let record: RecoveryRecord;
  try {record=JSON.parse(raw);}catch{return null;}
  if (record.expires <= Date.now()) {await removeCheckoutRecovery(token); return null;}
  return (!session || record.session === session) && validEncryptedCheckout(record.encrypted) ? record : null;
}
export async function removeCheckoutRecovery(token: unknown) {
  if (!validToken(token))return;
  if(recoveryBucket())await cloudRecoveryDelete(hash(token));
  else await unlink(filename(token)).catch(() => {});
}
// Remove expired local files even if no later checkout is made. Cloud Storage
// additionally needs a one-day object lifecycle rule on the backup bucket.
const cleanup=setInterval(async()=>{
  try {if(recoveryBucket())return;for(const file of (await readdir(folder())).filter(f=>/^[a-f0-9]{64}\.json$/.test(f))){const target=path.join(folder(),file);try{const entry=JSON.parse(await readFile(target,'utf8')) as RecoveryRecord;if(entry.expires<=Date.now())await unlink(target);}catch{}}}catch{}
},15*60_000);
cleanup.unref();
