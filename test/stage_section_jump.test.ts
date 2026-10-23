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
  runInNewContext(ts.transpileModule(readFileSync('src/components/StagePrompterModal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    exports,
    require: (name: string) => name === 'react' ? react : new Proxy({}, { get: () => () => {} }),
  });
  const tree = exports.StagePrompterModal({ isOpen: true, onClose() {}, song: { id: 'song', title: 'Test', lyrics: 'Verse 1\nFirst lyrics\nChorus\nWe sing together\nBridge\nFinal lyrics' } });
  const nodes: any[] = [];
  function visit(node: any) {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    node.children?.forEach(visit);
  }
  visit(tree);
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
  assert.match(nav.props.style.paddingBottom, /--app-safe-bottom/);
});
