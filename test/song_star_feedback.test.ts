import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('star feedback is immediate, rapid taps serialize revisions, and failures roll back', async () => {
  const source = readFileSync('src/components/SongsTab.tsx','utf8');
  const code = source.slice(source.indexOf('  const handleToggleStar ='),source.indexOf('  const handleSaveSongForm ='));
  let overrides:Record<string,boolean> = {};
  const writes:any[] = [], releases:Array<(song:any)=>void> = [];
  let fail = false;
  const context:any = {readOnly:false,starWrites:{current:new Map()},
    setStarOverrides:(update:any)=>{overrides=update(overrides);},
    onSaveSong:(song:any)=>{writes.push(song);return fail?Promise.reject(Error('Save failed')):new Promise(resolve=>releases.push(resolve));},
  };
  runInNewContext(ts.transpileModule(code+'\nthis.toggle=handleToggleStar;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const song={id:'one',title:'Test',isStarred:false,revision:1};
  context.toggle(song);
  assert.equal(overrides.one,true,'feedback does not wait for the server');
  context.toggle(song);
  assert.equal(overrides.one,false,'second tap is visible while first write is pending');
  assert.equal(writes.length,1);
  releases.shift()!({...writes[0],revision:2});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes.length,2);
  assert.equal(writes[1].revision,2);
  assert.equal(writes[1].isStarred,false);
  releases.shift()!({...writes[1],revision:3});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(overrides.one,undefined);
  fail=true;
  context.toggle(song);
  assert.equal(overrides.one,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(overrides.one,undefined,'failed save restores authoritative state');
  assert.equal(context.starWrites.current.size,0);
});
