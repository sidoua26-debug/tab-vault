/**
 * Tab Vault Offscreen Document Handler
 * Creates Blob URLs for large backup exports and returns them to the service worker.
 * (Note: chrome.downloads is NOT available in offscreen documents).
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.action === 'createBlobUrl') {
    try {
      const blob = new Blob([message.data], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      sendResponse({ success: true, blobUrl });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.action === 'revokeBlobUrl') {
    try {
      if (message.blobUrl) {
        URL.revokeObjectURL(message.blobUrl);
      }
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }
});
