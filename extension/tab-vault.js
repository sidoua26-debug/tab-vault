/**
 * Tab Vault Dashboard Script
 * Renders tab groups, empty state / disaster recovery banners, trash bin view,
 * and handles undo, restore, and delete flows.
 */

import { TabVaultStorage, adjustBaseline, purgeExpiredTrash } from './src/storage.js';
import { evaluateEmptyState } from './src/wipe-detection.js';

const storage = new TabVaultStorage(chrome.storage.local, chrome.storage.sync);

let lastDeletedAction = null; // { type: 'tab' | 'group', trashItem, payload, groupId }
let toastTimeout = null;
let currentView = 'active'; // 'active' | 'trash'

document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  setupDevPanel();
  setupEventListeners();
  await purgeExpiredTrash(chrome.storage.local).catch(() => {});
  await renderDashboard();
  await checkCollapseUndoBanner();

  // Clear onInstalledReason after first dashboard render so subsequent opens are not treated as fresh installs
  await chrome.storage.local.remove(['onInstalledReason']).catch(() => {});
});

function setupTheme() {
  const savedTheme = localStorage.getItem('tab_vault_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tab_vault_theme', next);
}

async function setupDevPanel() {
  const isDevUrl = window.location.search.includes('dev=1');
  const { devMode } = await chrome.storage.local.get(['devMode']);
  const devPanel = document.getElementById('devPanel');
  if (devPanel && (isDevUrl || devMode === true)) {
    devPanel.style.display = 'block';
  }
}

async function checkCollapseUndoBanner() {
  const { lastCollapsedSession } = await chrome.storage.local.get(['lastCollapsedSession']);
  const banner = document.getElementById('collapseUndoBanner');
  const message = document.getElementById('collapseUndoMessage');

  if (lastCollapsedSession && lastCollapsedSession.tabs && lastCollapsedSession.tabs.length > 0) {
    message.textContent = `Stashed ${lastCollapsedSession.tabs.length} tabs into a new group.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function setupEventListeners() {
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

  // View toggling (Active vs Trash)
  document.getElementById('btnViewActive').addEventListener('click', () => {
    currentView = 'active';
    document.getElementById('btnViewActive').classList.add('active-view-btn');
    document.getElementById('btnViewTrash').classList.remove('active-view-btn');
    document.getElementById('trashContainer').classList.add('hidden');
    document.getElementById('groupsList').classList.remove('hidden');
    document.getElementById('bannerContainer').classList.remove('hidden');
    renderDashboard();
  });

  document.getElementById('btnViewTrash').addEventListener('click', async () => {
    currentView = 'trash';
    document.getElementById('btnViewTrash').classList.add('active-view-btn');
    document.getElementById('btnViewActive').classList.remove('active-view-btn');
    document.getElementById('groupsList').classList.add('hidden');
    document.getElementById('bannerContainer').classList.add('hidden');
    document.getElementById('trashContainer').classList.remove('hidden');
    await renderTrashView();
  });

  document.getElementById('btnEmptyTrash').addEventListener('click', async () => {
    if (confirm('Empty trash bin permanently?')) {
      await storage.clearTrash();
      await renderTrashView();
      await updateTrashBadge();
    }
  });

  // Collapse Undo Banner handlers
  document.getElementById('btnUndoCollapse').addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ action: 'undoCollapse' });
    if (res && res.success) {
      document.getElementById('collapseUndoBanner').classList.add('hidden');
      showToast(`Reopened ${res.count} tabs in window.`);
      await renderDashboard();
    }
  });

  document.getElementById('btnDismissCollapseUndo').addEventListener('click', async () => {
    await chrome.storage.local.remove(['lastCollapsedSession']);
    document.getElementById('collapseUndoBanner').classList.add('hidden');
  });

  // Export Backup
  document.getElementById('btnExport').addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'triggerBackupNow', force: true });
      if (response && response.success) {
        showToast(`Backup exported to ${response.filename} (${response.tabCount} tabs)`);
      } else {
        showToast(`Backup failed: ${response?.message || response?.error || 'Unknown error'}`);
      }
    } catch (err) {
      showToast(`Export error: ${err.message}`);
    }
  });

  // Restore file picker
  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnRestorePicker').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Invalid JSON format: ${parseErr.message}`);
      }

      let groupsToRestore = null;
      if (Array.isArray(payload)) {
        groupsToRestore = payload;
      } else if (payload && Array.isArray(payload.groups)) {
        groupsToRestore = payload.groups;
      }

      if (!groupsToRestore || groupsToRestore.length === 0) {
        throw new Error('Invalid Tab Vault backup format: no tab groups found in file');
      }

      let totalRestoredTabs = 0;
      for (const group of groupsToRestore) {
        const cleanTabs = (Array.isArray(group.tabs) ? group.tabs : []).map((t, idx) => ({
          id: t.id ? String(t.id) : `tab_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          url: t.url || '',
          title: t.title || t.url || 'Untitled Tab',
          favIconUrl: t.favIconUrl || '',
          pinned: Boolean(t.pinned),
          incognito: Boolean(t.incognito),
          createdAt: t.createdAt || Date.now()
        }));

        const cleanGroup = {
          ...group,
          id: group.id ? String(group.id) : `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: group.title || 'Restored Group',
          createdAt: group.createdAt || Date.now(),
          isLocked: Boolean(group.isLocked),
          isStarred: Boolean(group.isStarred),
          tabs: cleanTabs
        };

        await storage.saveGroup(cleanGroup);
        totalRestoredTabs += cleanTabs.length;
      }

      // Raise baseline so shrink guard accounts for restored tabs
      await adjustBaseline(chrome.storage.local, totalRestoredTabs);

      showToast(`Successfully restored ${groupsToRestore.length} groups (${totalRestoredTabs} tabs)`);
      await renderDashboard();
    } catch (err) {
      console.error('[Tab Vault] Backup restore failed:', err);
      showToast(`Restore error: ${err.message}`);
      alert(`Could not restore file: ${err.message}`);
    } finally {
      fileInput.value = '';
    }
  });

  // Developer simulation controls
  document.getElementById('btnSimulateWipe').addEventListener('click', async () => {
    const confirmed = confirm(
      'This will clear chrome.storage.local to simulate a browser crash or profile wipe.\n(chrome.storage.sync and backup files in Downloads will remain intact).\n\nProceed?'
    );
    if (!confirmed) return;

    await chrome.storage.local.clear();
    showToast('chrome.storage.local wiped! Reloading state...');
    await renderDashboard();
  });

  document.getElementById('btnTriggerAutoBackup').addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'triggerBackupNow' });
    showToast(response.success ? `Auto-backup completed: ${response.filename}` : `Auto-backup: ${response.message}`);
  });

  // Toast Undo
  document.getElementById('btnToastUndo').addEventListener('click', async () => {
    if (!lastDeletedAction) return;

    if (lastDeletedAction.type === 'group') {
      await storage.saveGroup(lastDeletedAction.payload);
      // Raise baseline
      const count = lastDeletedAction.payload.tabs ? lastDeletedAction.payload.tabs.length : 0;
      await adjustBaseline(chrome.storage.local, count);
    } else if (lastDeletedAction.type === 'tab') {
      const { tab, groupId } = lastDeletedAction;
      let group = groupId ? await storage.getGroup(groupId) : null;
      if (!group) {
        group = {
          id: groupId || `grp_${Date.now()}`,
          title: 'Restored Group',
          createdAt: Date.now(),
          tabs: [tab]
        };
        await storage.saveGroup(group);
      } else {
        group.tabs.push(tab);
        await chrome.storage.local.set({ [`grp_${group.id}`]: group });
      }
      // Raise baseline
      await adjustBaseline(chrome.storage.local, 1);
    }

    hideToast();
    lastDeletedAction = null;
    await renderDashboard();
    await updateTrashBadge();
  });

  document.getElementById('btnToastClose').addEventListener('click', hideToast);
}

async function updateTrashBadge() {
  const trash = await storage.getTrashBin();
  document.getElementById('trashCount').textContent = trash.length;
}

async function renderDashboard() {
  await updateTrashBadge();
  const groups = await storage.getAllGroups();
  const totalTabs = groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);

  let syncState = null;
  try {
    syncState = await chrome.storage.sync.get(['hasSavedTabs', 'lastKnownTabCount']);
  } catch (err) {
    console.warn('Sync storage unavailable:', err);
  }

  const localMeta = await chrome.storage.local.get(['onInstalledReason']);

  let downloadItems = [];
  try {
    downloadItems = await chrome.downloads.search({
      query: ['tab-vault-backup-'],
      orderBy: ['-endTime'],
      limit: 10
    });
  } catch (err) {
    console.warn('Downloads search unavailable:', err);
  }

  const emptyState = evaluateEmptyState({
    localTabCount: totalTabs,
    syncState,
    onInstalledReason: localMeta.onInstalledReason,
    downloadItems
  });

  const bannerContainer = document.getElementById('bannerContainer');
  const groupsList = document.getElementById('groupsList');

  bannerContainer.innerHTML = '';
  groupsList.innerHTML = '';

  if (emptyState.isEmpty) {
    renderEmptyBanner(bannerContainer, emptyState);
  } else {
    renderGroups(groupsList, groups);
  }
}

function renderEmptyBanner(container, state) {
  const banner = document.createElement('div');
  const severityClass = state.severity === 'danger'
    ? 'banner-danger'
    : (state.severity === 'warning' ? 'banner-warning' : 'banner-info');

  banner.className = `banner ${severityClass}`;

  let hintHtml = '';
  if (state.recommendedBackup) {
    const rec = state.recommendedBackup;
    hintHtml = `
      <div class="banner-hint">
        💡 <strong>Recommended Backup File:</strong> ${escapeHtml(rec.filename)} (${Math.round((rec.fileSize || 0) / 1024)} KB)
      </div>
    `;
  }

  banner.innerHTML = `
    <div class="banner-title">${escapeHtml(state.title)}</div>
    <div class="banner-message">${escapeHtml(state.message)}</div>
    ${hintHtml}
    <div class="banner-actions">
      <button id="btnBannerRestore" class="btn btn-sm btn-primary">Select Backup File to Restore</button>
    </div>
  `;

  container.appendChild(banner);

  banner.querySelector('#btnBannerRestore').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
}

function renderGroups(container, groups) {
  for (const group of groups) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.id = `card_${group.id}`;

    const tabsCount = group.tabs ? group.tabs.length : 0;

    card.innerHTML = `
      <div class="group-header">
        <div class="group-header-info">
          <span class="group-title">${escapeHtml(group.title || 'Untitled Group')}</span>
          <span class="group-count">${tabsCount} ${tabsCount === 1 ? 'tab' : 'tabs'}</span>
        </div>
        <div class="group-actions">
          <button class="btn btn-sm btn-secondary btn-restore-all" data-id="${group.id}">Restore all</button>
          <button class="btn btn-sm btn-ghost btn-delete-all" data-id="${group.id}">Delete all</button>
        </div>
      </div>
      <div class="group-tabs">
        ${(group.tabs || []).map(tab => `
          <div class="tab-row" data-tab-id="${tab.id}">
            <img class="tab-favicon" src="${escapeHtml(tab.favIconUrl || 'icons/icon16.png')}" alt="">
            <a class="tab-link" href="${escapeHtml(tab.url)}" target="_blank" rel="noopener">${escapeHtml(tab.title || tab.url)}</a>
            <button class="tab-delete-btn" title="Delete tab" data-group-id="${group.id}" data-tab-id="${tab.id}">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    // Attach dynamic image error listener without inline onerror handler
    card.querySelectorAll('.tab-favicon').forEach(img => {
      img.addEventListener('error', () => {
        img.src = 'icons/icon16.png';
      }, { once: true });
    });

    // Handlers
    card.querySelector('.btn-restore-all').addEventListener('click', async () => {
      const count = group.tabs ? group.tabs.length : 0;
      const urls = (group.tabs || []).map(t => t.url);
      await chrome.runtime.sendMessage({ action: 'restoreTabs', urls });

      // Lower shrink-guard baseline on restore removal
      await adjustBaseline(chrome.storage.local, -count);

      if (!group.isLocked) {
        await storage.deleteGroup(group.id);
        await renderDashboard();
      }
    });

    card.querySelector('.btn-delete-all').addEventListener('click', async () => {
      const count = group.tabs ? group.tabs.length : 0;
      const deletedGroup = await storage.getGroup(group.id);
      lastDeletedAction = {
        type: 'group',
        payload: deletedGroup,
        groupId: group.id
      };
      await storage.deleteGroup(group.id);
      showToast(`Group deleted (${count} tabs).`);
      await renderDashboard();
    });

    card.querySelectorAll('.tab-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const gId = btn.getAttribute('data-group-id');
        const tId = btn.getAttribute('data-tab-id');
        const groupObj = await storage.getGroup(gId);
        const tabObj = groupObj?.tabs?.find(t => t.id === tId);

        lastDeletedAction = {
          type: 'tab',
          tab: tabObj,
          groupId: gId
        };

        const res = await storage.deleteTab(gId, tId);
        if (res) {
          showToast('Tab removed.');
          await renderDashboard();
        }
      });
    });

    container.appendChild(card);
  }
}

async function renderTrashView() {
  const trashList = document.getElementById('trashList');
  trashList.innerHTML = '';
  const trash = await storage.getTrashBin();

  if (trash.length === 0) {
    trashList.innerHTML = '<div style="padding: 16px; color: var(--color-text-muted);">Trash is empty.</div>';
    return;
  }

  for (const item of trash) {
    const el = document.createElement('div');
    el.className = 'trash-item';

    const isGroup = item.itemType === 'group';
    const title = isGroup ? (item.payload.title || 'Untitled Group') : (item.payload.title || item.payload.url);
    const dateStr = new Date(item.deletedAt).toLocaleString();
    const subText = isGroup ? `${item.payload.tabs?.length || 0} tabs • Deleted ${dateStr}` : `Single tab • Deleted ${dateStr}`;

    el.innerHTML = `
      <div class="trash-item-info">
        <span class="trash-item-title">${escapeHtml(title)}</span>
        <span class="trash-item-meta">${escapeHtml(subText)}</span>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-sm btn-secondary btn-restore-trash" data-trash-id="${item.id}">Restore</button>
      </div>
    `;

    el.querySelector('.btn-restore-trash').addEventListener('click', async () => {
      await storage.restoreTrashItem(item.id);
      showToast('Item restored from trash.');
      await renderTrashView();
      await updateTrashBadge();
    });

    trashList.appendChild(el);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 15000);
}

function hideToast() {
  document.getElementById('toast').classList.add('hidden');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
