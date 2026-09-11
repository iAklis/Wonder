import { createIconSvg } from '../lib/icon.js';
import { config } from '../lib/config.js';
import { languages } from '../lib/languages.js';
import { platformInfo } from '../lib/platformInfo.js';
import { translationCache } from './translationCache.ts';
import './translationService.js';
"use strict";

// Avoid outputting the error message "Receiving end does not exist" in the Console.
function checkedLastError() {
    chrome.runtime.lastError
}

let currentScheme = 'light'
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMainFramePageLanguageState") {
        chrome.tabs.sendMessage(sender.tab.id, {
            action: "getCurrentPageLanguageState"
        }, {
            frameId: 0
        }, pageLanguageState => {
            checkedLastError()
            sendResponse(pageLanguageState)
        })

        return true
    } else if (request.action === "getMainFrameTabLanguage") {
        chrome.tabs.sendMessage(sender.tab.id, {
            action: "getOriginalTabLanguage"
        }, {
            frameId: 0
        }, tabLanguage => {
            checkedLastError()
            sendResponse(tabLanguage)
        })

        return true
    } else if (request.action === "setPageLanguageState") {
        updateContextMenu(request.pageLanguageState)
    } else if (request.action === "openOptionsPage") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("/options/options.html")
        })
    } else if (request.action === "openDonationPage") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("/options/options.html#donation")
        })
    } else if (request.action === "detectTabLanguage") {
        if (!sender.tab) {
            // https://github.com/FilipePS/Traduzir-paginas-web/issues/478
            sendResponse("und")
            return
        }
        try {
            chrome.tabs.detectLanguage(sender.tab.id, result => sendResponse(result))
        } catch (e) {
            console.error(e)
            sendResponse("und")
        }

        return true
    } else if (request.action === "getTabHostName") {
        sendResponse(new URL(sender.tab?.url || sender.url || "about:blank").hostname)
    }else if (request.action === "getTabUrl") {
        sendResponse(sender.tab?.url || sender.url || "about:blank")
    } else if (request.action === "thisFrameIsInFocus") {
        chrome.tabs.sendMessage(sender.tab.id, {action: "anotherFrameIsInFocus"}, checkedLastError)
    }else if(request.action ==='detectLanguage'){
        chrome.i18n.detectLanguage(request.text, function(result){
          if(result.languages.length > 0){
            sendResponse(result.languages[0].language);
          }else{
            sendResponse(undefined);
          }
        });
        return true
    }
})


function updateContextMenu(pageLanguageState = "original") {
    let contextMenuTitle
    if (pageLanguageState === "translated") {
        contextMenuTitle = chrome.i18n.getMessage("btnRestore")
    } else {
        const targetLanguage = config.get("targetLanguage")
        contextMenuTitle = chrome.i18n.getMessage("msgTranslateFor", languages.codeToLanguage(targetLanguage))
    }
    if (typeof chrome.contextMenus != 'undefined') {
        chrome.contextMenus.remove("translate-web-page", checkedLastError)
        if (config.get("showTranslatePageContextMenu") == "yes") {
            chrome.contextMenus.create({
                id: "translate-web-page",
                title: contextMenuTitle,
                contexts: ["page", "frame"]
            })
        }
    }
}

chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == "install") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("/options/options.html")
        })
    } else if (details.reason == "update" && chrome.runtime.getManifest().version != details.previousVersion) {
        config.onReady(async () => {
            translationCache.deleteTranslationCache()
            if (platformInfo.isMobile.any) return;
            // delete hotkeys from old versions
            // get current hostkeys 
            
            if (typeof chrome.commands !== "undefined") {
              chrome.commands.getAll((results) => {
                try {
                  const hotKeys = [];
                  const configHotKeys = config.get("hotKeys") || {};
                  for (const result of results) {
                    hotKeys[result.name] = configHotKeys[result.name] || result.shortcut;
                  }
                  config.set("hotkeys",hotKeys);
                } catch (e) {
                  console.error(e);
                } 
              });
            }
        })
    }

    config.onReady(async () => {
        if (platformInfo.isMobile.any) {
            config.set("enableDeepL", "no")
        }
    })
})

function resetPageAction(tabId, forceShow = false) {
    if (config.get("translateClickingOnce") === "yes" && !forceShow) {
        chrome.pageAction.setPopup({
            popup: null,
            tabId
        })
    } else {
            chrome.pageAction.setPopup({
                popup: "popup/popup.html",
                tabId
            })
    }
}

function resetBrowserAction(forceShow = false) {
    if (config.get("translateClickingOnce") === "yes" && !forceShow) {
        chrome.browserAction.setPopup({
            popup: null
        })
    } else {
            chrome.browserAction.setPopup({
                popup: "popup/popup.html"
            })
    }
}

if (typeof chrome.contextMenus !== "undefined") {
    chrome.contextMenus.removeAll()
    chrome.contextMenus.create({
        id: "browserAction-showPopup",
        title: chrome.i18n.getMessage("btnShowPopup"),
        contexts: ["browser_action"]
    })
    chrome.contextMenus.create({
        id: "pageAction-showPopup",
        title: chrome.i18n.getMessage("btnShowPopup"),
        contexts: ["page_action"]
    })
    chrome.contextMenus.create({
        id: "never-translate",
        title: chrome.i18n.getMessage("btnNeverTranslate"),
        contexts: ["browser_action", "page_action"]
    })
    chrome.contextMenus.create({
        id: "more-options",
        title: chrome.i18n.getMessage("btnMoreOptions"),
        contexts: ["browser_action", "page_action"]
    })
    const tabHasContentScript = {}

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId == "translate-web-page") {
            chrome.tabs.sendMessage(tab.id, {
                action: "toggle-translation"
            }, checkedLastError)
        } else if (info.menuItemId == "browserAction-showPopup") {
            resetBrowserAction(true)

            chrome.browserAction.openPopup()

            resetBrowserAction()
        } else if (info.menuItemId == "pageAction-showPopup") {
            resetPageAction(tab.id, true)

            chrome.pageAction.openPopup()

            resetPageAction(tab.id)
        } else if (info.menuItemId == "never-translate") {
            const hostname = new URL(tab.url).hostname
            config.addSiteToNeverTranslate(hostname)
        } else if (info.menuItemId == "more-options") {
            chrome.tabs.create({
                url: chrome.runtime.getURL("/options/options.html")
            })
        }
    })

    chrome.tabs.onActivated.addListener(activeInfo => {
        config.onReady(() => updateContextMenu())
        chrome.tabs.sendMessage(activeInfo.tabId, {
            action: "getCurrentPageLanguageState"
        }, {
            frameId: 0
        }, pageLanguageState => {
            checkedLastError()
            if (pageLanguageState) {
                config.onReady(() => updateContextMenu(pageLanguageState))
            }
        })
    })

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && changeInfo.status == "loading") {
            config.onReady(() => updateContextMenu())
        } else if (changeInfo.status == "complete") {
            chrome.tabs.sendMessage(tabId, {
                action: "contentScriptIsInjected"
            }, {
                frameId: 0
            }, response => {
                checkedLastError()
                tabHasContentScript[tabId] = !!response;
            })
        }
    })

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        delete tabHasContentScript[tabId]
    })

    chrome.tabs.query({}, tabs =>
        tabs.forEach(tab =>
            chrome.tabs.sendMessage(tab.id, {
                action: "contentScriptIsInjected"
            }, {
                frameId: 0
            }, response => {
                checkedLastError()
                if (response) {
                    tabHasContentScript[tab.id] = true
                }
            })))
}

config.onReady(() => {
    if (platformInfo.isMobile.any) {
        chrome.tabs.query({}, tabs => tabs.forEach(tab => chrome.pageAction.hide(tab.id)))

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status == "loading") {
                chrome.pageAction.hide(tabId)
            }
        })

        chrome.browserAction.onClicked.addListener(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: "showPopupMobile"
            }, {
                frameId: 0
            }, checkedLastError)
        })
    } else {
        if (chrome.pageAction) {
            chrome.pageAction.onClicked.addListener(tab => {
                if (config.get("translateClickingOnce") === "yes") {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "toggle-translation"
                    }, checkedLastError)
                }
            })

        }
        chrome.browserAction.onClicked.addListener(tab => {
            if (config.get("translateClickingOnce") === "yes") {
                chrome.tabs.sendMessage(tab.id, {
                    action: "toggle-translation"
                }, checkedLastError)
            }
        })

        resetBrowserAction()

        config.onChanged((name, newvalue) => {
            switch (name) {
                case "translateClickingOnce":
                    resetBrowserAction()
                    chrome.tabs.query({
                        currentWindow: true,
                        active: true
                    }, tabs => {
                        resetPageAction(tabs[0].id)
                    })
                    break
            }
        })

        if (chrome.pageAction && browser) {
            let pageLanguageState = "original"

            let themeColorPopupText = null
            browser.theme.getCurrent().then(theme => {
                themeColorPopupText = null
                if (theme.colors && (theme.colors.toolbar_field_text || theme.colors.popup_text)) {
                    themeColorPopupText = theme.colors.toolbar_field_text || theme.colors.popup_text
                }
                updateIconInAllTabs()
            })

            chrome.theme.onUpdated.addListener(updateInfo => {
                themeColorPopupText = null
                if (updateInfo.theme.colors && (updateInfo.theme.colors.toolbar_field_text || updateInfo.theme.colors.popup_text)) {
                    themeColorPopupText = updateInfo.theme.colors.toolbar_field_text || updateInfo.theme.colors.popup_text
                }
                updateIconInAllTabs()
            })

            let darkMode = false
            darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
            updateIconInAllTabs()

            matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
                updateIconInAllTabs()
            })

            function getSVGIcon() {
                const translated = pageLanguageState === "translated" && config.get("popupBlueWhenSiteIsTranslated") === "yes";
                const svg = createIconSvg({
                    background: null,
                    color: translated ? "#45a1ff" : themeColorPopupText || (darkMode ? "white" : "black"),
                    opacity: translated ? 1 : 0.5,
                });
                return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

            }

            function updateIcon(tabId) {
                resetPageAction(tabId)
                chrome.pageAction.setIcon({
                    tabId: tabId,
                    path: getSVGIcon()
                })

                if (config.get("showButtonInTheAddressBar") == "no") {
                    chrome.pageAction.hide(tabId)
                } else {
                    chrome.pageAction.show(tabId)
                }
            }

            function updateIconInAllTabs() {
                chrome.tabs.query({}, tabs =>
                    tabs.forEach(tab => updateIcon(tab.id)))
            }

            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status == "loading") {
                    pageLanguageState = "original"
                    updateIcon(tabId)
                }
            })

            chrome.tabs.onActivated.addListener(activeInfo => {
                pageLanguageState = "original"
                updateIcon(activeInfo.tabId)
                chrome.tabs.sendMessage(activeInfo.tabId, {
                    action: "getCurrentPageLanguageState"
                }, {
                    frameId: 0
                }, _pageLanguageState => {
                    checkedLastError()
                    if (_pageLanguageState) {
                        pageLanguageState = _pageLanguageState
                        updateIcon(activeInfo.tabId)
                    }
                })
            })

            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === "setPageLanguageState") {
                    pageLanguageState = request.pageLanguageState
                    updateIcon(sender.tab.id)
                }
            })

            config.onChanged((name, newvalue) => {
                switch (name) {
                    case "showButtonInTheAddressBar":
                        updateIconInAllTabs()
                        break
                }
            })
        }
    }
})

if (typeof chrome.commands !== "undefined") {
    chrome.commands.onCommand.addListener(command => {
        if (command === "hotkey-toggle-translation") {
            chrome.tabs.query({
                currentWindow: true,
                active: true
            }, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggle-translation"
                }, checkedLastError)
            })
        }else if (command === "hotkey-toggle-dual") {
            if (config.get("isShowDualLanguage") === "yes") {
                config.set("isShowDualLanguage", "no")
            } else {
                config.set("isShowDualLanguage", "yes")
            }
            chrome.tabs.query({
                currentWindow: true,
                active: true
            }, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggle-translation"
                }, checkedLastError)
                chrome.tabs.query({
                    currentWindow: true,
                    active: true
                }, tabs => {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "toggle-translation"
                    }, checkedLastError)
                })
            })
        
        } else if (command === "hotkey-swap-page-translation-service") {
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, tabs =>
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "swapTranslationService"
                }, checkedLastError))

            let currentPageTranslatorService = config.get("pageTranslatorService")
            if (currentPageTranslatorService === "google") {
                currentPageTranslatorService = "edge"
            } else {
                currentPageTranslatorService = "google"
            }

            config.set("pageTranslatorService", currentPageTranslatorService)
        } 

    })
}

config.onReady(async () => {
    updateContextMenu()

     if (!config.get("installDateTime")) {
        config.set("installDateTime", Date.now())
    }
})

config.onReady(async () => {
    let activeTabTranslationInfo = {}

    function tabsOnActivated(activeInfo) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            activeTabTranslationInfo = {
                tabId: tabs[0].id,
                pageLanguageState: "original",
                url: tabs[0].url
            }
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "getCurrentPageLanguageState"
            }, {
                frameId: 0
            }, pageLanguageState => {
                activeTabTranslationInfo = {
                    tabId: tabs[0].id,
                    pageLanguageState,
                    url: tabs[0].url
                }
            })
        })
    }

    let sitesToAutoTranslate = {}

    function tabsOnRemoved(tabId) {
        delete sitesToAutoTranslate[tabId]
    }

    function runtimeOnMessage(request, sender, sendResponse) {
        if (request.action === "setPageLanguageState") {
            if (sender.tab.active) {
                activeTabTranslationInfo = {
                    tabId: sender.tab.id,
                    pageLanguageState: request.pageLanguageState,
                    url: sender.tab.url
                }
            }
        }
    }

    function webNavigationOnCommitted(details) {
        if (details.transitionType === "link" && details.frameId === 0 &&
            activeTabTranslationInfo.pageLanguageState === "translated" &&
            new URL(activeTabTranslationInfo.url).host === new URL(details.url).host) {
            sitesToAutoTranslate[details.tabId] = new URL(details.url).host
        } else {
            delete sitesToAutoTranslate[details.tabId]
        }
    }

    function webNavigationOnDOMContentLoaded(details) {
        if (details.frameId === 0) {
            const host = new URL(details.url).host
            if (sitesToAutoTranslate[details.tabId] === host) {
                setTimeout(() =>
                    chrome.tabs.sendMessage(details.tabId, {
                        action: "autoTranslateBecauseClickedALink"
                    }, {
                        frameId: 0
                    }), 700)
            }
            delete sitesToAutoTranslate[details.tabId]
        }
    }

    function enableTranslationOnClickingALink() {
        disableTranslationOnClickingALink()
        if (!chrome.webNavigation) return;

        chrome.tabs.onActivated.addListener(tabsOnActivated)
        chrome.tabs.onRemoved.addListener(tabsOnRemoved)
        chrome.runtime.onMessage.addListener(runtimeOnMessage)
        chrome.webNavigation.onCommitted.addListener(webNavigationOnCommitted)
        chrome.webNavigation.onDOMContentLoaded.addListener(webNavigationOnDOMContentLoaded)
    }

    function disableTranslationOnClickingALink() {
        activeTabTranslationInfo = {}
        sitesToAutoTranslate = {}
        chrome.tabs.onActivated.removeListener(tabsOnActivated)
        chrome.tabs.onRemoved.removeListener(tabsOnRemoved)
        chrome.runtime.onMessage.removeListener(runtimeOnMessage)

        if (chrome.webNavigation) {
            chrome.webNavigation.onCommitted.removeListener(webNavigationOnCommitted)
            chrome.webNavigation.onDOMContentLoaded.removeListener(webNavigationOnDOMContentLoaded)
        } else {
            console.info("No webNavigation permission")
        }
    }

    config.onChanged((name, newvalue) => {
        if (name === "autoTranslateWhenClickingALink") {
            if (newvalue == "yes") {
                enableTranslationOnClickingALink()
            } else {
                disableTranslationOnClickingALink()
            }
        }
    })

    chrome.permissions.onRemoved.addListener(permissions => {
        if (permissions.permissions.indexOf("webNavigation") !== -1) {
            config.set("autoTranslateWhenClickingALink", "no")
        }
    })

    chrome.permissions.contains({
        permissions: ["webNavigation"]
    }, hasPermissions => {
        if (hasPermissions && config.get("autoTranslateWhenClickingALink") === "yes") {
            enableTranslationOnClickingALink()
        } else {
            config.set("autoTranslateWhenClickingALink", "no")
        }
    })
})
