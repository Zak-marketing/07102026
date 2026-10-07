import React, { useEffect, useState } from 'react';
import { Share2, Copy, Check, Link, Trash2, Download } from 'lucide-react';
import { auraSlimApi } from '../services/apiClient';

export function canShareVideo(blob: Blob | null): boolean {
  if (!blob || typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    const policy = (document as Document & {permissionsPolicy?:{allowsFeature:(feature:string)=>boolean};featurePolicy?:{allowsFeature:(feature:string)=>boolean}}).permissionsPolicy || (document as any).featurePolicy;
    if (policy && !policy.allowsFeature('web-share')) return false;
    return navigator.canShare({files:[new File([blob], 'auraslim-progression.'+(blob.type.includes('mp4')?'mp4':'webm'),{type:blob.type.split(';')[0]})]});
  } catch { return false; }
}
export function VideoSharePanel({blob,download,text}:{blob:Blob;download:()=>void;text:string}) {
  const [enabled,setEnabled]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
  const [link,setLink]=useState(''),[token,setToken]=useState(''),[copied,setCopied]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;auraSlimApi('share-capabilities').then(r=>r.json()).then(r=>{if(active)setEnabled(r.enabled===true);}).catch(()=>{});return()=>{active=false;};},[]);
  const shareFile=async()=>{
    if(!canShareVideo(blob))return;
    try{await navigator.share({title:'AuraSlim',text,files:[new File([blob],'auraslim-progression.'+(blob.type.includes('mp4')?'mp4':'webm'),{type:blob.type.split(';')[0]})]});}
    catch(e){if((e as Error).name!=='AbortError')setError('Le partage n’a pas abouti. Téléchargez la vidéo, puis ajoutez-la dans votre application.');}
  };
  const publish=async()=>{
    if(!consent||busy)return;setBusy(true);setError('');
    try{const response=await auraSlimApi('video-shares',{method:'POST',headers:{'Content-Type':blob.type.split(';')[0],'X-AuraSlim-Share-Consent':'yes'},body:blob,signal:AbortSignal.timeout(90_000)});const data=await response.json();
      if(!response.ok)throw new Error(data.error);const url=new URL(data.url);if(url.protocol!=='https:'||!/^\/share\/[a-f0-9]{48}$/.test(url.pathname))throw new Error('Lien invalide.');setLink(url.href);setToken(data.token);
    }catch(e){setError(e instanceof Error?e.message:'Création du lien impossible.');}finally{setBusy(false);}
  };
  const remove=async()=>{setBusy(true);try{const r=await auraSlimApi('video-shares/'+token,{method:'DELETE'});if(!r.ok)throw new Error();setLink('');setToken('');setConsent(false);}catch{setError('Le lien n’a pas pu être supprimé. Réessayez.');}finally{setBusy(false);}};
  const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{setError('Sélectionnez le lien ci-dessous pour le copier manuellement.');}};
  const style='flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition hover:opacity-80';
  return <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 space-y-4">
    <h3 className="flex items-center gap-2 font-bold text-white"><Share2 size={20}/>Partager votre vidéo</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button onClick={download} className={'action-primary '+style}><Download size={18}/>Télécharger la vidéo</button>
      {canShareVideo(blob)&&<button onClick={()=>void shareFile()} className={style+' bg-cyan-500/10 text-cyan-300 border-cyan-500/40'}><Share2 size={18}/>Choisir une application</button>}
    </div>
    <p className="text-sm text-slate-300 leading-relaxed">WhatsApp, Viber, Facebook, Instagram ou Snapchat : téléchargez la vidéo, puis ajoutez le fichier dans votre conversation, publication ou story si le format est accepté.</p>
    {enabled&&!link&&<div className="rounded-xl border border-slate-700 p-3 space-y-3">
      <h4 className="font-bold flex items-center gap-2"><Link size={17}/>Partager par lien</h4>
      <label className="flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 shrink-0"/>J’accepte de créer un lien public de ma vidéo, valable 7 jours. Toute personne qui possède le lien pourra voir mes photos et mes mesures présentes dans la vidéo.</label>
      <button disabled={!consent||busy} onClick={()=>void publish()} className={style+' action-primary disabled:opacity-40 w-full'}>{busy?'Création du lien…':'Créer le lien de ma vidéo'}</button>
    </div>}
    {link&&<div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <a href={'https://wa.me/?text='+encodeURIComponent(text+' '+link)} target="_blank" rel="noopener noreferrer" className={style+' border-emerald-500/40 text-emerald-300 bg-emerald-500/10'}>WhatsApp</a>
        <a href={'viber://forward?text='+encodeURIComponent(text+' '+link)} className={style+' border-purple-500/40 text-purple-300 bg-purple-500/10'}>Viber</a>
        <a href={'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link)} target="_blank" rel="noopener noreferrer" className={style+' border-sky-500/40 text-sky-300 bg-sky-500/10'}>Facebook</a>
        <button onClick={()=>void copy()} className={style+' border-slate-600 text-slate-200'}>{copied?<Check size={17}/>:<Copy size={17}/>}Copier le lien</button>
        <button disabled={busy} onClick={()=>void remove()} className={style+' border-rose-500/40 text-rose-300'}><Trash2 size={17}/>Supprimer le lien</button>
      </div>
      <input aria-label="Lien de votre vidéo" readOnly value={link} onFocus={e=>e.currentTarget.select()} className="w-full rounded-xl border border-slate-600 p-3 text-xs"/>
      <p className="text-xs text-slate-400">Le lien expire après 7 jours. Vous pouvez le supprimer à tout moment.</p>
    </div>}
    {!enabled&&<p className="text-xs text-slate-400">Le partage par lien sera disponible lorsque l’adresse publique de l’application sera configurée.</p>}
    {error&&<p role="alert" className="text-sm text-rose-400">{error}</p>}
  </section>;
}
