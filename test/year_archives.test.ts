import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { createUiTestLoader } from './ui_test_components.ts';
const React = createRequire(import.meta.url)('react');
const dom = new JSDOM('');
const { splitPreviousYears, yearList, monthList } = createUiTestLoader(dom, React)('./MonthSeparators');
const rows = [{ id: 'old', date: '2025-02-02' }, { id: 'recent', date: '2026-12-31' }, { id: 'current', date: '2027-01-01' }, { id: 'future', date: '2028-01-01' }, { id: 'undated', date: '' }];
const dateOf = (item: any) => item.date;
const cards = (items: any[]) => items.map(item => React.createElement('article', { key: item.id }, item.id));
test('2027 rollover archives 2026 and older, preserving current/future/undated and input data', () => {
  const before = JSON.stringify(rows);
  const result = splitPreviousYears(rows, dateOf, 2027);
  assert.deepEqual(Array.from(result.current, (row: any) => row.id), ['current', 'future', 'undated']);
  assert.deepEqual(Array.from(result.previous, (pair: any) => pair[0]), [2026, 2025]);
  assert.equal(JSON.stringify(rows), before);
  const rendered = yearList(rows, dateOf, cards, { currentYear: 2027 });
  const archives = rendered.filter((node: any) => node.type === 'details');
  assert.equal(archives.length, 2);
  assert.ok(archives.every((node: any) => node.props.open === undefined));
  assert.equal(archives[0].props.children[1].props.children[0].props.children, 'recent');
});
test('search reveals archives, deep links reveal only the matching year', () => {
  const render = (options: any) => yearList(rows, dateOf, cards, { currentYear: 2027, ...options }).filter((node: any) => node.type === 'details');
  assert.ok(render({ reveal: true }).every((node: any) => node.props.open));
  assert.deepEqual(Array.from(render({ revealYear: '2025' }), (node: any) => !!node.props.open), [false, true]);
});
test('annual recognition grouping stays unchanged; selected practice detail bypasses archive', () => {
  const annual = monthList(rows, dateOf, ['birthday', 'birthdays'], { annual: true }).render((row: any) => React.createElement('article', { key: row.id }));
  assert.ok(annual.every((node: any) => node.type !== 'details'));
  const detail = monthList(rows.slice(0, 1), dateOf, ['practice', 'practices'], { archive: true, hidden: true }).render((row: any) => React.createElement('article', { key: row.id }));
  assert.equal(detail[0].type, 'article');
});

test('compact month groups preserve every card and month order without grouping a selected detail', () => {
  const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');
  const entries = [{ id: 'first', date: '2026-11-08' }, { id: 'second', date: '2026-11-15' }, { id: 'third', date: '2026-12-06' }];
  const render = (options: any) => monthList(entries, dateOf, ['choir song', 'choir songs'], options).render((row: any) => React.createElement('article', { key: row.id }, row.id));
  const document = new JSDOM(renderToStaticMarkup(React.createElement(React.Fragment, null, ...render({ groupClassName: 'compact-agenda-group' })))).window.document;
  const groups = [...document.querySelectorAll('.compact-agenda-group')];
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => [...group.querySelectorAll('article')].map(card => card.textContent)), [['first', 'second'], ['third']]);
  assert.deepEqual([...document.querySelectorAll('[role="heading"]')].map(heading => heading.textContent), ['November 2026', 'December 2026']);
  assert.ok(render({ hidden: true, groupClassName: 'compact-agenda-group' }).every((node: any) => node.type === 'article'));
});
