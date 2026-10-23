import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightActivityCards, scrollActivityBelowHeader } from '../src/features/activities/highlight.ts';

test('all cards for a chosen date pulse three times over 1.5 seconds and repeated taps restart',()=>{
 let cancelled=0;
 const calls: {frames:any,options:any}[]=[];
 const cards=Array.from({length:2},()=>({
  getAnimations:()=>[{id:'activity-date-highlight',cancel:()=>cancelled++},{id:'other',cancel:()=>assert.fail('unrelated animation cancelled')}],
  animate:(frames:any,options:any)=>{calls.push({frames,options});return {id:''};}
 })) as unknown as HTMLElement[];
 highlightActivityCards(cards);
 assert.equal(calls.length,2);
 assert.equal(cancelled,2);
 for(const call of calls) {
  assert.equal(call.options.duration*call.options.iterations,1500);
  assert.equal(call.options.iterations,3);
  assert.equal(call.frames[1].outlineWidth,'2px');
 }
});
test('reduced motion uses one steady outline for the same duration',()=>{
 let frames:any,options:any;
 const card={getAnimations:()=>[],animate:(f:any,o:any)=>{frames=f;options=o;return {id:''};}} as unknown as HTMLElement;
 highlightActivityCards([card],true);
 assert.deepEqual(frames[0],frames[1]);
 assert.equal(options.duration,1500);
 assert.equal(options.iterations,1);
});


test('calendar destinations stop below the measured sticky header, including tall safe-area headers', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const calls: any[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { scrollY: 300, scrollTo: (options: any) => calls.push(options) } });
  try {
    const card = { getBoundingClientRect: () => ({ top: 500 }) } as HTMLElement;
    const header = { getBoundingClientRect: () => ({ bottom: 108 }) } as HTMLElement;
    scrollActivityBelowHeader(card, header);
    assert.deepEqual(calls[0], { top: 680, behavior: 'smooth' });
    scrollActivityBelowHeader(card, null, true);
    assert.deepEqual(calls[1], { top: 788, behavior: 'instant' });
  } finally { if (original) Object.defineProperty(globalThis, 'window', original); else delete (globalThis as any).window; }
});
