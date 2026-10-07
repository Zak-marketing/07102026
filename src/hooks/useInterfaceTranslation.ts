import { useLayoutEffect } from 'react';
import { createInterfaceTranslator } from '../services/interfaceTranslation';
const texts=new WeakMap<Text,{source:string;displayed:string}>();
const attributes=new WeakMap<Element,Map<string,{source:string;displayed:string}>>();
/** Local static catalog only. User values, photos and form values never leave the device. */
export function useInterfaceTranslation(language:string,dictionary:object,version:number){
 useLayoutEffect(()=>{
  const translate=language==='fr'?(s:string)=>s:createInterfaceTranslator(dictionary as Record<string,unknown>);
  const excluded=(element:Element|null)=>!element||!!element.closest('script,style,textarea,[data-user-content],[data-no-translate]');
  const translateText=(node:Text)=>{
   if(excluded(node.parentElement)||!node.nodeValue?.trim())return;
   const prior=texts.get(node);const source=prior&&node.nodeValue===prior.displayed?prior.source:node.nodeValue;
   const displayed=translate(source);texts.set(node,{source,displayed});if(node.nodeValue!==displayed)node.nodeValue=displayed;
  };
  const translateAttributes=(element:Element)=>{
   if(excluded(element))return;
   const map=attributes.get(element)||new Map();attributes.set(element,map);
   for(const name of ['placeholder','title','aria-label','alt']){const value=element.getAttribute(name);if(!value)continue;const prior=map.get(name);const source=prior&&value===prior.displayed?prior.source:value;const displayed=translate(source);map.set(name,{source,displayed});if(value!==displayed)element.setAttribute(name,displayed);}
  };
  const scan=(node:Node)=>{
   if(node.nodeType===Node.TEXT_NODE){translateText(node as Text);return;}
   if(!(node instanceof Element))return;translateAttributes(node);
   const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);for(let child=walker.nextNode();child;child=walker.nextNode())translateText(child as Text);
   node.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(translateAttributes);
  };
  scan(document.body);
  const observer=new MutationObserver(records=>{
   for(const record of records){if(record.type==='childList')record.addedNodes.forEach(scan);else if(record.type==='characterData')translateText(record.target as Text);else translateAttributes(record.target as Element);}
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});
  return()=>observer.disconnect();
 },[language,version]);
}
