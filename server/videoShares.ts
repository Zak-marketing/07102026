import express from 'express';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 20 * 1024 * 1024;
const TTL = 7 * 86400_000;
const paths = (suffix:string) => ['/api/'+suffix, '/auraslim-api/'+suffix];
interface Share { owner:string; expires:number; type:string; bytes:number }
export function installVideoShareRoutes(app:express.Express, clientId:(req:express.Request,res:express.Response)=>string, rateLimit:(req:express.Request,res:express.Response,max?:number)=>boolean) {
 const folder=path.resolve(process.env.AURASLIM_DATA_DIR || '.auraslim-data','video-shares');
 const base=()=>{try{const u=new URL(process.env.APP_URL||'');return process.env.ENABLE_VIDEO_LINKS==='true'&&u.protocol==='https:'&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.username&&!u.password?u.origin:null;}catch{return null;}};
 const meta=async(token:string):Promise<Share|null>=>{
  if(!/^[a-f0-9]{48}$/.test(token))return null;
  try{const item=JSON.parse(await readFile(path.join(folder,token+'.json'),'utf8')) as Share;return item.expires>Date.now()?item:null;}catch{return null;}
 };
 const remove=async(token:string)=>{await Promise.allSettled([unlink(path.join(folder,token+'.bin')),unlink(path.join(folder,token+'.json'))]);};
 app.get(paths('share-capabilities'),(_req,res)=>res.json({enabled:!!base(),maxBytes:MAX_BYTES,expiresDays:7}));
 app.post(paths('video-shares'),express.raw({type:['video/webm','video/mp4'],limit:MAX_BYTES}),async(req,res)=>{
  if(!rateLimit(req,res,3))return;
  const origin=base();if(!origin){res.status(503).json({error:'Le partage par lien sera disponible après la configuration de l’adresse publique de l’application.'});return;}
  if(req.get('X-AuraSlim-Share-Consent')!=='yes'){res.status(400).json({error:'Votre accord est requis pour créer un lien public de cette vidéo.'});return;}
  const type=(req.get('content-type')||'').split(';')[0];const bytes=req.body as Buffer;
  const valid=Buffer.isBuffer(bytes)&&bytes.length>16&&bytes.length<=MAX_BYTES&&((type==='video/webm'&&bytes.subarray(0,4).toString('hex')==='1a45dfa3')||(type==='video/mp4'&&bytes.subarray(4,8).toString()==='ftyp'));
  if(!valid){res.status(400).json({error:'Vidéo WebM ou MP4 valide requise (20 Mo maximum).'});return;}
  try{
   const owner=clientId(req,res);await mkdir(folder,{recursive:true,mode:0o700});let ownedBytes=0;
   // Remove expired media and enforce a per-browser storage limit.
   for(const file of (await readdir(folder)).filter(f=>/^[a-f0-9]{48}\.json$/.test(f))){
    const token=file.slice(0,-5);const record=await meta(token);
    if(!record){await remove(token);continue;}if(record.owner===owner)ownedBytes+=record.bytes;
   }
   if(ownedBytes+bytes.length>60*1024*1024){res.status(429).json({error:'Supprimez un ancien lien de partage avant de créer une autre vidéo.'});return;}
   const token=randomBytes(24).toString('hex'),expires=Date.now()+TTL;
   await writeFile(path.join(folder,token+'.bin'),bytes,{mode:0o600,flag:'wx'});
   await writeFile(path.join(folder,token+'.json'),JSON.stringify({owner,expires,type,bytes:bytes.length}),{mode:0o600,flag:'wx'});
   res.status(201).json({url:origin+'/share/'+token,token,expiresAt:new Date(expires).toISOString()});
  }catch{res.status(500).json({error:'Le lien vidéo n’a pas pu être créé. Réessayez.'});}
 });
 app.delete(paths('video-shares/:token'),async(req,res)=>{
  const token=String(req.params.token);const record=await meta(token);
  if(!record){res.status(404).json({error:'Lien absent ou expiré.'});return;}
  if(record.owner!==clientId(req,res)){res.status(403).json({error:'Vous ne pouvez pas supprimer ce lien.'});return;}
  await remove(token);res.json({deleted:true});
 });
 app.get('/share/:token',async(req,res)=>{
  const token=String(req.params.token),record=await meta(token);
  if(!record){res.status(404).type('text').send('AuraSlim — Ce lien a expiré ou a été supprimé.');return;}
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
  res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>AuraSlim · Video</title><style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui;text-align:center;padding:24px}main{max-width:520px;margin:auto}video{width:100%;max-height:80vh;background:#0f172a;border-radius:20px}a{display:inline-block;padding:14px;margin-top:16px;color:#075985;font-weight:700}</style></head><body><main><h1>AuraSlim</h1><video controls playsinline preload="metadata" src="/share/${token}/video"></video><a href="/share/${token}/video?download=1" download>⬇ MP4 / WebM</a></main></body></html>`);
 });
 app.get('/share/:token/video',async(req,res)=>{
  const token=String(req.params.token),record=await meta(token);
  if(!record){res.status(404).end();return;}
  res.set({'Content-Type':record.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','X-Robots-Tag':'noindex','Content-Disposition':`${req.query.download==='1'?'attachment':'inline'}; filename="auraslim-progression.${record.type==='video/mp4'?'mp4':'webm'}"`});
  res.sendFile(path.join(folder,token+'.bin'));
 });
}
