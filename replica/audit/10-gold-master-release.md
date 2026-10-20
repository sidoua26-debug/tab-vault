# Audit 10: Gold Master Pre-Publish Verification, Edge-Case Bug Fixes, and Populated CWS Screenshots

## 1. Task
Copied from user prompt:
```text
Audit 09 (06ca109) reached 100/100 parity and 47 passing tests. Before we upload dist/tab-vault-mv3-release.zip and dist/screenshots/*.png to the Chrome Web Store, execute Audit 10 (Gold Master Pre-Publish Verification & Bug Fix Pass) to resolve 4 subtle edge-case bugs in the Audit 09 code and verify that the 1280x800 promotional screenshots actually render populated tab groups rather than an empty shell:

- Phase 1: Fix 4 Edge-Case Runtime Bugs:
  1. Single-Tab & Batch Restore Polluting Trash Bin and Double-Decrementing Baseline (extension/tab-vault.js & extension/src/storage.js):
     - Replace deleteTab on tab restore with removeRestoredTab(groupId, tabId). Do not push to trash_bin. Adjust baseline once. Respect group.isLocked.
  2. Enforce vault_settings.captureIncognito During Tab Collapse (extension/background.js & extension/src/collapse-filter.js).
  3. Snapshot Rollback Polluting Trash Bin and Desyncing Baseline (extension/src/snapshots.js & extension/src/storage.js):
     - Replace deleteGroup in rollback with replaceAllGroups(newGroups). Synchronize baseline directly to new total tab count.
  4. Guard chrome.storage Initialization in extension/tab-vault.js against Delayed/Missing Bindings.
- Phase 2: Verify & Fix 1280x800 Chrome Web Store Promotional Screenshots (dist/screenshots/*.png):
  - Ensure populated DOM renders the 2 group cards (7 tabs total) and the 3-link Starred Quick List bar instead of an empty shell before taking screenshots.
- Phase 3: Add Unit Tests in tests/ (50+ passing tests, 0 failures), Verify 100/100 Parity, and 20/20 WCAG AA Contrast.
- Phase 4: Clean up temporary scripts, rebuild production dist/tab-vault-mv3-release.zip, write replica/audit/10-gold-master-release.md, update AUDIT_REPORT.md, and commit cleanly.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/10-gold-master-release.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/10-gold-master-release.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-parity.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-contrast.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-screenshots-verify.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-screenshots-verify.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/snapshots.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/snapshots.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/collapse-filter.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/collapse-filter.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/collapse.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/collapse.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/snapshots.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/snapshots.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-light-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-light-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-dark-1280x800.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/screenshots/tab-vault-dark-1280x800.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/tab-vault-mv3-release.zip`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/dist/tab-vault-mv3-release.zip)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md)

## 4. Commands run
1. Headless Chromium DOM Assertions & Populated Screenshot Capture:
   `python3 /home/sid/verify_audit10_chromium.py`
   Log output: [`replica/audit/logs/10-screenshots-verify.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-screenshots-verify.txt)
2. Automated Unit Test Execution:
   `timeout 120 node --test tests/*.test.js > replica/audit/logs/10-tests.txt 2>&1`
   Log output: [`replica/audit/logs/10-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-tests.txt)
3. Feature Parity Check:
   `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/10-parity.txt 2>&1`
   Log output: [`replica/audit/logs/10-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-parity.txt)
4. WCAG AA Contrast Evaluation:
   `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/10-contrast.txt 2>&1`
   Log output: [`replica/audit/logs/10-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/10-contrast.txt)
5. Rebuild Production Release Zip:
   `cd extension && zip -r ../dist/tab-vault-mv3-release.zip . -x ".*"`

## 5. Tests
- **Automated Tests**:
  Command: `timeout 120 node --test tests/*.test.js`
  Result: **50 passed, 0 failed, 0 skipped** (1547ms).
  New test suites added:
  - `Storage Layer: removeRestoredTab decrements baseline, does NOT pollute trash, and respects group locking`
  - `Storage Layer: replaceAllGroups replaces active groups cleanly without trash pollution and syncs baseline`
  - `Collapse Filter: respects allowIncognito parameter`
  - `Snapshots: rollbackSnapshot delegates to replaceAllGroups without trash pollution`
- **Headless Chromium DOM & Visual Verification**:
  Verified in live headless Chromium 155 via CDP on `chrome-extension://<id>/tab-vault.html`:
  - `.group-card` count: 2 (expected 2) -> PASS
  - `.quick-link-pill` count: 3 (expected 3) -> PASS
  - `.tab-row` count: 7 (expected 7) -> PASS
  - Empty state banner: hidden -> PASS
  - Exact promotional screenshots captured at 1280x800 for Light & Dark themes.
- **Feature Parity**: **100.0 / 100** (36/36 counted features complete).
- **WCAG Contrast**: **20 pairs checked, 0 failing AA** (100% pass).
- **Verdict**: **PASS** (100% Gold Master Release Ready).

## 6. Not done
None. All planned bugs and requirements are implemented and verified.

## 7. Assumptions and guesses
None.

## 8. Deviations
Screenshots were padded/extent adjusted to exact 1280x800 dimensions matching Chrome Web Store promotional asset requirements.

## 9. Next step and how to continue
Upload `dist/tab-vault-mv3-release.zip` and the populated screenshots in `dist/screenshots/` to the Chrome Web Store Developer Dashboard.
