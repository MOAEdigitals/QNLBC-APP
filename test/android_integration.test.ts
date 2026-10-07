import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync('capacitor.config.ts', 'utf8');
const vite = readFileSync('vite.config.ts', 'utf8');
const lyrics = readFileSync('src/components/LyricsScreenAwake.tsx', 'utf8');
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const media = readFileSync('src/services/cloudMediaStorage.ts', 'utf8');

test('Capacitor Android build uses the shared app bundle and a stable application id', () => {
  assert.match(config, /appId: 'com\.qnlbc\.churchapp'/);
  assert.match(config, /webDir: 'dist'/);
  assert.match(vite, /mode === 'android' \? '\.\/' : '\/QNLBC-APP\/'/);
});

test('lyrics use the native keep-awake plugin inside the Android app', () => {
  assert.match(lyrics, /Capacitor\.isNativePlatform\(\)/);
  assert.match(lyrics, /KeepAwake\.keepAwake\(\)/);
  assert.match(lyrics, /KeepAwake\.allowSleep\(\)/);
});

test('Android declares recording permission and avoids an unavailable local upload endpoint', () => {
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.match(media, /Capacitor\.isNativePlatform\(\)/);
});
