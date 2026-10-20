/**
 * Tab Vault Empty-State & Wipe Detection Logic
 * Evaluates startup conditions:
 * - Alarm condition = empty local list AND sync flag hasSavedTabs true,
 *   whether or not a backup file is found (always offer the file picker).
 * - Sync flag false = quiet empty state.
 */

import { BACKUP_FILE_PREFIX } from './backup.js';

/**
 * Filter and find physical backup files in Downloads
 */
export function findRecommendedBackup(downloadItems) {
  if (!Array.isArray(downloadItems)) return null;

  const validBackups = downloadItems.filter(item => {
    if (!item) return false;
    const nameMatch = item.filename && (
      item.filename.includes(BACKUP_FILE_PREFIX) ||
      /tab-vault-backup-[1-3]\.json/.test(item.filename)
    );
    const existsOnDisk = item.exists !== false;
    return nameMatch && existsOnDisk && item.state === 'complete';
  });

  if (validBackups.length === 0) return null;

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
 * Evaluate empty state
 */
export function evaluateEmptyState({
  localTabCount = 0,
  syncState = null,
  onInstalledReason = null,
  downloadItems = [],
  deliberateClear = false
}) {
  if (localTabCount > 0) {
    return {
      isEmpty: false,
      isAlarm: false,
      scenario: 'active_tabs',
      tabCount: localTabCount
    };
  }

  const hasSyncTabs = Boolean(syncState && syncState.hasSavedTabs === true);
  const isFreshInstall = onInstalledReason === 'install';
  const recommendedBackup = findRecommendedBackup(downloadItems);

  // Alarm condition: empty local list AND sync flag hasSavedTabs true
  // (whether or not a backup file is found; always offer file picker)
  if (hasSyncTabs && !isFreshInstall) {
    return {
      isEmpty: true,
      isAlarm: true,
      scenario: recommendedBackup ? 'wipe_with_sync_flag' : 'wipe_with_sync_flag_no_backup',
      title: 'Disaster Recovery: Tabs Wiped',
      promptType: 'disaster_banner_high_confidence',
      severity: 'danger',
      recommendedBackup: recommendedBackup || null,
      showRestorePicker: true,
      message: recommendedBackup
        ? `Your local tabs appear to have been wiped by a browser reset. We detected your recent backup "${recommendedBackup.filename}".`
        : 'Your local tabs appear to have been wiped by a browser reset. No automatic backup was found in Downloads, but you can select an existing backup file to restore.'
    };
  }

  // Second device case
  if (isFreshInstall && hasSyncTabs) {
    return {
      isEmpty: true,
      isAlarm: false,
      scenario: 'second_device',
      title: 'New Device Detected',
      promptType: 'second_device_sync',
      showRestorePicker: true,
      message: 'You have Tab Vault tabs saved on another synced Chrome device. To load tabs here, export from your other device or select an existing backup.'
    };
  }

  // Fresh install case (no sync tabs, no backups)
  if (isFreshInstall && !hasSyncTabs && !recommendedBackup) {
    return {
      isEmpty: true,
      isAlarm: false,
      scenario: 'fresh_install',
      title: 'Welcome to Tab Vault',
      promptType: 'onboarding',
      showRestorePicker: true,
      message: 'Click the Tab Vault extension icon in your toolbar to collapse open tabs into a clean list.'
    };
  }

  // Scenario 4: Wipe with signed-out Chrome (sync empty/unavailable, but backup exists in Downloads)
  const isExplicitEmpty = Boolean(syncState && syncState.hasSavedTabs === false);
  if (!deliberateClear && !isExplicitEmpty && !hasSyncTabs && recommendedBackup && !isFreshInstall) {
    return {
      isEmpty: true,
      isAlarm: true,
      scenario: 'wipe_signed_out_with_backup',
      title: 'Disaster Recovery: Backup Detected',
      promptType: 'contextual_recovery_prompt',
      severity: 'warning',
      recommendedBackup,
      showRestorePicker: true,
      message: `Your local tabs appear to have been wiped by a browser reset. We detected your recent backup "${recommendedBackup.filename}".`
    };
  }

  // Quiet empty state (sync flag false / deliberate clear / restored all)
  return {
    isEmpty: true,
    isAlarm: false,
    scenario: 'quiet_empty',
    title: 'No Tabs Stashed',
    promptType: 'empty_dashboard',
    showTrashUndo: true,
    showRestorePicker: true,
    message: 'All tabs have been cleared or restored. Items moved to Trash can be recovered within 30 days.'
  };
}
