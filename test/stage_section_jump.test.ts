import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('section jump aligns the selected heading with the lyrics viewport, including the last section', () => {
  const refs: any[] = [];
  const react = {
    useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: (current: any) => { const ref = { current }; refs.push(ref); return ref; },
    useEffect: () => {},
    useMemo: (fn: any) => fn(),
    useCallback: (fn: any) => fn,
    createElement: (tag: any, props: any, ...children: any[]) => ({ tag, props: props || {}, children: children.flat(Infinity) }),
  };
  const exports: any = {};
  const preferences = new Map<string, string>();
  runInNewContext(ts.transpileModule(readFileSync('src/components/StagePrompterModal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    exports,
    localStorage: {
      getItem: (key: string) => preferences.get(key) ?? null,
      setItem: (key: string, value: string) => preferences.set(key, value),
    },
    require: (name: string) => name === 'react' ? react : new Proxy({}, { get: () => () => {} }),
  });
  const props = { isOpen: true, onClose() {}, song: { id: 'song', title: 'Test', lyrics: 'Verse 1\nFirst lyrics\nChorus\nWe sing together\nBridge\nFinal lyrics' } };
  const nodes: any[] = [];
  function visit(node: any) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    node.children?.forEach(visit);
  }
  visit(exports.StagePrompterModal(props));
  let target: any;
  const main = nodes.find(node => node.tag === 'main');
  main.props.ref.current = {
    scrollTop: 240,
    getBoundingClientRect: () => ({ top: 72 }),
    scrollTo: (options: any) => { target = options; },
  };
  const sections = nodes.filter(node => node.tag === 'section');
  sections.forEach((node, index) => node.props.ref({ getBoundingClientRect: () => ({ top: 72 + index * 300 - 240 }) }));
  const chorus = nodes.find(node => node.props['aria-label'] === 'Jump to Chorus');
  chorus.props.onClick();
  assert.equal(target.top, 300);
  assert.equal(target.behavior, 'instant');
  nodes.find(node => node.props['aria-label'] === 'Jump to Bridge').props.onClick();
  assert.equal(target.top, 600);
  assert.ok('minHeight' in sections.at(-1).props.style, 'last section reserves space to reach the viewport top');
  const nav = nodes.find(node => node.tag === 'nav');
  assert.match(nav.props.className, /order-3/);
  assert.match(nav.props.className, /var\(--app-safe-bottom,0px\)\+0\.75rem/);
  const alignmentButton = () => nodes.find(node => node.props['aria-label'] === 'Center lyrics');
  const lyrics = () => nodes.find(node => node.props['data-lyrics-alignment']);
  assert.equal(alignmentButton().props['aria-pressed'], false);
  assert.match(lyrics().props.className, /text-left/);
  alignmentButton().props.onClick();
  nodes.length = 0;
  visit(exports.StagePrompterModal(props));
  assert.equal(alignmentButton().props['aria-pressed'], true);
  assert.match(lyrics().props.className, /text-center/);
  alignmentButton().props.onClick();
  assert.equal(preferences.get('worship_stage_lyrics_alignment'), 'left');
});
