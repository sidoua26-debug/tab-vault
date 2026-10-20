/**
 * Tab Vault Service Worker (MV3)
 * Completely stateless background runner:
 * - Collapses tabs (skips pinned tabs and non-http(s) pages)
 * - Supports real undo collapse that reopens tabs in window
 * - Rebuilds index and purges expired trash on startup
 * - Coordinates large backup Blob URLs with offscreen document
 */

import { TabVaultStorage, rebuildIndexFromKeys, purgeExpiredTrash } from './src/storage.js';
import { executeAutoBackup } from './src/backup.js';
import { filterTabsForCollapse } from './src/collapse-filter.js';

const storage = typeof chrome !== 'undefined' && chrome.storage
  ? new TabVaultStorage(chrome.storage.local, chrome.storage.sync)
  : null;

// Setup on install/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.storage.local.set({
    onInstalledReason: details.reason,
    installedAt: Date.now()
  });

  // Rebuild index and purge trash
  await rebuildIndexFromKeys(chrome.storage.local).catch(() => {});
  await purgeExpiredTrash(chrome.storage.local).catch(() => {});

  // Daily heartbeat backup alarm (every 24h = 1440 min)
  chrome.alarms.create('backup_daily', { periodInMinutes: 1440 });
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildIndexFromKeys(chrome.storage.local).catch(() => {});
  await purgeExpiredTrash(chrome.storage.local).catch(() => {});
});

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'backup_debounce' || alarm.name === 'backup_daily') {
    try {
      await executeAutoBackup({
        storage,
        downloadsApi: chrome.downloads
      });
    } catch (err) {
      console.error('[Tab Vault] Auto-backup failed:', err);
    }
  }
});

// Action click: collapse current window tabs (skipping pinned and non-http(s))
chrome.action.onClicked.addListener(async (currentTab) => {
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  const allTabs = currentWindow.tabs || [];
  const dashboardUrl = chrome.runtime.getURL('tab-vault.html');

  // Filter: skip pinned tabs AND skip non-http(s) pages
  const tabsToCollapse = filterTabsForCollapse(allTabs, dashboardUrl);

  if (tabsToCollapse.length === 0) {
    await openOrFocusDashboard();
    return;
  }

  const groupId = `grp_${Date.now()}`;
  const now = new Date();
  const title = `Tabs saved on ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

  const tabsPayload = tabsToCollapse.map(t => ({
    id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: t.url,
    title: t.title || t.url,
    favIconUrl: t.favIconUrl || '',
    pinned: false,
    incognito: t.incognito || false,
    createdAt: Date.now()
  }));

  // Save atomically
  await storage.saveGroup({
    id: groupId,
    title,
    createdAt: Date.now(),
    isLocked: false,
    isStarred: false,
    tabs: tabsPayload
  });

  // Store session for real undo
  await chrome.storage.local.set({
    lastCollapsedSession: {
      groupId,
      windowId: currentWindow.id,
      tabs: tabsToCollapse.map(t => ({ url: t.url, title: t.title }))
    }
  });

  // Debounce backup
  chrome.alarms.create('backup_debounce', { delayInMinutes: 5 });

  // Open dashboard tab
  await openOrFocusDashboard();

  // Close collapsed tabs
  const tabIdsToClose = tabsToCollapse.map(t => t.id);
  await chrome.tabs.remove(tabIdsToClose);
});

async function openOrFocusDashboard() {
  const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
  const existingTabs = await chrome.tabs.query({ url: dashboardUrl });
  if (existingTabs.length > 0) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });
    if (existingTabs[0].windowId) {
      await chrome.windows.update(existingTabs[0].windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: dashboardUrl });
  }
}

// Runtime message dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'triggerBackupNow') {
    executeAutoBackup({
      storage,
      downloadsApi: chrome.downloads,
      force: message.force || false
    })
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'restoreTabs') {
    (async () => {
      const urls = message.urls || [];
      for (const url of urls) {
        await chrome.tabs.create({ url, active: false });
      }
      sendResponse({ success: true, count: urls.length });
    })().catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'undoCollapse') {
    (async () => {
      const { lastCollapsedSession } = await chrome.storage.local.get(['lastCollapsedSession']);
      if (!lastCollapsedSession) {
        return sendResponse({ success: false, message: 'No collapse session to undo' });
      }
      // Reopen tabs in window
      for (const t of lastCollapsedSession.tabs) {
        await chrome.tabs.create({ url: t.url, windowId: lastCollapsedSession.windowId, active: false });
      }
      // Delete the created group
      await storage.deleteGroup(lastCollapsedSession.groupId);
      await chrome.storage.local.remove(['lastCollapsedSession']);
      sendResponse({ success: true, count: lastCollapsedSession.tabs.length });
    })().catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
