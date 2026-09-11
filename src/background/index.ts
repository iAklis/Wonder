import { config } from '../lib/config.js';
import { languages } from '../lib/languages.js';
import { translationCache } from './translationCache';
import './translationService.js';

type TabState = {url?: string; languageState?: string; autoHost?: string};
const session = chrome.storage.session;
const stateKey = (id: number) => `tab:${id}`;
async function getState(id: number): Promise<TabState> { return (await session.get(stateKey(id)))[stateKey(id)] || {}; }
// Serialize writes so simultaneous navigation / language events do not overwrite one another.
let stateWrites = Promise.resolve();
function setState(id: number, patch: Partial<TabState>): Promise<void> {
  const operation = stateWrites.catch(() => {}).then(async () => session.set({[stateKey(id)]: {...await getState(id), ...patch}}));
  stateWrites = operation; return operation;
}
async function activeTab(): Promise<chrome.tabs.Tab | undefined> { return (await chrome.tabs.query({active:true,currentWindow:true}))[0]; }
async function send(id: number | undefined, action: string, fields: Record<string, unknown> = {}, mainFrame = false): Promise<unknown> {
  if (id === undefined) return;
  try { return await chrome.tabs.sendMessage(id, {action,...fields}, mainFrame ? {frameId:0} : {}); }
  catch { return undefined; } // Restricted pages have no content script.
}
function host(url?: string): string { try { return new URL(url || '').hostname; } catch { return ''; } }
async function popup(tabId?: number, force = false): Promise<void> {
  await chrome.action.setPopup({...(tabId === undefined ? {} : {tabId}), popup: !force && config.get('translateClickingOnce') === 'yes' ? '' : 'popup/popup.html'});
}
async function openPopup(tabId?: number): Promise<void> {
  await popup(tabId,true);
  try { await chrome.action.openPopup(); } finally { await popup(tabId); }
}
let menuWrites = Promise.resolve();
function updateMenu(languageState = 'original'): Promise<void> {
  menuWrites = menuWrites.catch(() => {}).then(async () => {
    await config.onReady();
    const title = languageState === 'translated' ? chrome.i18n.getMessage('btnRestore') : chrome.i18n.getMessage('msgTranslateFor',languages.codeToLanguage(config.get('targetLanguage') || 'zh-CN'));
    await chrome.contextMenus.remove('translate-web-page').catch(() => {});
    if (config.get('showTranslatePageContextMenu') === 'yes') chrome.contextMenus.create({id:'translate-web-page', title,contexts:['page','frame']});
  });
  return menuWrites;
}
async function installMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();
  for (const [id, message] of [['show-popup','btnShowPopup'],['never-translate','btnNeverTranslate'],['more-options','btnMoreOptions']]) {
    chrome.contextMenus.create({id,title:chrome.i18n.getMessage(message),contexts:['action']});
  }
  await updateMenu();
}
// All wake-up listeners are registered synchronously, before loading settings.
chrome.runtime.onInstalled.addListener(details => {
  void (async () => {
    await config.onReady(); await installMenus(); await popup();
    if(details.reason === 'install') await chrome.runtime.openOptionsPage();
    else if(details.reason === 'update') await translationCache.deleteTranslationCache();
  })();
});
chrome.runtime.onStartup.addListener(() => { void installMenus(); });
const messageActions = new Set(['getMainFramePageLanguageState','getMainFrameTabLanguage','setPageLanguageState','openOptionsPage','openDonationPage','detectTabLanguage','getTabHostName','getTabUrl','thisFrameIsInFocus','detectLanguage']);
chrome.runtime.onMessage.addListener((request,sender,respond) => {
  if (!request || !messageActions.has(request.action)) return;
  void (async () => {
    await config.onReady();
    const tab = sender.tab;
    switch(request.action) {
      case 'getMainFramePageLanguageState': return send(tab?.id,'getCurrentPageLanguageState',{},true);
      case 'getMainFrameTabLanguage': return send(tab?.id,'getOriginalTabLanguage',{},true);
      case 'setPageLanguageState':
        if(tab?.id !== undefined && (sender.frameId ?? 0) === 0) {
          await setState(tab.id,{url:tab.url,languageState:request.pageLanguageState});
          if(tab.active) await updateMenu(request.pageLanguageState);
        } return;
      case 'openOptionsPage': return chrome.runtime.openOptionsPage();
      case 'openDonationPage': return chrome.tabs.create({url:chrome.runtime.getURL('options/options.html#donation')});
      case 'detectTabLanguage': return tab?.id === undefined ? 'und' : chrome.tabs.detectLanguage(tab.id);
      case 'getTabHostName': return host(tab?.url);
      case 'getTabUrl': return tab?.url || sender.url || '';
      case 'thisFrameIsInFocus': return send(tab?.id,'anotherFrameIsInFocus');
      case 'detectLanguage': return typeof request.text === 'string' ? (await chrome.i18n.detectLanguage(request.text)).languages[0]?.language : undefined;
    }
  })().then(respond,() => respond());
  return true;
});
chrome.action.onClicked.addListener(tab => { void config.onReady().then(() => send(tab.id,'toggle-translation')); });
chrome.commands.onCommand.addListener(command => {
  void (async () => {
    await config.onReady(); const tab = await activeTab(); if(!tab) return;
    if(command === 'hotkey-toggle-translation') await send(tab.id,'toggle-translation');
    if(command === 'hotkey-toggle-dual') {
      config.set('isShowDualLanguage', config.get('isShowDualLanguage') === 'yes' ? 'no' : 'yes');
      await config.flush();
      // An explicit content command serializes restore/retranslate after the storage change.
      await send(tab.id,'refresh-dual-language');
    }
  })();
});
chrome.contextMenus.onClicked.addListener((info,tab) => {
  void (async () => {
    await config.onReady();
    switch(info.menuItemId) {
      case 'translate-web-page': await send(tab?.id,'toggle-translation'); break;
      case 'show-popup': await openPopup(tab?.id); break;
      case 'never-translate': if(host(tab?.url)) { const hostname = host(tab?.url); config.set('neverTranslateSites',[...new Set([...config.get('neverTranslateSites'),hostname])]); config.set('alwaysTranslateSites',config.get('alwaysTranslateSites').filter(site => site !== hostname)); }; break;
      case 'more-options': await chrome.runtime.openOptionsPage(); break;
    }
  })().catch(console.error);
});
chrome.tabs.onActivated.addListener(info => { void send(info.tabId,'getCurrentPageLanguageState',{},true).then(state => updateMenu(typeof state === 'string' ? state : 'original')); });
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if(change.status === 'loading' && tab.active) void updateMenu();
  if(change.status === 'complete') void continueTranslation(id,tab.url);
});
chrome.tabs.onRemoved.addListener(id => {
  stateWrites = stateWrites.catch(() => {}).then(() => session.remove(stateKey(id)));
});
function navigationCommitted(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
  if(details.frameId !== 0) return;
  void (async () => {
    await config.onReady(); await stateWrites;
    const previous=await getState(details.tabId);
    const auto = config.get('autoTranslateWhenClickingALink') === 'yes' && details.transitionType === 'link' && previous.languageState === 'translated' && host(previous.url) === host(details.url);
    await setState(details.tabId,{url:details.url,languageState:'original',autoHost:auto ? host(details.url) : undefined});
  })();
}
function registerNavigation(): void {
  if(chrome.webNavigation && !chrome.webNavigation.onCommitted.hasListener(navigationCommitted)) chrome.webNavigation.onCommitted.addListener(navigationCommitted);
}
registerNavigation();
chrome.permissions.onAdded.addListener(registerNavigation);
async function continueTranslation(id: number, url?: string): Promise<void> {
  await config.onReady(); await stateWrites;
  const state=await getState(id);
  if(state.autoHost && state.autoHost === host(url) && config.get('autoTranslateWhenClickingALink') === 'yes') {
    await send(id,'autoTranslateBecauseClickedALink',{},true); await setState(id,{autoHost:undefined});
  }
}
chrome.permissions.onRemoved.addListener(permissions => { if(permissions.permissions?.includes('webNavigation')) config.set('autoTranslateWhenClickingALink','no'); });
config.onChanged((name) => {
  if(name === 'translateClickingOnce') void popup();
  if(name === 'targetLanguage' || name === 'showTranslatePageContextMenu') void updateMenu();
});
void config.onReady().then(async () => {
  await popup();
  if(!config.get('installDateTime')) config.set('installDateTime',Date.now());
});
