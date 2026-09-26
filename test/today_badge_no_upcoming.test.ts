import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getTodayStr, isToday, isPastDate } from '../src/utils/dateUtils.ts';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const setlistsSrc = source('../src/components/SetlistsTab.tsx');
const specialNumSrc = source('../src/components/SpecialNumberTab.tsx');

test('SetlistsTab: today setlist displays only Today badge and no upcoming badge', () => {
  // soonestUpcoming must exclude today
  assert.match(
    setlistsSrc,
    /soonestUpcoming\s*=\s*useMemo\(\s*\(\)\s*=>\s*sortedSetlists\.find\(\(s\)\s*=>\s*!isPastDate\(s\.date\)\s*&&\s*!isToday\(s\.date\)\)/,
    'soonestUpcoming in SetlistsTab must exclude past dates and today'
  );

  // isSoonest must exclude today
  assert.match(
    setlistsSrc,
    /const\s+isSoonest\s*=\s*!today\s*&&\s*soonestUpcoming\?\.id\s*===\s*item\.id/,
    'isSoonest in SetlistsTab must be false when today is true'
  );

  // ★ Upcoming badge must not render for today
  assert.match(
    setlistsSrc,
    /\{isSoonest\s*&&\s*!today\s*&&\s*\(/,
    '★ Upcoming badge in SetlistsTab must guard against today'
  );

  // Upcoming badge must not render for today
  assert.match(
    setlistsSrc,
    /\{!isPast\s*&&\s*!isSoonest\s*&&\s*!today\s*&&\s*\(/,
    'Upcoming badge in SetlistsTab must guard against today'
  );

  // Today badge renders for today
  assert.match(
    setlistsSrc,
    /\{today\s*&&\s*\(\s*<span[^>]*>\s*Today\s*<\/span>\s*\)\}/,
    'Today badge in SetlistsTab must render when today is true'
  );
});

test('SpecialNumberTab: today entry displays only Today badge and no upcoming badge', () => {
  // soonestEntry must exclude today
  assert.match(
    specialNumSrc,
    /soonestEntry\s*=\s*sortedEntries\.find\(\(e\)\s*=>\s*!isPastDate\(e\.scheduledDate\)\s*&&\s*!isToday\(e\.scheduledDate\)\)/,
    'soonestEntry in SpecialNumberTab must exclude past dates and today'
  );

  // isSoonest must exclude today
  assert.match(
    specialNumSrc,
    /const\s+isSoonest\s*=\s*!today\s*&&\s*soonestEntry\?\.id\s*===\s*item\.id/,
    'isSoonest in SpecialNumberTab must be false when today is true'
  );

  // ★ Upcoming badge must not render for today
  assert.match(
    specialNumSrc,
    /\{isSoonest\s*&&\s*!today\s*&&\s*\(/,
    '★ Upcoming badge in SpecialNumberTab must guard against today'
  );
});

test('Badge determination logic: today item gets exactly Today badge and never Upcoming', () => {
  const todayStr = getTodayStr();

  const mockSetlists = [
    { id: '1', date: todayStr, title: "Today's Service" },
    { id: '2', date: '2099-01-01', title: 'Future Service' },
  ];

  const soonestUpcoming = mockSetlists.find((s) => !isPastDate(s.date) && !isToday(s.date));
  assert.equal(soonestUpcoming?.id, '2', 'Soonest upcoming should point to the future date, not today');

  // For today's item:
  const item = mockSetlists[0];
  const isPast = isPastDate(item.date);
  const today = isToday(item.date);
  const isSoonest = !today && soonestUpcoming?.id === item.id;

  const showStarUpcoming = isSoonest && !today;
  const showUpcoming = !isPast && !isSoonest && !today;
  const showToday = today;
  const showPast = isPast;

  assert.equal(showToday, true, 'Today badge should be shown');
  assert.equal(showStarUpcoming, false, '★ Upcoming badge must NOT be shown for today');
  assert.equal(showUpcoming, false, 'Upcoming badge must NOT be shown for today');
  assert.equal(showPast, false, 'Past badge must NOT be shown for today');
});
