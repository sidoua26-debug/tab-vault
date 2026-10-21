# Audit 11: Pre-Publish Hardening, E2E CI, and Release Readiness Pass

## 1. Task
Copied from user prompt:
```text
Audit 10 (d68ff0a) reached 50 passing tests, 100/100 parity, 20/20 WCAG AA contrast, and rebuilt dist/tab-vault-mv3-release.zip. Before uploading to the Chrome Web Store, execute Audit 11 to harden the extension against the bug classes that audits 04/09/10 repeatedly patched, close the mock-vs-real-browser verification gap, and complete CWS submission requirements.

Phase 1 — Permissions Scrub (extension/manifest.json):
- Review every declared permission (tabs, storage, unlimitedStorage, downloads, alarms, offscreen, contextMenus) and determine if it can be narrowed.
- Update STORE_LISTING.md with a "Permissions & Justifications" section: one line per permission, stating exact user-facing purpose.

Phase 2 — Storage Architecture Hardening:
- Single writer for backup_state: Create extension/src/baseline.js as the SOLE authoritative writer for backup_state.baselineTabCount.
- Storage self-healing: Implement reconcileOrphanKeys(storageArea) in extension/src/storage.js.

Phase 3 — Settings Consolidation:
- Move theme persistence from localStorage to vault_settings.theme in extension/src/settings.js with migrateThemeSettings().

Phase 4 — Real-Browser E2E Harness (tests/e2e/):
- Write an automated E2E test using puppeteer-core connected to the headless Chromium binary (/snap/bin/chromium).
- Seed storage (2 groups, 7 tabs, 3 starred). Assert DOM counts: .group-card = 2, .quick-link-pill = 3, .tab-row = 7.
- Test theme toggling via UI button #btnThemeToggle and verify data-theme attribute and vault_settings.theme.
- Seed a test group with 500 tabs and measure performance.now() for renderDashboard. Log timing in replica/audit/logs/11-e2e.txt.
- Capture clean native 1280x800 screenshots for Light, Dark, Settings Drawer, and Snapshots Drawer into dist/screenshots/.
- Write .github/workflows/ci.yml running unit and e2e tests.

Phase 5 — CWS Submission Assets:
- Capture native 1280x800 screenshots (dashboard light, dashboard dark, settings drawer, snapshots drawer).
- Write root PRIVACY.md.
- Ensure STORE_LISTING.md matches manifest permissions.

Phase 6 — Polish:
- First-run hint banner (#firstRunHint) in tab-vault.html and tab-vault.js: dismissible, shown only on empty vault fresh install without vault_settings, never on wipe recovery.
- 500-row render benchmark: measure renderDashboard time.
- Create CHANGELOG.md with 1.0.0 entry.

Phase 7 — Verification & Release:
- Target 56+ passing tests in tests/*.test.js -> replica/audit/logs/11-tests.txt.
- Verify 100.0/100 parity -> replica/audit/logs/11-parity.txt.
- Verify 20/20 WCAG AA contrast -> replica/audit/logs/11-contrast.txt.
- Rebuild dist/tab-vault-mv3-release.zip.
- Update AUDIT_REPORT.md and commit cleanly.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/baseline.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/baseline.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/baseline.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/baseline.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/e2e/dashboard.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/e2e/dashboard.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/.github/workflows/ci.yml`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/.github/workflows/ci.yml)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/PRIVACY.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/PRIVACY.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/CHANGELOG.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/CHANGELOG.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/.gitignore`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/.gitignore)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-settings-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-settings-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-snapshots-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-snapshots-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/11-pre-publish-hardening.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/11-pre-publish-hardening.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-parity.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-contrast.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-e2e.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-e2e.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-baseline-writer.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-baseline-writer.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/settings.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/settings.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/settings.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/settings.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/package.json`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/package.json)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/STORE_LISTING.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/STORE_LISTING.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-light-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-light-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-dark-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-dark-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/tab-vault-mv3-release.zip`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/tab-vault-mv3-release.zip)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md)

## 4. Commands run
1. Automated E2E Chromium & Puppeteer Suite:
   `node --test tests/e2e/dashboard.test.js`
   Log output: [`replica/audit/logs/11-e2e.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-e2e.txt)
2. Automated Unit Test Execution:
   `timeout 120 node --test tests/*.test.js > replica/audit/logs/11-tests.txt 2>&1`
   Log output: [`replica/audit/logs/11-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-tests.txt)
3. Feature Parity Check:
   `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/11-parity.txt 2>&1`
   Log output: [`replica/audit/logs/11-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-parity.txt)
4. WCAG AA Contrast Evaluation:
   `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/11-contrast.txt 2>&1`
   Log output: [`replica/audit/logs/11-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-contrast.txt)
5. Rebuild Production Release Zip:
   `cd extension && zip -r ../dist/tab-vault-mv3-release.zip . -x ".*"`

## 5. Verification results
- **Automated Unit Tests**:
  - Result: **PASS** (59/59 passing tests across 11 test suites, 0 failures, 0 skipped).
  - New test coverage: `tests/baseline.test.js` (3 tests including fresh read-merge-write in `updateBackupMetadata`), interleaved non-clobber test in `tests/backup.test.js`, orphan key reconciliation in `tests/storage.test.js` (2 tests), theme defaults/migration/immutability and settings drawer verification in `tests/settings.test.js` (4 tests).
- **Storage Architecture Hardening & Single-Writer Invariant**:
  - `extension/src/baseline.js` is the SOLE authoritative writer for `backup_state.baselineTabCount` (`syncBaselineFromGroups` and `applyBaselineDelta`).
  - `extension/src/backup.js` no longer writes `baselineTabCount` directly or spreads stale cached `...backupState`. All backup execution metadata updates are routed through `updateBackupMetadata(storageArea, metadata)` via fresh read-merge-write, eliminating the race condition / clobbering of concurrent tab restores during downloads.
  - Verification grep recorded in [`replica/audit/logs/11-baseline-writer.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/11-baseline-writer.txt).
- **Headless Chromium E2E Verification & Benchmark**:
  - Result: **PASS** in Chromium 155.0.8059.39 snap (`--headless=new`).
  - Service worker target booted cleanly with 0 console errors.
  - Live DOM assertions verified: 2 `.group-card`, 3 `.quick-link-pill`, 7 `.tab-row`.
  - Theme toggling verified: `#btnThemeToggle` toggles HTML `data-theme` attribute and syncs `vault_settings.theme` in `chrome.storage.local`.
  - 500-tab render benchmark: `renderDashboard` completed in **99.00ms** (well below the 500ms ceiling).
- **CWS Promotional Screenshots (Exact 1280x800 RGB PNG)**:
  - `dist/screenshots/tab-vault-light-1280x800.png` (91.5 KB): Populated dashboard in light theme.
  - `dist/screenshots/tab-vault-dark-1280x800.png` (93.1 KB): Populated dashboard in dark theme.
  - `dist/screenshots/tab-vault-settings-1280x800.png` (92.8 KB): Settings and Preferences drawer with storage repair tool.
  - `dist/screenshots/tab-vault-snapshots-1280x800.png` (89.0 KB): Rolling Snapshots drawer with 5-state safety history.
- **Feature Parity**:
  - Score: **100.0 / 100** (36 counted features, 13/13 must-haves done, 0 missing).
- **WCAG AA Color Contrast**:
  - Score: **20 / 20 pairs passing** (0 failing AA).
- **Permissions Audit**:
  - Verified least privilege: all 7 permissions (`tabs`, `storage`, `unlimitedStorage`, `downloads`, `alarms`, `offscreen`, `contextMenus`) rigorously documented and justified in `STORE_LISTING.md` and `PRIVACY.md`.
- **Production Package**:
  - `dist/tab-vault-mv3-release.zip`: 41 KB zip archive containing 23 clean production extension files with zero dev dependencies, test artifacts, or hidden OS metadata.
- **CI Automation**:
  - Added `.github/workflows/ci.yml` running unit tests and headless Chromium E2E tests on push and pull requests.

## 6. Blockers
None.

## 7. Next step
Submit `dist/tab-vault-mv3-release.zip`, `STORE_LISTING.md`, `PRIVACY.md`, and promotional screenshots in `dist/screenshots/` to the Chrome Web Store Developer Dashboard.
