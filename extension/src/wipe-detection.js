/**
 * Tab Vault Empty-State & Wipe Detection Logic
 * Evaluates startup conditions across local storage, chrome.storage.sync,
 * onInstalled details, and chrome.downloads.search to detect wipes without false alarms.
 */

import { BACKUP_FILE_PREFIX } from './backup.js';

/**
 * Filter and find the best physical backup file from downloads search results
 */
export function findRecommendedBackup(downloadItems) {
  if (!Array.isArray(downloadItems)) return null;

  const validBackups = downloadItems.filter(item => {
    if (!item) return false;
    const nameMatch = item.filename && (
      item.filename.includes(BACKUP_FILE_PREFIX) ||
      /tab-vault-backup-[1-3]\.json/.test(item.filename)
    );
    // Physically exists on disk
    const existsOnDisk = item.exists !== false; // true or undefined (if unchecked)
    return nameMatch && existsOnDisk && item.state === 'complete';
  });

  if (validBackups.length === 0) return null;

  // Sort descending by endTime (or startTime)
  validBackups.sort((a, b) => {
    const timeA = new Date(a.endTime || a.startTime || 0).getTime();
    const timeB = new Date(b.endTime || b.startTime || 0).getTime();
    return timeB - timeA;
  });

  const best = validBackups[0];
  const basename = best.filename ? best.filename.split(/[/\\]/).pop() : 'tab-vault-backup.json';

  return {
    id: best.id,
    filename: basename,
    fullPath: best.filename,
    fileSize: best.fileSize || best.bytesReceived || 0,
    endTime: best.endTime,
    exists: best.exists
  };
}

/**
 * Evaluate startup state to determine the appropriate UI experience
 *
 * Scenarios:
 * 1. fresh_install: New install, no tabs, no sync flag, no backups.
 * 2. second_device: New install on this device, but sync flag indicates tabs exist on another device.
 * 3. deliberate_clear: Empty list from deliberate user clear/purge.
 * 4. wipe_with_sync_flag: Local storage empty, but sync flag set + backup file found (high confidence wipe).
 * 5. wipe_signed_out: Local storage empty, sync unavailable, but backup file found on disk.
 */
export function evaluateEmptyState({
  localTabCount = 0,
  syncState = null,
  onInstalledReason = null,
  downloadItems = [],
  deliberateClear = false
}) {
  // If tabs exist locally, it's not an empty state
  if (localTabCount > 0) {
    return {
      isEmpty: false,
      scenario: 'active_tabs',
      tabCount: localTabCount
    };
  }

  const hasSyncTabs = Boolean(syncState && syncState.hasSavedTabs === true);
  const isFreshInstall = onInstalledReason === 'install';
  const recommendedBackup = findRecommendedBackup(downloadItems);
  const hasPhysicalBackup = Boolean(recommendedBackup);

  // Scenario 1: Fresh Install
  if (isFreshInstall && !hasSyncTabs && !hasPhysicalBackup) {
    return {
      isEmpty: true,
      scenario: 'fresh_install',
      title: 'Welcome to Tab Vault',
      promptType: 'onboarding',
      showRestoreHint: true,
      message: 'Click the Tab Vault extension icon in your toolbar to collapse open tabs into a clean list.'
    };
  }

  // Scenario 2: Second Device
  if (isFreshInstall && hasSyncTabs) {
    return {
      isEmpty: true,
      scenario: 'second_device',
      title: 'New Device Detected',
      promptType: 'second_device_sync',
      showRestoreHint: true,
      message: 'You have Tab Vault tabs saved on another synced Chrome device. To load tabs here, export from your other device or select an existing backup.'
    };
  }

  // Scenario 4: Wipe with Sync Flag (Highest confidence wipe)
  if (!isFreshInstall && hasSyncTabs && hasPhysicalBackup) {
    return {
      isEmpty: true,
      scenario: 'wipe_with_sync_flag',
      title: 'Disaster Recovery: Tabs Wiped',
      promptType: 'disaster_banner_high_confidence',
      severity: 'danger',
      recommendedBackup,
      message: `Your local tabs appear to have been wiped by a browser reset. We detected your recent backup "${recommendedBackup.filename}".`
    };
  }

  // Scenario 5: Wipe with Signed-Out Chrome
  // Sync flag is absent/unavailable, not a fresh install, but physical backup exists
  if (!isFreshInstall && !hasSyncTabs && hasPhysicalBackup && !deliberateClear) {
    return {
      isEmpty: true,
      scenario: 'wipe_signed_out',
      title: 'Recent Backup Detected',
      promptType: 'disaster_banner_contextual',
      severity: 'warning',
      recommendedBackup,
      message: `Your local tab list is empty, but a recent backup file "${recommendedBackup.filename}" was found in your Downloads.`
    };
  }

  // Scenario 3: Deliberate Clear / Standard Empty State
  return {
    isEmpty: true,
    scenario: 'deliberate_clear',
    title: 'No Tabs Stashed',
    promptType: 'empty_dashboard',
    showTrashUndo: true,
    showRestoreHint: true,
    message: 'All tabs have been cleared or restored. Items moved to Trash can be recovered within 30 days.'
  };
}
