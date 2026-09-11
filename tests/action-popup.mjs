import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

// Action popups auto-size differently from extension pages in ordinary tabs.
// Chromium exposes them as separate CDP targets, outside Playwright's pages().
export async function checkActionPopup({ context, page, extensionId, checks }) {
  await page.bringToFront();
  const worker = context
    .serviceWorkers()
    .find((item) => item.url().includes(extensionId));
  assert.ok(worker, "The extension worker must be running");
  const cdp = await context.browser().newBrowserCDPSession();
  const previous = new Set(
    (await cdp.send("Target.getTargets")).targetInfos.map(
      (target) => target.targetId,
    ),
  );
  const pending = new Map();
  let target,
    sessionId,
    nextId = 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const receive = (event) => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  cdp.on("Target.receivedMessageFromTarget", receive);
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Action popup CDP timeout: ${method}`));
      }, 5000);
      pending.set(id, { resolve, reject, timer });
      cdp
        .send("Target.sendMessageToTarget", {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch((error) => {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        });
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    assert.ok(
      !result.exceptionDetails,
      JSON.stringify(result.exceptionDetails),
    );
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    assert.fail(`Action popup condition timed out: ${expression}`);
  };
  const click = async (expression) => {
    const point = await evaluate(`(async () => {
      const element = ${expression};
      if (!element) throw new Error('Missing click target');
      element.scrollIntoView({block:'nearest'});
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = element.getBoundingClientRect();
      const x=rect.x+rect.width/2, y=rect.y+rect.height/2;
      if(!element.contains(document.elementFromPoint(x,y))) throw new Error('Target not hittable: '+element.textContent+' '+JSON.stringify({x,y,width:innerWidth,height:innerHeight,hit:document.elementFromPoint(x,y)?.outerHTML}));
      return {x,y};
    })()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...point,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...point,
    });
  };
  const option = (name) =>
    `[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent.trim()===${JSON.stringify(name)})`;
  const language = `document.querySelector('#selectTargetLanguage')`;
  const service = `document.querySelectorAll('[role="combobox"]')[1]`;
  const open = async (trigger) => {
    await waitFor(
      `!document.querySelector('[data-slot="select-content"]') && getComputedStyle(document.body).pointerEvents !== 'none'`,
    );
    const width = await evaluate("innerWidth");
    await click(trigger);
    // Regress the observed flash-then-close, including queued native resize events.
    await delay(350);
    assert.equal(
      await evaluate(`${trigger}.getAttribute('aria-expanded')`),
      "true",
      "The actual toolbar popup select must stay open after a mouse click",
    );
    assert.equal(
      await evaluate("innerWidth"),
      width,
      "Opening a menu must not change the toolbar popup width",
    );
    assert.equal(
      await evaluate(`(() => {
      const r=document.querySelector('[role="listbox"]').getBoundingClientRect();
      return r.top>=0 && r.left>=0 && r.bottom<=innerHeight && r.right<=innerWidth;
    })()`),
      true,
      "The entire menu must fit within the toolbar popup viewport",
    );
  };
  try {
    await worker.evaluate(() => chrome.action.openPopup());
    for (let attempt = 0; attempt < 100 && !target; attempt++) {
      target = (await cdp.send("Target.getTargets")).targetInfos.find(
        (item) =>
          !previous.has(item.targetId) &&
          item.url === `chrome-extension://${extensionId}/popup/popup.html`,
      );
      if (!target) await delay(50);
    }
    assert.ok(
      target,
      "chrome.action.openPopup must create a real toolbar popup",
    );
    ({ sessionId } = await cdp.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: false,
    }));
    await evaluate(`(() => {
      window.popupDiagnostics = [];
      const record = (event) => window.popupDiagnostics.push({
        event: event.type,
        width: innerWidth,
        height: innerHeight,
        clientWidth: document.documentElement.clientWidth,
        bodyWidth: document.body.getBoundingClientRect().width,
        marginRight: getComputedStyle(document.body).marginRight,
        scrollLocked: document.body.hasAttribute('data-scroll-locked'),
        expanded: document.querySelector('#selectTargetLanguage')?.getAttribute('aria-expanded'),
      });
      for (const type of ['resize', 'blur', 'pointerdown', 'pointerup'])
        window.addEventListener(type, record, true);
      record({type: 'attached'});
    })()`);
    await waitFor(
      `!!${language} && !document.querySelector('#btnTranslate')?.disabled`,
    );
    await open(language);
    const screenshot = await send("Page.captureScreenshot");
    await writeFile(
      "artifacts/action-popup-select.png",
      Buffer.from(screenshot.data, "base64"),
    );
    await click(option("German"));
    await waitFor(
      `(async()=> (await chrome.storage.local.get('targetLanguage')).targetLanguage === 'de')()`,
    );
    assert.equal(
      await evaluate(`${language}.getAttribute('aria-expanded')`),
      "false",
    );
    await open(language);
    await click(option("Chinese (Simplified)"));
    await waitFor(
      `(async()=> (await chrome.storage.local.get('targetLanguage')).targetLanguage === 'zh-CN')()`,
    );
    await open(service);
    await click(option("Edge Translate"));
    await waitFor(
      `(async()=> (await chrome.storage.local.get('pageTranslatorService')).pageTranslatorService === 'edge')()`,
    );
    await open(service);
    await click(option("Google Translate"));
    await waitFor(
      `(async()=> (await chrome.storage.local.get('pageTranslatorService')).pageTranslatorService === 'google')()`,
    );
    await open(language);
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await waitFor(
      `${language}.getAttribute('aria-expanded') === 'false' && document.activeElement === ${language}`,
    );
    // Blur still dismisses the select; only unchanged-size resize is ignored.
    await open(language);
    await evaluate(`window.dispatchEvent(new Event('blur'))`);
    await waitFor(`${language}.getAttribute('aria-expanded') === 'false'`);
    checks.push(
      "real toolbar popup mouse language/service selection, persistence, Escape focus and blur dismissal",
    );
  } catch (error) {
    if (sessionId) {
      const diagnostics = await evaluate("window.popupDiagnostics").catch(
        () => null,
      );
      await writeFile(
        "artifacts/action-popup-failure.json",
        JSON.stringify(diagnostics, null, 2),
      );
      const screenshot = await send("Page.captureScreenshot").catch(() => null);
      if (screenshot)
        await writeFile(
          "artifacts/action-popup-failure.png",
          Buffer.from(screenshot.data, "base64"),
        );
    }
    throw error;
  } finally {
    if (target)
      await cdp
        .send("Target.closeTarget", { targetId: target.targetId })
        .catch(() => {});
    cdp.off("Target.receivedMessageFromTarget", receive);
    for (const request of pending.values()) clearTimeout(request.timer);
    await cdp.detach();
  }
}
