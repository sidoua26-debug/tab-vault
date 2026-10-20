# Architecture: Tab Vault (Manifest V3 OneTab Rebuild)

Rebuilding OneTab's core tab consolidation and restoration functionality clean-room style in Manifest V3, with a defense-in-depth disaster recovery architecture.

---

## 1. Stack & Runtime Boundary

| Layer | Choice | Why & Constraints |
| :--- | :--- | :--- |
| **Platform** | Chrome Extension Manifest V3 | Modern standard extension platform for Chromium browsers. |
| **Background** | Service Worker (`background.js`) | Ephemeral background process. **Holds zero in-memory state**. |
| **Storage Engine** | `chrome.storage.local` with granular keys + `unlimitedStorage` | Avoids monolithic payload write amplification; removes 10MB quota. |
| **Cloud Flag** | `chrome.storage.sync` (minimal metadata) | Cross-device/profile wipe detection flag; survives local profile corruption. |
| **Frontend UI** | Vanilla HTML5 / TypeScript / CSS | Zero heavy frameworks. Instant startup and DOM rendering. |
| **Scheduler** | `chrome.alarms` | Survives worker termination; manages debounce timer and daily backups. |
| **Backup Bridge** | `chrome.downloads` + Data URL | Auto-exports rotated backup snapshots outside Chrome's profile directory. |

### Service Worker Lifespan & Stateless Contract
In Manifest V3, Chromium terminates the background service worker after ~30 seconds of inactivity or when event queues drain.
- **Rule**: `background.js` must NEVER store application state in global variables (e.g. `let cachedTabs = []` is strictly forbidden).
- Every event handler (`chrome.action.onClicked`, `chrome.alarms.onAlarm`, `chrome.contextMenus.onClicked`, `chrome.runtime.onMessage`) is completely stateless:
  1. Wakes up and parses event payload.
  2. Reads only required keys from storage.
  3. Executes logic and commits updates atomically.
  4. Idles and allows Chromium to terminate the process cleanly.

---

## 2. Storage Architecture: Granular Keys & Storage Choice

### Storage Location Reality
Both `chrome.storage.local` and IndexedDB reside inside the **local Chrome user profile directory** (`User Data/Default/Local Extension Settings/` or `IndexedDB/`). Therefore, **neither storage mechanism can protect against browser profile wipes, profile resets, or disk-level profile directory corruption**. Real disaster recovery requires external file exports.

### Justification: `chrome.storage.local` vs. IndexedDB
We choose **`chrome.storage.local` with `unlimitedStorage`** using a **granular per-group key structure**:

1. **Write Cost & Granularity**:
   - *Monolithic Array Anti-Pattern*: Storing all tab groups in a single giant `tab_groups` key means modifying, starring, or deleting a single tab forces the extension to JSON-serialize and write the entire database (e.g., 5,000 tabs = ~2MB written for a 1-character title edit).
   - *Granular Key Design*: We split groups into individual keys (`grp_<id>`) and maintain a lightweight index array (`group_index: string[]`). Adding, reordering, or removing a tab only writes to that single group key and the index, drastically reducing write amplification and disk I/O.
2. **Quota Management**:
   - Default `chrome.storage.local` has a strict **10 MB quota** (`QUOTA_BYTES: 10485760`).
   - Active tab hoarders storing thousands of tabs with metadata, titles, and icons can exceed 10 MB.
   - Declaring `unlimitedStorage` removes this quota restriction for `chrome.storage.local`, ensuring write operations never fail due to quota limits.

---

## 3. Storage Schema & Granular Key Layout

```typescript
// Keys in chrome.storage.local:

interface LocalStorageSchema {
  // Lightweight Group Index (ordered list of group IDs)
  "group_index": string[];               // ["grp_101", "grp_102", ...]

  // Granular Group Entities (stored individually)
  [groupKey: `grp_${string}`]: TabGroup;

  // Soft-Delete Trash Bin (30-day retention)
  "trash_bin": TrashItem[];

  // Settings & Configuration
  "settings": Settings;

  // Health and Backup State
  "backup_state": BackupMetadata;
}

interface TabGroup {
  id: string;               // e.g. "grp_1729420000000_abc"
  createdAt: number;        // Epoch timestamp ms
  title?: string;           // Custom name (defaults to date/time format)
  note?: string;            // Group-level markdown note
  folder?: string;          // Optional folder / tag classification
  isLocked: boolean;        // Prevent group deletion & retain on restore
  isStarred: boolean;       // Pin to top
  tabs: TabItem[];
}

interface TabItem {
  id: string;               // e.g. "tab_1729420000000_xyz"
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  createdAt: number;
}

interface TrashItem {
  id: string;
  deletedAt: number;        // Epoch timestamp ms for 30-day auto-purge
  itemType: "tab" | "group";
  payload: TabItem | TabGroup;
  sourceGroupId?: string;   // For tabs restored back to original group
}

// Minimal flag in chrome.storage.sync (survives local profile wipes if user signed into Chrome):
interface SyncStorageSchema {
  "hasSavedTabs": boolean;
  "lastKnownTabCount": number;
  "lastBackupTimestamp": number;
}
```

### Atomic Writes (Write-New, Verify, Swap)
For operations updating multiple keys (e.g. creating a group and updating `group_index`):
1. **Write Staging**: Save the new group data to `staging_grp_<id>`.
2. **Verify**: Read back the staging key and verify integrity (JSON structure and length).
3. **Swap**: Commit `grp_<id>` and update `group_index` in a single `chrome.storage.local.set` call.
4. **Cleanup**: Remove `staging_grp_<id>`.

---

## 4. Disaster Recovery: 3-File Rotated Auto-Backup to Downloads

### Backup Safety Guardrails
To prevent an empty list, partial session, or corrupted memory state from overwriting good backups:
1. **Never export an empty list**: If total tabs = 0, the auto-backup aborts immediately.
2. **Shrinkage Threshold Guard**: If the current total tab count has **shrunk by more than 50%** compared to `lastKnownTabCount` recorded during the last good backup, the auto-backup is paused, and a safety alert is logged. (A legitimate mass delete must be explicitly confirmed by the user before backup overwriting resumes).

### 3-File Rotation Scheme
Instead of overwriting a single file, the extension rotates across 3 fixed filenames in `Downloads/`:
- `tab-vault-backup-1.json`
- `tab-vault-backup-2.json`
- `tab-vault-backup-3.json`

Rotation index is tracked in `backup_state.currentSlot` (1 $\rightarrow$ 2 $\rightarrow$ 3 $\rightarrow$ 1).

### Export Generation via Data URL
- In MV3 Service Workers, `URL.createObjectURL` is unavailable (`TypeError: URL.createObjectURL is not a function`).
- The Service Worker compiles the JSON export (all groups, notes, folders, and timestamps) and formats it as a **Data URL**:
  ```typescript
  const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(jsonString);
  await chrome.downloads.download({
    url: dataUrl,
    filename: `tab-vault-backup-${slot}.json`,
    conflictAction: "overwrite",
    saveAs: false
  });
  ```

### Backup Cadence
- **Debounced After Changes**: When tabs are added, removed, or modified, set a 5-minute debounce alarm (`chrome.alarms.create("backup_debounce", { delayInMinutes: 5 })`).
- **Daily Heartbeat**: A recurring 24-hour alarm (`chrome.alarms.create("backup_daily", { periodInMinutes: 1440 })`) ensures regular point-in-time preservation.

### Chrome Download UI & Setting Considerations
- **"Ask where to save each file before downloading"**: If a user enabled this browser-level setting, `saveAs: false` may still trigger a native save dialog in some Chromium configurations.
  - *Testing requirement*: Verify behavior across Chrome and Edge when "Ask where to save" is ON vs OFF.
  - *Mitigation*: The Options page clearly informs users of this browser setting and provides a manual "Export Now" button if automatic silent downloads are obstructed.
- **Download Bubble / Shelf Animation**: Chromium displays a brief download bubble animation in the toolbar when downloads complete.
  - *Testing requirement*: Verify that rotated overwrites do not produce spammy desktop notifications or UI interruptions.

---

## 5. Restore Flow & Backup Selection Logic

### Browser Security Boundary
Chrome extensions cannot silently read or browse files in `~/Downloads` without explicit user interaction.

### How the Extension Selects the Backup to Offer
1. When the Restore dialog or disaster prompt opens, the extension queries `chrome.downloads.search`:
   ```typescript
   const candidates = await chrome.downloads.search({
     query: ["tab-vault-backup-"],
     orderBy: ["-endTime"],
     limit: 10
   });
   ```
2. **Filtering & Verification**:
   - Filters candidate items where `item.exists === true` (file still physically present on disk).
   - Sorts candidates by `endTime` (most recent successful download).
   - Extracts file metadata (timestamp and file size).
3. **User-Selected File Picker with Pre-Filled Hint**:
   - The UI presents an `<input type="file" accept=".json,.txt">`.
   - Directly above the button, the UI displays a clear hint:
     > 💡 **Recommended Backup**: `tab-vault-backup-2.json`  
     > *Saved on Oct 20, 2026 at 11:30 AM (142 tabs, 380 KB). Select this file in your Downloads folder to restore.*

---

## 6. Empty-State & Wipe Detection Matrix (No False Alarms)

The extension avoids false alarms by evaluating four distinct startup scenarios:

| Scenario | Local Storage State | `chrome.storage.sync` Flag | `chrome.downloads.search` (`exists: true`) | User Experience & UI Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1. Fresh Install** | Empty (`group_index: []`) | `hasSavedTabs: false` or missing | No backup files found | Standard welcoming onboarding screen explaining how to click the icon to collapse tabs. **Always-visible subtle link**: *"Already have a backup? [Restore from file]"*. |
| **2. Deliberate Clear** | Empty (`group_index: []`) | `hasSavedTabs: false` (flag cleared on user purge) | Backup files may exist | Normal empty dashboard. Active 30-day Trash bin available in sidebar; Undo toast visible if cleared recently. No disaster warning. |
| **3. Wipe with Sync Flag** | Empty (`group_index: []`) | `hasSavedTabs: true` (persisted in sync) | Backup file found with `exists: true` | **High-Confidence Disaster Recovery Banner**: *"Your local tabs appear to have been wiped by a browser reset. We detected your recent backup `tab-vault-backup-1.json`. [Restore Backup Now] [Dismiss]"*. |
| **4. Wipe with Signed-Out Chrome** | Empty (`group_index: []`) | Unavailable / Empty | Backup file found with `exists: true` | **Contextual Recovery Prompt**: *"Local list is empty, but we found a recent `tab-vault-backup-X.json` in Downloads. [Restore from Backup] [Dismiss]"*. |

---

## 7. In-App Deletion Safety: 30-Day Trash & Safe Collapse

1. **30-Day Trash Bin & Immediate Undo**:
   - Any deleted tab or group is moved to `trash_bin` with a timestamp (`deletedAt: Date.now()`).
   - A floating Undo toast appears for 15 seconds: *"Tab deleted. [Undo]"*.
   - Trash Bin view in the dashboard displays deleted items for 30 days before automatic pruning, allowing 1-click restoration back into original groups.
   - (Full in-memory rollback snapshots are moved to `could` as an optional developer feature).
2. **Safe-by-Default Collapse**:
   - Clicking the toolbar action collapses tabs and immediately shows a sticky top banner on the focused dashboard:
     > 📥 **Stashed 18 tabs into a new group.**  
     > `[Undo — Reopen tabs in window]` `[Dismiss]`
   - Clicking Undo restores all 18 tabs into the window at their exact indices and removes the temporary group.

---

## 8. Minimum Permissions & Justification

| Permission | Purpose | Chrome Install Warning | Justification |
| :--- | :--- | :--- | :--- |
| `tabs` | Reading URLs, titles, and favicons to collapse windows; recreating tabs upon restore. | None | Essential core loop requirement. |
| `storage` | Storing granular tab groups, trash bin, and settings in `chrome.storage.local` and flags in `sync`. | None | Core local data persistence. |
| `alarms` | Debouncing auto-exports and triggering daily scheduled backups without a persistent worker. | None | Clean background scheduling. |
| `contextMenus` | Right-click page menu for selective tab saving. | None | Secondary capture trigger. |
| `downloads` | Auto-saving rotated `tab-vault-backup-X.json` files to `Downloads/` outside volatile profile. | ⚠️ *"Manage your downloads"* | Essential for real crash recovery outside the browser's profile directory. |
| `unlimitedStorage` | Lifting the default 10MB quota on `chrome.storage.local` for large tab hoards. | ⚠️ *"Store unlimited amount of client-side data"* | Protects heavy research users from quota-exceeded write failures. |

---

## 9. Build Order & Implementation Phases

1. **Phase 1: Vertical Slice (The Core Loop)**
   - Manifest V3 configuration with stateless service worker.
   - Toolbar button collapse $\rightarrow$ granular `chrome.storage.local` write (`grp_<id>` + `group_index`).
   - Dashboard rendering with restore, delete, and favicon display.
2. **Phase 2: Data Integrity & In-App Safety (Must-Haves)**
   - Safe-by-default collapse with 15-second Undo toast.
   - Trash bin with 30-day retention and single-click item undelete.
   - Atomic writes (`writeNewVerifySwap`).
3. **Phase 3: Rotated Disaster Recovery (Must-Haves)**
   - 3-file rotated JSON backup to Downloads (`chrome.alarms` + `chrome.downloads` via Data URL).
   - Shrinkage guard (>50% drop prevents overwrite).
   - Empty-state wipe detection (Sync flag + `chrome.downloads.search` exists check).
   - File picker restore with latest backup hint.
4. **Phase 4: High-Fidelity Import/Export & OneTab Migration (Must-Haves)**
   - Full-fidelity JSON export (groups, notes, folders).
   - OneTab plain-text importer (seamless migration for switchers).
   - Plain-text export.
5. **Phase 5: Search, Options & Polish (Should-Haves)**
   - Real-time client-side search filter (`/` hotkey).
   - Settings page (`options.html`) for theme, restore window target, and pinned tab rules.
   - Context menus and Omnibox query support.
