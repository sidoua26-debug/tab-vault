/**
 * Tab Vault Backup Module
 * 3-file rotated JSON auto-export with empty guard, >50% shrink guard,
 * in-app delete baseline adjustment, incognito tab exclusion,
 * Data URL export with offscreen fallback for encoded URLs > 2MB.
 */

import { BACKUP_STATE_KEY } from './storage.js';
import { applyBaselineDelta, syncBaselineFromGroups, updateBackupMetadata } from './baseline.js';

export const DATA_URL_MAX_LENGTH = 2 * 1024 * 1024; // 2 million characters limit on encoded URL
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
    schemaVersion: 1,
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
 * Adjust the shrink-guard baseline when an in-app deletion or restore occurs
 */
export async function adjustBaselineOnDelete(storageArea, deletedTabCount) {
  if (!storageArea || !deletedTabCount || deletedTabCount <= 0) return;
  return await applyBaselineDelta(storageArea, -deletedTabCount);
}

/**
 * Adjust shrink-guard baseline when an undo occurs (raises baseline)
 */
export async function adjustBaselineOnUndo(storageArea, restoredTabCount) {
  if (!storageArea || !restoredTabCount || restoredTabCount <= 0) return;
  return await applyBaselineDelta(storageArea, restoredTabCount);
}

/**
 * Wait for download completion (or error)
 */
async function waitForDownload(downloadsApi, downloadId) {
  if (!downloadsApi || !downloadId) return true;
  if (typeof downloadsApi.search !== 'function') return true;

  // Poll search for state up to 10 seconds
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const results = await downloadsApi.search({ id: downloadId });
    if (results && results.length > 0) {
      const item = results[0];
      if (item.state === 'complete') return true;
      if (item.state === 'interrupted' || item.error) {
        throw new Error(item.error || 'Download interrupted');
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return true;
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

  // 5. Measure data-URL limit on the ENCODED URL length, not raw bytes
  const dataUrlPrefix = 'data:application/json;charset=utf-8,';
  const encodedContent = encodeURIComponent(jsonString);
  const totalEncodedLength = dataUrlPrefix.length + encodedContent.length;

  let exportMethod = 'data_url';
  let downloadUrl = null;
  let createdBlobUrl = null;

  try {
    if (totalEncodedLength <= DATA_URL_MAX_LENGTH) {
      exportMethod = 'data_url';
      downloadUrl = dataUrlPrefix + encodedContent;
    } else {
      exportMethod = 'offscreen_document';
      // Have the offscreen doc create the Blob URL and return it to the caller
      if (offscreenHandler) {
        const offscreenRes = await offscreenHandler({
          action: 'createBlobUrl',
          data: jsonString,
          filename
        });
        if (!offscreenRes || !offscreenRes.blobUrl) {
          throw new Error('Offscreen document failed to create Blob URL');
        }
        createdBlobUrl = offscreenRes.blobUrl;
        downloadUrl = createdBlobUrl;
      } else if (typeof chrome !== 'undefined' && chrome.offscreen) {
        createdBlobUrl = await requestBlobUrlFromOffscreen(jsonString);
        downloadUrl = createdBlobUrl;
      } else {
        throw new Error('Offscreen handler unavailable for payload exceeding Data URL limit');
      }
    }

    // Call downloads API from the service worker / caller context
    let downloadId = null;
    if (downloadsApi) {
      downloadId = await downloadsApi.download({
        url: downloadUrl,
        filename,
        conflictAction: 'overwrite',
        saveAs: false
      });
      // Confirm download completion
      await waitForDownload(downloadsApi, downloadId);
    }

    // Revoke blob URL if created
    if (createdBlobUrl) {
      if (offscreenHandler) {
        await offscreenHandler({ action: 'revokeBlobUrl', blobUrl: createdBlobUrl });
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'revokeBlobUrl',
          blobUrl: createdBlobUrl
        }).catch(() => {});
      }
    }

    // Update backup_state ONLY after download is confirmed complete via fresh read-merge-write
    await updateBackupMetadata(storageArea, {
      currentSlot: nextSlot,
      lastBackupTimestamp: Date.now(),
      lastKnownTabCount: totalTabs,
      lastExportMethod: exportMethod,
      lastExportLength: totalEncodedLength,
      lastError: null
    });

    return {
      success: true,
      slot: nextSlot,
      filename,
      tabCount: totalTabs,
      encodedLength: totalEncodedLength,
      exportMethod,
      downloadId
    };

  } catch (err) {
    // On failure: record lastError via fresh read-merge-write
    await updateBackupMetadata(storageArea, {
      lastError: err.message,
      lastErrorTimestamp: Date.now()
    }).catch(() => {});

    // Cleanup blob url if needed
    if (createdBlobUrl && offscreenHandler) {
      await offscreenHandler({ action: 'revokeBlobUrl', blobUrl: createdBlobUrl }).catch(() => {});
    }

    return {
      success: false,
      reason: 'download_failed',
      error: err.message,
      currentSlot: backupState.currentSlot
    };
  }
}

/**
 * Extension offscreen bridge helper for MV3
 */
async function requestBlobUrlFromOffscreen(jsonString) {
  const OFFSCREEN_URL = 'offscreen.html';
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

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'createBlobUrl',
    data: jsonString
  });

  if (!response || !response.success || !response.blobUrl) {
    throw new Error(response?.error || 'Offscreen document failed to return Blob URL');
  }
  return response.blobUrl;
}
