import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
Object.assign(globalThis,{indexedDB:new IDBFactory(),chrome:{runtime:{onMessage:{addListener(){}},lastError:undefined},i18n:{getUILanguage:()=> 'en',getMessage:()=>''}}});
// Runtime modules retain JavaScript protocol parsers; test via their public messaging service.
const {translationService} = await import('../src/background/translationService.js');

test('Google preserves inline ordering and retries after transient failure',async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async () => {calls++; if(calls===1)return new Response('busy',{status:503}); return Response.json(['<pre><a i=1>链接</a><a i=0>你好</a></pre>']);});
  t.mock.method(console,'error',()=>{});
  await assert.rejects(translationService.translateHTML('google','auto','zh-CN',[['Hello','link']],true));
  const result=await translationService.translateHTML('google','auto','zh-CN',[['Hello','link']],true);
  assert.deepEqual(result,[['你好','链接']]); assert.equal(calls,2);
});
test('identical concurrent work shares requests but private translations never fill persistent cache',async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++; await new Promise(r=>setTimeout(r,10));return Response.json(['<pre>私密</pre>']);});
  const translate=()=>translationService.translateHTML('google','auto','zh-CN',[['private-example']],true);
  assert.deepEqual(await Promise.all([translate(),translate()]),[[['私密']],[['私密']]]); assert.equal(calls,1);
  await translationService.translateHTML('google','auto','zh-CN',[['private-example']],false); assert.equal(calls,2);
  await translationService.translateHTML('google','auto','zh-CN',[['private-example']],false); assert.equal(calls,2);
});

test('Edge posts JSON without authentication and preserves rows, empty nodes and literal markup',async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url: string,init: RequestInit)=>{
    calls++;
    const endpoint=new URL(url);
    assert.equal(endpoint.origin+endpoint.pathname,'https://edge.microsoft.com/translate/translatetext');
    assert.equal(endpoint.searchParams.get('from'),'');
    assert.equal(endpoint.searchParams.get('to'),'zh-Hans');
    assert.equal(endpoint.searchParams.get('isEnterpriseClient'),'false');
    assert.equal(init.method,'POST');
    assert.deepEqual(init.headers,{'Content-Type':'application/json'});
    assert.deepEqual(JSON.parse(String(init.body)),['Hello','world','<b> & &lt;\nnext']);
    return Response.json(['你好','世界','<b> & &lt;\n下一行'].map(text=>({translations:[{text}],detectedLanguage:{language:'en'}})));
  });
  assert.deepEqual(await translationService.translateHTML('edge','auto','zh-CN',[
    ['Hello','','world'],[],[' \n','<b> & &lt;\nnext'],
  ],true),[['你好','','世界'],[],[' \n','<b> & &lt;\n下一行']]);
  assert.equal(calls,1);
});

test('Edge maps language aliases for text and single-text translation without requiring detection metadata',async t => {
  const pairs=[['zh-CN','zh-TW','zh-Hans','zh-Hant'],['tl','no','fil','nb'],['hmn','mn','mww','mn-Cyrl'],['ku','ckb','kmr','ku'],['zh-HK','sr','zh-Hant','sr-Cyrl']];
  for (const [source,target,from,to] of pairs) {
    const mock=t.mock.method(globalThis,'fetch',async(url: string,init: RequestInit)=>{
      assert.equal(new URL(url).searchParams.get('from'),from);
      assert.equal(new URL(url).searchParams.get('to'),to);
      return Response.json(JSON.parse(String(init.body)).map((text: string)=>({translations:[{text:'translated '+text,to}]})));
    });
    assert.deepEqual(await translationService.translateText('edge',source,target,['one','two'],true),['translated one','translated two']);
    assert.equal(await translationService.translateSingleText('edge',source,target,'single',true),'translated single');
    mock.mock.restore();
  }
});

test('Edge failures and malformed batches do not poison later retries',async t => {
  t.mock.method(console,'error',()=>{});
  for (const response of [new Response('busy',{status:503}),Response.json({error:'bad'}),Response.json([]),Response.json([{translations:[{text:'partial'}]}]),Response.json([{translations:[{text:'partial'}]},{translations:[]}])]) {
    let calls=0;
    const mock=t.mock.method(globalThis,'fetch',async()=>++calls===1?response:Response.json(['完整','结果'].map(text=>({translations:[{text}]}))));
    const translate=()=>translationService.translateHTML('edge','auto','zh-CN',[['retry-one','retry-two']],true);
    await assert.rejects(translate(),/Translation failed/);
    assert.deepEqual(await translate(),[['完整','结果']]);
    assert.equal(calls,2);
    mock.mock.restore();
  }
});

test('Edge deduplicates concurrent segments, respects private cache isolation and handles empty input locally',async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;await new Promise(r=>setTimeout(r,10));return Response.json([{translations:[{text:'缓存'}]}]);});
  assert.deepEqual(await translationService.translateHTML('edge','auto','zh-CN',[[],['',' \n']],true),[[],['',' \n']]);
  assert.equal(calls,0);
  const translate=(privateRequest: boolean)=>translationService.translateHTML('edge','auto','zh-CN',[['edge-cache','edge-cache']],privateRequest);
  assert.deepEqual(await Promise.all([translate(true),translate(true)]),[[['缓存','缓存']],[['缓存','缓存']]]);
  assert.equal(calls,1);
  await translate(false); assert.equal(calls,2);
  await translate(false); assert.equal(calls,2);
});
