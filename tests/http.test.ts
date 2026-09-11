import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request,RequestQueue} from '../src/core/http';
test('queue bounds concurrent requests and releases slots after rejection',async () => {
  const queue=new RequestQueue(2); let active=0, maximum=0;
  const results=await Promise.allSettled(Array.from({length:8},(_,i) => queue.run(async () => {
    maximum=Math.max(maximum,++active); await new Promise(r=>setTimeout(r,5)); active--; if(i===2)throw new Error('offline'); return i;
  })));
  assert.equal(maximum,2); assert.equal(results.filter(r=>r.status==='fulfilled').length,7);
  assert.equal(await queue.run(async()=>42),42);
});
test('transport rejects HTTP failures and aborts stalled requests',async t => {
  t.mock.method(globalThis,'fetch',async()=>new Response('busy',{status:503}));
  await assert.rejects(request('https://example.test'),/503/);
  t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',(_url: string,init: RequestInit)=>new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(init.signal!.reason))));
  await assert.rejects(request('https://example.test',{},10),/timed out/);
});
