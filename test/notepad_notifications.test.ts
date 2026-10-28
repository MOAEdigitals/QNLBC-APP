import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

async function fixture(path: string, services: any, run: (exports: any, root: Root, dom: JSDOM) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/#home' });
  const keys = ['window','document','navigator','HTMLElement','Element','IS_REACT_ACT_ENVIRONMENT'];
  const prior = keys.map(key => Object.getOwnPropertyDescriptor(globalThis,key));
  keys.forEach(key => Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:(dom.window as any)[key]}));
  const { createRoot } = await import('react-dom/client');
  const exports: any = {}, root = createRoot(document.getElementById('root')!);
  runInNewContext(ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022} }).outputText, {
    exports,window:dom.window,document:dom.window.document,crypto:webcrypto,requestAnimationFrame:(f:()=>void)=>f(),
    require:(name:string)=>name==='react'?React:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):name.includes('useBackLayer')?{useBackLayer:()=>{}}:services,
  });
  try { await run(exports,root,dom); }
  finally { await act(()=>root.unmount()); dom.window.close(); keys.forEach((key,i)=>{if(prior[i])Object.defineProperty(globalThis,key,prior[i]!);else delete (globalThis as any)[key];}); }
}
const label = (name:string) => document.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;

test('personal notepad creates cards, preserves schedule whitespace and retains failed-save text', async()=>{
  const notes:any[]=[]; let writes=0,fail=false;
  const services={loadNotes:async()=>notes,saveNote:async(user_id:string,id:string,title:string,body:string)=>{
    writes++;if(fail)throw Error('Connection failed; note retained');const note={user_id,id,title,body,revision:1,deleted_at:null,updated_at:'2026-10-26T08:00:00Z'};notes.push(note);return note;
  }};
  await fixture('src/features/notepad/Notepad.tsx',services,async(exports,root,dom)=>{
    await act(async()=>root.render(React.createElement(exports.default,{userId:'owner',onClose(){}})));
    await act(()=>label('Add note').click());
    const title=()=>document.querySelector<HTMLInputElement>('[aria-label="Note title"]')!;
    const body=()=>document.querySelector<HTMLTextAreaElement>('[aria-label="Note text"]')!;
    const schedule='PRAYER ADVANCE\n\nFirst Part\n6:00 - 6:10 Singspiration\n\t6:10 - 6:20 Self Searching\n';
    await act(()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(title(),'PRAYER ADVANCE');title().dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(body(),schedule);body().dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    });
    await act(async()=>{const save=Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Save')!;save.click();save.click();});
    assert.equal(writes,1); assert.equal(notes[0].body,schedule);assert.equal(notes[0].user_id,'owner');
    await act(()=>Array.from(document.querySelectorAll('article button')).find(x=>x.textContent?.includes('PRAYER ADVANCE'))!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(body().value,schedule);fail=true;
    await act(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(body(),schedule+'More notes');body().dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    await act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Save')!.click());
    assert.equal(body().value,schedule+'More notes');assert.match(document.querySelector('[role="alert"]')!.textContent!,/retained/);
  });
});

test('notification swipe deletes intentionally but preserves vertical scrolling, edge Back, cancelled drags and taps',async()=>{
  await fixture('src/components/NotificationInbox.tsx',{},async(exports,root,dom)=>{
    let deleted=0,opened=0;
    await act(()=>root.render(React.createElement(exports.SwipeNotification,{label:'Test',disabled:false,unread:true,onDelete:()=>deleted++,onOpen:()=>opened++},'Message')));
    const row=document.querySelector('#root > div')!;
    const pointer=(type:string,x:number,y:number)=>{const e=new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperties(e,{isPrimary:{value:true},pointerId:{value:1}});row.dispatchEvent(e);};
    await act(()=>{pointer('pointerdown',150,100);pointer('pointermove',155,210);pointer('pointerup',155,210);});assert.equal(deleted,0);
    await act(()=>{pointer('pointerdown',10,100);pointer('pointermove',180,100);pointer('pointerup',180,100);});assert.equal(deleted,0);
    await act(()=>{pointer('pointerdown',150,100);pointer('pointermove',280,100);pointer('pointercancel',280,100);});assert.equal(deleted,0);
    await act(()=>{pointer('pointerdown',150,100);pointer('pointerup',150,100);(row.querySelector('button')!).click();});assert.equal(opened,1);
    await act(()=>{pointer('pointerdown',150,100);pointer('pointermove',280,100);pointer('pointerup',280,100);(row.querySelector('button')!).click();});assert.equal(deleted,1);assert.equal(opened,1);
  });
});

test('notification icons appear only on the three requested tabs, directly before Search, with Notepad on Setlists',async()=>{
  await fixture('src/components/Navbar.tsx',{useHeaderSearchContext:()=>({search:{value:'',label:'Find',placeholder:'Find',onChange(){},beforeSearch:React.createElement('button',{'aria-label':'Filter'},'Filter')}})},async(exports,root)=>{
    for(const tab of ['home','recognitions','special-numbers','songs','outlines']){
      await act(()=>root.render(React.createElement(exports.Navbar,{currentTab:tab,currentUser:null,onNavigateToSettings(){},onOpenNotifications(){},onOpenNotepad(){}})));
      const buttons=Array.from(document.querySelectorAll('header button')).map(x=>x.getAttribute('aria-label'));
      assert.equal(buttons.includes('Notepad'),tab==='home');assert.equal(buttons.includes('Notifications'),['home','recognitions','special-numbers'].includes(tab));
      if(buttons.includes('Notifications'))assert.equal(buttons.indexOf('Search'),buttons.indexOf('Notifications')+1);
    }
  });
});
