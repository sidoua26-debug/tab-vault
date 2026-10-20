import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TabVaultStorage,
  formatGroupKey,
  writeNewVerifySwap,
  GROUP_INDEX_KEY,
  TRASH_BIN_KEY
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

  // 1. Successful atomic write and index swap
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

  // Simulate storage tampering between set and readback
  const tamperedStorage = {
    async set(items) {
      if (items[stagingKey]) {
        // Tamper with data
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

test('Storage Layer: per-group keys and index lifecycle', async () => {
  const local = new MockStorageArea();
  const sync = new MockStorageArea();
  const storage = new TabVaultStorage(local, sync);

  // Initially empty
  const initialGroups = await storage.getAllGroups();
  assert.deepEqual(initialGroups, []);
  assert.equal(await storage.getTotalTabCount(), 0);

  // Save Group 1
  const g1 = {
    id: 'grp_alpha',
    title: 'Research Group',
    tabs: [
      { id: 'tab_1', url: 'https://test1.com', title: 'Test 1' },
      { id: 'tab_2', url: 'https://test2.com', title: 'Test 2' }
    ]
  };
  await storage.saveGroup(g1);

  // Save Group 2
  const g2 = {
    id: 'grp_beta',
    title: 'Work Group',
    tabs: [
      { id: 'tab_3', url: 'https://test3.com', title: 'Test 3' }
    ]
  };
  await storage.saveGroup(g2);

  // Check granular keys in storage dump
  const dump = local.rawDump();
  assert.ok(dump['grp_alpha'], 'grp_alpha key must exist');
  assert.ok(dump['grp_beta'], 'grp_beta key must exist');
  assert.deepEqual(dump[GROUP_INDEX_KEY], ['beta', 'alpha'], 'Index must order newest first');

  // Verify sync flag updated
  const syncDump = sync.rawDump();
  assert.equal(syncDump.hasSavedTabs, true);
  assert.equal(syncDump.lastKnownTabCount, 3);

  // Total tab count
  assert.equal(await storage.getTotalTabCount(), 3);

  // Delete Tab 2 from Group 1
  const deleteTabRes = await storage.deleteTab('alpha', 'tab_2');
  assert.equal(deleteTabRes.tab.id, 'tab_2');
  assert.equal(await storage.getTotalTabCount(), 2);

  // Check trash bin
  const trash = await storage.getTrashBin();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].payload.id, 'tab_2');
  assert.equal(trash[0].itemType, 'tab');

  // Delete Group 2
  const deleteGroupRes = await storage.deleteGroup('beta');
  assert.equal(deleteGroupRes.itemType, 'group');
  assert.equal(deleteGroupRes.payload.id, 'beta');

  const afterDeleteDump = local.rawDump();
  assert.equal(afterDeleteDump['grp_beta'], undefined, 'grp_beta must be removed');
  assert.deepEqual(afterDeleteDump[GROUP_INDEX_KEY], ['alpha'], 'Index must only have alpha');

  // Deliberate Clear All
  await storage.clearAll();
  const clearedDump = local.rawDump();
  assert.equal(clearedDump['grp_alpha'], undefined);
  assert.equal(clearedDump[GROUP_INDEX_KEY], undefined);
  const clearedSync = sync.rawDump();
  assert.equal(clearedSync.hasSavedTabs, false);
});
