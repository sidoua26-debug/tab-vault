/**
 * Tab Vault Dashboard Script (Milestone 3 & Final Production Polish)
 * Complete feature set:
 * - Instant search filter across titles and URLs
 * - Multi-select tab checkboxes & batch action bar (Restore, Move to Group, Delete)
 * - Star individual tabs & Quick List pinned sidebar
 * - Drag-and-drop tab reordering & split-to-new-group dropzone
 * - Inline group title editing, Group Star/Pin, Group Lock
 * - Options & Settings modal (window target, retention policy, startup behavior, lazy restore)
 * - Rolling in-extension snapshots with 1-click rollback
 * - OneTab plain-text import/export & JSON backup
 * - Single-tab click restore honoring retention settings
 * - Single-tab toast undo with atomic verification (no duplicate grp_ prefixes)
 * - Trash bin with 30-day retention and instant undo
 */

import { TabVaultStorage, adjustBaseline, purgeExpiredTrash, reconcileOrphanKeys } from './src/storage.js';
import { evaluateEmptyState } from './src/wipe-detection.js';
import { filterGroupsByQuery, countVisibleTabs } from './src/search.js';
import { exportToPlainText, parsePlainTextImport, deduplicateTabs, formatGroupUrlsForClipboard } from './src/import-export.js';
import { getSettings, saveSettings, migrateThemeSettings } from './src/settings.js';
import { createSnapshot, getSnapshots, rollbackSnapshot } from './src/snapshots.js';

const localArea = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.local : null;
const syncArea = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : null;
const storage = new TabVaultStorage(localArea, syncArea);

let lastDeletedAction = null; // { type: 'tab' | 'group' | 'batch', trashItem, payload, groupId }
let toastTimeout = null;
let currentView = 'active'; // 'active' | 'trash'
let currentSearchQuery = '';
let selectedTabs = new Map(); // tabId -> { tab, groupId }
let draggedTabInfo = null; // { tabId, sourceGroupId }

document.addEventListener('DOMContentLoaded', async () => {
  await setupTheme();
  setupDevPanel();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupDragAndDropDropzone();

  // Handle URL query ?q=... (e.g. from omnibox)
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q');
  if (initialQuery) {
    currentSearchQuery = initialQuery;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = initialQuery;
      document.getElementById('btnSearchClear').style.display = 'block';
    }
  }

  await purgeExpiredTrash(chrome.storage.local).catch(() => {});
  await renderDashboard();
  await checkCollapseUndoBanner();
  await checkFirstRunHint();

  // Clear onInstalledReason after first dashboard render
  await chrome.storage.local.remove(['onInstalledReason']).catch(() => {});
});

async function setupTheme() {
  const theme = await migrateThemeSettings(chrome.storage.local).catch(() => 'light');
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.body.setAttribute('data-theme', next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('tab_vault_theme', next);
  }
  await saveSettings(chrome.storage.local, { theme: next, themeSetExplicitly: true });
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

async function checkFirstRunHint() {
  const banner = document.getElementById('firstRunHint');
  if (!banner) return;

  const data = await chrome.storage.local.get(['vault_settings', 'firstRunDismissed', 'group_index']);
  const index = Array.isArray(data.group_index) ? data.group_index : [];
  const dismissed = Boolean(data.firstRunDismissed);
  const isFreshInstall = !data.vault_settings;

  // Show only if empty vault, fresh install (no vault_settings yet), and not dismissed
  if (index.length === 0 && isFreshInstall && !dismissed) {
    banner.classList.remove('hidden');
    document.getElementById('btnDismissFirstRun')?.addEventListener('click', async () => {
      banner.classList.add('hidden');
      await chrome.storage.local.set({ firstRunDismissed: true });
    }, { once: true });
  } else {
    banner.classList.add('hidden');
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const searchInput = document.getElementById('searchInput');
    if ((e.key === '/' && document.activeElement !== searchInput && !isEditingText(document.activeElement)) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape') {
      const modal = document.querySelector('.modal-overlay:not(.hidden)');
      if (modal) {
        modal.classList.add('hidden');
      } else if (document.activeElement === searchInput) {
        searchInput.value = '';
        currentSearchQuery = '';
        document.getElementById('btnSearchClear').style.display = 'none';
        renderDashboard();
      }
    }
  });
}

function isEditingText(el) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

function setupDragAndDropDropzone() {
  const dropzone = document.getElementById('newGroupDropzone');
  if (!dropzone) return;

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drop-active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drop-active');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('drop-active');
    if (!draggedTabInfo) return;

    const { tabId, sourceGroupId } = draggedTabInfo;
    const sourceGroup = await storage.getGroup(sourceGroupId);
    if (!sourceGroup || !Array.isArray(sourceGroup.tabs)) return;

    const tabIndex = sourceGroup.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const [movedTab] = sourceGroup.tabs.splice(tabIndex, 1);
    await storage.saveGroup(sourceGroup);

    // Create new group
    const newGroupId = `grp_${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      title: 'Split Group',
      createdAt: Date.now(),
      isLocked: false,
      isStarred: false,
      tabs: [movedTab]
    };
    await storage.saveGroup(newGroup);

    draggedTabInfo = null;
    showToast('Moved tab to new group.');
    await renderDashboard();
  });
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
    document.getElementById('searchToolbar').classList.remove('hidden');
    renderDashboard();
  });

  document.getElementById('btnViewTrash').addEventListener('click', async () => {
    currentView = 'trash';
    document.getElementById('btnViewTrash').classList.add('active-view-btn');
    document.getElementById('btnViewActive').classList.remove('active-view-btn');
    document.getElementById('groupsList').classList.add('hidden');
    document.getElementById('bannerContainer').classList.add('hidden');
    document.getElementById('searchToolbar').classList.add('hidden');
    document.getElementById('quickListSection').classList.add('hidden');
    document.getElementById('batchBar').classList.add('hidden');
    document.getElementById('trashContainer').classList.remove('hidden');
    await renderTrashView();
  });

  document.getElementById('btnEmptyTrash').addEventListener('click', async () => {
    if (confirm('Empty trash bin permanently?')) {
      await createSnapshot(storage, chrome.storage.local, 'Pre-Empty Trash');
      await storage.clearTrash();
      await renderTrashView();
      await updateTrashBadge();
    }
  });

  // Search Input Handlers
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('btnSearchClear');

  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    searchClear.style.display = currentSearchQuery ? 'block' : 'none';
    renderDashboard();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClear.style.display = 'none';
    searchInput.focus();
    renderDashboard();
  });

  // Global Deduplication
  document.getElementById('btnDedupAll').addEventListener('click', async () => {
    await createSnapshot(storage, chrome.storage.local, 'Pre-Dedup All');
    const groups = await storage.getAllGroups();
    let totalRemoved = 0;
    const globalSeen = new Set();

    for (const group of groups) {
      const originalCount = group.tabs ? group.tabs.length : 0;
      const filteredTabs = [];
      for (const tab of (group.tabs || [])) {
        const norm = (tab.url || '').trim().replace(/\/+$/, '');
        if (norm && !globalSeen.has(norm)) {
          globalSeen.add(norm);
          filteredTabs.push(tab);
        } else {
          totalRemoved++;
        }
      }

      if (filteredTabs.length !== originalCount) {
        group.tabs = filteredTabs;
        await storage.saveGroup(group);
      }
    }

    if (totalRemoved > 0) {
      await adjustBaseline(chrome.storage.local, -totalRemoved);
      showToast(`Removed ${totalRemoved} duplicate tab${totalRemoved === 1 ? '' : 's'}.`);
      await renderDashboard();
    } else {
      showToast('No duplicate URLs found.');
    }
  });

  // Snapshots Modal Drawer
  const snapshotsModal = document.getElementById('snapshotsModal');
  document.getElementById('btnSnapshots').addEventListener('click', async () => {
    await renderSnapshotsList();
    snapshotsModal.classList.remove('hidden');
  });

  document.getElementById('btnSnapshotsModalClose').addEventListener('click', () => {
    snapshotsModal.classList.add('hidden');
  });

  document.getElementById('btnCreateManualSnapshot').addEventListener('click', async () => {
    await createSnapshot(storage, chrome.storage.local, 'Manual User Snapshot');
    await renderSnapshotsList();
    showToast('Snapshot created.');
  });

  // Settings Modal Drawer
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('btnSettings').addEventListener('click', async () => {
    await populateSettingsForm();
    settingsModal.classList.remove('hidden');
  });

  document.getElementById('btnSettingsModalClose').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const target = document.getElementById('settingRestoreTarget').value;
    const retention = document.getElementById('settingRetentionPolicy').value;
    const startup = document.getElementById('settingOpenOnStartup').checked;
    const dedup = document.getElementById('settingDedupOnCapture').checked;
    const lazy = document.getElementById('settingLazyRestore').checked;
    const incognito = document.getElementById('settingCaptureIncognito').checked;

    await saveSettings(chrome.storage.local, {
      restoreWindowTarget: target,
      restoreRetentionPolicy: retention,
      openOnStartup: startup,
      deduplicateOnCapture: dedup,
      lazyRestore: lazy,
      captureIncognito: incognito
    });

    settingsModal.classList.add('hidden');
    showToast('Preferences saved.');
  });

  document.getElementById('btnRepairStorage')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('repairStorageStatus');
    if (statusEl) statusEl.textContent = 'Scanning storage...';

    try {
      const recon = await reconcileOrphanKeys(chrome.storage.local);
      const groups = await storage.getAllGroups();
      const updatedBaseline = await storage.syncBaselineFromGroups(chrome.storage.local, groups);

      const msg = `Repaired: removed ${recon.removedOrphans.length} orphan keys; synced baseline to ${updatedBaseline} tabs.`;
      if (statusEl) statusEl.textContent = msg;
      showToast(msg);
      await renderDashboard();
    } catch (err) {
      if (statusEl) statusEl.textContent = `Repair failed: ${err.message}`;
      showToast(`Repair error: ${err.message}`);
    }
  });

  // Batch Operations Handlers
  document.getElementById('btnBatchCancel').addEventListener('click', () => {
    selectedTabs.clear();
    updateBatchBar();
    document.querySelectorAll('.tab-checkbox').forEach(cb => cb.checked = false);
  });

  document.getElementById('btnBatchRestore').addEventListener('click', async () => {
    const items = Array.from(selectedTabs.values());
    if (items.length === 0) return;

    const urls = items.map(i => i.tab.url).filter(Boolean);
    const settings = await getSettings(chrome.storage.local);

    await chrome.runtime.sendMessage({
      action: 'restoreTabs',
      urls,
      newWindow: settings.restoreWindowTarget === 'new',
      lazy: settings.lazyRestore
    });

    if (settings.restoreRetentionPolicy === 'remove') {
      for (const item of items) {
        await storage.removeRestoredTab(item.groupId, item.tab.id);
      }
    }

    selectedTabs.clear();
    updateBatchBar();
    showToast(`Restored ${items.length} selected tabs.`);
    await renderDashboard();
  });

  document.getElementById('btnBatchDelete').addEventListener('click', async () => {
    const items = Array.from(selectedTabs.values());
    if (items.length === 0) return;

    await createSnapshot(storage, chrome.storage.local, `Pre-Batch Delete (${items.length} tabs)`);

    for (const item of items) {
      await storage.deleteTab(item.groupId, item.tab.id);
    }

    selectedTabs.clear();
    updateBatchBar();
    showToast(`Deleted ${items.length} tabs to trash.`);
    await renderDashboard();
  });

  document.getElementById('btnBatchMoveNew').addEventListener('click', async () => {
    const items = Array.from(selectedTabs.values());
    if (items.length === 0) return;

    for (const item of items) {
      const g = await storage.getGroup(item.groupId);
      if (g && Array.isArray(g.tabs)) {
        g.tabs = g.tabs.filter(t => t.id !== item.tab.id);
        await storage.saveGroup(g);
      }
    }

    const newGroup = {
      id: `grp_${Date.now()}`,
      title: `Batch Group (${items.length} tabs)`,
      createdAt: Date.now(),
      isLocked: false,
      isStarred: false,
      tabs: items.map(i => i.tab)
    };
    await storage.saveGroup(newGroup);

    selectedTabs.clear();
    updateBatchBar();
    showToast(`Moved ${items.length} tabs to a new group.`);
    await renderDashboard();
  });

  // Import / Export Plain-text Modal
  const modal = document.getElementById('importExportModal');
  const modalText = document.getElementById('importExportText');

  document.getElementById('btnTextImportExport').addEventListener('click', async () => {
    const groups = await storage.getAllGroups();
    modalText.value = exportToPlainText(groups);
    modal.classList.remove('hidden');
    modalText.focus();
  });

  document.getElementById('btnModalClose').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  document.getElementById('btnCopyExport').addEventListener('click', async () => {
    if (!modalText.value) return;
    await navigator.clipboard.writeText(modalText.value);
    showToast('Copied tabs list to clipboard!');
  });

  document.getElementById('btnPerformImport').addEventListener('click', async () => {
    const text = modalText.value.trim();
    if (!text) {
      showToast('Please paste URLs or OneTab text to import.');
      return;
    }

    const importedGroups = parsePlainTextImport(text);
    if (importedGroups.length === 0) {
      showToast('Could not find any valid URLs to import.');
      return;
    }

    const settings = await getSettings(chrome.storage.local);

    let totalTabs = 0;
    for (const group of importedGroups) {
      if (settings.deduplicateOnCapture) {
        group.tabs = deduplicateTabs(group.tabs);
      }
      await storage.saveGroup(group);
      totalTabs += group.tabs.length;
    }

    await adjustBaseline(chrome.storage.local, totalTabs);
    modal.classList.add('hidden');
    showToast(`Successfully imported ${importedGroups.length} groups (${totalTabs} tabs).`);
    await renderDashboard();
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

  // Export JSON Backup
  document.getElementById('btnExport').addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'triggerBackupNow', force: true });
      if (response && response.success) {
        showToast(`JSON backup exported to ${response.filename} (${response.tabCount} tabs)`);
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
      let groupsToRestore = null;

      if (file.name.endsWith('.txt')) {
        groupsToRestore = parsePlainTextImport(text);
      } else {
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (parseErr) {
          groupsToRestore = parsePlainTextImport(text);
        }

        if (!groupsToRestore && payload) {
          if (Array.isArray(payload)) {
            groupsToRestore = payload;
          } else if (Array.isArray(payload.groups)) {
            groupsToRestore = payload.groups;
          }
        }
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
          isStarred: Boolean(t.isStarred),
          createdAt: t.createdAt || Date.now()
        }));

        const cleanGroup = {
          id: group.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: group.title || 'Restored Group',
          createdAt: group.createdAt || Date.now(),
          isLocked: Boolean(group.isLocked),
          isStarred: Boolean(group.isStarred),
          tabs: cleanTabs
        };

        await storage.saveGroup(cleanGroup);
        totalRestoredTabs += cleanTabs.length;
      }

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

  // Toast Undo — Phase 1 Bug Fix: use storage.saveGroup to prevent duplicate grp_grp_ prefixes
  document.getElementById('btnToastUndo').addEventListener('click', async () => {
    if (!lastDeletedAction) return;

    if (lastDeletedAction.type === 'group') {
      await storage.saveGroup(lastDeletedAction.payload);
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
      } else {
        group.tabs.push(tab);
      }
      // Bug Fix: Always use storage.saveGroup(group) rather than chrome.storage.local.set({ [`grp_${group.id}`]: group })
      await storage.saveGroup(group);
      await adjustBaseline(chrome.storage.local, 1);
    }

    hideToast();
    lastDeletedAction = null;
    await renderDashboard();
    await updateTrashBadge();
  });

  document.getElementById('btnToastClose').addEventListener('click', hideToast);
}

async function renderSnapshotsList() {
  const container = document.getElementById('snapshotsList');
  container.innerHTML = '';
  const snapshots = await getSnapshots(chrome.storage.local);

  if (snapshots.length === 0) {
    container.innerHTML = '<div style="font-size: var(--type-xs-size); color: var(--color-text-muted);">No snapshots saved yet.</div>';
    return;
  }

  for (const snap of snapshots) {
    const el = document.createElement('div');
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'space-between';
    el.style.padding = '8px 12px';
    el.style.background = 'var(--color-bg)';
    el.style.border = '1px solid var(--color-border)';
    el.style.borderRadius = 'var(--radius-sm)';

    const dateStr = new Date(snap.createdAt).toLocaleString();
    el.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: var(--type-sm-size);">${escapeHtml(snap.label)}</div>
        <div style="font-size: var(--type-xs-size); color: var(--color-text-muted);">${snap.groupCount} groups, ${snap.tabCount} tabs • ${dateStr}</div>
      </div>
      <button class="btn btn-sm btn-secondary btn-snap-rollback" data-id="${snap.id}">Rollback</button>
    `;

    el.querySelector('.btn-snap-rollback').addEventListener('click', async () => {
      if (confirm(`Rollback vault to snapshot "${snap.label}"?`)) {
        await rollbackSnapshot(snap.id, storage, chrome.storage.local);
        document.getElementById('snapshotsModal').classList.add('hidden');
        showToast(`Rolled back to "${snap.label}".`);
        await renderDashboard();
      }
    });

    container.appendChild(el);
  }
}

async function populateSettingsForm() {
  const settings = await getSettings(chrome.storage.local);
  document.getElementById('settingRestoreTarget').value = settings.restoreWindowTarget;
  document.getElementById('settingRetentionPolicy').value = settings.restoreRetentionPolicy;
  document.getElementById('settingOpenOnStartup').checked = Boolean(settings.openOnStartup);
  document.getElementById('settingDedupOnCapture').checked = Boolean(settings.deduplicateOnCapture);
  document.getElementById('settingLazyRestore').checked = Boolean(settings.lazyRestore);
  document.getElementById('settingCaptureIncognito').checked = Boolean(settings.captureIncognito);

  const { excludedDomains } = await chrome.storage.local.get(['excludedDomains']);
  const domainsContainer = document.getElementById('excludedDomainsList');
  const domainList = Array.isArray(excludedDomains) ? excludedDomains : [];

  if (domainList.length === 0) {
    domainsContainer.innerHTML = 'None';
  } else {
    domainsContainer.innerHTML = domainList.map(d => `
      <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; margin-right: 4px; margin-bottom: 4px;">
        ${escapeHtml(d)}
        <button class="btn-remove-domain" data-domain="${escapeHtml(d)}" style="background:none; border:none; cursor:pointer; color:var(--color-danger);">✕</button>
      </span>
    `).join('');

    domainsContainer.querySelectorAll('.btn-remove-domain').forEach(btn => {
      btn.addEventListener('click', async () => {
        const d = btn.getAttribute('data-domain');
        const next = domainList.filter(item => item !== d);
        await chrome.storage.local.set({ excludedDomains: next });
        await populateSettingsForm();
      });
    });
  }
}

function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  const count = selectedTabs.size;
  if (count > 0) {
    bar.classList.remove('hidden');
    document.getElementById('batchCount').textContent = `${count} tab${count === 1 ? '' : 's'} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

async function updateTrashBadge() {
  const trash = await storage.getTrashBin();
  document.getElementById('trashCount').textContent = trash.length;
}

async function renderDashboard() {
  await updateTrashBadge();
  let groups = await storage.getAllGroups();

  // Sort groups: starred/pinned first, then chronological descending
  groups.sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const totalTabs = groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);

  // Render Quick List / Starred tabs across all groups
  renderQuickList(groups);

  // Search filter
  const filteredGroups = currentSearchQuery ? filterGroupsByQuery(groups, currentSearchQuery) : groups;
  const visibleTabCount = countVisibleTabs(filteredGroups);

  const searchBadge = document.getElementById('searchResultCount');
  if (currentSearchQuery) {
    searchBadge.textContent = `${visibleTabCount} match${visibleTabCount === 1 ? '' : 'es'}`;
  } else {
    searchBadge.textContent = `${totalTabs} tab${totalTabs === 1 ? '' : 's'}`;
  }

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
  } else if (filteredGroups.length === 0) {
    groupsList.innerHTML = `
      <div style="padding: 32px; text-align: center; color: var(--color-text-muted);">
        No tabs matched "${escapeHtml(currentSearchQuery)}".
      </div>
    `;
  } else {
    renderGroups(groupsList, filteredGroups);
  }
}

function renderQuickList(groups) {
  const quickSection = document.getElementById('quickListSection');
  const quickItems = document.getElementById('quickListItems');
  const quickCount = document.getElementById('quickListCount');

  const starredTabs = [];
  for (const g of groups) {
    for (const t of (g.tabs || [])) {
      if (t.isStarred) {
        starredTabs.push({ tab: t, group: g });
      }
    }
  }

  if (starredTabs.length === 0) {
    quickSection.classList.add('hidden');
    return;
  }

  quickSection.classList.remove('hidden');
  quickCount.textContent = `(${starredTabs.length})`;
  quickItems.innerHTML = starredTabs.map(item => `
    <a href="${escapeHtml(item.tab.url)}" target="_blank" rel="noopener" class="quick-link-pill" title="${escapeHtml(item.tab.title || item.tab.url)}">
      <img src="${escapeHtml(item.tab.favIconUrl || 'icons/icon16.png')}" width="14" height="14" alt="">
      <span>${escapeHtml(item.tab.title || item.tab.url)}</span>
    </a>
  `).join('');

  quickItems.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => { img.src = 'icons/icon16.png'; }, { once: true });
  });
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
    const isLocked = Boolean(group.isLocked);
    const isStarred = Boolean(group.isStarred);
    const dateStr = new Date(group.createdAt || Date.now()).toLocaleString();

    card.innerHTML = `
      <div class="group-header">
        <div class="group-header-info">
          <button class="group-btn-icon btn-star ${isStarred ? 'active' : ''}" title="${isStarred ? 'Unstar group' : 'Star and pin group'}" data-id="${group.id}">
            ${isStarred ? '★' : '☆'}
          </button>
          <button class="group-btn-icon btn-lock ${isLocked ? 'active' : ''}" title="${isLocked ? 'Unlock group' : 'Lock group (prevent deletion on restore)'}" data-id="${group.id}">
            ${isLocked ? '🔒' : '🔓'}
          </button>
          <span class="group-title-editable" contenteditable="true" title="Click to rename group" data-id="${group.id}">${escapeHtml(group.title || 'Untitled Group')}</span>
          <span class="group-count">${tabsCount} ${tabsCount === 1 ? 'tab' : 'tabs'} • ${dateStr}</span>
        </div>
        <div class="group-actions">
          <button class="btn btn-sm btn-ghost btn-copy-links" title="Copy all URLs in this group" data-id="${group.id}">Copy links</button>
          <button class="btn btn-sm btn-secondary btn-restore-all" data-id="${group.id}">Restore all</button>
          <button class="btn btn-sm btn-ghost btn-delete-all" data-id="${group.id}">Delete all</button>
        </div>
      </div>
      <div class="group-tabs" data-group-id="${group.id}">
        ${(group.tabs || []).map(tab => {
          const tabStarred = Boolean(tab.isStarred);
          const isChecked = selectedTabs.has(tab.id);
          return `
            <div class="tab-row" draggable="true" data-tab-id="${tab.id}" data-group-id="${group.id}">
              <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}" data-group-id="${group.id}" ${isChecked ? 'checked' : ''}>
              <button class="tab-star-btn ${tabStarred ? 'active' : ''}" data-tab-id="${tab.id}" data-group-id="${group.id}" title="${tabStarred ? 'Unstar link' : 'Star link to Quick List'}">
                ${tabStarred ? '★' : '☆'}
              </button>
              <img class="tab-favicon" src="${escapeHtml(tab.favIconUrl || 'icons/icon16.png')}" alt="">
              <a class="tab-link" href="${escapeHtml(tab.url)}" data-group-id="${group.id}" data-tab-id="${tab.id}" target="_blank" rel="noopener">${escapeHtml(tab.title || tab.url)}</a>
              <button class="tab-delete-btn" title="Delete tab" data-group-id="${group.id}" data-tab-id="${tab.id}">✕</button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Favicon fallback
    card.querySelectorAll('.tab-favicon').forEach(img => {
      img.addEventListener('error', () => {
        img.src = 'icons/icon16.png';
      }, { once: true });
    });

    // Checkbox selection
    card.querySelectorAll('.tab-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const tId = cb.getAttribute('data-tab-id');
        const gId = cb.getAttribute('data-group-id');
        const tabObj = group.tabs?.find(t => t.id === tId);
        if (cb.checked) {
          selectedTabs.set(tId, { tab: tabObj, groupId: gId });
        } else {
          selectedTabs.delete(tId);
        }
        updateBatchBar();
      });
    });

    // Tab Individual Star Toggle
    card.querySelectorAll('.tab-star-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tId = btn.getAttribute('data-tab-id');
        const tabObj = group.tabs?.find(t => t.id === tId);
        if (tabObj) {
          tabObj.isStarred = !tabObj.isStarred;
          await storage.saveGroup(group);
          await renderDashboard();
        }
      });
    });

    // Click on .tab-link removes tab from unlocked group if retention is 'remove' without polluting trash
    card.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        const settings = await getSettings(chrome.storage.local);
        if (!group.isLocked && settings.restoreRetentionPolicy === 'remove') {
          const tId = link.getAttribute('data-tab-id');
          await storage.removeRestoredTab(group.id, tId);
          setTimeout(renderDashboard, 100);
        }
      });
    });

    // Drag and Drop Tab Reordering & Inter-group Move
    card.querySelectorAll('.tab-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        const tId = row.getAttribute('data-tab-id');
        const gId = row.getAttribute('data-group-id');
        draggedTabInfo = { tabId: tId, sourceGroupId: gId };
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        document.querySelectorAll('.tab-row').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (!draggedTabInfo) return;

        const { tabId: sourceTabId, sourceGroupId } = draggedTabInfo;
        const targetTabId = row.getAttribute('data-tab-id');
        const targetGroupId = row.getAttribute('data-group-id');

        if (sourceTabId === targetTabId) return;

        const sGroup = await storage.getGroup(sourceGroupId);
        const tGroup = sourceGroupId === targetGroupId ? sGroup : await storage.getGroup(targetGroupId);

        if (!sGroup || !tGroup) return;

        const sIndex = sGroup.tabs.findIndex(t => t.id === sourceTabId);
        if (sIndex === -1) return;

        const [movedTab] = sGroup.tabs.splice(sIndex, 1);
        const tIndex = tGroup.tabs.findIndex(t => t.id === targetTabId);

        if (tIndex !== -1) {
          tGroup.tabs.splice(tIndex, 0, movedTab);
        } else {
          tGroup.tabs.push(movedTab);
        }

        await storage.saveGroup(sGroup);
        if (sourceGroupId !== targetGroupId) {
          await storage.saveGroup(tGroup);
        }

        draggedTabInfo = null;
        await renderDashboard();
      });
    });

    // Inline Title Renaming
    const titleEl = card.querySelector('.group-title-editable');
    titleEl.addEventListener('blur', async () => {
      const newTitle = titleEl.textContent.trim();
      if (newTitle && newTitle !== group.title) {
        group.title = newTitle;
        await storage.saveGroup(group);
      }
    });

    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    });

    // Star / Pin Toggle
    card.querySelector('.btn-star').addEventListener('click', async () => {
      group.isStarred = !group.isStarred;
      await storage.saveGroup(group);
      await renderDashboard();
    });

    // Lock Toggle
    card.querySelector('.btn-lock').addEventListener('click', async () => {
      group.isLocked = !group.isLocked;
      await storage.saveGroup(group);
      await renderDashboard();
    });

    // Copy Group Links
    card.querySelector('.btn-copy-links').addEventListener('click', async () => {
      const urlsText = formatGroupUrlsForClipboard(group);
      if (urlsText) {
        await navigator.clipboard.writeText(urlsText);
        showToast(`Copied ${group.tabs.length} links to clipboard!`);
      }
    });

    // Restore All
    card.querySelector('.btn-restore-all').addEventListener('click', async () => {
      const count = group.tabs ? group.tabs.length : 0;
      const urls = (group.tabs || []).map(t => t.url);
      const settings = await getSettings(chrome.storage.local);

      await chrome.runtime.sendMessage({
        action: 'restoreTabs',
        urls,
        newWindow: settings.restoreWindowTarget === 'new',
        lazy: settings.lazyRestore
      });

      // If unlocked and retention is 'remove', remove group upon restore (deleteGroup adjusts baseline)
      if (!group.isLocked && settings.restoreRetentionPolicy === 'remove') {
        await storage.deleteGroup(group.id);
        await renderDashboard();
      } else {
        showToast(`Restored ${count} tabs.`);
      }
    });

    // Delete All
    card.querySelector('.btn-delete-all').addEventListener('click', async () => {
      if (group.isLocked) {
        alert('This group is locked to prevent accidental deletion. Unlock it first.');
        return;
      }

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

    // Individual Tab Delete
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
        <div class="trash-item-title">${escapeHtml(title)}</div>
        <div class="trash-item-meta">${subText}</div>
      </div>
      <div class="trash-actions">
        <button class="btn btn-sm btn-secondary btn-trash-restore" data-trash-id="${item.id}">Restore</button>
      </div>
    `;

    el.querySelector('.btn-trash-restore').addEventListener('click', async () => {
      await storage.restoreTrashItem(item.id);
      showToast(`Restored "${title}" from trash.`);
      await renderTrashView();
      await updateTrashBadge();
    });

    trashList.appendChild(el);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  const undoBtn = document.getElementById('btnToastUndo');

  if (toastTimeout) clearTimeout(toastTimeout);

  msgEl.textContent = message;
  undoBtn.style.display = lastDeletedAction ? 'inline-block' : 'none';
  toast.classList.remove('hidden');

  toastTimeout = setTimeout(hideToast, 15000);
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('hidden');
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

// Expose test hooks for E2E harness and performance benchmarking
if (typeof window !== 'undefined') {
  window.__tabVaultTest = {
    renderDashboard,
    storage
  };
}
