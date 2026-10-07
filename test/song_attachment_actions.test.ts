import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/SongsTab.tsx', 'utf8').replace(/\r\n/g, '\n');

test('attached song tracks use a three-dot menu with edit and delete actions', () => {
  assert.match(source, /aria-label=\{`Actions for \$\{attachment\.name\}`\}/);
  assert.match(source, /<MoreVertical className="h-4 w-4"/);
  assert.match(source, /handleOpenEditAttachment\(attachment, event\)/);
  assert.match(source, />Edit<\/button>/);
  assert.match(source, />Delete<\/button>/);
  assert.match(source, /existingAttachment[\s\S]*?attachments: existingAttachment[\s\S]*?\.map\(/);
  assert.doesNotMatch(source, /title="Delete attachment"/);
});
