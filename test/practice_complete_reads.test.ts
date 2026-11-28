import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { dataReadContext } from './dataReadContext.ts';
import { createClient } from '@supabase/supabase-js';
import { readAllPages } from '../src/services/readAllPages.ts';

test('failed part or attachment reads reject the whole practice snapshot rather than returning an incomplete success', async()=>{
  for(const failed of ['vocal_parts','practice-attachments','part-attachments']) {
    const db={from(table:string){let owner='';const query:any={select(){return query;},is(){return query;},order(){return query;},in(){return query;},eq(_:string,value:string){owner=value;return query;},range:async()=>{
      const key=table==='attachments'?`${owner==='practice'?'practice':'part'}-attachments`:table;
      if(key===failed)return {error:Error(`${key} unavailable`)};
      const data=table==='practice_entries'?[{id:'practice'}]:table==='vocal_parts'?[{id:'part'}]:[];
      return {data,count:data.length,error:null};
    }};return query;}};
    const exports:any={};const source=readFileSync('src/services/supabaseData.ts','utf8').replaceAll('import.meta.env','({})');
    runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,dataReadContext({exports,console:{error(){},warn(){}},require:(name:string)=>name==='../supabase'?{supabase:db,isSupabaseConfigured:()=>true}:{}}));
    await assert.rejects(exports.fetchPracticeEntries(),/unavailable/);
  }
});
test('pagination runs through the installed Supabase query builder, with stable order, ranges and exact counts', async()=>{
  const ranges:string[]=[];const rows=Array.from({length:1205},(_,id)=>({id}));
  const db=createClient('https://qnlbc-test.invalid','publishable-test',{auth:{persistSession:false},global:{fetch:async(input:any,options:any)=>{
    const url=new URL(String(input));assert.equal(url.searchParams.get('order'),'id.asc');
    const from=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit'));
    assert.equal(limit,500);assert.match(new Headers(options.headers).get('prefer')||'',/count=exact/);
    const data=rows.slice(from,from+limit);ranges.push(String(from));
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Content-Range':`${from}-${from+data.length-1}/${rows.length}`}});
  }}});
  const result=await readAllPages(()=>db.from('setlists').select('*',{count:'exact'}).order('id'));
  assert.equal(result.error,null);assert.equal(result.data?.length,1205);assert.deepEqual(ranges,['0','500','1000']);
});

test('Notes Trash refresh runs after the delete barrier closes rather than waiting on its own write', async()=>{
  let deleted=false;
  const supabase={from(){const query:any={delete(){deleted=true;return query;},select(){return query;},eq(){return query;},not(){return query;},order(){return query;},range:async()=>({data:[],count:0,error:null}),then(resolve:any){return Promise.resolve({error:null}).then(resolve);}};return query;}};
  const exports:any={};const source=readFileSync('src/features/notepad/data.ts','utf8');
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,dataReadContext({exports,require:()=>({supabase})}));
  let timer:ReturnType<typeof setTimeout>;
  try {
    const rows=await Promise.race([exports.purgeNotes('test-user'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Notes refresh stalled')),1000);})]);
    assert.equal(deleted,true);assert.equal(rows.length,0);
  } finally { clearTimeout(timer!); }
});
