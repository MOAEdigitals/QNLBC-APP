import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPickerCategory, comparePickerSongs, PICKER_SORTS } from '../src/utils/songPicker.ts';
import { songTitleCase } from '../src/utils/songTitleCase.ts';
const base = { id: 'song', title: 'Song', lyrics: '', updatedAt: '' };
test('Uncategorized means no categories, supports legacy metadata, and stays exclusive', () => {
  for (const data of [{}, {categories:[]}, {category:'  '}, {category:'Uncategorized'}]) assert.equal(matchesPickerCategory({...base,...data},'uncategorized'),true);
  assert.equal(matchesPickerCategory({...base,categories:['Choir','Tagalog']},'uncategorized'),false);
  assert.equal(matchesPickerCategory({...base,categories:[],category:'Choir, Tagalog'},'Tagalog'),true);
  assert.equal(matchesPickerCategory({...base,isStarred:true},'starred'),true);
});
test('picker offers all library sorts and uses dates, tracks and relevance correctly', () => {
  assert.equal(PICKER_SORTS.length,7);
  const items=[{title:'Zulu',songObj:{...base,title:'Zulu',createdAt:'2026-01-01'},history:{lastDate:'2026-10-25'},score:10},{title:'Alpha',songObj:{...base,title:'Alpha',createdAt:'2026-10-27',minusOneLink:'https://example.test/audio.mp3'},history:{lastDate:null},score:99}];
  for (const [mode,first] of [['relevance','Alpha'],['az','Alpha'],['za','Zulu'],['tracks-first','Alpha'],['recently-sung','Zulu'],['least-recently-sung','Alpha'],['recently-added','Alpha']] as const) assert.equal([...items].sort((a,b)=>comparePickerSongs(a,b,mode))[0].title,first,mode);
});
test('import title capitalization preserves contractions, versions, and church acronyms', () => {
  assert.equal(songTitleCase("  GOD'S amazing GRACE (2)  "),"God's Amazing Grace (2)");
  assert.equal(songTitleCase('dakilang katapatan — qnlbc / ibma'), 'Dakilang Katapatan — QNLBC / IBMA');
});
