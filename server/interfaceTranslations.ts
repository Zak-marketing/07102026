import type express from 'express';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchLanguageCodes } from '../src/services/locales.ts';
import { translationSources, validateTranslation } from '../src/services/interfaceTranslation.ts';
const sources=translationSources();
export const translationSourceHash=createHash('sha256').update(JSON.stringify(sources)).digest('hex');
const memory=new Map<string,Record<string,string>>(),pending=new Map<string,Promise<Record<string,string>>>();
const folder=()=>path.resolve(process.env.AURASLIM_DATA_DIR||'.auraslim-data','translations');
const decode=(value:string)=>value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:\d+|x[\da-f]+);/gi,entity=>{
 const named:Record<string,string>={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};if(named[entity])return named[entity];
 const code=entity[2].toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):entity;
});
export async function buildInterfaceTranslation(language:string,gemini:(input:string[],language:string)=>Promise<string[]>):Promise<Record<string,string>>{
 if(!launchLanguageCodes.includes(language))throw new Error('Langue inconnue.');
 if(language==='fr')return sources;
 if(memory.has(language))return memory.get(language)!;
 if(pending.has(language))return pending.get(language)!;
 const work=(async()=>{
  const file=path.join(folder(),language+'-'+translationSourceHash+'.json');
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(validateTranslation(cached)){memory.set(language,cached);return cached;}}catch{}
  const key=process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY;
  if(!key&&!process.env.GEMINI_API_KEY)throw new Error('Configurez GOOGLE_CLOUD_TRANSLATE_API_KEY ou GEMINI_API_KEY pour traduire tous les écrans.');
  // Translate identical literals once; only repository interface texts go to Google.
  const groups=new Map<string,string[]>();for(const [key,text] of Object.entries(sources))groups.set(text,[...(groups.get(text)||[]),key]);
  const unique=[...groups.keys()];const output:Record<string,string>={};let cursor=0;
  const placeholder=(value:string)=>[...value.matchAll(/\{[^{}]+\}|%[sd]/g)].map(m=>m[0]).sort().join('|');
  await Promise.all(Array.from({length:4},async()=>{
   while(cursor<unique.length){const start=cursor;cursor+=40;const batch=unique.slice(start,start+40);let translated:string[];
    if(key){const response=await fetch('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30_000),body:JSON.stringify({target:language==='jv'?'jw':language,format:'text',q:batch})});
      if(!response.ok)throw new Error('Service de traduction indisponible.');
      const data=await response.json() as {data?:{translations?:Array<{translatedText:string}>}};translated=data.data?.translations?.map(item=>decode(item.translatedText))||[];
    }else translated=await gemini(batch,language);
    if(translated.length!==batch.length||translated.some((text,i)=>typeof text!=='string'||!text.trim()||placeholder(text)!==placeholder(batch[i])))throw new Error('Traduction incomplète : le choix précédent est conservé.');
    batch.forEach((source,i)=>groups.get(source)!.forEach(key=>output[key]=translated[i]));
   }
  }));
  if(!validateTranslation(output))throw new Error('La traduction ne couvre pas tous les champs.');
  memory.set(language,output);
  try{await mkdir(folder(),{recursive:true,mode:0o700});await writeFile(file,JSON.stringify(output),{mode:0o600});}catch{/* A read-only deployment can use the in-memory cache. */}
  return output;
 })();pending.set(language,work);try{return await work;}finally{pending.delete(language);}
}
export function installInterfaceTranslationRoutes(app:express.Express,rateLimit:(req:express.Request,res:express.Response,max?:number)=>boolean,gemini:(input:string[],language:string)=>Promise<string[]>){
 app.get(['/api/translations','/auraslim-api/translations'],async(req,res)=>{
  if(!rateLimit(req,res,12))return;
  const lang=String(req.query.lang||'');if(!launchLanguageCodes.includes(lang)){res.status(400).json({error:'Langue inconnue.'});return;}
  try{res.json(await buildInterfaceTranslation(lang,gemini));}
  catch(error){res.status(503).json({error:error instanceof Error?error.message:'Traduction indisponible.'});}
 });
}
