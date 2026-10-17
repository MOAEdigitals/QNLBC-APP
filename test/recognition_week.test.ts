import test from 'node:test';
import assert from 'node:assert/strict';
import { isBirthdayRecognitionWeek } from '../src/utils/dateUtils.ts';

test('Sunday badge includes Sunday through the following Saturday and excludes adjacent days', () => {
  const now = new Date(2026, 9, 18, 12);
  for (const day of [18,19,20,21,22,23,24]) assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), true);
  for (const day of [17,25]) assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), false);
});
test('Monday through Saturday prepare for the coming Sunday, and Sunday uses today', () => {
  for (let day=12; day<=18; day++) {
    assert.equal(isBirthdayRecognitionWeek('1990-10-18', new Date(2026,9,day)),true);
    assert.equal(isBirthdayRecognitionWeek('1990-10-24', new Date(2026,9,day)),true);
    assert.equal(isBirthdayRecognitionWeek('1990-10-17', new Date(2026,9,day)),false);
  }
  assert.equal(isBirthdayRecognitionWeek('1990-10-18', new Date(2026,9,19)),false);
  assert.equal(isBirthdayRecognitionWeek('1990-10-25', new Date(2026,9,19)),true);
});
test('recognition week crosses year boundaries without including invalid leap dates', () => {
  const now=new Date(2026,11,27);
  assert.equal(isBirthdayRecognitionWeek('1990-12-31',now),true);
  assert.equal(isBirthdayRecognitionWeek('1990-01-02',now),true);
  assert.equal(isBirthdayRecognitionWeek('1990-01-03',now),false);
  assert.equal(isBirthdayRecognitionWeek('2000-02-29',new Date(2028,1,27)),true);
  assert.equal(isBirthdayRecognitionWeek('2000-02-29',new Date(2027,2,1)),false);
});
