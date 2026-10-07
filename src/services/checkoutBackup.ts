import type {NutritionEntry, ReminderSetting, UserProfile, WeeklyPhoto, WeightEntry} from '../types';
import {STORAGE_KEYS} from './storage';
import {DAY_END_KEY} from './dailyGoals';
import {writeLocalSnapshot} from './localDatabase';

export interface CheckoutSnapshot {
  version: 1; profile: UserProfile; weights: WeightEntry[]; photos: WeeklyPhoto[];
  nutrition: NutritionEntry[]; reminders: ReminderSetting[];
  local: Record<string,string>;
}
export interface RecoverySecret {token: string; key: string; session: string}
export const RECOVERY_SECRET_KEY = 'auraslim_checkout_recovery_secret';
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
const unhex = (value: string) => Uint8Array.from(value.match(/../g)!, b => parseInt(b,16));
const toBase64 = (data: Uint8Array) => {let text=''; for(let i=0;i<data.length;i+=8192) text+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(text);};
const fromBase64 = (data: string) => Uint8Array.from(atob(data), c => c.charCodeAt(0));

export function checkoutSnapshot(profile: UserProfile, weights: WeightEntry[], photos: WeeklyPhoto[], nutrition: NutritionEntry[], reminders: ReminderSetting[], storage: Storage): CheckoutSnapshot {
  const local: Record<string,string> = {};
  for (const key of [STORAGE_KEYS.WATER_LOGS, STORAGE_KEYS.COLOR_MODE, DAY_END_KEY, 'auraslim_verified_sessions', 'auraslim_verified_session', `auraslim_inbody_scans_${profile.id}`]) {
    const value=storage.getItem(key); if(value!==null) local[key]=value;
  }
  return {version:1, profile:{...profile, plan:'free', isAdmin:false}, weights, photos, nutrition, reminders, local};
}
export async function encryptCheckoutSnapshot(snapshot: CheckoutSnapshot) {
  if (!globalThis.crypto?.subtle) throw new Error('La sauvegarde avant paiement exige une connexion HTTPS.');
  const keyBytes=crypto.getRandomValues(new Uint8Array(32)), iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
  const gzip=typeof CompressionStream!=='undefined';
  const packed=gzip ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()) : bytes;
  if(packed.length>20*1024*1024) throw new Error('Vos données dépassent la taille de sauvegarde avant paiement. Exportez-les dans les paramètres avant de continuer.');
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt']);
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,packed));
  return {recoveryKey:hex(keyBytes), encrypted:{cipher:toBase64(cipher),iv:hex(iv),encoding:gzip?'gzip' as const:'json' as const}};
}
export function parseRecoverySecret(hash: string, session: string | null): RecoverySecret | null {
  const value=new URLSearchParams(hash.replace(/^#/, '')).get('auraslim_recovery');
  if (!value || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null;
  const [token,key]=value.split('.');return {token,key,session:session || ''};
}
export function readRecoverySecret(session: string): RecoverySecret | null {
  try {const value=JSON.parse(localStorage.getItem(RECOVERY_SECRET_KEY)||'null');return value?.session===session&&/^[a-f0-9]{64}$/.test(value.token)&&/^[a-f0-9]{64}$/.test(value.key)?value:null;} catch{return null;}
}
export function validateCheckoutSnapshot(value: unknown): value is CheckoutSnapshot {
  const v=value as CheckoutSnapshot | undefined;
  return !!v && v.version===1 && typeof v.profile?.id==='string' && !!v.profile.name && v.profile.isOnboardingCompleted===true &&
    typeof v.profile.preferredLanguage==='string' && [v.weights,v.photos,v.nutrition,v.reminders].every(Array.isArray) && !!v.local && typeof v.local==='object';
}
export async function decryptCheckoutSnapshot(encrypted: {cipher:string;iv:string;encoding:string}, secret: RecoverySecret): Promise<CheckoutSnapshot> {
  if (!/^[a-f0-9]{24}$/.test(encrypted.iv) || encrypted.cipher.length>28*1024*1024 || !['json','gzip'].includes(encrypted.encoding)) throw new Error('Sauvegarde de paiement invalide.');
  const key=await crypto.subtle.importKey('raw',unhex(secret.key),{name:'AES-GCM'},false,['decrypt']);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(encrypted.iv)},key,fromBase64(encrypted.cipher));
  const stream=encrypted.encoding==='gzip'?new Blob([decrypted]).stream().pipeThrough(new DecompressionStream('gzip')):new Blob([decrypted]).stream();
  const reader=stream.getReader(), chunks: Uint8Array[]=[];let bytes=0;
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>100*1024*1024){await reader.cancel();throw new Error('Sauvegarde trop volumineuse.');}chunks.push(part.value);}
  const merged=new Uint8Array(bytes);let offset=0;for(const part of chunks){merged.set(part,offset);offset+=part.length;}
  const data=JSON.parse(new TextDecoder().decode(merged));
  if(!validateCheckoutSnapshot(data)) throw new Error('La sauvegarde du suivi est incomplète.');
  return data;
}
export async function restoreCheckoutSnapshot(data: CheckoutSnapshot) {
  if(!validateCheckoutSnapshot(data)) throw new Error('La sauvegarde du suivi est incomplète.');
  const previous=new Map<string,string|null>();
  const values: Record<string,string> = {
    [STORAGE_KEYS.USER_PROFILE]:JSON.stringify({...data.profile,plan:'free',isAdmin:false}),
    [STORAGE_KEYS.NUTRITION_ENTRIES]:JSON.stringify(data.nutrition),
    [STORAGE_KEYS.REMINDERS]:JSON.stringify(data.reminders)
  };
  for(const key of [STORAGE_KEYS.WATER_LOGS,STORAGE_KEYS.COLOR_MODE,DAY_END_KEY,'auraslim_verified_sessions','auraslim_verified_session',`auraslim_inbody_scans_${data.profile.id}`])if(typeof data.local[key]==='string')values[key]=data.local[key];
  try {
    for(const [key,value] of Object.entries(values)){previous.set(key,localStorage.getItem(key));localStorage.setItem(key,value);}
    if('indexedDB' in globalThis){await writeLocalSnapshot(data.weights,data.photos);}
    else {for(const [key,value] of [[STORAGE_KEYS.WEIGHT_ENTRIES,JSON.stringify(data.weights)],[STORAGE_KEYS.WEEKLY_PHOTOS,JSON.stringify(data.photos)]]){previous.set(key,localStorage.getItem(key));localStorage.setItem(key,value);}}
  }catch(error){for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}throw error;}
}
