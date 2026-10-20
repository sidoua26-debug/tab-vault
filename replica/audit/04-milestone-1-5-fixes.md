# Audit 04: Milestone 1.5 Fixes & Stabilization

## 1. Task
Copied from user prompt:
```text
# Tab Vault — Verify Audit Commit and Safely Resume Milestone 1.5

Continue working in the existing Tab Vault project. Do not rebuild the project, start Milestone 2, or discard any existing work.

## 1. Verify the Current Git State

Run and record the actual outputs of:

- `git status --short`
- `git log -1 --oneline`
- `git stash list`
- `git stash show --stat stash@{0}`

Confirm whether the audit-reporting changes were committed successfully. If not, inspect the current working tree and commit only the intended audit-reporting files after checking that they contain no unrelated changes.

Do not drop, overwrite, or apply any stash until its contents and purpose have been verified.

## 2. Inspect the Preserved Milestone 1.5 Changes

Identify the exact files and changes saved in the stash. Review them before applying anything.

Prioritize the previously documented issues:
- Deadlock-free or re-entrant mutex handling in `extension/src/storage.js`.
- Encoded URL length validation in `extension/src/backup.js`.
- Correct backup-baseline adjustment after restoring tabs.
- Correct collapse/undo behavior.
- Hiding the development-only simulation panel in the production UI.

Confirm which items are actually present and which still need implementation. Do not assume all five are implemented simply because they appear in the audit report.

## 3. Implement and Verify Safely

After confirming the Git state, recover the intended Milestone 1.5 work without losing unrelated changes. Make small, targeted fixes and run:

`timeout 120 node --test tests/*.test.js`

Add focused regression tests for any fixed bugs. Save real command output to uniquely named files under `replica/audit/logs/`.

Do not claim browser-level functionality is verified unless it has actually been tested in Chrome. Clearly list any remaining manual checks.

## 4. Update the Audit Trail

Preserve all existing audit files. Create the next sequential task audit file and append a dated entry to `AUDIT_REPORT.md`. Record actual changed files, commands, results, unresolved issues, and the correct verdict.

Verify the reports and logs exist and contain the current task's results.

## 5. Final Response

Report:
- Whether the audit commit exists.
- Whether the stash was present and what it contained.
- Which Milestone 1.5 fixes were implemented.
- Actual test results.
- Remaining manual Chrome checks.
- The exact next recommended action.

Do not begin Milestone 2. Do not claim success without execution evidence.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/collapse-filter.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/collapse-filter.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/collapse.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/collapse.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/04-milestone-1-5-fixes.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/04-milestone-1-5-fixes.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-parity.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-contrast.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.css`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.css)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/backup.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/backup.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/features.csv`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/features.csv)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md)

## 4. Commands run
1. `git status --short && git log -1 --oneline && git stash list && git stash show --stat stash@{0}`
2. `git stash apply stash@{0}`
3. `timeout 120 node --test tests/*.test.js > replica/audit/logs/04-tests.txt 2>&1`  
   Log output: [`replica/audit/logs/04-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-tests.txt)
4. `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/04-parity.txt 2>&1`  
   Log output: [`replica/audit/logs/04-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-parity.txt)
5. `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/04-contrast.txt 2>&1`  
   Log output: [`replica/audit/logs/04-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/04-contrast.txt)

## 5. Tests
- Command: `timeout 120 node --test tests/*.test.js`
- Test Output:
  ```text
  ✔ Backup Module: slot calculation and filename rotation (3.713038ms)
  ✔ Backup Module: sanitizeGroupsForBackup excludes incognito tabs (0.733663ms)
  ✔ Backup Module: Empty Guard aborts when tabs count is 0 (1.705502ms)
  ✔ Backup Module: Shrink Guard blocks backup if tabs drop > 50% (7.293995ms)
  ✔ Backup Module: In-app removals lower baseline, undo raises baseline, and restore a 100-tab group allows backup to succeed (20.255331ms)
  ✔ Backup Module: Encoded URL length check triggers offscreen Blob URL creation (434.574215ms)
  ✔ Backup Module: backup_state updated ONLY after download complete; on failure state kept and lastError recorded (1.691516ms)
  ✔ Backup Module: regression - encoded URL length measurement accounts for URI encoding expansion (58.655139ms)
  ✔ Collapse Filter: skips pinned tabs and non-http(s) pages (2.581464ms)
  ✔ Storage Layer: formatGroupKey (3.121863ms)
  ✔ Storage Layer: writeNewVerifySwap atomic workflow (5.976669ms)
  ✔ Storage Layer: writeNewVerifySwap aborts on corruption during staging (4.88746ms)
  ✔ Storage Layer: parallel saveGroup calls serialized without race conditions (18.732908ms)
  ✔ Storage Layer: rebuildIndexFromKeys reconstructs group_index from grp_* keys (0.867514ms)
  ✔ Storage Layer: 30-day trash purge cleans expired items on startup (1.191595ms)
  ✔ Storage Layer: soft-delete, undo, and restore from trash bin (5.907466ms)
  ✔ Storage Layer: regression - concurrent restore and save operations do not deadlock (5.811933ms)
  ✔ Wipe Detection: findRecommendedBackup selection logic (9.201235ms)
  ✔ Real Flow: stash -> restore all -> empty (no alarm) (7.727717ms)
  ✔ Real Flow: stash -> delete all -> empty (no alarm) (1.632697ms)
  ✔ Real Flow: stash -> local.clear() with backup file (alarm) (1.325101ms)
  ✔ Real Flow: stash -> local.clear() without backup file (alarm) (1.906108ms)
  ℹ tests 22
  ℹ suites 0
  ℹ pass 22
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 739.126221
  ```
- **WCAG Contrast Check**: 20 pairs checked, 0 failing AA.
- **Parity Score**: 20.5 / 100 (Features marked `partial` pending real Chrome user verification as instructed).
- **Actual Final Verdict**: **PASS WITH WARNINGS** (Automated suite 100% green; warning reflects that manual browser verification in Chrome is pending).

## 6. Not done
- Milestone 2 features (Real-time search bar, OneTab plain-text importer, plain-text export) were not started.
- Manual browser verification in real Chrome has not been executed by the user yet.

## 7. Assumptions and guesses
- Safe encoded URL limit threshold assumed at 2,097,152 characters (`DATA_URL_MAX_LENGTH`).
- Assumed `?dev=1` URL query parameter or `chrome.storage.local.get(['devMode'])` as the trigger for displaying development controls.

## 8. Deviations (Features built beyond Milestone 1)
As mandated by project instructions, the following items were added during Milestone 1.5:
1. **Mutex Serialization (`withGroupIndexLock` / `_saveGroupUnlocked`)**: Decoupled unlocked inner writes from outer locks to ensure re-entrancy safety.
2. **Crash Recovery Index Rebuild (`rebuildIndexFromKeys`)**: Reconstructs `group_index` from physical `grp_*` keys on startup if corrupted.
3. **Soft-Delete Trash Bin View with 30-Day Purge**: Trash container UI with item restore, empty trash, and automated timestamp-based purge on browser launch.
4. **Safe-by-Default Window Reopen Undo**: Session capture during collapse allowing 1-click restoration of tabs back to the active window.
5. **Protocol & State Filter (`filterTabsForCollapse`)**: Filters out pinned tabs and non-http(s) schemes (`chrome://`, `file://`, `about:`).
6. **Encoded URL Length Measurement**: Measures `encodeURIComponent` length rather than raw bytes before triggering offscreen Blob fallback.
7. **Two-Way Shrink Guard Adjuster (`adjustBaseline`)**: Lowers baseline on tab restoration and deletion; raises baseline on undo.
8. **Stateless Offscreen Blob Bridge**: Offscreen document creates and revokes Object URLs, while service worker retains control of `chrome.downloads.download`.
9. **Dev Panel Quarantine**: Simulation panel hidden in production UI; enabled only via `?dev=1` or `devMode` setting.

## 9. Next step and how to continue
- Load the unpacked extension at `extension/` in Chrome (`chrome://extensions`).
- Execute manual browser verification checklist (stashing active tabs, undoing collapse, inspecting Download shelf, and simulating a wipe in DevTools console).
- Once manually verified, update verified items in `features.csv` from `partial` to `yes`.
- Proceed to Milestone 2 (Search filter, OneTab text import/export).
