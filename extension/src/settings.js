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
  captureIncognito: false,
  theme: 'light' // 'light' | 'dark'
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

/**
 * One-time migration: reads old localStorage 'tab_vault_theme' into vault_settings if not already set
 * @param {Object} storageArea - chrome.storage.local
 * @returns {Promise<string>} Active theme ('light' | 'dark')
 */
export async function migrateThemeSettings(storageArea = chrome.storage.local) {
  const current = await getSettings(storageArea);
  if (typeof localStorage !== 'undefined') {
    const legacyTheme = localStorage.getItem('tab_vault_theme');
    if (legacyTheme && !current.themeSetExplicitly) {
      const updated = await saveSettings(storageArea, {
        theme: legacyTheme,
        themeSetExplicitly: true
      });
      return updated.theme;
    }
  }
  return current.theme || 'light';
}
