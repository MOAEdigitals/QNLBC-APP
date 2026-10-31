import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationReadTimer } from '../src/utils/notificationReadTimer.ts';

test('inbox reads only after five visible seconds, gives arrivals their own timer and cancels on close', () => {
  let now = 0, sequence = 0;
  const tasks = new Map<number, { fn: () => void; due: number }>();
  const read: string[][] = [];
  const clock = { now: () => now, later(fn: () => void, delay: number) { const id = ++sequence; tasks.set(id, { fn, due: now + delay }); return id as any; }, cancel(id: any) { tasks.delete(id); } };
  const advance = (to: number) => { now = to; for (const [id, task] of [...tasks]) if (task.due <= now) { tasks.delete(id); task.fn(); } };
  const timer = createNotificationReadTimer(ids => read.push(ids), clock);
  timer.sync(['first'], true); advance(3000);
  timer.sync(['first','new'], true); advance(4999); assert.deepEqual(read, []);
  advance(5000); assert.deepEqual(read, [['first']]);
  advance(7999); assert.equal(read.length, 1); advance(8000); assert.deepEqual(read, [['first'],['new']]);
  timer.sync(['hidden'], true); advance(10000); timer.sync(['hidden'], false); advance(20000); assert.equal(read.length, 2);
  timer.sync(['hidden'], true); advance(24999); assert.equal(read.length, 2); advance(25000); assert.deepEqual(read[2], ['hidden']);
  timer.sync(['closing'], true); timer.dispose(); advance(40000); assert.equal(read.length, 3);
});
