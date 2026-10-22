import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSetlistCardId } from '../src/utils/initialSetlistCard.ts';

const today = '2026-10-22';
const rows = [{ id: 'future', date: '2026-10-25' }, { id: 'first-today', date: today }, { id: 'second-today', date: today }, { id: 'past', date: '2026-10-21' }];

test('only the first Today opens by default; Next up and past cards never auto-open', () => {
  assert.equal(initialSetlistCardId(rows, today), 'first-today');
  assert.equal(initialSetlistCardId(rows.filter(row => row.date !== today), today), null);
  assert.equal(initialSetlistCardId([], today), null);
});

test('manual selection and collapse survive the session, while a fresh session reapplies Today', () => {
  assert.equal(initialSetlistCardId(rows, today, null, []), null);
  assert.equal(initialSetlistCardId(rows, today, null, ['second-today']), 'second-today');
  assert.equal(initialSetlistCardId(rows, today, 'past', ['second-today']), 'past');
  assert.equal(initialSetlistCardId(rows, today), 'first-today');
});
