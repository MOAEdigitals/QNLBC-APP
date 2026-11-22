import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';import ts from'typescript';
const source=readFileSync('src/components/SetlistsTab.tsx','utf8');
const start=source.indexOf('export function formatSetlistForMessenger'),end=source.indexOf('\nfunction SetlistPerson',start);
const format=runInNewContext(ts.transpileModule(source.slice(start,end).replace('export function','function')+'\nformatSetlistForMessenger;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Date});
const sunday:any={id:'sunday',date:'2026-11-08',presider:'BRO JV',welcomeSong:'Welcome',closingSong:'Closing',themeSong:'Theme',sundaySchool:{songLeader:'BRO RONNIE',songs:[{title:'old title',songId:'library-id',keyNote:'G'},{title:' '}]},worshipService:{songLeader:'BRO MARIUS',songs:[{title:'Amazing Grace'}]}};
test('Copy Setlist contains the correct Sunday roles, songs, keys, numbering and theme without empty selections',()=>{assert.equal(format(sunday,[{id:'library-id',title:'Current Library Title'}]),'Sunday, Nov 8, 2026\n\nPresider: BRO JV\nWelcome Song: Welcome\nClosing Song: Closing\n\nSunday School: BRO RONNIE\n1. Current Library Title (G)\n\nWorship Service: BRO MARIUS\n1. Amazing Grace\n2. Theme (Theme Song)');});
test('prayer meeting and event copying use only the program role, custom title and songs',()=>{for(const type of ['prayer_meeting','fellowship','event']){const text=format({id:type,date:'2026-11-04',type,title:'Custom Gathering',program:{songLeader:'BRO ERIC',songs:[{title:'Song One'},{title:'Song Two'}]}});assert.match(text,/Custom Gathering: BRO ERIC\n1. Song One\n2. Song Two/);assert.doesNotMatch(text,/Sunday School|Worship Service|Presider|undefined/);}});
test('Copy Setlist closes its menu immediately, writes in the same tap, and retains confirmed feedback', async () => {
  let resolve!: (value: boolean) => void;
  let menu: string | null = 'sunday';
  let received = '';
  const events: string[] = [];
  const code = source.slice(source.indexOf('  const handleCopySetlist ='), source.indexOf('\n  // Back swipe'));
  const context: any = {
    formatSetlistForMessenger: format, songs: [],
    setOpenMenuSetlistId: (value: string | null) => { menu = value; events.push('close'); },
    copyWithFeedback: (text: string, message: string) => { received = text; events.push('copy'); assert.equal(message, 'Setlist copied.'); return new Promise<boolean>(r => resolve = r); },
    setTimeout: () => { throw Error('Copy must not wait for a menu timer'); },
  };
  runInNewContext(ts.transpileModule(code + '\nthis.copy = handleCopySetlist;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, context);
  const pending = context.copy(sunday, {preventDefault(){events.push('prevent');}, stopPropagation(){events.push('stop');}});
  assert.equal(menu, null, 'menu closes even while clipboard is still pending');
  assert.match(received, /Sunday, Nov 8, 2026/);
  assert.deepEqual(events, ['prevent', 'stop', 'close', 'copy']);
  resolve(true);
  assert.equal(await pending, true);
  menu = 'sunday';
  const failure = context.copy(sunday);
  assert.equal(menu, null);
  resolve(false);
  assert.equal(await failure, false, 'clipboard failure remains a failure rather than displaying success');
});
