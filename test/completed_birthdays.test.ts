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
import { createUiTestLoader } from './ui_test_components.ts';

test('completed birthdays collapse separately while a past birthday in the recognition window stays visible', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const keys=['window','document','navigator','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];
  const previous=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  keys.forEach(key=>Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:(dom.window as any)[key]}));
  const native=createRequire(import.meta.url),root=native('react-dom/client').createRoot(document.getElementById('root'));
  const exports:any={};let today='2026-11-28';let now=new Date(today+'T12:00:00');
  const ui=createUiTestLoader(dom,React);
  runInNewContext(ts.transpileModule(readFileSync('src/components/RecognitionsTab.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,window:dom.window,document:dom.window.document,
    require:(name:string)=>name==='react'?React:name.includes('MonthSeparators')?ui(name):name.includes('recognitionOrder')?order:name.includes('recognitionDetails')?details
      :name.includes('dateUtils')?{...dates,getTodayStr:()=> today,isBirthdayRecognitionWeek:(date:string)=>dates.isBirthdayRecognitionWeek(date,now)}
      :name.includes('SwipeNavigation')?{useSwipeSubtabs:()=>['birthdays',()=>{}]}
      :name.includes('useLiveClock')?{useLiveClock:()=>now.getTime()}
      :new Proxy({},{get:()=>()=>null}),
  });
  try {
    const props={birthdays:[{id:'past',name:'Earlier',birthDate:'2000-11-01'},{id:'window',name:'Still to recognize',birthDate:'2000-11-27'},{id:'future',name:'Upcoming',birthDate:'2000-11-30'}],anniversaries:[],specialRecognitions:[],onSaveBirthday:async()=>true,onDeleteBirthday(){}};
    const render=()=>root.render(React.createElement(exports.RecognitionsTab,props as any));
    await act(render);
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
    assert.ok(completed.querySelector('[data-birthday-actions="2026:past"] button'),'completed rows retain their actions');
    today='2027-01-08';now=new Date(today+'T12:00:00');
    await act(render);
    const year=document.querySelector<HTMLDetailsElement>('[data-year-archive="2026"]')!;
    assert.ok(year);assert.equal(year.open,false);
    assert.equal(year.querySelectorAll('[data-completed-month="2026-11"]').length,1);
    assert.match(year.textContent!,/Earlier/);assert.match(year.textContent!,/Still to recognize/);assert.match(year.textContent!,/Upcoming/);
    assert.equal(document.querySelectorAll('[data-birthday-actions="past"]').length,1,'the annual record is also available for the new year');
    await act(()=>year.querySelector('summary')!.click());
    const month=year.querySelector<HTMLDetailsElement>('[data-completed-month]')!;
    await act(()=>month.querySelector('summary')!.click());
    await act(()=>month.querySelector<HTMLButtonElement>('[data-birthday-actions="2026:past"] button')!.click());
    assert.equal(document.querySelectorAll('[role="menu"]').length,1,'archive actions do not also open the current-year menu');

  } finally {await act(()=>root.unmount());dom.window.close();keys.forEach((key,i)=>{if(previous[i])Object.defineProperty(globalThis,key,previous[i]!);else delete (globalThis as any)[key];});}
});
