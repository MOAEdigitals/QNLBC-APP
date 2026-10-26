import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { cleanLeadingSongTitle, cleanEmptySectionLabels, cleanDuplicateChorusSections } from '../src/utils/songLyrics.ts';
import { songTitleCase } from '../src/utils/songTitleCase.ts';
function harness(initial: any[] = []) {
  const rows = initial.map(row => ({...row})); let failAt = -1, lost = false; let attempts = 0;
  const db = { from: () => ({
    select() { return this; }, is() { return this; }, order() { return this; },
    range: async (start: number, end: number) => ({data:rows.filter(row=>!row.deleted_at).slice(start,end+1),error:null}),
    upsert: (payload: any[], options: any) => ({select: async () => {
      assert.equal(options.ignoreDuplicates,true,'import must never overwrite a song');
      if (attempts++ === failAt) return {error:{message:'Connection failed'},data:null};
      const saved = payload.filter(row=>!rows.some(existing=>existing.id===row.id)); rows.push(...saved);
      if(lost){lost=false;return {error:{message:'Response lost'},data:null};}
      return {data:saved.map(row=>({id:row.id})),error:null};
    }}),
  }) };
  const exports:any={};runInNewContext(ts.transpileModule(fs.readFileSync('src/services/batchLyricsImport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,require:(name:string)=>name.includes('songLyrics')?{cleanLeadingSongTitle}:name.includes('songTitleCase')?{songTitleCase}:{supabase:db},
  });
  return {rows,run:exports.importBatchLyricsTxt,failAt:(at:number)=>{failAt=at;},loseResponse:()=>{lost=true;}};
}
const file=(name:string,text:string)=>new File([text],name,{type:'text/plain'});
test('batch import persists new lyrics, title-cases names, skips identical lyrics despite a different title, and keeps originals',async()=>{
  const original={id:'original',title:'Existing Title',lyrics:'Verse 1\nSame words to sing',metadata:{attachments:['keep']}};
  const h=harness([original]);const result=await h.run([file('other TITLE.txt','Verse 1\nSame words to sing'),file('i\'LL praise THE LORD.txt','Verse 1\nA different song'),file('copy.txt','Verse 1\nA different song')]);
  assert.equal(result.addedCount,1);assert.equal(result.updatedCount,0);assert.equal(result.skippedDuplicates,2);assert.deepEqual(h.rows[0],original);
  assert.equal(h.rows[1].title,"I'll Praise The Lord");assert.equal(h.rows[1].lyrics,'Verse 1\nA different song');assert.ok(h.rows[1].metadata.importBatchId);
});
test('failed or unconfirmed saves never report success and retries do not create duplicates',async()=>{
  const h=harness();const files=Array.from({length:27},(_,i)=>file(`song ${i}.txt`,`Verse 1\nDistinct song ${i}`));h.failAt(1);
  await assert.rejects(()=>h.run(files),/25 confirmed/);assert.equal(h.rows.length,25);
  const result=await h.run(files);assert.equal(result.addedCount,2);assert.equal(h.rows.length,27);
  const lost=harness();lost.loseResponse();await assert.rejects(()=>lost.run([file('New.txt','Unique lyrics')]),/confirmed/);
  assert.equal((await lost.run([file('New.txt','Unique lyrics')])).addedCount,0);assert.equal(lost.rows.length,1);
});
test('duplicate checks read beyond the first 1000 records; empty files are skipped',async()=>{
  const h=harness(Array.from({length:1102},(_,i)=>({id:String(i),title:`Song ${i}`,lyrics:`Different lyrics ${i}`})));
  const result=await h.run([file('Renamed.txt','Different lyrics 1101'),file('empty.txt','  ')]);
  assert.equal(result.addedCount,0);assert.equal(result.skippedDuplicates,1);assert.equal(result.skippedEmpty,1);assert.equal(h.rows.length,1102);
});
test('Title Case preserves apostrophes and Unicode names',()=>{
  assert.equal(songTitleCase("i'LL PRAISE THE LORD"),"I'll Praise The Lord");
  assert.equal(songTitleCase('ANG DIYOS AY PAG-IBIG'),'Ang Diyos Ay Pag-Ibig');
  assert.equal(songTitleCase('JESUS LOVES THE CHURCH (ENGLISH & TAGALOG)'),'Jesus Loves The Church (English & Tagalog)');
});
test('song library loads all pages after a large import instead of stopping at the API row limit',async()=>{
  const rows=Array.from({length:1658},(_,i)=>({id:String(i),title:`Song ${i}`,lyrics:'Verse 1\nLyrics'}));const pages:number[]=[];
  const db={from:()=>({select(){return this;},is(){return this;},order(){return this;},range:async(start:number,end:number)=>{pages.push(start);return {data:rows.slice(start,end+1),error:null};}})};
  const exports:any={};runInNewContext(ts.transpileModule(fs.readFileSync('src/services/supabaseData.ts','utf8').replace(/import\.meta\.env/g,'({})'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,console,require:(name:string)=>name==='../supabase'?{supabase:db,isSupabaseConfigured:()=>true}:name.includes('songLyrics')?{cleanLeadingSongTitle,cleanEmptySectionLabels,cleanDuplicateChorusSections}:new Proxy({},{get:()=>()=>null}),
  });
  assert.equal((await exports.fetchSongs()).length,1658);assert.deepEqual(pages,[0,500,1000,1500]);
});

test('counted library pages load concurrently, retain every lyric, and reject incomplete loads', async()=>{
  const rows=Array.from({length:1491},(_,i)=>({id:String(i),title:`Song ${i}`,lyrics:`Full lyrics ${i}`}));
  const starts:number[]=[], release:Array<()=>void>=[];let fail=false;
  const db={from:()=>({select(){return this;},is(){return this;},order(){return this;},range:async(start:number,end:number)=>{
    starts.push(start);if(start>0)await new Promise<void>(resolve=>release.push(resolve));
    return {data:rows.slice(start,end+1),error:fail&&start===1000?Error('Read failed'):null,count:start===0?rows.length:null};
  }})};
  const exports:any={};runInNewContext(ts.transpileModule(fs.readFileSync('src/services/supabaseData.ts','utf8').replace(/import\.meta\.env/g,'({})'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,console,require:(name:string)=>name==='../supabase'?{supabase:db,isSupabaseConfigured:()=>true}:name.includes('songLyrics')?{cleanLeadingSongTitle,cleanEmptySectionLabels,cleanDuplicateChorusSections}:new Proxy({},{get:()=>()=>null}),
  });
  const loading=exports.fetchSongs();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(starts,[0,500,1000],'remaining pages start together rather than waiting for each other');
  release.splice(0).forEach(fn=>fn());const songs=await loading;assert.equal(songs.length,1491);assert.equal(songs[1490].lyrics,'Full lyrics 1490');
  fail=true;const failed=exports.fetchSongs();await new Promise(resolve=>setImmediate(resolve));release.splice(0).forEach(fn=>fn());await assert.rejects(()=>failed,/Read failed/);
});
