import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEmptyState,
  findRecommendedBackup
} from '../extension/src/wipe-detection.js';

test('Wipe Detection: findRecommendedBackup selection logic', () => {
  const downloads = [
    {
      id: 1,
      filename: '/home/user/Downloads/tab-vault-backup-1.json',
      endTime: '2026-10-18T10:00:00Z',
      exists: true,
      fileSize: 45000,
      state: 'complete'
    },
    {
      id: 2,
      filename: '/home/user/Downloads/tab-vault-backup-2.json',
      endTime: '2026-10-20T12:00:00Z',
      exists: true,
      fileSize: 98000,
      state: 'complete'
    },
    {
      id: 3,
      filename: '/home/user/Downloads/tab-vault-backup-3.json',
      endTime: '2026-10-20T15:00:00Z',
      exists: false, // File was deleted or moved by user!
      fileSize: 110000,
      state: 'complete'
    },
    {
      id: 4,
      filename: '/home/user/Downloads/unrelated-file.pdf',
      endTime: '2026-10-20T16:00:00Z',
      exists: true,
      fileSize: 500000,
      state: 'complete'
    }
  ];

  const recommended = findRecommendedBackup(downloads);
  assert.ok(recommended, 'Must find a recommended backup');
  // Must skip id 3 because exists === false, and id 4 because unrelated
  // id 2 is newer than id 1
  assert.equal(recommended.id, 2);
  assert.equal(recommended.filename, 'tab-vault-backup-2.json');
  assert.equal(recommended.fileSize, 98000);
});

test('Wipe Detection: Scenario 1 - Fresh Install', () => {
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState: null,
    onInstalledReason: 'install',
    downloadItems: []
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.scenario, 'fresh_install');
  assert.equal(result.promptType, 'onboarding');
  assert.equal(result.showRestoreHint, true);
  assert.match(result.message, /Click the Tab Vault extension icon/);
});

test('Wipe Detection: Scenario 2 - Second Device (sync flag set, onInstalled reason=install)', () => {
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState: { hasSavedTabs: true, lastKnownTabCount: 85 },
    onInstalledReason: 'install',
    downloadItems: []
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.scenario, 'second_device');
  assert.equal(result.promptType, 'second_device_sync');
  assert.match(result.message, /saved on another synced Chrome device/);
});

test('Wipe Detection: Scenario 3 - Deliberate Clear', () => {
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState: { hasSavedTabs: false, lastKnownTabCount: 0 },
    onInstalledReason: 'update',
    deliberateClear: true,
    downloadItems: [
      {
        id: 1,
        filename: 'tab-vault-backup-1.json',
        endTime: '2026-10-19T08:00:00Z',
        exists: true,
        state: 'complete'
      }
    ]
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.scenario, 'deliberate_clear');
  assert.equal(result.promptType, 'empty_dashboard');
  assert.equal(result.showTrashUndo, true);
  assert.match(result.message, /All tabs have been cleared or restored/);
});

test('Wipe Detection: Scenario 4 - Wipe with Sync Flag (High confidence disaster banner)', () => {
  const downloadItems = [
    {
      id: 1,
      filename: '/home/user/Downloads/tab-vault-backup-1.json',
      endTime: '2026-10-20T10:00:00Z',
      exists: true,
      fileSize: 45000,
      state: 'complete'
    }
  ];

  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState: { hasSavedTabs: true, lastKnownTabCount: 50 },
    onInstalledReason: 'update', // Not fresh install; was already running
    downloadItems
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.scenario, 'wipe_with_sync_flag');
  assert.equal(result.promptType, 'disaster_banner_high_confidence');
  assert.equal(result.severity, 'danger');
  assert.ok(result.recommendedBackup);
  assert.equal(result.recommendedBackup.filename, 'tab-vault-backup-1.json');
  assert.match(result.message, /wiped by a browser reset/);
});

test('Wipe Detection: Scenario 5 - Wipe Signed Out (Contextual recovery prompt)', () => {
  const downloadItems = [
    {
      id: 2,
      filename: '/home/user/Downloads/tab-vault-backup-2.json',
      endTime: '2026-10-20T11:00:00Z',
      exists: true,
      fileSize: 62000,
      state: 'complete'
    }
  ];

  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState: null, // Signed out of Chrome profile, no sync storage
    onInstalledReason: null,
    downloadItems
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.scenario, 'wipe_signed_out');
  assert.equal(result.promptType, 'disaster_banner_contextual');
  assert.equal(result.severity, 'warning');
  assert.ok(result.recommendedBackup);
  assert.equal(result.recommendedBackup.filename, 'tab-vault-backup-2.json');
  assert.match(result.message, /recent backup file .* was found in your Downloads/);
});

test('Wipe Detection: Active tabs returns isEmpty = false', () => {
  const result = evaluateEmptyState({
    localTabCount: 15
  });

  assert.equal(result.isEmpty, false);
  assert.equal(result.scenario, 'active_tabs');
  assert.equal(result.tabCount, 15);
});
