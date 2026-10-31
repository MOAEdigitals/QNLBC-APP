import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMonthKeys, isAnnualDatePast, orderAnnualBirthdays, orderBirthdayRecognitionMonths } from '../src/utils/recognitionOrder.ts';

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

const monthOrder = (dates: string[], today: string) => [...new Set(orderBirthdayRecognitionMonths(dates, date => date, today).map(date => date.slice(5, 7)))];

test('birthday months rotate annually from November through December and January', () => {
  const dates = Array.from({ length: 12 }, (_, month) => `1990-${String(month + 1).padStart(2, '0')}-15`);
  assert.deepEqual(monthOrder(dates, '2026-11-01'), ['11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  assert.deepEqual(monthOrder(dates, '2026-12-01'), ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']);
});

test('previous month remains first through its Sunday recognition, then moves to the end', () => {
  const dates = ['1990-10-28', '1990-10-29', '1990-10-31', '1990-11-01', '1990-11-04', '1990-11-05', '1990-12-01', '1990-01-01'];
  assert.deepEqual(orderBirthdayRecognitionMonths(dates, date => date, '2026-11-01'), [dates[1], dates[2], dates[0], dates[3], dates[4], dates[5], dates[6], dates[7]]);
  assert.deepEqual(monthOrder(dates, '2026-11-02'), ['11', '12', '01', '10']);
  assert.deepEqual(dates, ['1990-10-28', '1990-10-29', '1990-10-31', '1990-11-01', '1990-11-04', '1990-11-05', '1990-12-01', '1990-01-01']);
});

test('a finished current month moves to the end even before the calendar month ends', () => {
  const dates = ['1990-11-01', '1990-11-04', '1990-12-01', '1990-01-01', '1992-02-29'];
  assert.deepEqual(monthOrder(dates, '2026-11-02'), ['12', '01', '02', '11']);
});

test('December birthdays in the January Sunday window stay above January', () => {
  const dates = ['1990-12-30', '1990-12-31', '1990-01-01', '1990-01-06', '1990-01-07', '1990-02-01'];
  assert.deepEqual(monthOrder(dates, '2027-01-03'), ['12', '01', '02']);
  assert.deepEqual(monthOrder(dates, '2027-01-04'), ['01', '02', '12']);
});
