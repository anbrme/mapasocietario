export function sendToWorker(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp) => {
      const err = chrome.runtime.lastError;
      resolve(err ? { type: 'error', error: String(err.message) } : resp);
    });
  });
}
