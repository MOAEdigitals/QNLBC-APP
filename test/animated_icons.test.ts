import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

test('official animated icons preserve button actions, render offline SVGs and honor reduced motion', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'https://example.test'});
  let reduced = false, nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const listeners = new Set<() => void>();
  const media = {get matches(){return reduced;}, addEventListener: (_:string, fn:()=>void)=>listeners.add(fn), removeEventListener: (_:string, fn:()=>void)=>listeners.delete(fn)};
  dom.window.matchMedia = (()=>media) as any;
  const values:any = {window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true,
    requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:(id:number)=>frames.delete(id)};
  const prior = Object.keys(values).map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  Object.entries(values).forEach(([key,value])=>Object.defineProperty(globalThis,key,{configurable:true,value}));
  const native = createRequire(import.meta.url);
  const exports:any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/components/AnimatedIcons.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window:dom.window,require:(name:string)=>name==='react'?React:native(name)});
  const root = native('react-dom/client').createRoot(document.getElementById('root'));
  let copies = 0;
  try {
    await act(()=>root.render(React.createElement('button',{onClick:()=>copies++, 'aria-label':'Copy lyrics'},React.createElement(exports.CopyIcon,{className:'h-4 w-4'}),'Copy lyrics')));
    const host = document.querySelector('[data-motion-icon="copy"]')!;
    assert.equal(host.getAttribute('aria-hidden'),'true');
    assert.ok(host.querySelector('svg path'), 'real UseAnimations asset renders without fetching an image');
    assert.equal(document.querySelectorAll('button').length,1,'decorative icon adds no nested button');
    await act(()=>document.querySelector('button')!.click());
    assert.equal(copies,1,'text/keyboard activation copies once immediately');
    assert.ok(frames.size>0,'the same activation starts the official animation');
    await act(()=>host.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(copies,2,'icon activation does not duplicate the real action');
    await act(()=>{reduced=true;listeners.forEach(fn=>fn());});
    assert.equal(host.querySelector('[data-useanimations]'),null,'reduced motion switches to the static icon');
    assert.ok(host.querySelector('svg'));
    await act(()=>document.querySelector('button')!.click());
    assert.equal(copies,3,'reduced motion retains the action');
    await act(()=>{reduced=false;listeners.forEach(fn=>fn());});
    await act(()=>root.render(React.createElement(exports.LoadingIcon,{className:'h-4 w-4 animate-spin'})));
    assert.ok(document.querySelector('[data-motion-icon="loading"] svg'));
    assert.equal(document.querySelector('.animate-spin'),null,'loading has one animation rather than double rotation');
    assert.equal(document.querySelector('img,iframe,video'),null,'icons require no external media');
  } finally {
    await act(()=>root.unmount());
    assert.equal(listeners.size,0,'motion subscriptions are cleaned up');
    dom.window.close();
    Object.keys(values).forEach((key,i)=>{if(prior[i])Object.defineProperty(globalThis,key,prior[i]!);else delete (globalThis as any)[key];});
  }
});
