import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMonthKeys, isAnnualDatePast, orderAnnualBirthdays } from '../src/utils/recognitionOrder.ts';

test('birthdays keep the current month first with today/future before elapsed dates', () => {
  const dates = ['1990-09-20', '1990-10-04', '2000-12-01', '2000-10-25', '1994-10-22', '2000-10-18', '2000-11-01', '1990-08-30'];
  assert.deepEqual(orderAnnualBirthdays(dates, date => date, '2026-10-22'), ['1994-10-22', '2000-10-25', '2000-10-18', '1990-10-04', '2000-11-01', '2000-12-01', '1990-09-20', '1990-08-30']);
  assert.equal(isAnnualDatePast('1990-10-21', '2026-10-22'), true);
  assert.equal(isAnnualDatePast('1990-10-22', '2026-10-22'), false);
  assert.equal(isAnnualDatePast('1990-10-23', '2026-10-22'), false);
});

test('birthdays reset each January and preserve the source list', () => {
  const dates = ['1990-12-01', '1990-01-01', '1990-01-20'];
  assert.deepEqual(orderAnnualBirthdays(dates, date => date, '2027-01-02'), ['1990-01-20', '1990-01-01', '1990-12-01']);
  assert.deepEqual(dates, ['1990-12-01', '1990-01-01', '1990-01-20']);
});

test('event months keep elapsed current-month cards before moving into later months', () => {
  const months = ['2026-09', '2027-01', '2026-11', '2026-10', '2025-10'];
  assert.deepEqual(months.sort((a, b) => compareMonthKeys(a, b, '2026-10')), ['2026-10', '2026-11', '2027-01', '2026-09', '2025-10']);
});
