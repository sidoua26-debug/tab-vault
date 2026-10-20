import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syncBaselineFromGroups,
  applyBaselineDelta,
  getBaseline,
  BACKUP_STATE_KEY
} from '../extension/src/baseline.js';

class MockStorage {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  async get(keys) {
    if (!keys) return { ...this.store };
    const list = Array.isArray(keys) ? keys : [keys];
    const res = {};
    for (const k of list) {
      if (k in this.store) res[k] = this.store[k];
    }
    return res;
  }
  async set(items) {
    Object.assign(this.store, items);
  }
  async remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) delete this.store[k];
  }
}

test('Baseline Module: syncBaselineFromGroups calculates baseline strictly from actual group contents', async () => {
  const storage = new MockStorage();
  const groups = [
    { id: 'g1', tabs: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] },
    { id: 'g2', tabs: [{ id: 't4' }] },
    { id: 'g3', tabs: [] }
  ];

  const baseline = await syncBaselineFromGroups(storage, groups);
  assert.equal(baseline, 4);

  const state = (await storage.get([BACKUP_STATE_KEY]))[BACKUP_STATE_KEY];
  assert.equal(state.baselineTabCount, 4);
  assert.equal(state.lastKnownTabCount, 4);
});

test('Baseline Module: applyBaselineDelta modifies baseline with sanity checks', async () => {
  const storage = new MockStorage({
    [BACKUP_STATE_KEY]: { baselineTabCount: 10 }
  });

  // Lower baseline by 3
  const lowered = await applyBaselineDelta(storage, -3);
  assert.equal(lowered, 7);
  assert.equal(await getBaseline(storage), 7);

  // Raise baseline by 5
  const raised = await applyBaselineDelta(storage, 5);
  assert.equal(raised, 12);
  assert.equal(await getBaseline(storage), 12);

  // Lower beyond zero clamps to 0
  const clamped = await applyBaselineDelta(storage, -100);
  assert.equal(clamped, 0);

  // Reject non-finite delta
  await assert.rejects(async () => {
    await applyBaselineDelta(storage, NaN);
  }, /Invalid baseline delta/);

  await assert.rejects(async () => {
    await applyBaselineDelta(storage, 'invalid');
  }, /Invalid baseline delta/);
});
