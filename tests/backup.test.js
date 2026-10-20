import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAutoBackup,
  adjustBaselineOnDelete,
  adjustBaselineOnUndo,
  sanitizeGroupsForBackup,
  getNextSlot,
  getBackupFilename,
  DATA_URL_MAX_LENGTH
} from '../extension/src/backup.js';
import { TabVaultStorage, adjustBaseline, BACKUP_STATE_KEY } from '../extension/src/storage.js';
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
        { id: 't2', title: 'Private Tab', url: 'https://secret.com', incognito: true }
      ]
    }
  ];

  const sanitized = sanitizeGroupsForBackup(groups);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].tabs.length, 1);
  assert.equal(sanitized[0].tabs[0].id, 't1');
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
  assert.equal(downloads.downloads.length, 0);
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
  assert.equal(downloads.downloads.length, 0);
});

test('Backup Module: In-app removals lower baseline, undo raises baseline, and restore a 100-tab group allows backup to succeed', async () => {
  const local = new MockStorageArea({
    [BACKUP_STATE_KEY]: {
      currentSlot: 1,
      baselineTabCount: 150,
      lastKnownTabCount: 150
    }
  });
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  // Setup: 1 group of 100 tabs, 1 group of 50 tabs (150 total)
  const tabs100 = Array.from({ length: 100 }, (_, i) => ({
    id: `t100_${i}`,
    title: `Tab ${i}`,
    url: `https://example.com/100/${i}`
  }));
  const tabs50 = Array.from({ length: 50 }, (_, i) => ({
    id: `t50_${i}`,
    title: `Tab ${i}`,
    url: `https://example.com/50/${i}`
  }));

  await storage.saveGroup({ id: 'grp_100', title: '100 Tabs', tabs: tabs100 });
  await storage.saveGroup({ id: 'grp_50', title: '50 Tabs', tabs: tabs50 });

  // In-app removal: user restores the 100-tab group (removing it from storage)
  // Baseline must be lowered by 100!
  await adjustBaseline(local, -100);
  await storage.deleteGroup('grp_100');

  // Remaining tabs = 50. Baseline is now 50.
  assert.equal(await storage.getTotalTabCount(), 50);

  // Auto-backup must now succeed (50 tabs >= 50% of 50 baseline)
  const backupRes = await executeAutoBackup({
    storage,
    downloadsApi: downloads
  });

  assert.equal(backupRes.success, true, 'Backup must succeed after in-app removal lowered baseline');
  assert.equal(backupRes.slot, 2);
  assert.equal(backupRes.tabCount, 50);

  // Test Undo: restore 20 tabs back from trash -> raises baseline by 20
  await adjustBaselineOnUndo(local, 20);
  const stateDump = local.rawDump()[BACKUP_STATE_KEY];
  assert.equal(stateDump.baselineTabCount, 70);
});

test('Backup Module: Encoded URL length check triggers offscreen Blob URL creation', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  let offscreenCalled = false;
  let revokedUrl = null;

  const offscreenHandler = async (msg) => {
    if (msg.action === 'createBlobUrl') {
      offscreenCalled = true;
      return { success: true, blobUrl: 'blob:chrome-extension://mock-blob-token-123' };
    }
    if (msg.action === 'revokeBlobUrl') {
      revokedUrl = msg.blobUrl;
      return { success: true };
    }
  };

  // Generate 20,000 tabs to exceed 2MB encoded URL length
  const TOTAL_TABS = 20000;
  const TABS_PER_GROUP = 100;
  for (let g = 0; g < TOTAL_TABS / TABS_PER_GROUP; g++) {
    const tabs = [];
    for (let t = 0; t < TABS_PER_GROUP; t++) {
      const idx = g * TABS_PER_GROUP + t;
      tabs.push({
        id: `tab_${idx}`,
        title: `Complex Research Query Title [Special Characters & Symbols: %$#@!] ${idx}`,
        url: `https://example.org/search?q=quantum+mechanics+and+thermodynamics+paper+number+${idx}&ref=vault`,
        favIconUrl: 'https://example.org/favicon.ico'
      });
    }
    await storage.saveGroup({ id: `grp_${g}`, title: `Group ${g}`, tabs });
  }

  const result = await executeAutoBackup({
    storage,
    downloadsApi: downloads,
    offscreenHandler
  });

  assert.equal(result.success, true);
  assert.ok(result.encodedLength > DATA_URL_MAX_LENGTH, `Encoded length (${result.encodedLength}) must exceed limit (${DATA_URL_MAX_LENGTH})`);
  assert.equal(result.exportMethod, 'offscreen_document');
  assert.equal(offscreenCalled, true, 'Offscreen handler must be requested for Blob URL');
  assert.equal(revokedUrl, 'blob:chrome-extension://mock-blob-token-123', 'Blob URL must be revoked after download');
  assert.equal(downloads.downloads.length, 1);
  assert.equal(downloads.downloads[0].url, 'blob:chrome-extension://mock-blob-token-123');
});

test('Backup Module: backup_state updated ONLY after download complete; on failure state kept and lastError recorded', async () => {
  const local = new MockStorageArea({
    [BACKUP_STATE_KEY]: {
      currentSlot: 1,
      baselineTabCount: 1,
      lastKnownTabCount: 1,
      lastBackupTimestamp: 1000
    }
  });
  const storage = new TabVaultStorage(local);

  await storage.saveGroup({
    id: 'grp_fail',
    title: 'Fail Test',
    tabs: [{ id: 't1', url: 'https://test.com' }]
  });

  // Failing downloads API
  const failingDownloads = {
    async download() {
      throw new Error('Disk write error / download permission denied');
    }
  };

  const res = await executeAutoBackup({
    storage,
    downloadsApi: failingDownloads,
    force: true
  });

  assert.equal(res.success, false);
  assert.equal(res.reason, 'download_failed');

  // Verify backup_state kept previous slot and recorded lastError
  const stateDump = local.rawDump()[BACKUP_STATE_KEY];
  assert.equal(stateDump.currentSlot, 1, 'Slot must not advance on failure');
  assert.equal(stateDump.lastBackupTimestamp, 1000, 'Timestamp must not update on failure');
  assert.match(stateDump.lastError, /Disk write error/);
  assert.ok(stateDump.lastErrorTimestamp > 0);
});

test('Backup Module: regression - encoded URL length measurement accounts for URI encoding expansion', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);
  const downloads = new MockDownloadsApi();

  let offscreenInvoked = false;
  const offscreenHandler = async (msg) => {
    if (msg.action === 'createBlobUrl') {
      offscreenInvoked = true;
      return { success: true, blobUrl: 'blob:mock-expanded' };
    }
  };

  // Create a payload where raw bytes < 2MB (~1.2MB), but due to spaces/special symbols,
  // encodeURIComponent expands each space/bracket to 3 chars (%20, %7B), pushing encoded length > 2MB!
  const symbols = "   %%%   &&&   {{{   }}}   ";
  const tabs = Array.from({ length: 5000 }, (_, i) => ({
    id: `t_${i}`,
    title: `Title ${symbols} ${i}`,
    url: `https://example.com/query?filter=${symbols}&idx=${i}`
  }));

  await storage.saveGroup({ id: 'grp_expanded', title: 'Expansion Group', tabs });

  const result = await executeAutoBackup({
    storage,
    downloadsApi: downloads,
    offscreenHandler
  });

  assert.equal(result.success, true);
  assert.ok(result.encodedLength > DATA_URL_MAX_LENGTH, `Encoded length (${result.encodedLength}) must exceed limit`);
  assert.equal(result.exportMethod, 'offscreen_document');
  assert.equal(offscreenInvoked, true, 'Offscreen fallback must be chosen when encoded length exceeds limit');
});
