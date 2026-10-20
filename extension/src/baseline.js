/**
 * Tab Vault Baseline Management Module
 * SOLE authoritative writer for backup_state.baselineTabCount in chrome.storage.local.
 *
 * All mutations that impact the shrink guard baseline MUST route through this module.
 * Baseline is derived strictly from actual group contents or verified against storage state.
 */

export const BACKUP_STATE_KEY = 'backup_state';

/**
 * Recalculate baseline directly from active groups and persist to storageArea.
 * Guarantees zero arithmetic drift or desynchronization.
 *
 * @param {Object} storageArea - chrome.storage.local
 * @param {Array<Object>} groups - Array of group objects with tabs
 * @returns {Promise<number>} The updated baselineTabCount
 */
export async function syncBaselineFromGroups(storageArea, groups = []) {
  if (!storageArea) throw new Error('Storage area is required');
  const actualTabCount = (Array.isArray(groups) ? groups : []).reduce(
    (acc, g) => acc + (Array.isArray(g.tabs) ? g.tabs.length : 0),
    0
  );

  const res = await storageArea.get([BACKUP_STATE_KEY]);
  const state = res[BACKUP_STATE_KEY] || {};

  await storageArea.set({
    [BACKUP_STATE_KEY]: {
      ...state,
      baselineTabCount: actualTabCount,
      lastKnownTabCount: actualTabCount,
      lastSyncedAt: Date.now()
    }
  });

  return actualTabCount;
}

/**
 * Apply a verified delta to baselineTabCount with sanity boundary checks.
 * Rejects NaN, non-finite, or caller desync values.
 *
 * @param {Object} storageArea - chrome.storage.local
 * @param {number} delta - Integer change in tab count (+/-)
 * @returns {Promise<number>} New baseline count
 */
export async function applyBaselineDelta(storageArea, delta) {
  if (!storageArea) throw new Error('Storage area is required');
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new Error(`Invalid baseline delta: ${delta}`);
  }
  if (delta === 0) {
    const res = await storageArea.get([BACKUP_STATE_KEY]);
    const state = res[BACKUP_STATE_KEY] || {};
    return state.baselineTabCount ?? 0;
  }

  const res = await storageArea.get([BACKUP_STATE_KEY]);
  const state = res[BACKUP_STATE_KEY] || {};
  const current = state.baselineTabCount ?? state.lastKnownTabCount ?? 0;
  const newBaseline = Math.max(0, current + Math.trunc(delta));

  await storageArea.set({
    [BACKUP_STATE_KEY]: {
      ...state,
      baselineTabCount: newBaseline,
      lastKnownTabCount: newBaseline,
      lastUpdatedAt: Date.now()
    }
  });

  return newBaseline;
}

/**
 * Read current baseline tab count
 * @param {Object} storageArea - chrome.storage.local
 * @returns {Promise<number>}
 */
export async function getBaseline(storageArea) {
  if (!storageArea) return 0;
  const res = await storageArea.get([BACKUP_STATE_KEY]);
  const state = res[BACKUP_STATE_KEY] || {};
  return state.baselineTabCount ?? state.lastKnownTabCount ?? 0;
}
