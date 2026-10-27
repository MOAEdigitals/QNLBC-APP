import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSetlistShare } from '../cloudflare/setlist-share.mjs';
const id='10000000-0000-4000-8000-000000000001';
test('public preview requires authenticated active account, setlist access, bounded PNG; serves safe OG snapshot and original app link', async()=>{
  const originalFetch=globalThis.fetch, objects=new Map();let active=true,available=true,puts=0;
  globalThis.fetch=async (url:any)=>Response.json(String(url).includes('/auth/')?{id}:String(url).includes('/profiles')?[{active}]:available?[{id,title:'<Test & "Program">',type:'event',service_date:'2026-11-01'}]:[]);
  const bucket={head:async(key:string)=>objects.get(key),put:async(key:string,bytes:Uint8Array,options:any)=>{puts++;objects.set(key,{size:bytes.length,bytes,customMetadata:options.customMetadata});},get:async(key:string)=>{const o=objects.get(key);return o?{...o,body:o.bytes}:null;}};
  const env={AUDIO_BUCKET:bucket,SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
  const reply=(status:number,body:any)=>Response.json(body,{status});
  const request=(data=new Uint8Array([137,80,78,71,13,10,26,10,...Array(24).fill(0)]),auth=true)=>new Request('https://qnlbc-media.aigems2026.workers.dev/api/share-setlist',{method:'POST',headers:{'X-Setlist-Id':id,'Content-Type':'image/png',...(auth?{Authorization:'Bearer test'}:{})},body:data});
  try{
    assert.equal((await handleSetlistShare(request(undefined,false),env,reply)).status,401);
    active=false;assert.equal((await handleSetlistShare(request(),env,reply)).status,403);active=true;
    available=false;assert.equal((await handleSetlistShare(request(),env,reply)).status,404);available=true;
    assert.equal((await handleSetlistShare(request(new Uint8Array(40)),env,reply)).status,415);assert.equal(puts,0);
    const response=await handleSetlistShare(request(),env,reply);assert.equal(response.status,200);
    const result=await response.json();await handleSetlistShare(request(),env,reply);assert.equal(puts,1,'same snapshot is immutable and idempotent');
    const page=await handleSetlistShare(new Request(result.url),env,reply),html=await page.text();
    assert.match(page.headers.get('Content-Type')!,/text\/html/);assert.match(html,/property="og:image"/);assert.match(html,/&lt;Test &amp; &quot;Program&quot;&gt;/);assert.ok(html.includes(`?setlist=${id}#home`));assert.doesNotMatch(html,/Bearer|public-test-key/);
    const image=await handleSetlistShare(new Request(result.url+'.png'),env,reply);assert.equal(image.headers.get('Content-Type'),'image/png');assert.equal((await image.arrayBuffer()).byteLength,32);
    assert.equal((await handleSetlistShare(new Request('https://example.test/share/../../bad'),env,reply)).status,404);
  }finally{globalThis.fetch=originalFetch;}
});
