import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

test('Schedules keeps every subtab one tap away and labels only the selected item on mobile', () => {
  const source = read('src/components/SpecialNumberTab.tsx');
  assert.match(source, /aria-label="Schedules sections" className="flex gap-1\.5/);
  assert.match(source, /activeSubTab === 'schedules' \? 'flex-1' : 'w-11 shrink-0'/);
  assert.match(source, /activeSubTab === tab \? 'inline' : 'hidden'/);
});

test('Recognitions keeps every subtab one tap away and labels only the selected item on mobile', () => {
  const source = read('src/components/RecognitionsTab.tsx');
  assert.match(source, /recognition-tabs flex gap-1\.5/);
  assert.match(source, /subTab === 'birthdays' \? 'flex-1' : 'w-11 shrink-0'/);
  assert.match(source, /subTab === 'visitors' \? 'inline' : 'hidden'/);
});
