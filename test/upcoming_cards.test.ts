import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingCardStatuses } from '../src/utils/upcomingCards.ts';

test('only the nearest two future cards receive a status, without mutating list order', () => {
  const entries = [
    { id: 'later', date: '2026-11-02' },
    { id: 'past', date: '2026-10-20' },
    { id: 'next', date: '2026-10-25' },
    { id: 'today', date: '2026-10-22' },
    { id: 'second', date: '2026-10-28' },
    { id: 'undated' },
  ];
  const original = [...entries];
  const statuses = upcomingCardStatuses(entries, item => item.date, '2026-10-22');
  assert.deepEqual([...statuses], [['next', 'next-up'], ['second', 'upcoming']]);
  assert.deepEqual(entries, original);
  assert.equal(statuses.get('later'), undefined);
  // A search only hides cards; it does not promote a later result to "Next up".
  assert.equal(entries.filter(item => item.id === 'later').map(item => statuses.get(item.id))[0], undefined);
});

test('completed choir and practice entries are excluded and practice date takes priority', () => {
  const entries = [
    { id: 'done', practiceDate: '2026-10-23', isDone: true },
    { id: 'practice', practiceDate: '2026-10-24', targetDate: '2026-11-08' },
    { id: 'target-only', targetDate: '2026-10-25' },
    { id: 'invalid', targetDate: 'not-a-date' },
  ];
  assert.deepEqual([...upcomingCardStatuses(entries, item => item.practiceDate || item.targetDate, '2026-10-22', item => !item.isDone)], [
    ['practice', 'next-up'], ['target-only', 'upcoming'],
  ]);
});

test('ties stay stable and past-only or empty lists have no badges', () => {
  assert.deepEqual([...upcomingCardStatuses([{ id: 'a', date: '2026-10-25' }, { id: 'b', date: '2026-10-25' }], item => item.date, '2026-10-22')], [['a', 'next-up'], ['b', 'upcoming']]);
  assert.equal(upcomingCardStatuses([{ id: 'a', date: '2026-10-21' }], item => item.date, '2026-10-22').size, 0);
  assert.equal(upcomingCardStatuses([], () => undefined, '2026-10-22').size, 0);
});
