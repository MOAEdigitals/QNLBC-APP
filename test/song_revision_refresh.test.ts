import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { mergeSongSnapshot, newestSong } from '../src/utils/songRevisions.ts';
import type { Song } from '../src/types.ts';

const row=(revision:number,starred:boolean):Song=>({id:'one',title:'Song',lyrics:'Lyrics',revision,isStarred:starred,starred,is_starred:starred,updatedAt:'2026-11-28'});
const app=readFileSync('src/App.tsx','utf8');
const compile=(code:string)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

test('a late star snapshot cannot undo a newer unstar, while newer server changes and deletions still apply',()=>{
  const unstar=row(3,false),oldStar=row(2,true),newStar=row(4,true);
  assert.equal(mergeSongSnapshot([unstar],[oldStar])[0],unstar);
  assert.equal(mergeSongSnapshot([unstar],[newStar])[0],newStar);
  assert.deepEqual(mergeSongSnapshot([unstar],[]),[],'server deletions remain authoritative');
  assert.equal(oldStar.isStarred,true,'incoming data is not mutated');
});

test('actual realtime handler ignores an older response that finishes after the latest refresh',async()=>{
  let songs=[row(3,false)];const states:boolean[]=[];
  const pending:Array<(rows:Song[])=>void>=[];
  const context:any={isMounted:true,offlineReadOnlyRef:{current:false},signingOutRef:{current:false},
    fetchSongs:()=>new Promise< Song[]>(resolve=>pending.push(resolve)),
    setSongs:(update:any)=>{songs=typeof update==='function'?update(songs):update;states.push(songs[0].isStarred!);},
    mergeSongSnapshot,scheduleOfflineSync(){},preserveOnRefreshFailure:()=>songs,
  };
  const start=app.indexOf('      onSongsChange: async () => {');
  const end=app.indexOf('      onSpecialNumbersChange:',start);
  const handler=app.slice(start,end).trim().replace(/^onSongsChange:/,'this.refresh =').replace(/,$/,';');
  runInNewContext(compile(handler),context);
  const older=context.refresh(),latest=context.refresh();
  pending[1]([row(3,false)]);await latest;
  pending[0]([row(2,true)]);await older;
  assert.deepEqual(states,[false,false],'there is no one-frame return to starred');
  assert.equal(songs[0].revision,3);
});

test('a delayed save response cannot replace a newer realtime version either',async()=>{
  let songs=[row(3,false)];
  const code=app.slice(app.indexOf('  const handleSaveSong ='),app.indexOf('  const handleBatchSaveSongs ='));
  const context:any={songs,currentUser:{id:'user'},requirePermission:()=>true,useCallback:(fn:any)=>fn,
    supabaseSaveSong:async()=>row(2,true),scheduleOfflineSync(){},newestSong,mergeSongSnapshot,
    setSongs:(update:any)=>{songs=update(songs);},
  };
  runInNewContext(compile(code+'\nthis.save=handleSaveSong;'),context);
  await context.save(row(1,true));
  assert.equal(songs[0].revision,3);assert.equal(songs[0].isStarred,false);
});
