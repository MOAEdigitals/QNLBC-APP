import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredSetlistCardId, initialSetlistCardId } from '../src/utils/initialSetlistCard.ts';

const today = '2026-10-22';
const rows = [{ id: 'future', date: '2026-10-25' }, { id: 'first-today', date: today }, { id: 'second-today', date: today }, { id: 'past', date: '2026-10-21' }];

test('only Today or the nearest future card opens by default; past-only lists stay collapsed', () => {
  assert.equal(initialSetlistCardId(rows, today), 'first-today');
  assert.equal(initialSetlistCardId(rows.filter(row => row.date !== today), today), 'future');
  assert.equal(initialSetlistCardId([{ id: 'older', date: '2026-10-01' }, { id: 'recent', date: '2026-10-21' }], today), null);
  assert.equal(initialSetlistCardId([], today), null);
  const pastOnly = [{ id: 'older', date: '2026-10-01' }, { id: 'recent', date: '2026-10-21' }];
  assert.equal(featuredSetlistCardId(pastOnly, today), null, 'a past top card never receives a gradient');
  assert.equal(initialSetlistCardId(pastOnly, today), null, 'past top card stays collapsed by default');
  assert.equal(initialSetlistCardId(pastOnly, today, 'recent'), 'recent', 'explicitly opening a past card still works');
});

test('manual selection and collapse survive the session, while a fresh session reapplies the featured card', () => {
  assert.equal(initialSetlistCardId(rows, today, null, []), null);
  assert.equal(initialSetlistCardId(rows, today, null, ['second-today']), 'second-today');
  assert.equal(initialSetlistCardId(rows, today, 'past', ['second-today']), 'past');
  assert.equal(initialSetlistCardId(rows, today), 'first-today');
});


test('gradient and startup choose the same nearest card using the shared same-date order', () => {
  const cards = [{ id: 'later', date: '2026-11-01' }, { id: 'second', date: '2026-10-25', displayOrder: 1 }, { id: 'first', date: '2026-10-25', displayOrder: 0 }];
  assert.equal(featuredSetlistCardId(cards, today), 'first');
  assert.equal(initialSetlistCardId(cards, today), 'first');
  assert.equal(initialSetlistCardId(cards, today, null, []), null);
  assert.equal(initialSetlistCardId(cards, today, null, ['later']), 'later');
});
