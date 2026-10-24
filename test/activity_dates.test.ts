import test from 'node:test';
import assert from 'node:assert/strict';
import { activityBadge, isPastActivity, orderActivityList, sortActivities, groupActivityMonths } from '../src/features/activities/model.ts';

test('past activity styling uses the full saved year and leaves today active', () => {
  assert.equal(isPastActivity('2025-12-31', '2026-10-17'), true);
  assert.equal(isPastActivity('2026-10-16', '2026-10-17'), true);
  assert.equal(isPastActivity('2026-10-17', '2026-10-17'), false);
  assert.equal(isPastActivity('2027-01-01', '2026-10-17'), false);
  assert.equal(isPastActivity('2026-12-31', '2027-01-01'), true);
});

test('each year places completed activities after its upcoming months', () => {
  const items = [
    { id: 'past-month', title: 'Past', activityDate: '2026-09-30' },
    { id: 'future-year', title: 'Future', activityDate: '2027-01-01' },
    { id: 'past-same-month', title: 'Past', activityDate: '2026-10-16' },
    { id: 'next', title: 'Next', activityDate: '2026-10-18' },
    { id: 'future-month', title: 'Future', activityDate: '2026-11-01' },
  ];
  assert.deepEqual(orderActivityList(items, '2026-10-17').map(item => item.id), ['next', 'future-month', 'past-same-month', 'past-month', 'future-year']);
  assert.equal(activityBadge('2026-10-18', '2026-10-17', true), 'Next up');
  assert.equal(activityBadge('2026-11-01', '2026-10-17', false), 'Upcoming');
  assert.equal(activityBadge('2026-10-17', '2026-10-17', true), 'Today');
  assert.equal(activityBadge('2026-10-16', '2026-10-17', true), null);
  assert.deepEqual(orderActivityList([], '2026-10-17'), []);
  assert.equal(orderActivityList(items, '2027-01-02')[0].id, 'future-year');
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


test('month headings keep expired October cards below November and December of the same year', () => {
  const items = [
    { id: 'past-oct', title: 'Old October', activityDate: '2026-10-20' },
    { id: 'dec', title: 'December', activityDate: '2026-12-12' },
    { id: 'today', title: 'Today', activityDate: '2026-10-24' },
    { id: 'nov', title: 'November', activityDate: '2026-11-14' },
    { id: 'past-sep', title: 'September', activityDate: '2026-09-13' },
  ];
  const groups = groupActivityMonths(items, '2026-10-24');
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.id)), ['today', 'nov', 'dec', 'past-oct', 'past-sep']);
  assert.deepEqual(groups.map(group => group.key), ['2026-10-upcoming', '2026-11-upcoming', '2026-12-upcoming', '2026-10-past', '2026-09-past']);
  assert.deepEqual(groupActivityMonths(items, '2026-10-25').flatMap(group => group.items.map(item => item.id)), ['nov', 'dec', 'today', 'past-oct', 'past-sep']);
  assert.equal(items[0].id, 'past-oct', 'presentation does not mutate saved records');
});
