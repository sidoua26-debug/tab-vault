/**
 * Tab Vault Rolling Snapshots Module
 * Maintains a ring buffer of the last 5 vault states in chrome.storage.local
 * Allows 1-click rollback before destructive operations.
 */

export const MAX_SNAPSHOTS = 5;
const SNAPSHOTS_KEY = 'rolling_snapshots';

/**
 * Capture a new snapshot of current vault groups
 * @param {Object} storage - TabVaultStorage instance
 * @param {Object} storageArea - chrome.storage.local
 * @param {string} label - Description of the action triggering the snapshot
 * @returns {Promise<Array>} Updated list of snapshots
 */
export async function createSnapshot(storage, storageArea = chrome.storage.local, label = 'Manual Snapshot') {
  if (!storage || typeof storage.getAllGroups !== 'function') return [];

  const groups = await storage.getAllGroups();
  const data = await storageArea.get([SNAPSHOTS_KEY]);
  const snapshots = Array.isArray(data[SNAPSHOTS_KEY]) ? data[SNAPSHOTS_KEY] : [];

  const newSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    label,
    createdAt: Date.now(),
    groupCount: groups.length,
    tabCount: groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0),
    groups: JSON.parse(JSON.stringify(groups))
  };

  snapshots.unshift(newSnapshot);

  // Prune to MAX_SNAPSHOTS
  const pruned = snapshots.slice(0, MAX_SNAPSHOTS);
  await storageArea.set({ [SNAPSHOTS_KEY]: pruned });
  return pruned;
}

/**
 * Get all rolling snapshots
 * @param {Object} storageArea - chrome.storage.local
 * @returns {Promise<Array>}
 */
export async function getSnapshots(storageArea = chrome.storage.local) {
  const data = await storageArea.get([SNAPSHOTS_KEY]);
  return Array.isArray(data[SNAPSHOTS_KEY]) ? data[SNAPSHOTS_KEY] : [];
}

/**
 * Rollback the vault to a selected snapshot state
 * @param {string} snapshotId
 * @param {Object} storage - TabVaultStorage instance
 * @param {Object} storageArea - chrome.storage.local
 * @returns {Promise<boolean>}
 */
export async function rollbackSnapshot(snapshotId, storage, storageArea = chrome.storage.local) {
  const snapshots = await getSnapshots(storageArea);
  const target = snapshots.find(s => s.id === snapshotId);
  if (!target || !Array.isArray(target.groups)) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  // Create an automatic safety snapshot of current state before rolling back
  await createSnapshot(storage, storageArea, 'Pre-Rollback State');

  // Replace active groups cleanly without trash pollution and sync baseline
  if (typeof storage.replaceAllGroups === 'function') {
    await storage.replaceAllGroups(target.groups);
  } else {
    // Fallback for older storage instances
    const currentGroups = await storage.getAllGroups();
    for (const g of currentGroups) {
      await storage.deleteGroup(g.id);
    }
    for (const group of target.groups) {
      await storage.saveGroup(group);
    }
  }

  return true;
}
