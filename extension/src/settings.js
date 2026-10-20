/**
 * Tab Vault Settings Module
 * Manages user preferences, defaults, and persistence in chrome.storage.local
 */

export const DEFAULT_SETTINGS = {
  restoreWindowTarget: 'current', // 'current' | 'new'
  restoreRetentionPolicy: 'remove', // 'remove' | 'keep'
  openOnStartup: false,
  deduplicateOnCapture: true,
  lazyRestore: true,
  captureIncognito: false
};

const SETTINGS_KEY = 'vault_settings';

/**
 * Get current settings merged with defaults
 * @param {Object} storageArea - chrome.storage.local
 * @returns {Promise<Object>}
 */
export async function getSettings(storageArea = chrome.storage.local) {
  try {
    const data = await storageArea.get([SETTINGS_KEY]);
    return {
      ...DEFAULT_SETTINGS,
      ...(data[SETTINGS_KEY] || {})
    };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save updated settings
 * @param {Object} storageArea - chrome.storage.local
 * @param {Object} partialSettings
 * @returns {Promise<Object>}
 */
export async function saveSettings(storageArea = chrome.storage.local, partialSettings = {}) {
  const current = await getSettings(storageArea);
  const updated = {
    ...current,
    ...partialSettings
  };
  await storageArea.set({ [SETTINGS_KEY]: updated });
  return updated;
}
