import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TabVaultStorage,
  formatGroupKey,
  writeNewVerifySwap,
  rebuildIndexFromKeys,
  purgeExpiredTrash,
  adjustBaseline,
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
