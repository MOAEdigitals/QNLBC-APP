import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path: string)=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
test('clear search preserves focus without forcing the software keyboard open',()=>{
 const source=read('src/components/Navbar.tsx');
 assert.match(source,/onPointerDown=\{\(event\) => event.preventDefault\(\)\} onClick=\{\(\) => \{ setIsSearching\(true\); search.onChange\(''\); \}\} aria-label="Clear search"/);
 assert.match(source,/searchRef.current\?\.contains/);
 assert.match(source,/removeEventListener\('pointerdown', dismiss\)/);
});
test('event programs can remove their final song and replacement clears both link aliases',()=>{
 const source=read('src/components/SetlistsTab.tsx');
 assert.match(source,/program\?\.songs\?\.length \|\| 0\) > 0/);
 assert.doesNotMatch(source,/program\?\.songs\?\.length \|\| 0\) > 1/);
 assert.match(source,/song_id: matched \? matched.id : undefined/);
 assert.match(source,/const linkedId = s.songId \|\| s.song_id/);
});
test('all setlist song entry points retain the originating setlist',()=>{
 const source=read('src/components/SetlistsTab.tsx');
 const calls=source.match(/onClick=\{\(\) => \([^\n]*handleOpenSong[^\n]*/g)||[];
 assert.equal(calls.length,9);
 for(const call of calls) assert.match(call,/, item.id\)/);
});
