import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TabVaultStorage,
  formatGroupKey,
  writeNewVerifySwap,
  rebuildIndexFromKeys,
  purgeExpiredTrash,
  adjustBaseline,
  areObjectsEquivalent,
  GROUP_INDEX_KEY,
  TRASH_BIN_KEY,
  BACKUP_STATE_KEY
} from '../extension/src/storage.js';
import { MockStorageArea } from './test-helpers.js';

test('Storage Layer: formatGroupKey', () => {
  assert.equal(formatGroupKey('123'), 'grp_123');
  assert.equal(formatGroupKey('grp_123'), 'grp_123');
  assert.throws(() => formatGroupKey(''), /Group ID cannot be empty/);
});

test('Storage Layer: writeNewVerifySwap atomic workflow', async () => {
  const local = new MockStorageArea();
  const stagingKey = 'staging_grp_1';
  const finalKey = 'grp_1';
  const testData = { id: '1', title: 'Group 1', tabs: [{ id: 't1', url: 'https://example.com' }] };

  const result = await writeNewVerifySwap(local, stagingKey, finalKey, testData, (idx) => ['1', ...idx]);

  assert.deepEqual(result, testData);
  const dump = local.rawDump();
  assert.equal(dump[stagingKey], undefined, 'Staging key must be cleaned up');
  assert.deepEqual(dump[finalKey], testData, 'Final key must hold committed data');
  assert.deepEqual(dump[GROUP_INDEX_KEY], ['1'], 'Index must be updated');
});

test('Storage Layer: writeNewVerifySwap aborts on corruption during staging', async () => {
  const local = new MockStorageArea();
  const stagingKey = 'staging_grp_bad';
  const finalKey = 'grp_bad';
  const testData = { id: 'bad', title: 'Corrupt Test' };

  const tamperedStorage = {
    async set(items) {
      if (items[stagingKey]) {
        await local.set({ [stagingKey]: { id: 'tampered' } });
      } else {
        await local.set(items);
      }
    },
    async get(keys) {
      return local.get(keys);
    },
    async remove(keys) {
      return local.remove(keys);
    }
  };

  await assert.rejects(
    async () => {
      await writeNewVerifySwap(tamperedStorage, stagingKey, finalKey, testData);
    },
    /Atomic write verification failed: data mismatch/
  );

  const dump = local.rawDump();
  assert.equal(dump[finalKey], undefined, 'Final key must never be written if staged check fails');
  assert.equal(dump[stagingKey], undefined, 'Staging key must be cleared after verification failure');
});

test('Storage Layer: parallel saveGroup calls serialized without race conditions', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // Trigger 10 parallel saves simultaneously
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      storage.saveGroup({
        id: `grp_par_${i}`,
        title: `Parallel Group ${i}`,
        createdAt: 1000 + i,
        tabs: [{ id: `t_${i}`, title: `Tab ${i}`, url: `https://test.com/${i}` }]
      })
    );
  }

  await Promise.all(promises);

  const index = await storage.getGroupIndex();
  assert.equal(index.length, 10, 'Index must contain all 10 saved groups');

  const groups = await storage.getAllGroups();
  assert.equal(groups.length, 10, 'All 10 groups must be retrievable');
  assert.equal(await storage.getTotalTabCount(), 10);
});

test('Storage Layer: rebuildIndexFromKeys reconstructs group_index from grp_* keys', async () => {
  const local = new MockStorageArea({
    grp_old: { id: 'old', title: 'Old Group', createdAt: 100 },
    grp_mid: { id: 'mid', title: 'Mid Group', createdAt: 200 },
    grp_new: { id: 'new', title: 'New Group', createdAt: 300 },
    unrelated_key: { data: 'ignore' }
  });

  const rebuilt = await rebuildIndexFromKeys(local);
  // Rebuilt index must sort descending by createdAt
  assert.deepEqual(rebuilt, ['new', 'mid', 'old']);

  const dump = local.rawDump();
  assert.deepEqual(dump[GROUP_INDEX_KEY], ['new', 'mid', 'old']);
});

test('Storage Layer: 30-day trash purge cleans expired items on startup', async () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const local = new MockStorageArea({
    [TRASH_BIN_KEY]: [
      { id: 't_fresh', deletedAt: now - 5 * ONE_DAY, payload: {} },
      { id: 't_border', deletedAt: now - 29 * ONE_DAY, payload: {} },
      { id: 't_expired', deletedAt: now - 35 * ONE_DAY, payload: {} },
      { id: 't_ancient', deletedAt: now - 60 * ONE_DAY, payload: {} }
    ]
  });

  const purgedCount = await purgeExpiredTrash(local);
  assert.equal(purgedCount, 2, 'Must purge 2 items older than 30 days');

  const dump = local.rawDump();
  const remaining = dump[TRASH_BIN_KEY];
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].id, 't_fresh');
  assert.equal(remaining[1].id, 't_border');
});

test('Storage Layer: soft-delete, undo, and restore from trash bin', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  await storage.saveGroup({
    id: 'grp_alpha',
    title: 'Alpha',
    tabs: [
      { id: 'tab_1', title: 'Tab 1', url: 'https://test1.com' },
      { id: 'tab_2', title: 'Tab 2', url: 'https://test2.com' }
    ]
  });

  // Soft delete tab 1
  const delTabRes = await storage.deleteTab('alpha', 'tab_1');
  assert.ok(delTabRes);

  let trash = await storage.getTrashBin();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].payload.id, 'tab_1');

  // Restore tab 1 from trash
  const restored = await storage.restoreTrashItem(trash[0].id);
  assert.equal(restored.tabCountRestored, 1);

  const groupAfterRestore = await storage.getGroup('alpha');
  assert.equal(groupAfterRestore.tabs.length, 2);

  trash = await storage.getTrashBin();
  assert.equal(trash.length, 0, 'Trash bin must be empty after restore');

  // Soft delete entire group
  const delGroupRes = await storage.deleteGroup('alpha');
  assert.ok(delGroupRes);
  assert.equal((await storage.getAllGroups()).length, 0);

  trash = await storage.getTrashBin();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].itemType, 'group');

  // Restore entire group
  await storage.restoreTrashItem(trash[0].id);
  assert.equal((await storage.getAllGroups()).length, 1);
});

test('Storage Layer: regression - concurrent restore and save operations do not deadlock', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  await storage.saveGroup({
    id: 'grp_deadlock_test',
    title: 'Deadlock Test',
    tabs: [{ id: 't_deadlock', title: 'Test', url: 'https://test.com' }]
  });

  const del = await storage.deleteTab('deadlock_test', 't_deadlock');
  assert.ok(del);

  const trash = await storage.getTrashBin();
  assert.equal(trash.length, 1);

  // Concurrently restore the trash item while saving another group
  const results = await Promise.all([
    storage.restoreTrashItem(trash[0].id),
    storage.saveGroup({
      id: 'grp_concurrent',
      title: 'Concurrent Save',
      tabs: [{ id: 't_conc', title: 'Conc', url: 'https://conc.com' }]
    })
  ]);

  assert.equal(results[0].tabCountRestored, 1);
  assert.equal((await storage.getAllGroups()).length, 2);
});

test('Storage Layer: areObjectsEquivalent deep structural equality checks', () => {
  // Reordered keys
  assert.equal(
    areObjectsEquivalent(
      { z: 1, a: 2, m: { nestedZ: 10, nestedA: 20 } },
      { a: 2, m: { nestedA: 20, nestedZ: 10 }, z: 1 }
    ),
    true
  );

  // Array element order must be strictly preserved
  assert.equal(
    areObjectsEquivalent([1, 2, 3], [1, 3, 2]),
    false
  );

  // Nested tab arrays with reordered object properties inside array
  const groupA = {
    id: 'grp_1',
    title: 'Alpha',
    tabs: [{ url: 'https://a.com', title: 'A', id: 't1' }]
  };
  const groupB = {
    tabs: [{ id: 't1', title: 'A', url: 'https://a.com' }],
    title: 'Alpha',
    id: 'grp_1'
  };
  assert.equal(areObjectsEquivalent(groupA, groupB), true);

  // Mismatched data / corruption
  const groupCorrupted = {
    tabs: [{ id: 't1', title: 'Tampered Title', url: 'https://a.com' }],
    title: 'Alpha',
    id: 'grp_1'
  };
  assert.equal(areObjectsEquivalent(groupA, groupCorrupted), false);
});

test('Storage Layer: regression - writeNewVerifySwap succeeds when storage area reorders object keys', async () => {
  // Simulates Chromium C++ base::Value::Dict which stores dictionary keys in alphabetical order
  const sortingStorage = {
    _store: {},
    async set(items) {
      for (const [k, v] of Object.entries(items)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const sorted = {};
          for (const key of Object.keys(v).sort()) {
            sorted[key] = v[key];
          }
          this._store[k] = sorted;
        } else {
          this._store[k] = v;
        }
      }
    },
    async get(keys) {
      const res = {};
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        if (k in this._store) res[k] = this._store[k];
      }
      return res;
    },
    async remove(keys) {
      for (const k of keys) delete this._store[k];
    }
  };

  const stagingKey = 'staging_grp_sorted_test';
  const finalKey = 'grp_sorted_test';
  // Non-alphabetical property order
  const testData = {
    zIndex: 99,
    title: 'Sorting Regression',
    id: 'sorted_test',
    tabs: [{ url: 'https://example.com', title: 'Example', id: 't1' }],
    createdAt: 12345
  };

  const result = await writeNewVerifySwap(sortingStorage, stagingKey, finalKey, testData, (idx) => ['sorted_test', ...idx]);
  assert.equal(result.id, 'sorted_test');
  assert.deepEqual(sortingStorage._store[GROUP_INDEX_KEY], ['sorted_test']);
  assert.ok(sortingStorage._store[finalKey], 'Committed group must exist');
  assert.equal(sortingStorage._store[stagingKey], undefined, 'Staging key must be removed');
});

test('Storage Layer: backup restoration workflow restores groups and updates group_index', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // Backup payload with schemaVersion, metadata, and multiple groups
  const backupPayload = {
    version: 1,
    schemaVersion: 1,
    appName: 'Tab Vault',
    exportedAt: new Date().toISOString(),
    tabCount: 3,
    groupCount: 2,
    groups: [
      {
        id: '1001',
        title: 'Restored Group 1',
        createdAt: 1000,
        tabs: [
          { id: 'tab_1', title: 'Site 1', url: 'https://site1.com' },
          { id: 'tab_2', title: 'Site 2', url: 'https://site2.com' }
        ]
      },
      {
        id: '1002',
        title: 'Restored Group 2',
        createdAt: 2000,
        tabs: [
          { id: 'tab_3', title: 'Site 3', url: 'https://site3.com' }
        ]
      }
    ]
  };

  // Perform restore workflow
  for (const group of backupPayload.groups) {
    await storage.saveGroup(group);
  }

  // Verify group_index contains both groups
  const index = await storage.getGroupIndex();
  assert.equal(index.length, 2);
  assert.ok(index.includes('1001'));
  assert.ok(index.includes('1002'));

  // Verify individual grp_* keys exist in local storage
  const rawData = local.rawDump();
  assert.ok(rawData['grp_1001'], 'grp_1001 must exist in storage');
  assert.ok(rawData['grp_1002'], 'grp_1002 must exist in storage');

  // Verify getAllGroups returns all restored items
  const restoredGroups = await storage.getAllGroups();
  assert.equal(restoredGroups.length, 2);
  assert.equal(await storage.getTotalTabCount(), 3);

  // Verify sync flag is updated to hasSavedTabs: true
  const syncData = await sync.get(['hasSavedTabs', 'lastKnownTabCount']);
  assert.equal(syncData.hasSavedTabs, true);
  assert.equal(syncData.lastKnownTabCount, 3);
});

test('Storage Layer: malformed backup data throws error and preserves existing data', async () => {
  const local = new MockStorageArea();
  const storage = new TabVaultStorage(local);

  await storage.saveGroup({
    id: 'grp_existing',
    title: 'Existing Intact Group',
    tabs: [{ id: 't_ex', title: 'Existing', url: 'https://existing.com' }]
  });

  // Attempting to save invalid group without id must throw
  await assert.rejects(
    async () => {
      await storage.saveGroup(null);
    },
    /Group must have a valid id/
  );

  // Confirm existing data is untouched
  const groups = await storage.getAllGroups();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Existing Intact Group');
});
