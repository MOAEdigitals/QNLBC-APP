import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('practice playback converts local recordings to blobs and recovers a failed cloud stream on the recording device', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
  const globals:any={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
  const old=Object.keys(globals).map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  Object.entries(globals).forEach(([key,value])=>Object.defineProperty(globalThis,key,{configurable:true,value}));
  const native=createRequire(import.meta.url), root=native('react-dom/client').createRoot(document.getElementById('root'));
  const audios:any[]=[], revoked:string[]=[];
  let blobs=0, fetches=0, plays=0, pauses=0;
  class Audio extends dom.window.EventTarget {
    src=''; currentTime=0; duration=0; loop=false; preload=''; error:any=null;
    constructor(){super();audios.push(this);}
    pause(){} load(){} play(){plays++;return Promise.resolve();}
  }
  const exports:any={};
  runInNewContext(ts.transpileModule(readFileSync('src/components/PracticeAudioTrackRow.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{
    exports,window:dom.window,document:dom.window.document,Audio,AbortSignal,console,
    URL:{createObjectURL:()=>`blob:recording-${++blobs}`,revokeObjectURL:(value:string)=>revoked.push(value)},
    fetch:async()=>{fetches++;return {ok:true,blob:async()=>new Blob(['recording'],{type:'audio/webm'})};},
    require:(name:string)=>name==='react'?React:name==='@capacitor/core'?{Capacitor:{getPlatform:()=> 'web'}}
      :name.includes('audioStorage')?{getAudioFromStorage:async()=>null,subscribeToAudioUpdates:()=>()=>{}}
      :name.includes('audioCoordinator')?{registerActiveAudio(){},notifyAudioStopped(){}}
      :name.includes('mediaUtils')?{resolveMediaUrl:(url:string)=>url||''}
      :name.includes('cloudMediaStorage')?{dataUrlToBlob:async()=>new Blob(['recording'],{type:'audio/webm'})}
      :name.includes('r2Media')?{R2_PUBLIC_URL:'https://media.test',mediaHash:async()=> 'a'.repeat(64)}
      :new Proxy({},{get:()=>()=>null}),
  });
  const props={id:'track',badgeLabel:'Tenor 1',badgeCategory:'vocal_part',performerName:'Bro Eric',isCurrentlyPlaying:false,onPlay(){},onPause(){pauses++;}};
  try {
    await act(async()=>root.render(React.createElement(exports.PracticeAudioTrackRow,{...props,audioUrl:'data:audio/webm;base64,YQ=='})));
    assert.equal(audios.at(-1).src,'blob:recording-1','local data URL is decoded as a Blob for WebView playback');
    const cloud='https://media.test/worship_media/verified/'+'a'.repeat(64);
    await act(async()=>root.render(React.createElement(exports.PracticeAudioTrackRow,{...props,audioUrl:cloud})));
    const failing=audios.at(-1);
    failing.error={code:2};
    await act(async()=>{failing.dispatchEvent(new dom.window.Event('error'));failing.dispatchEvent(new dom.window.Event('error'));await new Promise(resolve=>setImmediate(resolve));});
    assert.equal(pauses,0,'duplicate error events do not cancel an in-flight recovery');
    assert.equal(fetches,1,'failed stream retries the same cloud recording as fetched bytes');
    assert.equal(audios.at(-1).src,'blob:recording-2');
    assert.ok(revoked.includes('blob:recording-1'));
    const play=document.querySelector<HTMLButtonElement>('[aria-label="Play Tenor 1 track"]')!;
    await act(()=>play.click());
    assert.equal(plays,1);
    const audio=audios.at(-1);audio.duration=12;
    await act(()=>audio.dispatchEvent(new dom.window.Event('loadedmetadata')));
    assert.match(document.body.textContent!,/00:12/);
    await act(async()=>root.render(React.createElement(exports.PracticeAudioTrackRow,{...props,audioUrl:cloud,offline:true})));
    assert.equal(fetches,1,'offline mode does not attempt network recovery');
  } finally {
    await act(()=>root.unmount());
    assert.ok(revoked.includes('blob:recording-2'));
    dom.window.close();Object.keys(globals).forEach((key,i)=>{if(old[i])Object.defineProperty(globalThis,key,old[i]!);else delete (globalThis as any)[key];});
  }
});
