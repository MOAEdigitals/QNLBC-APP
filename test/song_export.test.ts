import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import JSZip from 'jszip';
import { cleanLeadingSongTitle } from '../src/utils/songLyrics.ts';
function harness(rows: any[], failPage = -1) {
  const calls: number[]=[]; let archive: Blob|undefined; let downloads=0;
  const db={from:()=>({select(){return this;},is(){return this;},order(){return this;},range:async(start:number,end:number)=>{calls.push(start);return {data:rows.slice(start,end+1),error:start===failPage?{message:'offline'}:null};}})};
  const exports:any={};
  runInNewContext(ts.transpileModule(fs.readFileSync('src/services/songExport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
    exports,Blob,Uint8Array,setTimeout:()=>0,URL:{createObjectURL:(value:Blob)=>{archive=value;return 'blob:test';},revokeObjectURL:()=>{}},document:{createElement:()=>({click:()=>downloads++,remove:()=>{}}),body:{appendChild:()=>{}}},
    require:(name:string)=>name==='jszip'?JSZip:name.includes('songLyrics')?{cleanLeadingSongTitle}:name==='@capacitor/core'?{Capacitor:{isNativePlatform:()=>false}}:name.includes('supabaseData')?{mapSongFromDB:(row:any)=>({...row,attachments:row.metadata?.attachments||[]})}:name.includes('supabase')?{supabase:db}:{},
  });
  return {exports,calls,archive:()=>archive,downloads:()=>downloads};
}
test('songs-only ZIP preserves exact lyrics, details, Unicode titles and colliding filenames',async()=>{
  const rows=[{id:'1',title:'Ama / Ama',lyrics:'Verse\r\nIkaw ang Diyos!\r\n',metadata:{attachments:[{url:'https://example.com/audio'}]}},{id:'2',title:'Ama \\ Ama',lyrics:'Different song'},{id:'3',title:'Panginoon—Sa’yo',lyrics:''}];
  const h=harness(rows); const bytes=await h.exports.buildSongsArchive(rows); const zip=await JSZip.loadAsync(bytes);
  const files=Object.keys(zip.files).filter(x=>x.endsWith('.txt')&&x.startsWith('lyrics/'));
  assert.equal(files.length,3); assert.ok(files.some(x=>x.includes('(2)')));assert.ok(files.some(x=>x.includes('Panginoon—Sa’yo')));
  assert.equal(await zip.file(files[0])!.async('string'),rows[0].lyrics.replace(/\r\n/g,'\n'));
  const json=JSON.parse(await zip.file('songs-backup.json')!.async('string'));assert.deepEqual(json.rawSongs,rows);assert.equal(json.songs[0].attachments[0].url,'https://example.com/audio');assert.equal(json.setlists,undefined);
});
test('each text file uses its title as filename and starts with verse lyrics while JSON retains original text',async()=>{
  const lyrics='All Glory, Laud, and Honour\r\n\r\nVerse 1\r\nAll glory, laud, and honour\r\nTo Thee, Redeemer, King,\r\n\r\nVerse 2\r\nThou art the King of Israel,\r\n';
  const rows=[{id:'1',title:'All Glory, Laud, and Honour',lyrics},{id:'2',title:'Sung first line',lyrics:'Sung first line\nAnother line\n\nChorus\nKeep these lyrics'}];
  const zip=await JSZip.loadAsync(await harness(rows).exports.buildSongsArchive(rows));
  assert.equal(await zip.file('lyrics/All Glory, Laud, and Honour.txt')!.async('string'),'Verse 1\nAll glory, laud, and honour\nTo Thee, Redeemer, King,\n\nVerse 2\nThou art the King of Israel,\n');
  assert.equal(await zip.file('lyrics/Sung first line.txt')!.async('string'),rows[1].lyrics);
  assert.equal(JSON.parse(await zip.file('songs-backup.json')!.async('string')).rawSongs[0].lyrics,lyrics);
});
test('export fetches and verifies every page beyond 1000 songs before downloading',async()=>{
  const rows=Array.from({length:1102},(_,i)=>({id:String(i),title:`Song ${i}`,lyrics:`Lyrics ${i}`}));const h=harness(rows);
  assert.equal(await h.exports.exportAllSongs(()=>{}),1102);assert.deepEqual(h.calls,[0,500,1000,0,500,1000]);assert.equal(h.downloads(),1);
  const zip=await JSZip.loadAsync(await h.archive()!.arrayBuffer());assert.equal(JSON.parse(await zip.file('songs-backup.json')!.async('string')).songs.length,1102);
});
test('failed song pagination never produces an incomplete backup',async()=>{
  const h=harness(Array.from({length:700},(_,i)=>({id:String(i),title:'Song',lyrics:'text'})),500);
  await assert.rejects(()=>h.exports.exportAllSongs(()=>{}),/Could not export/);assert.equal(h.downloads(),0);
});
