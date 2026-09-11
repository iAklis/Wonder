import '../lib/config.js';
import '../lib/platformInfo.js';
import '../lib/i18n.js';
import '../contentScript/checkScriptIsInjected.js';
// Module imports are bundled once per frame. Begin observing settings at document_start.
function start() { import('../entries/page.js'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
else start();
