import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLIDAYS, EMPTY_OVERLAY_FILTERS, calendarOverlays } from '../src/features/activities/calendarOverlays.ts';

test('verified holidays cover 2026 and 2027 with accurate movable dates and local scope', () => {
  assert.equal(HOLIDAYS.length, 43);
  assert.equal(new Set(HOLIDAYS.map(item => item.id)).size, HOLIDAYS.length);
  for (const item of HOLIDAYS) {
    assert.match(item.date, /^202[67]-\d{2}-\d{2}$/);
    assert.ok(item.source?.startsWith('https://'));
  }
  const holiday = (date: string) => HOLIDAYS.find(item => item.date === date);
  assert.equal(holiday('2026-02-17')?.title, 'Chinese New Year');
  assert.equal(holiday('2027-02-06')?.title, 'Chinese New Year');
  assert.equal(holiday('2026-03-20')?.title, 'Eid’l Fitr');
  assert.equal(holiday('2026-05-27')?.title, 'Eid’l Adha');
  assert.equal(HOLIDAYS.some(item => item.date.startsWith('2027') && /Eid/.test(item.title)), false, 'unproclaimed 2027 Eid dates are not guessed');
  assert.equal(holiday('2026-04-25')?.kind, 'local');
  assert.equal(holiday('2027-04-25'), undefined, 'one-off 2026 proclamation does not silently recur');
  for (const year of [2026, 2027]) {
    assert.equal(holiday(`${year}-09-02`)?.title, 'Araw ng Nueva Ecija');
    assert.equal(holiday(`${year}-08-19`), undefined, 'Quezon City/Province holiday does not apply to Quezon, Nueva Ecija');
    assert.match(holiday(`${year}-02-25`)!.detail, /working/);
  }
});

test('calendar layers default off and filter independently without creating church activities', () => {
  assert.deepEqual(calendarOverlays(2026, [], EMPTY_OVERLAY_FILTERS), []);
  const national = calendarOverlays(2026, [], { ...EMPTY_OVERLAY_FILTERS, ph: true });
  assert.equal(national.length, 21);
  assert.ok(national.every(item => item.kind === 'ph'));
  assert.equal(calendarOverlays(2027, [], { ...EMPTY_OVERLAY_FILTERS, ph: true }).length, 19);
  assert.equal(calendarOverlays(2026, [], { ...EMPTY_OVERLAY_FILTERS, local: true }).length, 2);
  assert.equal(calendarOverlays(2027, [], { ...EMPTY_OVERLAY_FILTERS, local: true }).length, 1);
  assert.equal(calendarOverlays(2026, [], { ...EMPTY_OVERLAY_FILTERS, ph: true }, 'Christmas').length, 2);
});

test('birthday dots use actual month/day each year, handling leap years and multiple celebrants', () => {
  const birthdays = [{ id: 'one', name: 'Roger', birthDate: '2000-11-02' }, { id: 'two', name: 'Joshua', birthDate: '1990-11-02' }, { id: 'leap', name: 'Leap', birthDate: '2000-02-29' }];
  const before = JSON.stringify(birthdays);
  const enabled = { ...EMPTY_OVERLAY_FILTERS, birthday: true };
  for (const year of [2026, 2027]) {
    const entries = calendarOverlays(year, birthdays, enabled);
    assert.equal(entries.length, 2);
    assert.ok(entries.every(item => item.date === `${year}-11-02`));
  }
  assert.equal(calendarOverlays(2028, birthdays, enabled).find(item => item.title === 'Leap')?.date, '2028-02-29');
  assert.equal(calendarOverlays(2027, birthdays, enabled, 'Roger').length, 1);
  assert.equal(JSON.stringify(birthdays), before);
});
