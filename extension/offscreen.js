/**
 * Offscreen Document Handler for large blob-based backup downloads
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.action === 'downloadLargeBackup') {
    handleLargeBackup(message.data, message.filename)
      .then(downloadId => sendResponse({ success: true, downloadId }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleLargeBackup(jsonString, filename) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename,
      conflictAction: 'overwrite',
      saveAs: false
    });

    // Cleanup blob URL after a short buffer
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 15000);

    return downloadId;
  } catch (err) {
    URL.revokeObjectURL(blobUrl);
    throw err;
  }
}
