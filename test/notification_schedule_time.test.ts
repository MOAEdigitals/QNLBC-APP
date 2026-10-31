import test from 'node:test';
import assert from 'node:assert/strict';
import { philippineScheduleISO } from '../src/utils/notificationSchedule.ts';
test('custom send times use Philippine time independently of the device timezone', () => {
  assert.equal(philippineScheduleISO('2099-11-01T06:00'), '2099-10-31T22:00:00.000Z');
  assert.throws(() => philippineScheduleISO('2020-01-01T06:00'), /future/);
  assert.throws(() => philippineScheduleISO(''), /Choose/);
});
