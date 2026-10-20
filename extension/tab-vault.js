/**
 * Tab Vault Dashboard Script
 * Renders tab groups, empty state / disaster recovery banners, and handles restore & delete actions.
 */

import { TabVaultStorage } from './src/storage.js';
import { evaluateEmptyState } from './src/wipe-detection.js';
import { adjustBaselineOnDelete } from './src/backup.js';

const storage = new TabVaultStorage(chrome.storage.local, chrome.storage.sync);

let lastDeletedItem = null;
let toastTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  setupEventListeners();
  await renderDashboard();
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

function setupEventListeners() {
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

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

  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnRestorePicker').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.groups || !Array.isArray(payload.groups)) {
        throw new Error('Invalid Tab Vault backup format');
      }

      for (const group of payload.groups) {
        await storage.saveGroup(group);
      }
      showToast(`Successfully restored ${payload.groups.length} groups (${payload.tabCount || ''} tabs)`);
      await renderDashboard();
    } catch (err) {
      alert(`Could not restore file: ${err.message}`);
    } finally {
      fileInput.value = '';
    }
  });

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

  document.getElementById('btnToastUndo').addEventListener('click', async () => {
    if (!lastDeletedItem) return;
    if (lastDeletedItem.itemType === 'group') {
      await storage.saveGroup(lastDeletedItem.payload);
    }
    hideToast();
    await renderDashboard();
  });

  document.getElementById('btnToastClose').addEventListener('click', hideToast);
}

async function renderDashboard() {
  const groups = await storage.getAllGroups();
  const totalTabs = groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);

  // Retrieve sync metadata
  let syncState = null;
  try {
    syncState = await chrome.storage.sync.get(['hasSavedTabs', 'lastKnownTabCount']);
  } catch (err) {
    console.warn('Sync storage unavailable:', err);
  }

  // Retrieve install details
  const localMeta = await chrome.storage.local.get(['onInstalledReason']);

  // Query downloads for backup files
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
            <img class="tab-favicon" src="${escapeHtml(tab.favIconUrl || 'icons/icon16.png')}" onerror="this.src='icons/icon16.png'" alt="">
            <a class="tab-link" href="${escapeHtml(tab.url)}" target="_blank" rel="noopener">${escapeHtml(tab.title || tab.url)}</a>
            <button class="tab-delete-btn" title="Delete tab" data-group-id="${group.id}" data-tab-id="${tab.id}">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    // Handlers
    card.querySelector('.btn-restore-all').addEventListener('click', async () => {
      const urls = (group.tabs || []).map(t => t.url);
      await chrome.runtime.sendMessage({ action: 'restoreTabs', urls });
      if (!group.isLocked) {
        await storage.deleteGroup(group.id);
        await renderDashboard();
      }
    });

    card.querySelector('.btn-delete-all').addEventListener('click', async () => {
      const count = group.tabs ? group.tabs.length : 0;
      // In-app delete lowers baseline!
      await adjustBaselineOnDelete(chrome.storage.local, count);
      lastDeletedItem = await storage.deleteGroup(group.id);
      showToast(`Group deleted (${count} tabs).`);
      await renderDashboard();
    });

    card.querySelectorAll('.tab-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const gId = btn.getAttribute('data-group-id');
        const tId = btn.getAttribute('data-tab-id');
        // In-app delete lowers baseline
        await adjustBaselineOnDelete(chrome.storage.local, 1);
        const res = await storage.deleteTab(gId, tId);
        if (res) {
          lastDeletedItem = res.trashItem;
          showToast('Tab removed.');
          await renderDashboard();
        }
      });
    });

    container.appendChild(card);
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 15000); // 15-second toast
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
