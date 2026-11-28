import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as dates from '../src/utils/dateUtils.ts';
import * as order from '../src/utils/recognitionOrder.ts';
import * as details from '../src/utils/recognitionDetails.ts';

test('completed birthdays collapse separately while a past birthday in the recognition window stays visible', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const keys=['window','document','navigator','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];
  const previous=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  keys.forEach(key=>Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:(dom.window as any)[key]}));
  const native=createRequire(import.meta.url),root=native('react-dom/client').createRoot(document.getElementById('root'));
  const exports:any={};const now=new Date('2026-11-28T12:00:00');
  runInNewContext(ts.transpileModule(readFileSync('src/components/RecognitionsTab.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,window:dom.window,document:dom.window.document,
    require:(name:string)=>name==='react'?React:name.includes('recognitionOrder')?order:name.includes('recognitionDetails')?details
      :name.includes('dateUtils')?{...dates,getTodayStr:()=> '2026-11-28',isBirthdayRecognitionWeek:(date:string)=>dates.isBirthdayRecognitionWeek(date,now)}
      :name.includes('SwipeNavigation')?{useSwipeSubtabs:()=>['birthdays',()=>{}]}
      :name.includes('useLiveClock')?{useLiveClock:()=>now.getTime()}
      :new Proxy({},{get:()=>()=>null}),
  });
  try {
    await act(()=>root.render(React.createElement(exports.RecognitionsTab,{birthdays:[{id:'past',name:'Earlier',birthDate:'2000-11-01'},{id:'window',name:'Still to recognize',birthDate:'2000-11-27'},{id:'future',name:'Upcoming',birthDate:'2000-11-30'}],anniversaries:[],specialRecognitions:[],onSaveBirthday:async()=>true,onDeleteBirthday(){}} as any)));
    const completed=document.querySelector<HTMLDetailsElement>('[data-completed-birthdays]')!;
    assert.ok(completed);
    assert.equal(completed.open,false);
    assert.match(completed.textContent!,/Earlier/);
    assert.doesNotMatch(completed.textContent!,/Still to recognize|Upcoming/);
    assert.ok([...document.querySelectorAll('.birthday-name')].find(el=>el.textContent==='Still to recognize'));
    const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    assert.equal(ids.length,new Set(ids).size,'split months have unique heading IDs');
    await act(()=>completed.querySelector('summary')!.click());
    assert.equal(completed.open,true);
    assert.ok(completed.querySelector('[data-birthday-actions="past"] button'),'completed rows retain their actions');
  } finally {await act(()=>root.unmount());dom.window.close();keys.forEach((key,i)=>{if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else delete (globalThis as any)[key];});}
});
