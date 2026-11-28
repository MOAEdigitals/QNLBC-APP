import test from 'node:test';
import assert from 'node:assert/strict';
import { latestRead, beginReadMutation } from '../src/services/latestRead.ts';
import { readAllPages, readRelatedPages } from '../src/services/readAllPages.ts';

const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject}; };
test('late snapshots cannot resurrect a deletion or remove a newly created record', async () => {
  const old = deferred<string[]>(), current = deferred<string[]>();
  const a = latestRead('membership-test', () => old.promise);
  await Promise.resolve();
  const b = latestRead('membership-test', () => current.promise);
  current.resolve(['new']); assert.deepEqual(await b, ['new']);
  old.resolve(['deleted']); assert.deepEqual(await a, ['new']);
});
test('reads during writes wait for commit and invalidated reads repeat after commit', async () => {
  const first = deferred<string[]>(); let calls=0;
  const load=() => ++calls===1 ? first.promise : Promise.resolve(['committed']);
  const read = latestRead('mutation-test', load); await Promise.resolve();
  const finish=beginReadMutation('mutation-test'); first.resolve(['stale']);
  await new Promise(resolve=>setTimeout(resolve,0)); assert.equal(calls,1);
  finish(); assert.deepEqual(await read,['committed']); assert.equal(calls,2);
});
test('failed older reads use newer results and failed writes release waiting readers', async () => {
  const old=deferred<string[]>();const a=latestRead('error-test',()=>old.promise);
  await Promise.resolve();
  const finish=beginReadMutation('error-test'); const b=latestRead('error-test',async()=>['server']);
  finish();old.reject(Error('old connection'));assert.deepEqual(await a,['server']);assert.deepEqual(await b,['server']);
});
test('complete paging respects a lower server cap and rejects partial errors and changing snapshots', async () => {
  const rows=Array.from({length:1203},(_,id)=>({id}));const offsets:number[]=[];
  const result=await readAllPages(()=>({range:async(from:number,to:number)=>{offsets.push(from);return {data:rows.slice(from,Math.min(to+1,from+175)),count:rows.length,error:null};}}));
  assert.equal(result.data?.length,1203);assert.deepEqual(offsets,[0,175,350,525,700,875,1050]);
  let count=0;
  const failed=await readAllPages(()=>({range:async()=>++count===1?{data:rows.slice(0,500),count:1203}:{error:Error('Connection lost')}}));
  assert.equal(failed.data,null);assert.match(failed.error.message,/Connection lost/);
  count=0;
  const changed=await readAllPages(()=>({range:async()=>({data:rows.slice(0,500),count:++count===1?1203:1202})}));
  assert.equal(changed.data,null);assert.match(changed.error.message,/changed/);
});
test('large relationship reads split IDs into bounded batches and retain every child', async () => {
  const ids=Array.from({length:1205},(_,i)=>String(i)),sizes:number[]=[];
  const result=await readRelatedPages(ids,batch=>{sizes.push(batch.length);return {range:async()=>({data:batch.map(id=>({id})),count:batch.length})};});
  assert.equal(result.data?.length,ids.length);assert.ok(sizes.every(size=>size<=100));
});
