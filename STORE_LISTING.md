# Chrome Web Store Listing — Tab Vault

## 1. Extension Metadata
- **Name**: Tab Vault
- **Summary**: Fast, privacy-first tab manager with defense-in-depth disaster recovery and instant search.
- **Category**: Productivity / Workflow & Planning
- **Version**: 1.0.0
- **Manifest Version**: 3
- **Primary Language**: English

---

## 2. Store Description

### Overview
**Tab Vault** converts cluttered browser windows into clean, organized lists with a single click—saving up to 95% of memory while keeping your research safe and structured.

Built from the ground up for modern Chrome Manifest V3, Tab Vault introduces defense-in-depth disaster recovery so you never lose tabs to profile wipes, unexpected browser crashes, or sync resets.

### Key Features
- **One-Click Stash & Restore**: Collapse any window into an organized session group with timestamps. Restore individual links or entire batches in seconds.
- **Instant Search**: Real-time token and substring search across all saved tab titles and URLs. Focus instantly with `/` or `Ctrl+F`.
- **OneTab Import & Export**: Full plain-text format compatibility (`url | title`) for seamless migration to and from OneTab, plus complete-fidelity JSON backups.
- **Defense-in-Depth Disaster Recovery**: Automated rotation backups to Downloads, startup wipe detection, and 1-click restore banner if local storage is ever cleared.
- **30-Day Trash Bin & Instant Undo**: Accidental deletions are protected with an instant 15-second undo toast and a soft-delete trash bin with 30-day retention.
- **Custom Organization**: Inline title renaming, Star & Pin priority groups, and Lock groups to protect sensitive project collections from deletion upon restore.
- **Context Menus & Keyboard Shortcuts**: Stash current tab, current window, tabs to the right/left, or across all windows directly from the right-click menu or `Alt+Shift+V`.
- **Duplicate URL Cleaner**: 1-click deduplication removes repeated links across your vault.
- **Clean, Accessible UI**: Dense, typography-driven list view with native Light and Dark themes (100% WCAG AA compliant contrast).

---

## 3. Justification for Extension Permissions

Tab Vault strictly follows Google's **Least Privilege Principle**. Every requested permission is strictly required for local tab management:

| Permission | Justification |
| :--- | :--- |
| `tabs` | Required to query tabs in open windows, read titles/URLs/favicons for saving, close collapsed tabs, and reopen restored tabs. |
| `storage` | Required to persist saved tab groups, session indices, user preferences, and soft-deleted trash items in `chrome.storage.local`. |
| `unlimitedStorage` | Essential to prevent storage quota exhaustion when users store thousands of research tabs and extensive session histories. |
| `downloads` | Required to save automated backup rotation JSON files (`tab-vault-backup-slot-*.json`) to user storage for disaster recovery. |
| `alarms` | Schedules the daily heartbeat and debounced backup jobs without requiring persistent background processes. |
| `offscreen` | Used exclusively to generate Blob URLs for massive tab collections (>2MB) without blocking the service worker or exceeding data URL length limits. |
| `contextMenus` | Adds quick right-click actions ("Send only this tab to Tab Vault", "Send tabs to right", etc.) directly in the browser. |

---

## 4. Privacy Policy & Single Purpose Declaration

### Single Purpose
Tab Vault serves a single dedicated purpose: managing and organizing browser tabs into persistent, searchable lists with automated local backup recovery.

### Privacy Policy
1. **Zero External Data Transmission**: Tab Vault operates 100% locally on your device. It does not communicate with any external server, third-party analytics, tracker, or cloud database.
2. **No Data Collection or Selling**: We do not collect, log, track, sell, or monetize any user browsing data, URLs, titles, or search queries.
3. **Local Storage**: All tab data is stored in your browser's private `chrome.storage` and local Downloads directory.
4. **Clean Code**: Contains zero remote scripts, analytics trackers, or obfuscated code.
