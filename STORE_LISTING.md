# Chrome Web Store Listing — Tab Vault

## 1. Extension Metadata
- **Name**: Tab Vault
- **Summary**: Fast, privacy-first tab manager with defense-in-depth disaster recovery, rolling snapshots, and instant search.
- **Category**: Productivity / Workflow & Planning
- **Version**: 1.0.0
- **Manifest Version**: 3
- **Primary Language**: English

---

## 2. Store Description

### Overview
**Tab Vault** converts cluttered browser windows into clean, organized lists with a single click—saving up to 95% of memory while keeping your research safe, structured, and instantly accessible.

Built from the ground up for modern Chrome Manifest V3, Tab Vault introduces defense-in-depth disaster recovery, automated rolling snapshots, and rich organization tools so you never lose tabs to profile wipes, unexpected browser crashes, or sync resets.

### Key Features
- **One-Click Stash & Restore**: Collapse any window into an organized session group with timestamps. Restore individual links or entire batches in seconds.
- **Instant Search & Omnibox Keyword**: Real-time token and substring search across all saved tab titles and URLs with `/` or `Ctrl+F`. Or query saved tabs directly from your Chrome address bar by typing `tv <query>`.
- **OneTab Import & Export**: Full plain-text format compatibility (`url | title`) for seamless migration to and from OneTab, plus complete-fidelity JSON backups.
- **Defense-in-Depth Disaster Recovery**: Automated rotation backups to Downloads, startup wipe detection, and 1-click restore banner if local storage is ever cleared.
- **Rolling In-Extension Snapshots**: Automatic 5-state safety buffer before major operations, allowing 1-click rollback to prior vault states at any time.
- **Drag-and-Drop Organization**: Reorder tabs within groups, drag tabs between groups, or drop a tab onto the new-group dropzone to split it into its own collection.
- **Multi-Select Batch Actions**: Check multiple tabs for batch restore, batch move to a new group, or batch deletion.
- **Quick List / Starred Links**: Star individual high-priority tabs (`★`) for instant 1-click access in the dedicated Quick List header.
- **Custom Preferences & Options**:
  - Configurable restore window target (restore in current window vs. new window).
  - Configurable restore retention policy (remove tabs from group vs. keep upon restore).
  - Startup behavior option (automatically open Tab Vault dashboard on browser launch).
  - Automatic duplicate URL stripping on collapse and import.
  - Lazy tab restore to prevent memory and CPU thrashing when reopening 50+ tabs.
  - Optional incognito tab capture.
- **30-Day Trash Bin & Instant Undo**: Accidental deletions are protected with an instant 15-second undo toast and a soft-delete trash bin with 30-day retention.
- **Custom Naming & Group Protection**: Inline title renaming, Star & Pin priority groups, and Lock groups (🔒) to protect sensitive project collections from deletion upon restore.
- **Context Menus & Keyboard Shortcuts**: Stash current tab, current window, tabs to the right/left, or across all windows directly from the right-click menu or `Alt+Shift+V`.
- **Clean, Accessible UI**: Dense, typography-driven list view with native Light and Dark themes (100% WCAG AA compliant contrast).

---

## 3. Promotional Screenshots (1280x800)
Available in [`dist/screenshots/`](file:///dist/screenshots/):
1. **Light Theme Dashboard**: `dist/screenshots/tab-vault-light-1280x800.png` — Shows active session groups, Quick List starred items, search bar, and batch controls in high-contrast light mode.
2. **Dark Theme Dashboard**: `dist/screenshots/tab-vault-dark-1280x800.png` — Shows the same rich dashboard state rendered in native dark theme.
3. **Settings & Preferences Drawer**: `dist/screenshots/tab-vault-settings-1280x800.png` — Shows configurable restore targets, deduplication, lazy restore, startup options, and storage repair tools.
4. **Rolling Snapshots Drawer**: `dist/screenshots/tab-vault-snapshots-1280x800.png` — Shows 5-state safety snapshots with timestamps, group/tab tallies, manual snapshots, and 1-click state rollback.

---

## 4. Justification for Extension Permissions

Tab Vault strictly follows Google's **Least Privilege Principle**. Every requested permission is strictly required for local tab management:

| Permission | Justification |
| :--- | :--- |
| `tabs` | Required to query tabs in open windows, read titles/URLs/favicons for saving, close collapsed tabs, and reopen restored tabs. |
| `storage` | Required to persist saved tab groups, session indices, user preferences, rolling snapshots, and soft-deleted trash items in `chrome.storage.local`. |
| `unlimitedStorage` | Essential to prevent storage quota exhaustion when users store thousands of research tabs and extensive session histories. |
| `downloads` | Required to save automated backup rotation JSON files (`tab-vault-backup-slot-*.json`) to user storage for disaster recovery. |
| `alarms` | Schedules the daily heartbeat and debounced backup jobs without requiring persistent background processes. |
| `offscreen` | Used exclusively to generate Blob URLs for massive tab collections (>2MB) without blocking the service worker or exceeding data URL length limits. |
| `contextMenus` | Adds quick right-click actions ("Send only this tab to Tab Vault", "Send tabs to right", etc.) directly in the browser. |

---

## 5. Privacy Policy & Single Purpose Declaration

### Single Purpose
Tab Vault serves a single dedicated purpose: managing and organizing browser tabs into persistent, searchable lists with automated local backup recovery.

### Privacy Policy
1. **Zero External Data Transmission**: Tab Vault operates 100% locally on your device. It does not communicate with any external server, third-party analytics, tracker, or cloud database.
2. **No Data Collection or Selling**: We do not collect, log, track, sell, or monetize any user browsing data, URLs, titles, or search queries.
3. **Local Storage**: All tab data is stored in your browser's private `chrome.storage` and local Downloads directory.
4. **Clean Code**: Contains zero remote scripts, analytics trackers, or obfuscated code.
