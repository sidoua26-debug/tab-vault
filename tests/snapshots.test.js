import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SNAPSHOTS, createSnapshot, getSnapshots, rollbackSnapshot } from '../extension/src/snapshots.js';

class MockStorageArea {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  async get(keys) {
    const res = {};
    for (const k of keys) {
      if (k in this.store) {
        res[k] = this.store[k];
      }
    }
    return res;
  }
  async set(items) {
    Object.assign(this.store, items);
  }
}

class MockVaultStorage {
  constructor(initialGroups = []) {
    this.groups = [...initialGroups];
  }
  async getAllGroups() {
    return [...this.groups];
  }
  async saveGroup(group) {
    const idx = this.groups.findIndex(g => g.id === group.id);
    if (idx !== -1) {
      this.groups[idx] = group;
    } else {
      this.groups.push(group);
    }
    return group;
  }
  async deleteGroup(groupId) {
    this.groups = this.groups.filter(g => g.id !== groupId);
    return true;
  }
}

test('Snapshots: prunes ring buffer to MAX_SNAPSHOTS (5)', async () => {
  const mockStorage = new MockStorageArea();
  const vaultStorage = new MockVaultStorage([
    { id: 'g1', title: 'Group 1', tabs: [{ id: 't1', url: 'https://example.com' }] }
  ]);

  for (let i = 1; i <= 7; i++) {
    await createSnapshot(vaultStorage, mockStorage, `Snapshot ${i}`);
  }

  const snapshots = await getSnapshots(mockStorage);
  assert.equal(snapshots.length, MAX_SNAPSHOTS);
  assert.equal(snapshots[0].label, 'Snapshot 7');
  assert.equal(snapshots[4].label, 'Snapshot 3');
});

test('Snapshots: rollbackSnapshot restores target state', async () => {
  const mockStorage = new MockStorageArea();
  const vaultStorage = new MockVaultStorage([
    { id: 'g1', title: 'Initial State', tabs: [{ id: 't1', url: 'https://initial.com' }] }
  ]);

  const snaps = await createSnapshot(vaultStorage, mockStorage, 'Snapshot Initial');
  const snapId = snaps[0].id;

  // Mutate vault
  vaultStorage.groups = [
    { id: 'g2', title: 'Mutated State', tabs: [{ id: 't2', url: 'https://mutated.com' }] }
  ];

  // Rollback
  await rollbackSnapshot(snapId, vaultStorage, mockStorage);

  const restored = await vaultStorage.getAllGroups();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, 'g1');
  assert.equal(restored[0].title, 'Initial State');
});
