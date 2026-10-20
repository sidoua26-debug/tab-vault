/**
 * Tab Vault Storage Layer
 * Manifest V3 storage using granular per-group keys (grp_<id>) and an index (group_index)
 * with atomic writes (writeNewVerifySwap) and navigator.locks mutex serialization.
 */

export const GROUP_INDEX_KEY = 'group_index';
export const TRASH_BIN_KEY = 'trash_bin';
export const SETTINGS_KEY = 'settings';
export const BACKUP_STATE_KEY = 'backup_state';

// In-memory fallback lock for environments without navigator.locks
class SimpleMutex {
  constructor() {
    this._queue = Promise.resolve();
  }
  async acquire(fn) {
    let release;
    const next = new Promise(resolve => { release = resolve; });
    const prev = this._queue;
    this._queue = next;
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const fallbackMutex = new SimpleMutex();

export async function withGroupIndexLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return await navigator.locks.request('tab_vault_group_index_lock', fn);
  }
  return await fallbackMutex.acquire(fn);
}

/**
 * Format group ID with grp_ prefix
 */
export function formatGroupKey(id) {
  if (!id) throw new Error('Group ID cannot be empty');
  return id.startsWith('grp_') ? id : `grp_${id}`;
}

/**
 * Atomic Write Helper: writeNewVerifySwap
 */
export async function writeNewVerifySwap(storageArea, stagingKey, finalKey, data, indexUpdater = null) {
  if (!storageArea) throw new Error('Storage area is required');

  // Step 1: Write to staging key
  await storageArea.set({ [stagingKey]: data });

  // Step 2: Read back and verify integrity
  const readback = await storageArea.get([stagingKey]);
  const stagedData = readback[stagingKey];
  if (!stagedData) {
    throw new Error(`Atomic write verification failed: staging key ${stagingKey} not found`);
  }

  const expectedJson = JSON.stringify(data);
  const actualJson = JSON.stringify(stagedData);
  if (expectedJson !== actualJson) {
    await storageArea.remove([stagingKey]);
    throw new Error(`Atomic write verification failed: data mismatch for ${stagingKey}`);
  }

  // Step 3: Compute updates for atomic swap
  const commitPayload = { [finalKey]: data };
  if (typeof indexUpdater === 'function') {
    const currentIndexData = await storageArea.get([GROUP_INDEX_KEY]);
    const currentIndex = Array.isArray(currentIndexData[GROUP_INDEX_KEY])
      ? currentIndexData[GROUP_INDEX_KEY]
      : [];
    const updatedIndex = indexUpdater(currentIndex);
    commitPayload[GROUP_INDEX_KEY] = updatedIndex;
  }

  // Single atomic set call
  await storageArea.set(commitPayload);

  // Step 4: Cleanup staging key
  await storageArea.remove([stagingKey]);

  return data;
}

/**
 * Rebuild group_index from all grp_* keys
 */
export async function rebuildIndexFromKeys(storageArea) {
  if (!storageArea) throw new Error('Storage area is required');
  const allData = await storageArea.get(null);
  const groupEntries = [];

  for (const [k, v] of Object.entries(allData)) {
    if (k.startsWith('grp_') && v && typeof v === 'object') {
      const cleanId = k.slice(4);
      groupEntries.push({
        id: cleanId,
        createdAt: v.createdAt || 0
      });
    }
  }

  // Sort descending by createdAt
  groupEntries.sort((a, b) => b.createdAt - a.createdAt);
  const rebuiltIndex = groupEntries.map(e => e.id);

  await storageArea.set({ [GROUP_INDEX_KEY]: rebuiltIndex });
  return rebuiltIndex;
}

/**
 * Adjust shrink-guard baseline tab count
 * delta < 0 lowers baseline (on deletion or tab restoration)
 * delta > 0 raises baseline (on undo)
 */
export async function adjustBaseline(storageArea, delta) {
  if (!storageArea || !delta) return;
  const res = await storageArea.get([BACKUP_STATE_KEY]);
  const state = res[BACKUP_STATE_KEY] || {};
  const current = state.baselineTabCount ?? state.lastKnownTabCount ?? 0;
  const newBaseline = Math.max(0, current + delta);

  await storageArea.set({
    [BACKUP_STATE_KEY]: {
      ...state,
      baselineTabCount: newBaseline
    }
  });
  return newBaseline;
}

/**
 * Purge trash items older than maxAgeMs (default 30 days)
 */
export async function purgeExpiredTrash(storageArea, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  if (!storageArea) return 0;
  const res = await storageArea.get([TRASH_BIN_KEY]);
  const trash = Array.isArray(res[TRASH_BIN_KEY]) ? res[TRASH_BIN_KEY] : [];
  const cutoff = Date.now() - maxAgeMs;

  const valid = trash.filter(item => item.deletedAt && item.deletedAt >= cutoff);
  const purgedCount = trash.length - valid.length;

  if (purgedCount > 0) {
    await storageArea.set({ [TRASH_BIN_KEY]: valid });
  }
  return purgedCount;
}

/**
 * TabVaultStorage Class
 */
export class TabVaultStorage {
  constructor(localArea = null, syncArea = null) {
    this.local = localArea || (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null);
    this.sync = syncArea || (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.sync : null);
  }

  _requireLocal() {
    if (!this.local) throw new Error('chrome.storage.local area not initialized');
    return this.local;
  }

  async getGroupIndex() {
    const area = this._requireLocal();
    const res = await area.get([GROUP_INDEX_KEY]);
    return Array.isArray(res[GROUP_INDEX_KEY]) ? res[GROUP_INDEX_KEY] : [];
  }

  async getGroup(groupId) {
    const area = this._requireLocal();
    const key = formatGroupKey(groupId);
    const res = await area.get([key]);
    return res[key] || null;
  }

  async getAllGroups() {
    const area = this._requireLocal();
    const index = await this.getGroupIndex();
    if (index.length === 0) return [];

    const groupKeys = index.map(id => formatGroupKey(id));
    const results = await area.get(groupKeys);

    const groups = [];
    for (const id of index) {
      const key = formatGroupKey(id);
      if (results[key]) {
        groups.push(results[key]);
      }
    }
    return groups;
  }

  /**
   * Save group with navigator.locks mutex serialization
   */
  async saveGroup(group) {
    return await withGroupIndexLock(async () => {
      return await this._saveGroupUnlocked(group);
    });
  }

  /**
   * Internal unlocked save for callers that already hold the group index lock
   */
  async _saveGroupUnlocked(group) {
    const area = this._requireLocal();
    if (!group || !group.id) throw new Error('Group must have a valid id');

    const cleanId = group.id.startsWith('grp_') ? group.id.slice(4) : group.id;
    const finalKey = formatGroupKey(cleanId);
    const stagingKey = `staging_${finalKey}`;

    const normalizedGroup = {
      ...group,
      id: cleanId,
      tabs: Array.isArray(group.tabs) ? group.tabs : [],
      createdAt: group.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await writeNewVerifySwap(area, stagingKey, finalKey, normalizedGroup, (currentIndex) => {
      if (!currentIndex.includes(cleanId)) {
        return [cleanId, ...currentIndex];
      }
      return currentIndex;
    });

    await this._updateSyncMetadata();
    return normalizedGroup;
  }

  /**
   * Soft-delete group and lower baseline
   */
  async deleteGroup(groupId) {
    const area = this._requireLocal();
    const cleanId = groupId.startsWith('grp_') ? groupId.slice(4) : groupId;
    const groupKey = formatGroupKey(cleanId);

    return await withGroupIndexLock(async () => {
      const existing = await this.getGroup(cleanId);
      if (!existing) return null;

      const tabCount = existing.tabs ? existing.tabs.length : 0;
      // Lower baseline on removal
      await adjustBaseline(area, -tabCount);

      const trash = await this.getTrashBin();
      const trashItem = {
        id: `trash_${Date.now()}_${cleanId}`,
        deletedAt: Date.now(),
        itemType: 'group',
        payload: existing
      };
      trash.unshift(trashItem);

      const currentIndex = await this.getGroupIndex();
      const newIndex = currentIndex.filter(id => id !== cleanId);

      await area.set({
        [GROUP_INDEX_KEY]: newIndex,
        [TRASH_BIN_KEY]: trash
      });
      await area.remove([groupKey]);

      await this._updateSyncMetadata();
      return trashItem;
    });
  }

  /**
   * Soft-delete tab and lower baseline
   */
  async deleteTab(groupId, tabId) {
    const area = this._requireLocal();
    const cleanId = groupId.startsWith('grp_') ? groupId.slice(4) : groupId;

    return await withGroupIndexLock(async () => {
      const group = await this.getGroup(cleanId);
      if (!group) return null;

      const tabIndex = group.tabs.findIndex(t => t.id === tabId);
      if (tabIndex === -1) return null;

      const [deletedTab] = group.tabs.splice(tabIndex, 1);
      // Lower baseline by 1
      await adjustBaseline(area, -1);

      const trash = await this.getTrashBin();
      const trashItem = {
        id: `trash_${Date.now()}_${tabId}`,
        deletedAt: Date.now(),
        itemType: 'tab',
        payload: deletedTab,
        sourceGroupId: cleanId
      };
      trash.unshift(trashItem);

      if (group.tabs.length === 0 && !group.isLocked) {
        const currentIndex = await this.getGroupIndex();
        const newIndex = currentIndex.filter(id => id !== cleanId);
        await area.set({
          [GROUP_INDEX_KEY]: newIndex,
          [TRASH_BIN_KEY]: trash
        });
        await area.remove([formatGroupKey(cleanId)]);
      } else {
        await area.set({
          [formatGroupKey(cleanId)]: group,
          [TRASH_BIN_KEY]: trash
        });
      }

      await this._updateSyncMetadata();
      return { tab: deletedTab, trashItem };
    });
  }

  /**
   * Restore an item from the trash bin
   */
  async restoreTrashItem(trashId) {
    const area = this._requireLocal();
    return await withGroupIndexLock(async () => {
      const trash = await this.getTrashBin();
      const itemIdx = trash.findIndex(t => t.id === trashId);
      if (itemIdx === -1) return null;

      const [item] = trash.splice(itemIdx, 1);
      let tabCountRestored = 0;

      if (item.itemType === 'group') {
        const group = item.payload;
        tabCountRestored = group.tabs ? group.tabs.length : 0;
        await this._saveGroupUnlocked(group);
      } else if (item.itemType === 'tab') {
        tabCountRestored = 1;
        const targetGroupId = item.sourceGroupId;
        let group = targetGroupId ? await this.getGroup(targetGroupId) : null;
        if (!group) {
          group = {
            id: targetGroupId || `grp_${Date.now()}`,
            title: 'Restored Tabs',
            createdAt: Date.now(),
            tabs: [item.payload]
          };
          await this._saveGroupUnlocked(group);
        } else {
          group.tabs.push(item.payload);
          await area.set({ [formatGroupKey(group.id)]: group });
        }
      }

      // Raise baseline on undo/restore
      await adjustBaseline(area, tabCountRestored);

      await area.set({ [TRASH_BIN_KEY]: trash });
      await this._updateSyncMetadata();
      return { item, tabCountRestored };
    });
  }

  async getTrashBin() {
    const area = this._requireLocal();
    const res = await area.get([TRASH_BIN_KEY]);
    return Array.isArray(res[TRASH_BIN_KEY]) ? res[TRASH_BIN_KEY] : [];
  }

  async clearTrash() {
    const area = this._requireLocal();
    await area.set({ [TRASH_BIN_KEY]: [] });
  }

  async getTotalTabCount() {
    const groups = await this.getAllGroups();
    return groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);
  }

  async _updateSyncMetadata() {
    if (!this.sync) return;
    const totalTabs = await this.getTotalTabCount();
    try {
      await this.sync.set({
        hasSavedTabs: totalTabs > 0,
        lastKnownTabCount: totalTabs,
        lastUpdated: Date.now()
      });
    } catch {
      // Sync quota or signed-out errors must not break local operations
    }
  }

  async clearAll() {
    const area = this._requireLocal();
    const index = await this.getGroupIndex();
    const keysToRemove = index.map(id => formatGroupKey(id));
    keysToRemove.push(GROUP_INDEX_KEY);

    await area.remove(keysToRemove);

    if (this.sync) {
      try {
        await this.sync.set({
          hasSavedTabs: false,
          lastKnownTabCount: 0,
          lastUpdated: Date.now()
        });
      } catch {
        // Ignore
      }
    }
  }
}
