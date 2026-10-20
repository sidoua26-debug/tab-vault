/**
 * Tab Vault Service Worker (MV3)
 * Completely stateless background runner:
 * - Collapses tabs (skips pinned tabs, non-http(s) pages, and excluded domains)
 * - Supports real undo collapse that reopens tabs in window
 * - Rebuilds index and purges expired trash on startup
 * - Context menu integration for directional and selective collapse
 * - Omnibox keyword "tv" search integration
 * - Lazy restore to prevent browser memory spikes
 * - Startup behavior integration (openOnStartup)
 * - Coordinates large backup Blob URLs with offscreen document
 */

import { TabVaultStorage, rebuildIndexFromKeys, purgeExpiredTrash, reconcileOrphanKeys } from './src/storage.js';
import { executeAutoBackup } from './src/backup.js';
import { filterTabsForCollapse } from './src/collapse-filter.js';
import { setupContextMenus, handleContextMenuClick } from './src/context-menu.js';
import { getSettings } from './src/settings.js';
import { filterGroupsByQuery } from './src/search.js';
import { deduplicateTabs } from './src/import-export.js';

const storage = typeof chrome !== 'undefined' && chrome.storage
  ? new TabVaultStorage(chrome.storage.local, chrome.storage.sync)
  : null;

// Setup on install/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.storage.local.set({
    onInstalledReason: details.reason,
    installedAt: Date.now()
  });

  // Reconcile orphan keys, rebuild index, sync baseline, and purge trash
  await reconcileOrphanKeys(chrome.storage.local).catch(() => {});
  await rebuildIndexFromKeys(chrome.storage.local).catch(() => {});
  if (storage) {
    await storage.syncBaselineFromGroups().catch(() => {});
  }
  await purgeExpiredTrash(chrome.storage.local).catch(() => {});

  // Daily heartbeat backup alarm (every 24h = 1440 min)
  chrome.alarms.create('backup_daily', { periodInMinutes: 1440 });

  // Register context menus
  if (chrome.contextMenus) {
    setupContextMenus(chrome.contextMenus);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await reconcileOrphanKeys(chrome.storage.local).catch(() => {});
  await rebuildIndexFromKeys(chrome.storage.local).catch(() => {});
  if (storage) {
    await storage.syncBaselineFromGroups().catch(() => {});
  }
  await purgeExpiredTrash(chrome.storage.local).catch(() => {});
  if (chrome.contextMenus) {
    setupContextMenus(chrome.contextMenus);
  }

  // Check openOnStartup preference
  const settings = await getSettings(chrome.storage.local);
  if (settings.openOnStartup) {
    await openOrFocusDashboard();
  }
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

/**
 * Common stashing engine for window, selection, or context menu triggers.
 * @param {Array} tabsToCollapse
 */
async function stashTabsList(tabsToCollapse) {
  if (!tabsToCollapse || tabsToCollapse.length === 0) {
    await openOrFocusDashboard();
    return;
  }

  const settings = await getSettings(chrome.storage.local);

  // Filter excluded domains and incognito tabs
  const { excludedDomains } = await chrome.storage.local.get(['excludedDomains']);
  const domainList = Array.isArray(excludedDomains) ? excludedDomains : [];

  let eligibleTabs = tabsToCollapse.filter(t => {
    if (t.incognito && !settings.captureIncognito) return false;
    try {
      if (!t.url) return false;
      const host = new URL(t.url).hostname;
      return !domainList.includes(host);
    } catch (_) {
      return true;
    }
  });

  // Optional duplicate URL handling on capture
  if (settings.deduplicateOnCapture) {
    eligibleTabs = deduplicateTabs(eligibleTabs);
  }

  if (eligibleTabs.length === 0) {
    await openOrFocusDashboard();
    return;
  }

  const groupId = `grp_${Date.now()}`;
  const now = new Date();
  const title = `Tabs saved on ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

  const tabsPayload = eligibleTabs.map(t => ({
    id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: t.url,
    title: t.title || t.url,
    favIconUrl: t.favIconUrl || '',
    pinned: false,
    incognito: t.incognito || false,
    isStarred: false,
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
      tabs: eligibleTabs.map(t => ({ url: t.url, title: t.title }))
    }
  });

  // Debounce backup
  chrome.alarms.create('backup_debounce', { delayInMinutes: 5 });

  // Open dashboard tab
  await openOrFocusDashboard();

  // Close collapsed tabs
  const tabIdsToClose = eligibleTabs.map(t => t.id).filter(Boolean);
  if (tabIdsToClose.length > 0) {
    await chrome.tabs.remove(tabIdsToClose);
  }
}

// Action click: collapse current window tabs
chrome.action.onClicked.addListener(async (currentTab) => {
  const currentWindow = await chrome.windows.getCurrent({ populate: true });
  const allTabs = currentWindow.tabs || [];
  const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
  const tabsToCollapse = filterTabsForCollapse(allTabs, dashboardUrl);
  await stashTabsList(tabsToCollapse);
});

// Commands shortcut listener (e.g. Alt+Shift+V or Alt+Shift+O)
if (chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open_vault') {
      await openOrFocusDashboard();
    }
  });
}

// Omnibox keyword search ("tv <query>")
if (chrome.omnibox) {
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    if (!text.trim()) return;
    try {
      const groups = await storage.getAllGroups();
      const filtered = filterGroupsByQuery(groups, text);
      const suggestions = [];

      for (const g of filtered) {
        for (const t of (g.tabs || [])) {
          suggestions.push({
            content: t.url,
            description: `${escapeXml(t.title || t.url)} <dim>- ${escapeXml(t.url)}</dim>`
          });
          if (suggestions.length >= 6) break;
        }
        if (suggestions.length >= 6) break;
      }
      suggest(suggestions);
    } catch (_) {}
  });

  chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    if (text.startsWith('http://') || text.startsWith('https://')) {
      if (disposition === 'currentTab') {
        await chrome.tabs.update({ url: text });
      } else {
        await chrome.tabs.create({ url: text });
      }
    } else {
      const searchUrl = chrome.runtime.getURL(`tab-vault.html?q=${encodeURIComponent(text)}`);
      await chrome.tabs.create({ url: searchUrl });
    }
  });
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Context Menu listener
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    await handleContextMenuClick(info, tab, {
      stashTabs: stashTabsList,
      openDashboard: openOrFocusDashboard,
      excludeDomain: async (domain) => {
        const { excludedDomains } = await chrome.storage.local.get(['excludedDomains']);
        const currentList = Array.isArray(excludedDomains) ? excludedDomains : [];
        if (!currentList.includes(domain)) {
          currentList.push(domain);
          await chrome.storage.local.set({ excludedDomains: currentList });
        }
      }
    });
  });
}

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
      const inNewWindow = Boolean(message.newWindow);
      const lazy = message.lazy !== false;

      let targetWindowId = undefined;
      if (inNewWindow) {
        const newWin = await chrome.windows.create({ focused: true });
        targetWindowId = newWin.id;
      }

      // Restore with lazy prevention of memory spikes
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const createProps = {
          url,
          active: i === 0 && inNewWindow
        };
        if (targetWindowId !== undefined) {
          createProps.windowId = targetWindowId;
        }

        await chrome.tabs.create(createProps);

        // Stagger if large batch to prevent CPU / memory thrashing
        if (lazy && urls.length > 10 && (i + 1) % 10 === 0) {
          await new Promise(r => setTimeout(r, 150));
        }
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
      for (const t of lastCollapsedSession.tabs) {
        await chrome.tabs.create({ url: t.url, active: false });
      }
      await storage.deleteGroup(lastCollapsedSession.groupId);
      await chrome.storage.local.remove(['lastCollapsedSession']);
      sendResponse({ success: true, count: lastCollapsedSession.tabs.length });
    })().catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
