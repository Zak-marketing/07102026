import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import express from 'express';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { translationSources, validateTranslation, createInterfaceTranslator } from '../src/services/interfaceTranslation.ts';
import { buildInterfaceTranslation } from '../server/interfaceTranslations.ts';
import { getTranslation } from '../src/services/i18n.ts';
import { launchLanguageCodes } from '../src/services/locales.ts';
import { mealRecipes } from '../src/services/mealRecipes.ts';
import { MealComposerTab } from '../src/components/MealComposerTab.tsx';
import { AccountSettings } from '../src/components/AccountSettings.tsx';
import { PhotoTracker } from '../src/components/PhotoTracker.tsx';
import { ClientRegistrationModal } from '../src/components/ClientRegistrationModal.tsx';
import { getTheme } from '../src/services/theme.ts';
import { defaultProfile } from '../src/services/storage.ts';
import { compressImage } from '../src/utils/imageCompressor.ts';
import { installVideoShareRoutes } from '../server/videoShares.ts';
import { canUseSystemNotifications, showNotification } from '../src/services/notifications.ts';

const originalFetch=globalThis.fetch;
const temp=await mkdtemp(path.join(os.tmpdir(),'auraslim-current-'));
process.env.AURASLIM_DATA_DIR=temp;
(globalThis as any).localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const theme=getTheme('male','light'),t=getTranslation('fr');
const profile={...defaultProfile,name:'Utilisateur test',isOnboardingCompleted:true,initialPhotoUrl:'data:image/jpeg;base64,photo',plan:'complete_pack' as const};
const base={profile,theme,t};
try {
 // The existing translations remain meaningful even before an online bundle is loaded.
 assert.equal(getTranslation('ar').goalMaintain,'تثبيت الوزن');
 assert.equal(Object.keys(mealRecipes).length,180);
 const uiSource=translationSources();assert.ok(Object.keys(uiSource).length>2200);
 const key=(text:string)=>{const match=Object.keys(uiSource).find(k=>uiSource[k]===text);assert.ok(match,'Uncatalogued interface: '+text);return match;};
 const quantity=key('Quantité modifiable'),recipe=key('Recette rapide :'),template=key('{slot_0} ajouté à votre repas.');
 const translator=createInterfaceTranslator({...uiSource,[quantity]:'كمية قابلة للتعديل',[recipe]:'وصفة سريعة:',[template]:'تمت إضافة {slot_0} إلى وجبتك.'});
 assert.equal(translator('Quantité modifiable'),'كمية قابلة للتعديل');
 assert.equal(translator('Poulet ajouté à votre repas.'),'تمت إضافة Poulet إلى وجبتك.');
 assert.equal(translator('Note personnelle inconnue'),'Note personnelle inconnue');
 assert.equal(validateTranslation({...uiSource,[template]:'Missing slots'}),false);
 const incomplete={...uiSource};delete incomplete[quantity];assert.equal(validateTranslation(incomplete),false);
 delete process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY;delete process.env.GEMINI_API_KEY;
 await assert.rejects(buildInterfaceTranslation('ar',async()=>[]),/Configurez/);
 process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY='test-key-only';
 const submitted=new Set<string>();let translationCalls=0;
 globalThis.fetch=async(input:any,init:any)=>{
  assert.ok(String(input).startsWith('https://translation.googleapis.com/'));const body=JSON.parse(init.body);translationCalls++;
  const known=new Set(Object.values(uiSource));for(const text of body.q){assert.ok(known.has(text),'Only repository literals may be translated');submitted.add(text);}
  return Response.json({data:{translations:body.q.map((text:string)=>({translatedText:body.target==='ar'&&text==='Stabilisation du poids'?'تثبيت الوزن':body.target+' '+text}))}});
 };
 for(const language of launchLanguageCodes){const dictionary=await buildInterfaceTranslation(language,async()=>[]);assert.ok(validateTranslation(dictionary),'Complete '+language+' bundle');}
 assert.equal(launchLanguageCodes.length,20);assert.ok(submitted.size>1800);
 const before=translationCalls;await buildInterfaceTranslation('ar',async()=>[]);assert.equal(translationCalls,before,'The complete bundle must be reused');

 for(const goal of ['lose','gain','maintain'] as const){
  const html=renderToStaticMarkup(React.createElement(MealComposerTab,{...base,profile:{...profile,weightGoal:goal},nutritionEntries:[],onAddNutrition:()=>{},onDeleteNutrition:()=>{}}));
  assert.equal((html.match(/Recette rapide/g)||[]).length,15);assert.equal((html.match(/Quantité modifiable/g)||[]).length,15);
  assert.ok(!html.includes('<img')&&!html.includes('Repas des jours précédents'));
  assert.ok(html.includes('inputMode="decimal"'));
 }
 const settings=renderToStaticMarkup(React.createElement(AccountSettings,{...base,onUpdateProfile:()=>{},onOpenUpgradeModal:()=>{},onLockSession:()=>{}}));
 assert.ok(!settings.includes('Montre et activité')&&!settings.includes('Tester le rappel'));
 const photos=renderToStaticMarkup(React.createElement(PhotoTracker,{...base,photos:[],onAddPhoto:()=>{},onReplacePhoto:()=>{},onUpdateProfile:()=>{},onOpenUpgradeModal:()=>{}}));
 assert.ok(!photos.includes('Générer / actualiser')&&!photos.includes('J’accepte d’envoyer'));
 const registration=renderToStaticMarkup(React.createElement(ClientRegistrationModal,{preferredLanguage:'fr',colorMode:'light',onToggleMode:()=>{},onLanguageChange:async()=>{},onComplete:()=>{}}));
 assert.ok(!registration.includes('Projection IA'));
 // Unsupported notifications must fail rather than falsely claim success.
 (globalThis as any).window={isSecureContext:false,top:1,self:1};assert.equal(canUseSystemNotifications(),false);
 await assert.rejects(showNotification('Test','body'),/indisponibles/);

 // Decode and re-encode real dimensions; never accept unreadable or empty input.
 const revoked:string[]=[];const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 URL.createObjectURL=()=> 'blob:test-photo';URL.revokeObjectURL=url=>{revoked.push(url);};
 (globalThis as any).Image=class{naturalWidth=2000;naturalHeight=1500;onload:any;onerror:any;set src(value:string){queueMicrotask(()=>value.includes('bad')?this.onerror():this.onload());}};
 let canvas:any;
 (globalThis as any).document={createElement:()=>canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,'+'a'.repeat(120)}};
 const image=await compressImage(new File(['data'],'image.jpg'));assert.ok(image.startsWith('data:image/jpeg'));
 assert.equal(canvas.width,1000);assert.equal(canvas.height,750);assert.deepEqual(revoked,['blob:test-photo']);
 await assert.rejects(compressImage('bad-image'),/Photo illisible/);
 URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;

 // Public links carry the actual video and cannot be created without consent.
 process.env.APP_URL='https://auraslim.example';process.env.ENABLE_VIDEO_LINKS='true';
 const app=express();let owner='a'.repeat(48);installVideoShareRoutes(app,()=>owner,()=>true);
 const call=async(method:string,route:string,body:any={},params:any={},headers:Record<string,string>={})=>{
  const layer=(app as any)._router.stack.find((l:any)=>l.route&&l.route.methods[method]&&(Array.isArray(l.route.path)?l.route.path.includes('/auraslim-api/'+route):l.route.path===route));assert.ok(layer,route);
  let status=200,data:any;const res:any={set(){return this;},status(n:number){status=n;return this;},json(v:any){data=v;return this;},type(){return this;},send(v:any){data=v;return this;},end(){return this;}};
  await layer.route.stack.at(-1).handle({body,params,query:{},get:(key:string)=>headers[key]},res);return {status,data};
 };
 const video=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.alloc(80)]),headers={'content-type':'video/webm','X-AuraSlim-Share-Consent':'yes'};
 assert.equal((await call('post','video-shares',video,{}, {'content-type':'video/webm'})).status,400);
 assert.equal((await call('post','video-shares',Buffer.from('not-a-video'),{},headers)).status,400);
 const published=await call('post','video-shares',video,{},headers);assert.equal(published.status,201);
 const token=published.data.token;assert.match(published.data.url,/^https:\/\/auraslim\.example\/share\/[a-f0-9]{48}$/);
 assert.deepEqual(await readFile(path.join(temp,'video-shares',token+'.bin')),video);
 assert.ok((await call('get','/share/:token',{}, {token})).data.includes('<video controls'));
 owner='b'.repeat(48);assert.equal((await call('delete','video-shares/:token',{}, {token})).status,403);
 owner='a'.repeat(48);assert.equal((await call('delete','video-shares/:token',{}, {token})).status,200);
 assert.equal((await call('get','/share/:token',{}, {token})).status,404);
 const second=await call('post','video-shares',video,{},headers);
 const metadataFile=path.join(temp,'video-shares',second.data.token+'.json');const metadata=JSON.parse(await readFile(metadataFile,'utf8'));metadata.expires=Date.now()-1;await writeFile(metadataFile,JSON.stringify(metadata));
 assert.equal((await call('get','/share/:token',{}, {token:second.data.token})).status,404);
 console.log('PASS: 20 complete translation schemas (Google mocked), Arabic maintenance, templates/privacy, 180 recipes, photos/wearable UI, unavailable notification rejection, image decoding, real media link storage/consent/ownership/expiry.');
}finally {globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}
