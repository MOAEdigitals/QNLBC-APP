import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { JSDOM } from 'jsdom';
import * as appDialogs from '../src/services/appDialogs.ts';

/** Render shared UI components in isolation with real React and portal behavior. */
export function createUiTestLoader(dom: JSDOM, React: any) {
  const native = createRequire(import.meta.url);
  const cache = new Map<string, any>();
  const load = (name: string): any => {
    const base = name.split('/').at(-1)!;
    if (base === 'useBackLayer') return { useBackLayer() {} };
    if (base === 'appDialogs') return appDialogs;
    if (!['SheetSelect', 'SheetDateField', 'BottomSheet', 'AppDialogHost'].includes(base)) throw Error(`Unexpected test UI import: ${name}`);
    if (cache.has(base)) return cache.get(base);
    const exports: any = {}; cache.set(base, exports);
    runInNewContext(ts.transpileModule(readFileSync(`src/components/${base}.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
      exports, window: dom.window, document: dom.window.document, setTimeout, clearTimeout,
      require: (dependency: string) => dependency === 'react' ? React : dependency === 'react-dom' ? native('react-dom') : dependency === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : load(dependency),
    });
    return exports;
  };
  return load;
}
