import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAppTab } from '../src/utils/tabNavigation.ts';

test('first open with no tab and unknown URLs default to Schedules', () => {
  for (const hash of ['', '#', '#unknown', '#constructor', '#Songs']) {
    assert.equal(initialAppTab(hash), 'special-numbers');
  }
});

test('refresh preserves each main tab from its URL', () => {
  for (const tab of ['home', 'recognitions', 'special-numbers', 'songs', 'settings']) {
    assert.equal(initialAppTab(`#${tab}`), tab);
  }
});
