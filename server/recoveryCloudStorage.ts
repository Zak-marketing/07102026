// Optional private Cloud Storage backend for Cloud Run's multiple instances.
// Authentication uses the runtime service account; no browser API key is used.
let access: {token:string;until:number} | null = null;
export function recoveryBucket() {
  const bucket=process.env.AURASLIM_BACKUP_BUCKET?.trim();
  if(!bucket)return null;
  if(!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucket))throw new Error('Invalid private backup bucket');
  return bucket;
}
async function auth() {
  if(access && access.until>Date.now())return access.token;
  const response=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('Runtime identity unavailable');
  const payload=await response.json() as {access_token?:string;expires_in?:number};
  if(!payload.access_token)throw new Error('Runtime token unavailable');
  access={token:payload.access_token,until:Date.now()+Math.max(60,(payload.expires_in || 300)-60)*1000};
  return access.token;
}
const objectName=(hash:string)=>'auraslim-checkout/'+hash+'.json';
export async function cloudRecoveryWrite(hash:string, value:string) {
  const bucket=recoveryBucket();if(!bucket)throw new Error('Missing private backup bucket');
  const url=new URL(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o`);
  url.searchParams.set('uploadType','media');url.searchParams.set('name',objectName(hash));url.searchParams.set('ifGenerationMatch','0');
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+await auth(),'Content-Type':'application/json'},body:value,signal:AbortSignal.timeout(45_000)});
  if(!response.ok)throw new Error('Private backup write failed');
}
export async function cloudRecoveryRead(hash:string):Promise<string|null> {
  const bucket=recoveryBucket();if(!bucket)throw new Error('Missing private backup bucket');
  const response=await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName(hash))}?alt=media`,{headers:{Authorization:'Bearer '+await auth()},signal:AbortSignal.timeout(45_000)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error('Private backup read failed');
  return response.text();
}
export async function cloudRecoveryDelete(hash:string) {
  const bucket=recoveryBucket();if(!bucket)throw new Error('Missing private backup bucket');
  const response=await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName(hash))}`,{method:'DELETE',headers:{Authorization:'Bearer '+await auth()},signal:AbortSignal.timeout(30_000)});
  if(!response.ok && response.status!==404)throw new Error('Private backup delete failed');
}
