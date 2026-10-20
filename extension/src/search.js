/**
 * Tab Vault Search Module
 * Token and substring search filter across tab titles and URLs.
 */

/**
 * Filter groups and tabs matching query tokens.
 * A tab matches if every token in the query appears in its title or URL (case-insensitive).
 * Groups with zero matching tabs are omitted unless the group title itself matches.
 *
 * @param {Array} groups - List of group objects
 * @param {string} query - Search query string
 * @returns {Array} Filtered groups with matching tabs
 */
export function filterGroupsByQuery(groups, query) {
  if (!Array.isArray(groups)) return [];
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) {
    return groups;
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const matchedGroups = [];

  for (const group of groups) {
    const groupTitle = (group.title || '').toLowerCase();
    const groupTitleMatches = tokens.every(token => groupTitle.includes(token));

    const matchingTabs = (group.tabs || []).filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      return tokens.every(token => title.includes(token) || url.includes(token));
    });

    if (matchingTabs.length > 0) {
      matchedGroups.push({
        ...group,
        tabs: matchingTabs
      });
    } else if (groupTitleMatches && group.tabs && group.tabs.length > 0) {
      // If group title matches all tokens, include the entire group
      matchedGroups.push(group);
    }
  }

  return matchedGroups;
}

/**
 * Calculate total visible tabs across an array of groups.
 * @param {Array} groups
 * @returns {number}
 */
export function countVisibleTabs(groups) {
  if (!Array.isArray(groups)) return 0;
  return groups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);
}
