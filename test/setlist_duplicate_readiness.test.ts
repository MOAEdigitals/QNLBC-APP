import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateSetlist, setlistReadiness } from '../src/utils/setlistDraft.ts';
import type { Setlist, Song } from '../src/types.ts';

test('all service types duplicate as independent drafts without changing the source',()=>{
  for(const type of ['sunday','prayer_meeting','fellowship','event'] as const){
    let n=0;
    const source:Setlist={id:'source',type,date:'2026-01-01',service_date:'2026-01-01',revision:8,displayOrder:4,deleted_at:null,updatedAt:'then',presider:'Presider',program:{songLeader:'Leader',songs:[{id:'old-slot',title:'Song',songId:'library-song',revision:3,lyricsMode:'snapshot',lyricsSnapshot:'Custom verse'}]}};
    const before=JSON.stringify(source),draft=duplicateSetlist(source,'2026-12-06',()=>`new-${++n}`);
    assert.equal(JSON.stringify(source),before);assert.notEqual(draft.id,source.id);assert.equal(draft.date,'2026-12-06');
    assert.equal(draft.service_date,undefined);assert.equal(draft.revision,undefined);assert.equal(draft.displayOrder,undefined);
    assert.notEqual(draft.program!.songs[0].id,'old-slot');assert.equal(draft.program!.songs[0].songId,'library-song');
    assert.equal(draft.program!.songs[0].lyricsSnapshot,'Custom verse');assert.equal(draft.program!.songs[0].revision,undefined);
  }
});
test('readiness reports missing assignments, lyrics and media while honoring custom lyrics',()=>{
  const song:Song={id:'song',title:'Song',lyrics:'Library lyrics',updatedAt:'today',attachments:[{id:'track',type:'audio',name:'Track',url:'https://example.test/audio'}]};
  const list:Setlist={id:'one',date:'2026-12-02',type:'prayer_meeting',updatedAt:'today',program:{songLeader:'Leader',songs:[{id:'slot',title:'Song',songId:'song'}]}};
  assert.deepEqual(setlistReadiness(list,[song]),[],'midweek needs no presider');
  list.program!.songLeader='';song.lyrics='';song.attachments=[];
  const issues=setlistReadiness(list,[song]);assert.equal(issues.length,3);
  list.program!.songs[0].lyricsMode='custom';list.program!.songs[0].lyricsSnapshot='Practice lyrics';
  assert.ok(!setlistReadiness(list,[song]).some(issue=>issue.detail==='Lyrics missing'));
});
