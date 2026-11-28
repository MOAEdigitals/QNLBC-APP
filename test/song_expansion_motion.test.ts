import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('song collapse keeps content during the transition, disables hidden controls, and safely reopens', async () => {
  const dom=new JSDOM('<div id="root"></div>');
  const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'];const old=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  keys.forEach(key=>Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:(dom.window as any)[key]}));
  const native=createRequire(import.meta.url),root=native('react-dom/client').createRoot(document.getElementById('root'));
  const source=readFileSync('src/components/SongsTab.tsx','utf8'),start=source.indexOf('function SongExpansion('),end=source.indexOf('interface SongsTabProps',start);
  const timers=new Map<number,()=>void>();let timerId=0;
  const context:any={React,useState:React.useState,useLayoutEffect:React.useLayoutEffect,requestAnimationFrame:(fn:()=>void)=>{fn();return 1;},cancelAnimationFrame(){},setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id)};
  runInNewContext(ts.transpileModule(source.slice(start,end)+'\nthis.Expansion=SongExpansion;',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const render=(open:boolean)=>root.render(React.createElement(context.Expansion,{open},React.createElement('button',null,'Lyrics controls')));
  try {
    await act(()=>render(true));
    await act(()=>render(false));
    let expansion=document.querySelector<HTMLElement>('[data-song-expansion]')!;
    assert.equal(expansion.style.gridTemplateRows,'0fr');
    assert.equal(expansion.getAttribute('inert'),'');
    assert.ok(document.querySelector('button'),'content remains mounted until exit completes');
    await act(()=>render(true));
    assert.equal(timers.size,0,'reopening cancels pending unmount');
    assert.equal(expansion.style.gridTemplateRows,'1fr');
    await act(()=>render(false));
    await act(()=>{timers.forEach(fn=>fn());timers.clear();});
    assert.equal(document.querySelector('button'),null);
  } finally {await act(()=>root.unmount());dom.window.close();keys.forEach((key,i)=>{if(old[i])Object.defineProperty(globalThis,key,old[i]!);else delete (globalThis as any)[key];});}
});
