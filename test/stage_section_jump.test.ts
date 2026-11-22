import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('section jump aligns the selected heading with the lyrics viewport, including the last section', () => {
  const refs: any[] = [];
  let retainState = false;
  let stateCursor = 0;
  const states: any[] = [];
  const react = {
    useState: (initial: any) => {
      const value = () => typeof initial === 'function' ? initial() : initial;
      if (!retainState) return [value(), () => {}];
      const index = stateCursor++;
      if (!(index in states)) states[index] = value();
      return [states[index], (next: any) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
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
      removeItem: (key: string) => preferences.delete(key),
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
  assert.match(nodes.find(node => node.tag === 'span' && node.children.includes('Chorus')).props.className, /text-amber-900/);
  assert.match(nodes.find(node => node.tag === 'span' && node.children.includes('Verse 1')).props.className, /text-sky-900/);
  assert.match(nodes.find(node => node.props['aria-label'] === 'Jump to Verse 1').props.className, /bg-slate-100/);
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

  retainState = true;
  const renderSong = (userId: string, id: string, lyrics: string, remount = false) => {
    if (remount) states.length = 0;
    stateCursor = 0;
    nodes.length = 0;
    visit(exports.StagePrompterModal({ ...props, userId, song: { ...props.song, id, lyrics } }));
    nodes.find(node => node.tag === 'main').props.ref.current = main.props.ref.current;
    nodes.filter(node => node.tag === 'section').forEach((node, index) => {
      node.props.ref({ getBoundingClientRect: () => ({ top: 72 + index * 300 - 240 }) });
    });
  };
  const repeat = () => nodes.find(node => node.props['aria-label'] === 'Repeat Chorus');
  const next = () => nodes.find(node => node.props['aria-label'] === 'Next lyrics section');
  const singleSong = 'Verse 1\nOne\n[Chorus]\nRefrain line\nVerse 2\nTwo\nBridge:\nBridge line\nEnding\nDone';
  renderSong('alice', 'one', singleSong);
  assert.equal(repeat().props['aria-pressed'], false);
  assert.equal(next(), undefined);
  repeat().props.onClick();
  renderSong('alice', 'two', singleSong);
  assert.equal(repeat().props['aria-pressed'], false);
  repeat().props.onClick();
  renderSong('bob', 'one', singleSong, true);
  assert.equal(repeat().props['aria-pressed'], false);
  renderSong('alice', 'two', singleSong, true);
  assert.equal(repeat().props['aria-pressed'], true);
  renderSong('alice', 'one', singleSong, true);
  assert.equal(repeat().props['aria-pressed'], true);
  nodes.find(node => node.props['aria-label'] === 'Jump to Verse 1').props.onClick();
  renderSong('alice', 'one', singleSong);
  assert.deepEqual(nodes.filter(node => node.tag === 'section').map(node => Boolean(node.props['data-lyrics-dimmed'])), [false, true, true, true, true]);
  assert.match(nodes.find(node => node.props['aria-label'] === 'Jump to Verse 1').props.className, /bg-sky-400/);
  assert.equal(nodes.filter(node => node.props['data-lyrics-focus-outline']).length, 1);
  for (const position of [300, 600, 300, 900, 300, 1200]) {
    renderSong('alice', 'one', singleSong);
    next().props.onClick();
    assert.equal(target.top, position);
  }
  renderSong('alice', 'one', singleSong);
  assert.equal(next().props.disabled, true);
  const versesOnly = 'Verse 1\nOne\nVerse 2\nTwo\nVerse 3\nThree';
  renderSong('alice', 'verses-only', versesOnly, true);
  assert.equal(repeat(), undefined);
  const mode = () => nodes.find(node => node.props['aria-label'] === 'Next mode');
  assert.equal(next(), undefined, 'verse-only songs do not enable Next automatically');
  assert.equal(mode().props['aria-pressed'], false);
  mode().props.onClick();
  renderSong('alice', 'verses-only', versesOnly);
  for (const position of [0, 300, 600]) {
    next().props.onClick();
    assert.equal(target.top, position);
    renderSong('alice', 'verses-only', versesOnly);
  }
  assert.equal(next().props.disabled, true, 'Next follows verses without requiring a chorus');
  renderSong('alice', 'verses-only', versesOnly, true);
  assert.equal(mode().props['aria-pressed'], true, 'the same user and song remember the enabled mode');
  renderSong('bob', 'verses-only', versesOnly, true);
  assert.equal(next(), undefined, 'another user has an independent preference');
  renderSong('alice', 'another-verse-song', versesOnly, true);
  assert.equal(next(), undefined, 'another song starts with Next disabled');
  const repeatedChorusOne = 'Verse 1\nOne\nChorus 1\nSing\nVerse 2\nTwo\nChorus 1\nSing\nBridge\nKeep singing\nChorus 2\nSing again\nEnding\nDone';
  renderSong('alice', 'one', repeatedChorusOne, true);
  assert.equal(repeat(), undefined);
  assert.deepEqual(nodes.find(node => node.props['aria-label'] === 'Jump to Ending').children, ['End']);
  for (const [label, color] of [['Chorus 2', 'amber'], ['Bridge', 'violet'], ['Ending', 'red']]) {
    const jump = nodes.find(node => node.props['aria-label'] === `Jump to ${label}`);
    const content = nodes.filter(node => node.tag === 'section').map(node => node.children[0])
      .find(node => node.children.some((child: any) => child?.children?.some((badge: any) => badge?.children?.includes(label))));
    const textClass = new RegExp(`text-${color}-900`);
    assert.match(jump.props.className, color === 'amber' ? textClass : /bg-slate-100/);
    assert.match(content.children.find((child: any) => child?.children?.[0]?.children?.includes(label)).children[0].props.className, textClass);
    const lyricsClass = content.children.at(-1).props.className;
    if (color === 'amber') assert.match(lyricsClass, textClass);
    else assert.doesNotMatch(lyricsClass, textClass);
  }
  for (const position of [0, 300, 600, 900, 1200, 1500, 1800]) {
    next().props.onClick();
    assert.equal(target.top, position);
    renderSong('alice', 'one', repeatedChorusOne);
    const active = nodes.find(node => node.props['aria-current'] === 'location');
    const activeColor = ({ 1200: 'violet', 1500: 'amber', 1800: 'red' } as Record<number, string>)[position];
    if (activeColor) {
      assert.match(active.props.className, new RegExp(`text-${activeColor}-900`));
      assert.match(active.props.className, /outline-current/);
    }
  }
  assert.equal(next().props.disabled, true);
  const twoChoruses = 'Verse 1\nOne\nChorus 1\nSing\nVerse 2\nTwo\nChorus 2\nSing again\nBridge\nKeep singing\nEnding\nDone';
  renderSong('alice', 'fresh-multi', twoChoruses, true);
  assert.equal(repeat(), undefined, 'a song with two choruses follows its written sequence');
  assert.equal(next(), undefined, 'multiple choruses do not enable Next automatically either');
  mode().props.onClick();
  renderSong('alice', 'fresh-multi', twoChoruses);
  for (const position of [0, 300, 600, 900, 1200, 1500]) {
    next().props.onClick();
    assert.equal(target.top, position);
    renderSong('alice', 'fresh-multi', twoChoruses);
  }
  assert.equal(next().props.disabled, true);
});
