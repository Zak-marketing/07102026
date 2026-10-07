import uiCatalog from './uiCatalog.json';
import { getTranslation } from './i18n';
export const normalizedUiText=(value:string)=>value.replace(/\s+/g,' ').trim();
export function translationSources():Record<string,string>{return Object.fromEntries(Object.entries(getTranslation('fr')).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&!!entry[1].trim()));}
export function validateTranslation(dictionary:unknown):dictionary is Record<string,string>{
 if(!dictionary||typeof dictionary!=='object')return false;
 const value=dictionary as Record<string,unknown>;
 const placeholders=(text:string)=>[...text.matchAll(/\{[^{}]+\}|%[sd]/g)].map(m=>m[0]).sort().join('|');
 return Object.entries(translationSources()).every(([key,source])=>typeof value[key]==='string'&&!!(value[key] as string).trim()&&placeholders(value[key] as string)===placeholders(source));
}
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function createInterfaceTranslator(dictionary:Record<string,unknown>){
 const exact=new Map<string,string>();
 const templates:Array<{pattern:RegExp;translated:string;names:string[]}>=[];
 for(const sources of [getTranslation('fr'),getTranslation('en'),uiCatalog])for(const [key,source] of Object.entries(sources)){
  const translated=dictionary[key];if(typeof source!=='string'||typeof translated!=='string'||!translated.trim()||translated===source)continue;
  const normalized=normalizedUiText(source);exact.set(normalized,translated);
 }
 for(const [source,translated] of exact){
  const matches=[...source.matchAll(/\{([^{}]+)\}/g)];
  if(!matches.length||source.replace(/\{[^{}]+\}/g,'').replace(/[^A-Za-zÀ-ÿ]/g,'').length<4)continue;
  let start=0,pattern='';for(const match of matches){pattern+=escape(source.slice(start,match.index))+'(.+?)';start=match.index!+match[0].length;}
  pattern+=escape(source.slice(start));templates.push({pattern:new RegExp('^'+pattern+'$'),translated,names:matches.map(m=>m[1])});
 }
 return (text:string)=>{
  const normalized=normalizedUiText(text);let translated=exact.get(normalized);
  if(!translated){for(const template of templates){const match=template.pattern.exec(normalized);if(match){translated=template.translated.replace(/\{([^{}]+)\}/g,(original,name)=>match[template.names.indexOf(name)+1]||original);break;}}}
  if(!translated)return text;
  return (text.match(/^\s*/)?.[0]||'')+translated+(text.match(/\s*$/)?.[0]||'');
 };
}
