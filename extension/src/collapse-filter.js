/**
 * Tab Vault Collapse Filter
 * Filters tabs for collapse:
 * - Skips pinned tabs
 * - Skips non-http(s) pages (chrome://, file://, about:, chrome-extension://)
 * - Skips Tab Vault dashboard itself
 */

export function filterTabsForCollapse(allTabs, dashboardUrl = '', allowIncognito = false) {
  if (!Array.isArray(allTabs)) return [];
  return allTabs.filter(tab => {
    if (tab.pinned) return false;
    if (!tab.url) return false;
    if (tab.incognito && !allowIncognito) return false;
    const isHttp = tab.url.startsWith('http://') || tab.url.startsWith('https://');
    if (!isHttp) return false;
    if (dashboardUrl && tab.url.startsWith(dashboardUrl)) return false;
    return true;
  });
}
