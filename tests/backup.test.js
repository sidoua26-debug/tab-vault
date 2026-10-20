import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAutoBackup,
  adjustBaselineOnDelete,
  sanitizeGroupsForBackup,
  getNextSlot,
  getBackupFilename,
  DATA_URL_MAX_BYTES
} from '../extension/src/backup.js';
import { TabVaultStorage, BACKUP_STATE_KEY } from '../extension/src/storage.js';
import { MockStorageArea, MockDownloadsApi } from './test-helpers.js';

test('Backup Module: slot calculation and filename rotation', () => {
  assert.equal(getNextSlot(0), 1);
  assert.equal(getNextSlot(1), 2);
  assert.equal(getNextSlot(2), 3);
  assert.equal(getNextSlot(3), 1);
  assert.equal(getBackupFilename(1), 'tab-vault-backup-1.json');
  assert.equal(getBackupFilename(2), 'tab-vault-backup-2.json');
  assert.equal(getBackupFilename(3), 'tab-vault-backup-3.json');
});

test('Backup Module: sanitizeGroupsForBackup excludes incognito tabs', () => {
  const groups = [
    {
      id: 'grp_1',
      title: 'Mixed Group',
      tabs: [
        { id: 't1', title: 'Normal Tab', url: 'https://example.com', incognito: false },
        { id: 't2', title: 'Private Tab', url: 'https://secret.com', incognito: true },
        { id: 't3', title: 'Another Private Tab', url: 'https://bank.com', incognito: true }
      ]
    },
    {
      id: 'grp_2',
      title: 'All Incognito Group',
      isLocked: false,
      tabs: [
        { id: 't4', title: 'Secret Only', url: 'https://vpn.com', incognito: true }
      ]
    }
  ];

  const sanitized = sanitizeGroupsForBackup(groups);
  assert.equal(sanitized.length, 1, 'Group with only incognito tabs must be excluded');
  assert.equal(sanitized[0].tabs.length, 1, 'Only non-incognito tabs retained');
  assert.equal(sanitized[0].tabs[0].id, 't1');
  assert.equal(sanitized[0].tabs[0].incognito, false);
});

test('Backup Module: Empty Guard aborts when tabs count is 0', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  const result = await executeAutoBackup({
    storage,
    downloadsApi: downloads
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, 'empty_list');
  assert.equal(downloads.downloads.length, 0, 'No download should be triggered');
});

test('Backup Module: Shrink Guard blocks backup if tabs drop > 50%', async () => {
  const local = new MockStorageArea({
    [BACKUP_STATE_KEY]: {
      currentSlot: 1,
      baselineTabCount: 100,
      lastKnownTabCount: 100
    }
  });
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  // Populate only 40 tabs (< 50% of 100)
  const tabs = Array.from({ length: 40 }, (_, i) => ({
    id: `tab_${i}`,
    title: `Tab ${i}`,
    url: `https://example.com/${i}`
  }));
  await storage.saveGroup({ id: 'grp_small', title: 'Small', tabs });

  const result = await executeAutoBackup({
    storage,
    downloadsApi: downloads
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, 'shrink_guard_triggered');
  assert.equal(result.baselineTabCount, 100);
  assert.equal(result.currentCount, 40);
  assert.equal(downloads.downloads.length, 0, 'Backup blocked by shrink guard');
});

test('Backup Module: In-app deletes lower baseline and prevent shrink guard false alarm', async () => {
  const local = new MockStorageArea({
    [BACKUP_STATE_KEY]: {
      currentSlot: 1,
      baselineTabCount: 100,
      lastKnownTabCount: 100
    }
  });
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  // User legitimately deletes 60 tabs in-app
  await adjustBaselineOnDelete(local, 60);

  // Remaining tabs = 40
  const tabs = Array.from({ length: 40 }, (_, i) => ({
    id: `tab_${i}`,
    title: `Tab ${i}`,
    url: `https://example.com/${i}`
  }));
  await storage.saveGroup({ id: 'grp_legit', title: 'Legit', tabs });

  const result = await executeAutoBackup({
    storage,
    downloadsApi: downloads
  });

  // Since baseline was adjusted from 100 down to 40, 40 tabs is >= 50% of 40!
  assert.equal(result.success, true);
  assert.equal(result.slot, 2, 'Rotated to slot 2');
  assert.equal(downloads.downloads.length, 1);
  assert.equal(downloads.downloads[0].filename, 'tab-vault-backup-2.json');
});

test('Backup Module: 3-file rotation sequence (1 -> 2 -> 3 -> 1)', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  await storage.saveGroup({
    id: 'grp_rot',
    title: 'Rotation Test',
    tabs: [{ id: 't1', title: 'Tab', url: 'https://test.com' }]
  });

  // Run 1 -> slot 1
  const r1 = await executeAutoBackup({ storage, downloadsApi: downloads });
  assert.equal(r1.slot, 1);
  assert.equal(r1.filename, 'tab-vault-backup-1.json');

  // Run 2 -> slot 2
  const r2 = await executeAutoBackup({ storage, downloadsApi: downloads });
  assert.equal(r2.slot, 2);
  assert.equal(r2.filename, 'tab-vault-backup-2.json');

  // Run 3 -> slot 3
  const r3 = await executeAutoBackup({ storage, downloadsApi: downloads });
  assert.equal(r3.slot, 3);
  assert.equal(r3.filename, 'tab-vault-backup-3.json');

  // Run 4 -> wraps back to slot 1
  const r4 = await executeAutoBackup({ storage, downloadsApi: downloads });
  assert.equal(r4.slot, 1);
  assert.equal(r4.filename, 'tab-vault-backup-1.json');

  assert.equal(downloads.downloads.length, 4);
});

test('Backup Module: 20,000 tabs stress test triggers offscreen fallback', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  let offscreenInvoked = false;
  let offscreenPayload = null;

  const offscreenHandler = async (msg) => {
    offscreenInvoked = true;
    offscreenPayload = msg;
    // Simulate offscreen blob download
    await downloads.download({
      url: 'blob:chrome-extension://offscreen-blob-url',
      filename: msg.filename,
      conflictAction: 'overwrite',
      saveAs: false
    });
  };

  // Generate 20,000 tabs across 200 groups (100 tabs each)
  const TOTAL_TABS = 20000;
  const TABS_PER_GROUP = 100;
  const NUM_GROUPS = TOTAL_TABS / TABS_PER_GROUP;

  for (let g = 0; g < NUM_GROUPS; g++) {
    const tabs = [];
    for (let t = 0; t < TABS_PER_GROUP; t++) {
      const idx = g * TABS_PER_GROUP + t;
      tabs.push({
        id: `tab_${idx}`,
        title: `Comprehensive Research Article ${idx} with Detailed Page Header`,
        url: `https://en.wikipedia.org/wiki/Special:Search?search=quantum_computing_research_paper_${idx}`,
        favIconUrl: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
        pinned: false,
        createdAt: 1729420000000 + idx,
        incognito: idx % 1000 === 0 // occasional incognito tab to verify exclusion
      });
    }
    await storage.saveGroup({
      id: `grp_bulk_${g}`,
      title: `Archive Group ${g}`,
      tabs
    });
  }

  const rawTabCount = await storage.getTotalTabCount();
  assert.equal(rawTabCount, 20000);

  const backupResult = await executeAutoBackup({
    storage,
    downloadsApi: downloads,
    offscreenHandler
  });

  assert.equal(backupResult.success, true);
  // Incognito tabs (20 total: 20000 / 1000) must have been excluded!
  assert.equal(backupResult.tabCount, 19980);
  assert.ok(backupResult.byteLength > DATA_URL_MAX_BYTES, `Byte length (${backupResult.byteLength}) must exceed 2MB (${DATA_URL_MAX_BYTES})`);
  assert.equal(backupResult.exportMethod, 'offscreen_document');
  assert.equal(offscreenInvoked, true, 'Offscreen handler must be invoked');
  assert.equal(offscreenPayload.filename, 'tab-vault-backup-1.json');
  assert.equal(downloads.downloads.length, 1);
});
