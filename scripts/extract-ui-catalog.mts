import { transform } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const sourceFiles=[...(await readdir('src/components')).filter(f=>f.endsWith('.tsx')).map(f=>'src/components/'+f),'src/App.tsx','src/types/index.ts','src/utils/imageCompressor.ts',...['mealRecipes','mealChoiceCopy','goalPhoto','apiClient','pdfReportGenerator','speechRecognition','notifications','nutritionTarget','personalProgram','checkoutBackup','dailyGoals','paymentReturn','motivationalQuotes','greeting'].map(f=>'src/services/'+f+'.ts'),'server/payments.ts','server/checkoutRecovery.ts','server/videoShares.ts','server/api.ts'];
const values=new Set<string>();
const isUi=(s:string)=>{
 if(s.length<2||s.length>1300||!/[A-Za-zÀ-ÿ]/.test(s)||s.includes('https:')||s.includes('http:')||s.includes('data:')||s.includes('://')||s.startsWith('/')||s.startsWith('./')||s.startsWith('../'))return false;
 if(/\b(?:bg-|text-|rounded-|flex |grid-|px-|py-|w-|h-|border-|font-|shadow-|transition|npm |SELECT |Content-Type|You are |Return only |Translate each|Analyze|Generate |image\/|video\/|format JSON)/.test(s))return false;
 if(/^[a-z0-9_.:@#{}\[\]\/\-]+$/.test(s))return false;
 if(/^(?:Edit the supplied|Observe cette|Observe la|Analyze|Extract|Translate |Gemini translation|M \{|translate\(|inset\(|0 0 |group \{|\{|<!doctype)/.test(s) && !/ajout|jusqu|meal|environ|écart/.test(s))return false;
 if(s.includes('{slot_')&&s.replace(/\{slot_\d+\}/g,'').replace(/\b(?:kg|cm|ml|kcal|bpm|L|g)\b/g,'').replace(/[^A-Za-zÀ-ÿ]/g,'').length<4)return false;
 return /\s/.test(s)||/[À-ÿ]/.test(s)||/^[A-Z][a-z]{3,}$/.test(s);
};
for(const file of sourceFiles){
 const raw=await readFile(file,'utf8');const code=(await transform(raw,{loader:file.endsWith('tsx')?'tsx':'ts',jsx:'transform',target:'es2022'})).code;
 for(const match of code.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)){
  try{const value=normalize(vm.runInNewContext(match[0],Object.create(null),{timeout:50}));if(isUi(value))values.add(value);}catch{}
 }
 // Preserve interpolation slots without ever translating the interpolated user values.
 for(let i=0;i<code.length;i++){
  if(code[i]!=='`')continue;let text='',slot=0,end=i+1;
  for(;end<code.length;end++){
   if(code[end]==='\\'){text+=code.slice(end,end+2);end++;continue;}
   if(code[end]==='`')break;
   if(code[end]==='$'&&code[end+1]==='{'){
    let depth=1;end+=2;for(;end<code.length&&depth;end++){
     if(['"',"'",'`'].includes(code[end])){const q=code[end];for(end++;end<code.length;end++){if(code[end]==='\\'){end++;continue;}if(code[end]===q)break;}}
     else if(code[end]==='{')depth++;else if(code[end]==='}')depth--;
    }end--;text+='{slot_'+slot+++'}';continue;
   }text+=code[end];
  }
  let value='';try{value=normalize(vm.runInNewContext('`'+text+'`',Object.create(null),{timeout:50}));}catch{}if(isUi(value))values.add(value);i=end;
 }
}
const catalog=Object.fromEntries([...values].sort().map(text=>['ui_'+createHash('sha256').update(text).digest('hex').slice(0,16),text]));
await writeFile('src/services/uiCatalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log('UI catalog:',Object.keys(catalog).length,'static texts and templates from',sourceFiles.length,'source files');
