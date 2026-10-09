import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTracksFirst } from '../src/utils/songTracks.ts';

test('tracks-first sorts playable attachments and legacy backing links ahead of songs without tracks', () => {
  const song = (title: string, extra = {}) => ({ id: title, title, lyrics: '', ...extra });
  const songs = [song('A'), song('Z', { attachments: [{ type: 'audio', url: 'https://example.com/audio' }] }),
    song('B', { minusOneLink: 'https://example.com/backing' }), song('C', { attachments: [{ type: 'text', url: 'https://example.com/text' }] })];
  assert.deepEqual(songs.sort(compareTracksFirst).map(s => s.title), ['B', 'Z', 'A', 'C']);
});
