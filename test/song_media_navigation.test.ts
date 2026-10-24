import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledSongMedia } from '../src/utils/songMediaNavigation.ts';
import { getYouTubeEmbedUrl } from '../src/utils/mediaUtils.ts';
import type { Song } from '../src/types.ts';

const song = { id: 'song-one', title: 'Who Am I', lyrics: 'Lyrics remain in the library', attachments: [{ id: 'existing', name: 'Library recording', type: 'audio', urlOrData: 'https://example.com/library.mp3' }] } as Song;

test('schedule playback uses the scheduled link instead of a different library recording, without saving a song', () => {
  const original = JSON.stringify(song);
  const url = 'https://youtu.be/12345678901?si=from-schedule';
  const media = scheduledSongMedia(song, url);
  assert.equal(media.url, url);
  assert.equal(media.type, 'link');
  assert.match(getYouTubeEmbedUrl(media.url) || '', /12345678901\?autoplay=1/);
  assert.equal(JSON.stringify(song), original);
});

test('matching attachments keep their identity and direct media links work with query strings', () => {
  const media = scheduledSongMedia(song, ' https://example.com/library.mp3 ');
  assert.equal(media.id, 'existing');
  assert.equal(media.name, 'Library recording');
  assert.equal(media.type, 'audio');
  for (const extension of ['mp3', 'm4a', 'ogg']) assert.equal(scheduledSongMedia(song, `https://example.com/track.${extension}?download=1`).type, 'audio');
  assert.equal(scheduledSongMedia(song, 'https://example.com/video.mp4?token=test').type, 'video');
});
