import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('all shared add/edit dialogs keep scrollable fields separate from bottom actions', () => {
  let checked = 0;
  for (const file of ['SongsTab', 'SetlistsTab', 'SpecialNumberTab', 'RecognitionsTab']) {
    const path = `src/components/${file}.tsx`;
    const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hasClass = (node: ts.Node, name: string) => ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(ast) === 'className' && attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text.split(/\s+/).includes(name));
    function visit(node: ts.Node) {
      if (hasClass(node, 'ui-form-actions')) {
        checked++;
        assert.ok(!hasClass(node.parent, 'ui-form-body'), `${file}: actions cannot scroll with fields`);
        assert.ok(ts.isJsxElement(node.parent));
        assert.ok(node.parent.children.some(child => hasClass(child, 'ui-form-body')), `${file}: actions need a separate scrolling sibling`);
        for (let ancestor: ts.Node | undefined = node.parent; ancestor; ancestor = ancestor.parent) assert.ok(!hasClass(ancestor, 'ui-form-body'));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.equal(checked, 13, 'covers setlist program variants and all song, schedule, practice, track, vocal, choir and recognition dialogs');
});

test('suggestion placement stays above actions and hides when its input scrolls behind them', () => {
  const source = readFileSync('src/components/AutofillInput.tsx', 'utf8');
  const handler = source.slice(source.indexOf('  const positionMobilePicker ='), source.indexOf('  const cleanVal ='));
  let position: any;
  let inputBounds = { top: 300, bottom: 344, left: 20, width: 350 };
  const body = { getBoundingClientRect: () => ({ top: 90, bottom: 400 }) };
  const footer = { querySelector: () => true, getBoundingClientRect: () => ({ top: 400, bottom: 480, height: 80 }) };
  const form = { getBoundingClientRect: () => ({ top: 90, bottom: 480 }), querySelectorAll: () => [footer] };
  const input = { closest: (selector: string) => selector === 'form' ? form : body, getBoundingClientRect: () => inputBounds };
  const pickerSource = readFileSync('src/utils/pickerPlacement.ts', 'utf8').replace('export function', 'function');
  const run = runInNewContext(ts.transpileModule(`${pickerSource}\n${handler}\npositionMobilePicker;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    inputRef: { current: input }, window: { innerHeight: 480, innerWidth: 390 }, setMobilePickerPosition: (value: any) => { position = value; },
  });
  run();
  assert.ok(position.top >= 90);
  assert.ok(position.top + position.maxHeight <= 394);
  assert.ok(position.maxHeight > 0);
  inputBounds = { ...inputBounds, top: 410, bottom: 454 };
  run();
  assert.equal(position.maxHeight, 0, 'input hidden behind Save/Cancel cannot leave an overlay');
  inputBounds = { ...inputBounds, top: 30, bottom: 74 };
  run();
  assert.equal(position.maxHeight, 0, 'input hidden behind the modal header cannot leave an overlay');
});
