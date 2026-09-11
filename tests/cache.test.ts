import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {TranslationCache} from '../src/core/cache';
test('cache persists through worker instances and separates engines and languages',async () => {
  const factory=new IDBFactory(); const first=new TranslationCache(factory);
  assert.equal(await first.set('google','auto','zh-CN','Hello','你好','en'),true);
  await first.close(); const second=new TranslationCache(factory);
  assert.equal((await second.get('google','auto','zh-CN','Hello'))?.translatedText,'你好');
  assert.equal(await second.get('edge','auto','zh-CN','Hello'),undefined);
  assert.equal(await second.get('google','auto','fr','Hello'),undefined);
  assert.notEqual(await second.size(),'0 B'); await second.clear(); assert.equal(await second.size(),'0 B'); await second.close();
});
