import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import{runInNewContext}from'node:vm';import ts from'typescript';import{parseDate}from'../src/utils/dateUtils.ts';
const source=readFileSync('src/components/RecognitionsTab.tsx','utf8');
function harness(kind:'Anniversary'|'Special',fail=false){
 const calls:any[]=[];let closed=false;let error='';let saving=false;
 const context:any={parseDate,generateUUID:()=> 'new-id',recognitionSaveLock:{current:false},setSavingRecognition:(v:boolean)=>{saving=v},setRecognitionSaveError:(v:string)=>{error=v},setEditingAnniversary:()=>{},setEditingSpecial:()=>{},setIsAddingAnniversary:(v:boolean)=>{closed=!v},setIsAddingSpecial:(v:boolean)=>{closed=!v},onSaveAnniversary:async(x:any)=>{calls.push(x);return !fail},onSaveSpecialRecognition:async(x:any)=>{calls.push(x);return !fail},editingAnniversary:{id:'old',revision:7,years_count:20},editingSpecial:{id:'old',revision:8},annivForm:{title:' Couple ',anniversaryDate:'2000-11-08',startingYear:'2006',type:'Wedding',notes:' Note '},specialForm:{name:' Person ',recognitionType:'Custom',customType:'Award',date:'2026-11-08',description:'Details'}};
 const start=source.indexOf('  const handleAdd'+kind+' =');const end=source.indexOf('\n  const ',start+10);
 runInNewContext(ts.transpileModule(source.slice(start,end)+'\nthis.save=handleAdd'+kind+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {context,calls,save:()=>context.save({preventDefault(){}}),get closed(){return closed},get error(){return error},get saving(){return saving}};
}
test('recognition edits preserve ID/revision and await save before closing',async()=>{
 for(const kind of ['Anniversary','Special'] as const){const h=harness(kind);await h.save();assert.equal(h.calls.length,1);assert.equal(h.calls[0].id,'old');assert.equal(h.calls[0].revision,kind==='Anniversary'?7:8);assert.equal(h.closed,true);assert.equal(h.saving,false);}
});
test('failed recognition saves retain draft and release lock for retry',async()=>{
 for(const kind of ['Anniversary','Special'] as const){const h=harness(kind,true);await h.save();assert.equal(h.closed,false);assert.match(h.error,/Unable to save/);assert.equal(h.context.recognitionSaveLock.current,false);await h.save();assert.equal(h.calls.length,2);}
});
test('unknown anniversary year stays optional; starting year anchors the automatic count',async()=>{
 const h=harness('Anniversary');await h.save();assert.equal(h.calls[0].anniversaryDate,'2006-11-08');assert.equal(h.calls[0].yearsCount,0);
 h.context.annivForm.startingYear='';await h.save();assert.equal(h.calls[1].anniversaryDate,'2000-11-08');assert.equal(h.calls[1].yearsCount,undefined);assert.equal(h.calls[1].years_count,undefined);
});
test('invalid leap starting date and empty custom title are not saved',async()=>{
 const a=harness('Anniversary');a.context.annivForm.startingYear='2025';a.context.annivForm.anniversaryDate='2000-02-29';await a.save();assert.equal(a.calls.length,0);assert.match(a.error,/Check/);
 const s=harness('Special');s.context.specialForm.customType=' ';await s.save();assert.equal(s.calls.length,0);
});
