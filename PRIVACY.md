# Privacy Policy — Tab Vault

Last Updated: October 20, 2026

Tab Vault is built from the ground up as a private, local-first browser extension for Chromium-based browsers. Your privacy, control, and data ownership are fundamental to our architecture.

### 1. Zero External Data Transmission
Tab Vault does not communicate with any external server, cloud database, third-party API, or analytics service. There is zero telemetry, tracking, or network transmission of any kind.

### 2. What Data We Process and Where It Lives
- **Tab Titles, URLs, and Favicons**: When you choose to stash tabs, their URLs, page titles, and favicon references are stored exclusively in your browser's private local storage via `chrome.storage.local`.
- **User Preferences**: Your settings (such as theme, restore behaviors, and deduplication choices) are stored locally in `chrome.storage.local`.
- **Rolling Snapshots & Trash**: Historical safety snapshots and deleted tabs in the 30-day trash bin remain strictly within your device's local storage.
- **Disaster Recovery Backups**: Automated and manual JSON backups are saved directly to your local `Downloads` directory. They are never transmitted over the internet.

### 3. Permissions Used
All permissions requested by Tab Vault are strictly scoped to local tab management and disaster recovery:
- `tabs`: Read tab titles, URLs, and favicons to collapse tabs and reopen restored tabs.
- `storage`: Persist stashed tabs, settings, snapshots, and trash locally on your computer.
- `unlimitedStorage`: Prevent browser quota errors when saving large collections (>10MB).
- `downloads`: Save rotated JSON backup files to your local Downloads folder for disaster recovery.
- `alarms`: Schedule non-persistent background tasks (e.g. daily backup check).
- `offscreen`: Generate Blob URLs locally for large backups (>2MB) without freezing the service worker.
- `contextMenus`: Provide right-click options for selective and directional tab stashing.

### 4. Third-Party Sharing and Selling
We do not collect, monetize, profile, sell, or share your data with any third party, advertiser, or data broker.

### 5. Data Retention & Deletion
You retain complete control of your data. Stashed groups and tabs can be restored, deleted, or cleared at any time. When you uninstall Tab Vault, all extension storage is purged automatically by the browser.

### 6. Contact
For questions, issue reports, or open-source inspection, visit the Tab Vault project repository.
