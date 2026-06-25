import { resolveCompany, getCompany } from './api/client.js';
import { MSG } from './api/messages.js';

export async function handleMessage(msg, { resolveImpl = resolveCompany, getImpl = getCompany } = {}) {
  try {
    if (msg.type === MSG.RESOLVE) {
      return { type: 'matches', matches: await resolveImpl(msg.query) };
    }
    if (msg.type === MSG.GET_COMPANY) {
      const company = await getImpl(msg.id);
      return company ? { type: 'company', company } : { type: 'error', error: 'not_found' };
    }
    return { type: 'error', error: 'unknown_message' };
  } catch (e) {
    return { type: 'error', error: String(e?.message || e) };
  }
}

// --- Chrome wiring (not exercised by unit tests) ---
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

  chrome.runtime.onInstalled?.addListener(() => {
    chrome.contextMenus.create({
      id: 'lookup-company',
      title: 'Look up Spanish company: "%s"',
      contexts: ['selection'],
    });
  });

  chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'lookup-company' || !info.selectionText) return;
    await chrome.sidePanel.open({ tabId: tab.id });
    // Panel may still be mounting; retry the broadcast briefly.
    const payload = { type: MSG.SELECTION, query: info.selectionText.trim() };
    for (let i = 0; i < 10; i++) {
      try { await chrome.runtime.sendMessage(payload); break; }
      catch { await new Promise((r) => setTimeout(r, 150)); }
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handleMessage(msg).then(sendResponse);
    return true; // async response
  });
}
