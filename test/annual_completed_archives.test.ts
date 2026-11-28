import test from 'node:test';
import assert from 'node:assert/strict';
import { completedAnnualOccurrences } from '../src/utils/recognitionDetails.ts';

test('annual archives use occurrence years, preserve pending cross-year recognition, and do not duplicate records',()=>{
  const items=[{id:'old',date:'1980-11-01'},{id:'recognize',date:'2000-11-27'},{id:'future',date:'2000-11-30'},{id:'carry',date:'2000-12-31'}];
  const before=JSON.stringify(items);
  const render=(today:string)=>completedAnnualOccurrences(items,item=>item.date,today,()=> '2026-10-01');
  assert.deepEqual(render('2026-11-28').map(entry=>entry.item.id),['old']);
  const rollover=render('2027-01-01');
  assert.deepEqual(rollover.map(entry=>entry.date),['2026-11-01','2026-11-27','2026-11-30']);
  assert.ok(rollover.every(entry=>entry.year===2026));
  assert.ok(render('2027-01-08').some(entry=>entry.item.id==='carry'&&entry.date==='2026-12-31'));
  assert.equal(JSON.stringify(items),before);
  assert.equal(rollover[0].item,items[0],'archive is a view of the original annual record');
});

test('a newly added annual record is not backfilled into earlier archive years and leap-day birthdays stay available',()=>{
  const created=[{date:'2000-01-01',createdAt:'2027-01-01'}];
  assert.deepEqual(completedAnnualOccurrences(created,item=>item.date,'2027-02-01',item=>item.createdAt).map(entry=>entry.date),['2027-01-01']);
  const leap=completedAnnualOccurrences([{date:'2000-02-29'}],item=>item.date,'2026-11-28',()=>undefined);
  assert.equal(leap[0].date,'2026-02-29');
});
