import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SettingsStore, type StorageAdapter} from '../src/core/settings';
function fixture(saved: Record<string, unknown> = {}) {
  let listener: Parameters<StorageAdapter['subscribe']>[0];
  const writes: Record<string, unknown>[] = [];
  const adapter: StorageAdapter = {read: async () => saved, write: async v => {writes.push(v);}, subscribe: cb => {listener=cb;}};
  const store=new SettingsStore(adapter);
  return {store,writes,change: (value: Record<string,{newValue?: unknown}>) => listener(value)};
}
test('loads old backups and roundtrips dictionaries without losing entries',async () => {
  const {store}=fixture({customDictionary:{Codex:'Codex'},targetLanguages:['zh-CN'],useOldPopup:'no'}); await store.onReady();
  assert.equal(store.get('customDictionary').get('Codex'),'Codex');
  const restored=fixture().store; await restored.onReady(); await restored.import(store.export('0.1.0'));
  assert.deepEqual(restored.get('customDictionary'),store.get('customDictionary'));
  assert.deepEqual(restored.get('targetLanguages'),['zh-CN']);
  assert.equal(restored.get('useOldPopup'),'no');
});
test('normalizes malformed settings, ignores unknown backup keys and restores removed defaults',async () => {
  const {store,change}=fixture({targetLanguages:'bad',customDictionary:null}); await store.onReady();
  assert.deepEqual(store.get('targetLanguages'),[]);
  await store.import('{"targetLanguages":["en",null,3],"intruder":true}');
  assert.deepEqual(store.get('targetLanguages'),['en']); assert.equal(store.get('intruder'),undefined);
  change({targetLanguages:{}}); await Promise.resolve(); assert.deepEqual(store.get('targetLanguages'),[]);
  await assert.rejects(store.import('[]'),/Invalid settings backup/);
});
test('settings do not expose mutable internal references and notify once for storage echoes',async () => {
  const {store,change,writes}=fixture(); await store.onReady(); let calls=0;
  store.onChanged(() => calls++);
  store.set('alwaysTranslateSites',['example.com']); await store.flush();
  store.set('alwaysTranslateSites',['example.com']); await store.flush();
  change({alwaysTranslateSites:{newValue:['example.com']}}); await Promise.resolve();
  store.get('alwaysTranslateSites').push('evil.test');
  assert.deepEqual(store.get('alwaysTranslateSites'),['example.com']); assert.equal(calls,1); assert.equal(writes.length,1);
});

test('migrates removed Yandex selections on load, import and storage changes',async()=>{
  const {store,writes,change}=fixture({pageTranslatorService:'yandex',textTranslatorService:'yandex'});
  await store.onReady();
  assert.equal(store.get('pageTranslatorService'),'edge');
  assert.equal(store.get('textTranslatorService'),'edge');
  assert.deepEqual(writes,[{pageTranslatorService:'edge'},{textTranslatorService:'edge'}]);
  store.set('pageTranslatorService','google');
  await store.import('{"pageTranslatorService":"yandex"}');
  assert.equal(store.get('pageTranslatorService'),'edge');
  assert.equal(JSON.parse(store.export('0.1.0')).pageTranslatorService,'edge');
  store.set('textTranslatorService','google');
  change({textTranslatorService:{newValue:'yandex'}});
  await Promise.resolve();
  assert.equal(store.get('textTranslatorService'),'edge');
});
