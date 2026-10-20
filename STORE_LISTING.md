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

## 3. Visual Assets & Promotional Materials

### A. Chrome Web Store Screenshots (1280x800 PNG)
Available in [`dist/screenshots/`](file:///dist/screenshots/):
1. **Hero — One-Click Stash & 95% RAM Reduction**: `dist/screenshots/store-screenshot-1-hero-collapse.png` (alias: `tab-vault-light-1280x800.png`) — Declutter 50+ tabs in 1 click into organized session groups with instant RAM reclamation.
2. **Disaster Recovery & Rolling Snapshots**: `dist/screenshots/store-screenshot-2-disaster-recovery.png` (alias: `tab-vault-snapshots-1280x800.png`) — 5-state rolling safety snapshots, automated Downloads backup rotation, and 1-click state rollback.
3. **Instant Search & Omnibox Keyword**: `dist/screenshots/store-screenshot-3-instant-search.png` — Address bar `tv <query>` real-time suggestions and in-app `/` instant search across thousands of tabs.
4. **Power Organization & Drag-and-Drop Control**: `dist/screenshots/store-screenshot-4-batch-organize.png` — Multi-select batch actions, drag-to-split collections, starred Quick Lists, and 30-day soft trash.
5. **100% Local Privacy & Dual Themes**: `dist/screenshots/store-screenshot-5-privacy-themes.png` (alias: `tab-vault-dark-1280x800.png`) — Split light/dark showcase with 100% WCAG AA contrast certification and zero telemetry.
6. **Precision Settings & Self-Healing Diagnostics**: `dist/screenshots/store-screenshot-6-power-settings.png` (alias: `tab-vault-settings-1280x800.png`) — Restore targets, deduplication, lazy restore, and 1-click storage repair.

### B. Promotional Tiles & Banners
Available in [`dist/promo/`](file:///dist/promo/):
1. **Small Promo Tile (440x280 PNG)**: `dist/promo/tab-vault-small-promo-440x280.png` — High-impact card for Chrome Web Store search and category listings.
2. **Marquee Promo Banner (1400x560 PNG)**: `dist/promo/tab-vault-marquee-promo-1400x560.png` — Panoramic hero banner for featured homepage placement.

### C. Brand & Extension Icons
Available in [`dist/brand-assets/`](file:///dist/brand-assets/) and [`extension/icons/`](file:///extension/icons/):
1. **Master Vector Logo**: `dist/brand-assets/tab-vault-master-512.svg` & `tab-vault-icon-512.png`
2. **Monochrome Vector Mark**: `dist/brand-assets/tab-vault-monochrome.svg`
3. **Optimized Extension Icons**: `16x16`, `32x32`, `48x48`, `128x128`, `256x256`, `512x512`

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
