/**
 * Tab Vault Service Worker (MV3)
 * Completely stateless background runner:
 * - Collapses tabs on extension icon click
 * - Schedules and handles debounced & daily auto-backups
 * - Excludes incognito tabs
 */

import { TabVaultStorage } from './src/storage.js';
import { executeAutoBackup } from './src/backup.js';

const storage = new TabVaultStorage(chrome.storage.local, chrome.storage.sync);

// Setup on install/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  // Store install reason in local storage for empty-state detection
  await chrome.storage.local.set({
    onInstalledReason: details.reason,
    installedAt: Date.now()
  });

  // Daily heartbeat backup alarm (every 24h = 1440 min)
  chrome.alarms.create('backup_daily', { periodInMinutes: 1440 });
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

// Icon click: collapse current window tabs into a new group
chrome.action.onClicked.addListener(async (currentTab) => {
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  const allTabs = currentWindow.tabs || [];

  // Exclude tab-vault dashboard tab itself and internal chrome pages if desired
  const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
  const tabsToCollapse = allTabs.filter(tab => {
    return !tab.url.startsWith(dashboardUrl) && !tab.url.startsWith('chrome://');
  });

  if (tabsToCollapse.length === 0) {
    // Just open or focus existing dashboard
    await openOrFocusDashboard();
    return;
  }

  // Create group payload
  const groupId = `grp_${Date.now()}`;
  const now = new Date();
  const title = `Tabs saved on ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

  const tabsPayload = tabsToCollapse.map(t => ({
    id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: t.url,
    title: t.title || t.url,
    favIconUrl: t.favIconUrl || '',
    pinned: t.pinned || false,
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

  // Debounce backup (runs 5 mins after tab changes, or immediately can be tested)
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
});
