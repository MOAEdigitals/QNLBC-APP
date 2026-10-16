import test from 'node:test';
import assert from 'node:assert/strict';
import { isBirthdayRecognitionWeek } from '../src/utils/dateUtils.ts';

test('Sunday badge includes Thursday through Wednesday and excludes adjacent days', () => {
  const now = new Date(2026, 9, 18, 12);
  for (const day of [15,16,17,18,19,20,21]) assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), true);
  for (const day of [14,22]) assert.equal(isBirthdayRecognitionWeek(`1990-10-${day}`, now), false);
});
test('recognition week stays stable from Thursday through Wednesday and rolls on Thursday', () => {
  for (let day=15; day<=21; day++) assert.equal(isBirthdayRecognitionWeek('1990-10-15', new Date(2026,9,day)),true);
  assert.equal(isBirthdayRecognitionWeek('1990-10-15', new Date(2026,9,22)),false);
});
test('recognition week crosses year boundaries without including invalid leap dates', () => {
  const now=new Date(2027,0,3);
  assert.equal(isBirthdayRecognitionWeek('1990-12-31',now),true);
  assert.equal(isBirthdayRecognitionWeek('1990-01-06',now),true);
  assert.equal(isBirthdayRecognitionWeek('1990-01-07',now),false);
  assert.equal(isBirthdayRecognitionWeek('2000-02-29',new Date(2027,2,1)),false);
});
