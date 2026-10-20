import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEmptyState,
  findRecommendedBackup
} from '../extension/src/wipe-detection.js';
import { TabVaultStorage } from '../extension/src/storage.js';
import { MockStorageArea, MockDownloadsApi } from './test-helpers.js';

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
      exists: false, // File removed from disk
      fileSize: 110000,
      state: 'complete'
    }
  ];

  const recommended = findRecommendedBackup(downloads);
  assert.ok(recommended);
  assert.equal(recommended.id, 2);
  assert.equal(recommended.filename, 'tab-vault-backup-2.json');
});

test('Real Flow: stash -> restore all -> empty (no alarm)', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // 1. Stash tabs
  await storage.saveGroup({
    id: 'grp_work',
    title: 'Work Tabs',
    tabs: [
      { id: 't1', title: 'Work 1', url: 'https://work.com/1' },
      { id: 't2', title: 'Work 2', url: 'https://work.com/2' }
    ]
  });

  assert.equal(await storage.getTotalTabCount(), 2);
  assert.equal((await sync.get('hasSavedTabs')).hasSavedTabs, true);

  // 2. Restore all: tabs removed from storage, sync flag cleared
  await storage.deleteGroup('grp_work');
  assert.equal(await storage.getTotalTabCount(), 0);
  assert.equal((await sync.get('hasSavedTabs')).hasSavedTabs, false);

  // 3. Evaluate empty state
  const syncState = await sync.get(['hasSavedTabs']);
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState,
    onInstalledReason: null,
    downloadItems: []
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.isAlarm, false, 'Restoring all tabs must produce quiet empty state, NOT an alarm');
  assert.equal(result.scenario, 'quiet_empty');
});

test('Real Flow: stash -> delete all -> empty (no alarm)', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // 1. Stash tabs
  await storage.saveGroup({
    id: 'grp_reading',
    title: 'Reading',
    tabs: [{ id: 't1', title: 'Article', url: 'https://news.com' }]
  });

  // 2. Delete all (deliberate user purge)
  await storage.clearAll();
  assert.equal(await storage.getTotalTabCount(), 0);
  assert.equal((await sync.get('hasSavedTabs')).hasSavedTabs, false);

  // 3. Evaluate empty state
  const syncState = await sync.get(['hasSavedTabs']);
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState,
    onInstalledReason: null,
    downloadItems: [
      { id: 1, filename: 'tab-vault-backup-1.json', endTime: '2026-10-20T10:00:00Z', exists: true, state: 'complete' }
    ]
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.isAlarm, false, 'Deliberate clear must produce quiet empty state, NOT an alarm');
  assert.equal(result.scenario, 'quiet_empty');
});

test('Real Flow: stash -> local.clear() with backup file (alarm)', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // 1. Stash tabs
  await storage.saveGroup({
    id: 'grp_valuable',
    title: 'Important Hoard',
    tabs: Array.from({ length: 50 }, (_, i) => ({ id: `t_${i}`, url: `https://test.com/${i}` }))
  });
  assert.equal((await sync.get('hasSavedTabs')).hasSavedTabs, true);

  // 2. Simulate browser crash / profile wipe: local storage wiped, sync flag survives
  await local.clear();

  // 3. Evaluate empty state with backup file present
  const syncState = await sync.get(['hasSavedTabs']);
  const downloadItems = [
    {
      id: 1,
      filename: '/home/user/Downloads/tab-vault-backup-1.json',
      endTime: '2026-10-20T11:00:00Z',
      exists: true,
      fileSize: 52000,
      state: 'complete'
    }
  ];

  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState,
    onInstalledReason: null,
    downloadItems
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.isAlarm, true, 'Wipe with sync flag must trigger alarm');
  assert.equal(result.scenario, 'wipe_with_sync_flag');
  assert.ok(result.recommendedBackup);
  assert.equal(result.recommendedBackup.filename, 'tab-vault-backup-1.json');
  assert.equal(result.showRestorePicker, true);
});

test('Real Flow: stash -> local.clear() without backup file (alarm)', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // 1. Stash tabs
  await storage.saveGroup({
    id: 'grp_valuable_2',
    title: 'Second Hoard',
    tabs: [{ id: 't1', url: 'https://test.com' }]
  });
  assert.equal((await sync.get('hasSavedTabs')).hasSavedTabs, true);

  // 2. Wipe local storage
  await local.clear();

  // 3. Evaluate empty state with NO backup files in Downloads
  const syncState = await sync.get(['hasSavedTabs']);
  const result = evaluateEmptyState({
    localTabCount: 0,
    syncState,
    onInstalledReason: null,
    downloadItems: []
  });

  assert.equal(result.isEmpty, true);
  assert.equal(result.isAlarm, true, 'Alarm condition must trigger even without backup file if sync flag hasSavedTabs is true');
  assert.equal(result.scenario, 'wipe_with_sync_flag_no_backup');
  assert.equal(result.recommendedBackup, null);
  assert.equal(result.showRestorePicker, true, 'Always offer file picker');
  assert.match(result.message, /No automatic backup was found in Downloads, but you can select an existing backup/);
});
