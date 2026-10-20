/**
 * Tab Vault Context Menu Operations
 * Handles:
 * - Stash current tab only
 * - Stash all tabs in current window
 * - Stash tabs to the right
 * - Stash tabs to the left
 * - Stash all tabs in all windows
 * - Exclude current domain from capture
 */

import { filterTabsForCollapse } from './collapse-filter.js';

export const CONTEXT_MENU_ITEMS = [
  { id: 'stash_current_tab', title: 'Send only this tab to Tab Vault' },
  { id: 'stash_current_window', title: 'Send all tabs in this window to Tab Vault' },
  { id: 'stash_tabs_right', title: 'Send tabs to the right to Tab Vault' },
  { id: 'stash_tabs_left', title: 'Send tabs to the left to Tab Vault' },
  { id: 'stash_all_windows', title: 'Send all tabs in all windows to Tab Vault' },
  { id: 'separator_1', type: 'separator' },
  { id: 'exclude_domain', title: 'Exclude this domain from capture' },
  { id: 'open_dashboard', title: 'Open Tab Vault dashboard' }
];

/**
 * Register all Tab Vault context menus
 * @param {Object} contextMenusApi - chrome.contextMenus
 */
export function setupContextMenus(contextMenusApi) {
  if (!contextMenusApi || typeof contextMenusApi.create !== 'function') return;

  contextMenusApi.removeAll(() => {
    for (const item of CONTEXT_MENU_ITEMS) {
      const opts = {
        id: item.id,
        title: item.title,
        contexts: ['action', 'page', 'frame']
      };
      if (item.type === 'separator') {
        opts.type = 'separator';
        delete opts.title;
      }
      contextMenusApi.create(opts, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          // ignore duplicate registration
        }
      });
    }
  });
}

/**
 * Handle context menu click actions
 * @param {Object} info - chrome.contextMenus.OnClickData
 * @param {Object} tab - current tab
 * @param {Object} handlers - { stashTabs, openDashboard, excludeDomain }
 */
export async function handleContextMenuClick(info, tab, handlers) {
  const { id } = info;
  switch (id) {
    case 'stash_current_tab':
      if (tab) {
        await handlers.stashTabs([tab]);
      }
      break;

    case 'stash_current_window': {
      const currentWin = await chrome.windows.getCurrent({ populate: true });
      const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
      const tabs = filterTabsForCollapse(currentWin.tabs || [], dashboardUrl);
      await handlers.stashTabs(tabs);
      break;
    }

    case 'stash_tabs_right': {
      const currentWin = await chrome.windows.getCurrent({ populate: true });
      const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
      const allTabs = currentWin.tabs || [];
      const currentIdx = tab ? tab.index : 0;
      const rightTabs = allTabs.filter(t => t.index > currentIdx);
      const filtered = filterTabsForCollapse(rightTabs, dashboardUrl);
      if (filtered.length > 0) {
        await handlers.stashTabs(filtered);
      }
      break;
    }

    case 'stash_tabs_left': {
      const currentWin = await chrome.windows.getCurrent({ populate: true });
      const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
      const allTabs = currentWin.tabs || [];
      const currentIdx = tab ? tab.index : 0;
      const leftTabs = allTabs.filter(t => t.index < currentIdx);
      const filtered = filterTabsForCollapse(leftTabs, dashboardUrl);
      if (filtered.length > 0) {
        await handlers.stashTabs(filtered);
      }
      break;
    }

    case 'stash_all_windows': {
      const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
      const dashboardUrl = chrome.runtime.getURL('tab-vault.html');
      const tabsToStash = [];
      for (const win of allWindows) {
        tabsToStash.push(...filterTabsForCollapse(win.tabs || [], dashboardUrl));
      }
      if (tabsToStash.length > 0) {
        await handlers.stashTabs(tabsToStash);
      }
      break;
    }

    case 'exclude_domain': {
      if (tab && tab.url) {
        try {
          const parsed = new URL(tab.url);
          const domain = parsed.hostname;
          await handlers.excludeDomain(domain);
        } catch (_) {}
      }
      break;
    }

    case 'open_dashboard':
      await handlers.openDashboard();
      break;
  }
}
