/**
 * Tab Vault Backup Module
 * 3-file rotated JSON auto-export with empty guard, >50% shrink guard,
 * in-app delete baseline adjustment, incognito tab exclusion,
 * Data URL export with offscreen fallback for payloads > 2MB.
 */

import { BACKUP_STATE_KEY } from './storage.js';

export const DATA_URL_MAX_BYTES = 2 * 1024 * 1024; // 2MB threshold
export const BACKUP_FILE_PREFIX = 'tab-vault-backup-';
export const ROTATION_SLOTS = 3;

/**
 * Filter out incognito tabs and return sanitized groups
 */
export function sanitizeGroupsForBackup(groups) {
  if (!Array.isArray(groups)) return [];

  const sanitized = [];
  for (const group of groups) {
    const safeTabs = (group.tabs || []).filter(tab => !tab.incognito);
    if (safeTabs.length > 0 || group.isLocked) {
      sanitized.push({
        ...group,
        tabs: safeTabs
      });
    }
  }
  return sanitized;
}

/**
 * Compile JSON backup payload with schema version and metadata
 */
export function buildBackupPayload(sanitizedGroups) {
  const totalTabs = sanitizedGroups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);
  return {
    version: 1,
    appName: 'Tab Vault',
    exportedAt: new Date().toISOString(),
    timestamp: Date.now(),
    tabCount: totalTabs,
    groupCount: sanitizedGroups.length,
    groups: sanitizedGroups
  };
}

/**
 * Determine next rotation slot (1 -> 2 -> 3 -> 1)
 */
export function getNextSlot(currentSlot) {
  const slot = typeof currentSlot === 'number' && currentSlot >= 1 && currentSlot <= ROTATION_SLOTS
    ? currentSlot
    : 0;
  return (slot % ROTATION_SLOTS) + 1;
}

/**
 * Get filename for a rotation slot
 */
export function getBackupFilename(slot) {
  return `${BACKUP_FILE_PREFIX}${slot}.json`;
}

/**
 * Adjust the shrink-guard baseline when an in-app deletion occurs
 */
export async function adjustBaselineOnDelete(storageArea, deletedTabCount) {
  if (!storageArea || !deletedTabCount || deletedTabCount <= 0) return;
  const res = await storageArea.get([BACKUP_STATE_KEY]);
  const state = res[BACKUP_STATE_KEY] || {};
  const currentBaseline = state.baselineTabCount || state.lastKnownTabCount || 0;
  const newBaseline = Math.max(0, currentBaseline - deletedTabCount);

  await storageArea.set({
    [BACKUP_STATE_KEY]: {
      ...state,
      baselineTabCount: newBaseline
    }
  });
}

/**
 * Execute Rotated Backup
 */
export async function executeAutoBackup({
  storage,
  downloadsApi = null,
  offscreenHandler = null,
  force = false
}) {
  if (!storage) throw new Error('Storage manager is required');

  const rawGroups = await storage.getAllGroups();
  const sanitizedGroups = sanitizeGroupsForBackup(rawGroups);
  const totalTabs = sanitizedGroups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);

  // 1. Empty Guard
  if (totalTabs === 0) {
    return {
      success: false,
      reason: 'empty_list',
      message: 'Backup aborted: tab list is empty.'
    };
  }

  // 2. Shrink Guard
  const storageArea = storage._requireLocal();
  const stateRes = await storageArea.get([BACKUP_STATE_KEY]);
  const backupState = stateRes[BACKUP_STATE_KEY] || {};
  const baseline = backupState.baselineTabCount ?? backupState.lastKnownTabCount ?? 0;

  if (!force && baseline > 0 && totalTabs < baseline * 0.5) {
    return {
      success: false,
      reason: 'shrink_guard_triggered',
      baselineTabCount: baseline,
      currentCount: totalTabs,
      message: `Backup paused: total tabs dropped from ${baseline} to ${totalTabs} (>50% shrink).`
    };
  }

  // 3. 3-File Rotation Slot
  const nextSlot = getNextSlot(backupState.currentSlot);
  const filename = getBackupFilename(nextSlot);

  // 4. Payload compilation
  const payload = buildBackupPayload(sanitizedGroups);
  const jsonString = JSON.stringify(payload, null, 2);
  const byteLength = new TextEncoder().encode(jsonString).length;

  let exportMethod = 'data_url';

  // 5. Size check and export dispatch
  if (byteLength <= DATA_URL_MAX_BYTES) {
    // Data URL path
    exportMethod = 'data_url';
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);

    if (downloadsApi) {
      await downloadsApi.download({
        url: dataUrl,
        filename,
        conflictAction: 'overwrite',
        saveAs: false
      });
    }
  } else {
    // Offscreen document fallback path
    exportMethod = 'offscreen_document';
    if (offscreenHandler) {
      await offscreenHandler({
        action: 'createBlobAndDownload',
        data: jsonString,
        filename,
        byteLength
      });
    } else if (downloadsApi && typeof chrome !== 'undefined' && chrome.offscreen) {
      // In-extension offscreen delegation
      await delegateToOffscreenDocument(jsonString, filename);
    }
  }

  // 6. Update backup state
  const newState = {
    ...backupState,
    currentSlot: nextSlot,
    lastBackupTimestamp: Date.now(),
    lastKnownTabCount: totalTabs,
    baselineTabCount: totalTabs,
    lastExportMethod: exportMethod,
    lastExportBytes: byteLength
  };

  await storageArea.set({
    [BACKUP_STATE_KEY]: newState
  });

  return {
    success: true,
    slot: nextSlot,
    filename,
    tabCount: totalTabs,
    byteLength,
    exportMethod
  };
}

/**
 * Extension offscreen bridge helper for MV3
 */
async function delegateToOffscreenDocument(jsonString, filename) {
  const OFFSCREEN_URL = 'offscreen.html';
  // Check if offscreen doc exists
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['BLOBS'],
        justification: 'Create Blob URL for large backup download'
      });
    }
  }

  await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'downloadLargeBackup',
    data: jsonString,
    filename
  });
}
