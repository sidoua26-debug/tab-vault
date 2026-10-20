/**
 * Tab Vault Import / Export Module
 * Handles OneTab plain-text format ("url | title"), Markdown format,
 * JSON export/import, and URL deduplication.
 */

/**
 * Format an array of tab groups into OneTab-compatible plain text.
 * Each tab is "url | title" (or "url" if title is identical/empty).
 * Groups are separated by a double newline ("\n\n").
 *
 * @param {Array} groups
 * @returns {string} Plain text representation
 */
export function exportToPlainText(groups) {
  if (!Array.isArray(groups)) return '';

  const groupBlocks = [];
  for (const group of groups) {
    const tabs = Array.isArray(group.tabs) ? group.tabs : [];
    if (tabs.length === 0) continue;

    const lines = [];
    for (const tab of tabs) {
      const url = (tab.url || '').trim();
      const title = (tab.title || '').trim();
      if (!url) continue;

      if (title && title !== url) {
        lines.push(`${url} | ${title}`);
      } else {
        lines.push(url);
      }
    }
    if (lines.length > 0) {
      groupBlocks.push(lines.join('\n'));
    }
  }

  return groupBlocks.join('\n\n');
}

/**
 * Parse plain-text import (OneTab format).
 * Blank lines separate groups.
 * Lines with "url | title" or bare URLs are converted into tabs.
 *
 * @param {string} text - Raw input text
 * @returns {Array} Array of parsed group objects { title, createdAt, tabs: [{ url, title }] }
 */
export function parsePlainTextImport(text) {
  if (!text || typeof text !== 'string') return [];

  const rawBlocks = text.split(/\n\s*\n+/);
  const parsedGroups = [];

  for (const block of rawBlocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const tabs = [];

    for (const line of lines) {
      let url = '';
      let title = '';

      if (line.includes(' | ')) {
        const parts = line.split(' | ');
        url = parts[0].trim();
        title = parts.slice(1).join(' | ').trim();
      } else {
        url = line.trim();
        title = url;
      }

      // Basic URL sanity: must look like a URL (http, https, chrome, file, etc.)
      if (url.match(/^[a-zA-Z0-9+.-]+:\/\//) || url.startsWith('www.')) {
        if (url.startsWith('www.')) {
          url = 'https://' + url;
        }
        tabs.push({
          id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url,
          title: title || url,
          createdAt: Date.now()
        });
      }
    }

    if (tabs.length > 0) {
      parsedGroups.push({
        id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: `Imported (${tabs.length} tabs)`,
        createdAt: Date.now(),
        tabs
      });
    }
  }

  return parsedGroups;
}

/**
 * Deduplicate URLs within a group or across groups.
 * Drops later occurrences of the same URL.
 *
 * @param {Array} tabs - Array of tab objects
 * @returns {Array} Deduplicated tabs
 */
export function deduplicateTabs(tabs) {
  if (!Array.isArray(tabs)) return [];
  const seen = new Set();
  const deduped = [];

  for (const tab of tabs) {
    const normalizedUrl = (tab.url || '').trim().replace(/\/+$/, '');
    if (!normalizedUrl || seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);
    deduped.push(tab);
  }

  return deduped;
}

/**
 * Export a single group's URLs to clipboard string format.
 * @param {Object} group
 * @returns {string}
 */
export function formatGroupUrlsForClipboard(group) {
  if (!group || !Array.isArray(group.tabs)) return '';
  return group.tabs.map(t => t.url).filter(Boolean).join('\n');
}
