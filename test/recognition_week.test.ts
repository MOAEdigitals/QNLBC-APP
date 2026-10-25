import test from 'node:test';
import assert from 'node:assert/strict';
import { isBirthdayRecognitionWeek, isAnniversaryRecognitionWeek } from '../src/utils/dateUtils.ts';

test('October 25 Sunday recognizes October 22–28 birthdays, with Sunday in the middle', () => {
  const now = new Date(2026, 9, 25, 12);
  for (const day of [22, 23, 24, 25, 26, 27, 28]) {
    assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), true, `October ${day}`);
  }
  for (const day of [21, 29]) assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), false);
});

test('Monday through Saturday prepare for the coming Sunday; Sunday uses today', () => {
  for (let day = 19; day <= 25; day++) {
    const now = new Date(2026, 9, day, 23, 59, 59);
    assert.equal(isBirthdayRecognitionWeek('1990-10-22', now), true);
    assert.equal(isBirthdayRecognitionWeek('1990-10-28', now), true);
    assert.equal(isBirthdayRecognitionWeek('1990-10-21', now), false);
    assert.equal(isBirthdayRecognitionWeek('1990-10-29', now), false);
  }
  const monday = new Date(2026, 9, 26);
  assert.equal(isBirthdayRecognitionWeek('1990-10-28', monday), false);
  assert.equal(isBirthdayRecognitionWeek('1990-10-29', monday), true);
  assert.equal(isBirthdayRecognitionWeek('1990-11-04', monday), true);
  assert.equal(isBirthdayRecognitionWeek('1990-11-05', monday), false);
});

test('recognition window includes both dates across month and year boundaries', () => {
  const now = new Date(2027, 0, 3);
  for (const date of ['1990-12-31', '1990-01-01', '1990-01-03', '1990-01-06']) {
    assert.equal(isBirthdayRecognitionWeek(date, now), true, date);
  }
  for (const date of ['1990-12-30', '1990-01-07']) {
    assert.equal(isBirthdayRecognitionWeek(date, now), false, date);
  }
});

test('leap birthdays are included only when February 29 exists in the recognition year', () => {
  assert.equal(isBirthdayRecognitionWeek('2000-02-29', new Date(2028, 1, 27)), true);
  assert.equal(isBirthdayRecognitionWeek('2000-02-29', new Date(2026, 2, 1)), false);
  for (const date of ['', 'invalid', '2000-13-01', '2000-02-30']) {
    assert.equal(isBirthdayRecognitionWeek(date, new Date(2026, 2, 1)), false, date);
  }
});

test('anniversary cards retain their Sunday-through-Saturday window', () => {
  const now = new Date(2026, 9, 25);
  assert.equal(isAnniversaryRecognitionWeek('1990-10-24', now), false);
  assert.equal(isAnniversaryRecognitionWeek('1990-10-25', now), true);
  assert.equal(isAnniversaryRecognitionWeek('1990-10-31', now), true);
  assert.equal(isAnniversaryRecognitionWeek('1990-11-01', now), false);
});
