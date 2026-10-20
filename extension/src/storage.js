/**
 * Tab Vault Storage Layer
 * Manifest V3 storage using granular per-group keys (grp_<id>) and an index (group_index)
 * with atomic writes (writeNewVerifySwap) to prevent corruption.
 */

export const GROUP_INDEX_KEY = 'group_index';
export const TRASH_BIN_KEY = 'trash_bin';
export const SETTINGS_KEY = 'settings';
export const BACKUP_STATE_KEY = 'backup_state';

/**
 * Format group ID with grp_ prefix
 */
export function formatGroupKey(id) {
  if (!id) throw new Error('Group ID cannot be empty');
  return id.startsWith('grp_') ? id : `grp_${id}`;
}

/**
 * Atomic Write Helper: writeNewVerifySwap
 * 1. Writes payload to stagingKey
 * 2. Reads back and verifies data integrity
 * 3. Atomic swap: sets finalKey and any index updates in a single set() call
 * 4. Cleans up stagingKey
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

  // Deep comparison via JSON serialization
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
 * Storage Manager Class
 */
export class TabVaultStorage {
  constructor(localArea = null, syncArea = null) {
    // In browser, default to chrome.storage.local / sync if available
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

    // Maintain index ordering
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
   * Save or update a group atomically
   */
  async saveGroup(group) {
    const area = this._requireLocal();
    if (!group || !group.id) throw new Error('Group must have a valid id');

    const cleanId = group.id.startsWith('grp_') ? group.id.slice(4) : group.id;
    const finalKey = formatGroupKey(cleanId);
    const stagingKey = `staging_${finalKey}`;

    const normalizedGroup = {
      ...group,
      id: cleanId,
      tabs: Array.isArray(group.tabs) ? group.tabs : [],
      updatedAt: Date.now()
    };

    await writeNewVerifySwap(area, stagingKey, finalKey, normalizedGroup, (currentIndex) => {
      if (!currentIndex.includes(cleanId)) {
        return [cleanId, ...currentIndex]; // Newest first
      }
      return currentIndex;
    });

    // Update sync flag if tabs exist
    await this._updateSyncMetadata();

    return normalizedGroup;
  }

  /**
   * Soft-delete group into trash bin
   */
  async deleteGroup(groupId) {
    const area = this._requireLocal();
    const cleanId = groupId.startsWith('grp_') ? groupId.slice(4) : groupId;
    const groupKey = formatGroupKey(cleanId);

    const existing = await this.getGroup(cleanId);
    if (!existing) return null;

    // Record into trash bin
    const trash = await this.getTrashBin();
    const trashItem = {
      id: `trash_${Date.now()}_${cleanId}`,
      deletedAt: Date.now(),
      itemType: 'group',
      payload: existing
    };
    trash.unshift(trashItem);

    // Update index and remove group key
    const currentIndex = await this.getGroupIndex();
    const newIndex = currentIndex.filter(id => id !== cleanId);

    await area.set({
      [GROUP_INDEX_KEY]: newIndex,
      [TRASH_BIN_KEY]: trash
    });
    await area.remove([groupKey]);

    await this._updateSyncMetadata();
    return trashItem;
  }

  /**
   * Soft-delete a single tab from a group
   */
  async deleteTab(groupId, tabId) {
    const area = this._requireLocal();
    const cleanId = groupId.startsWith('grp_') ? groupId.slice(4) : groupId;
    const group = await this.getGroup(cleanId);
    if (!group) return null;

    const tabIndex = group.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return null;

    const [deletedTab] = group.tabs.splice(tabIndex, 1);

    // Trash record
    const trash = await this.getTrashBin();
    const trashItem = {
      id: `trash_${Date.now()}_${tabId}`,
      deletedAt: Date.now(),
      itemType: 'tab',
      payload: deletedTab,
      sourceGroupId: cleanId
    };
    trash.unshift(trashItem);

    // If group is now empty, delete group or keep empty group
    if (group.tabs.length === 0 && !group.isLocked) {
      await this.deleteGroup(cleanId);
    } else {
      await area.set({
        [formatGroupKey(cleanId)]: group,
        [TRASH_BIN_KEY]: trash
      });
    }

    await this._updateSyncMetadata();
    return { tab: deletedTab, trashItem };
  }

  async getTrashBin() {
    const area = this._requireLocal();
    const res = await area.get([TRASH_BIN_KEY]);
    return Array.isArray(res[TRASH_BIN_KEY]) ? res[TRASH_BIN_KEY] : [];
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

  /**
   * Deliberate user clear
   */
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
