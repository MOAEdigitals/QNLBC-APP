import test from 'node:test';
import assert from 'node:assert/strict';
import { isPastActivity, sortActivities } from '../src/features/activities/model.ts';

test('past activity styling uses the full saved year and leaves today active', () => {
  assert.equal(isPastActivity('2025-12-31', '2026-10-17'), true);
  assert.equal(isPastActivity('2026-10-16', '2026-10-17'), true);
  assert.equal(isPastActivity('2026-10-17', '2026-10-17'), false);
  assert.equal(isPastActivity('2027-01-01', '2026-10-17'), false);
  assert.equal(isPastActivity('2026-12-31', '2027-01-01'), true);
});

test('saved and edited activities sort by complete date then time without changing their dates', () => {
  const items = [
    { id: 'next-year', title: 'Anniversary', activityDate: '2027-01-01' },
    { id: 'afternoon', title: 'Practice', activityDate: '2026-10-17', activityTime: '14:00' },
    { id: 'last-year', title: 'Anniversary', activityDate: '2025-12-31' },
    { id: 'morning', title: 'Service', activityDate: '2026-10-17', activityTime: '09:00' },
  ];
  assert.deepEqual(sortActivities(items).map(item => item.id), ['last-year', 'morning', 'afternoon', 'next-year']);
  assert.equal(items[0].id, 'next-year');
  const edited = items.map(item => item.id === 'next-year' ? { ...item, activityDate: '2025-01-01' } : item);
  assert.equal(sortActivities(edited)[0].id, 'next-year');
  assert.equal(isPastActivity(sortActivities(edited)[0].activityDate, '2026-10-17'), true);
});
