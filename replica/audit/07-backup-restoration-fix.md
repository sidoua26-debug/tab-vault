# Audit 07: Critical Bug Fix: Key-Order Resilient Atomic Writes & Backup Restoration Hardening

## 1. Task
Copied from user prompt:
```text
# Tab Vault — Critical Bug: Backup Restoration Is Not Working

Project directory:
`/home/sid/.gemini/antigravity/scratch/onetab-mv3`

## Observed problem

After performing the manual storage-wipe test, the Tab Vault dashboard displays:

"No Tabs Stashed
All tabs have been cleared or restored. Items moved to Trash can be recovered within 30 days.
Select Backup File to Restore"

Backup restoration is not working.

I inspected this part of the storage implementation:

const expectedJson = JSON.stringify(data);
const actualJson = JSON.stringify(stagedData);

if (expectedJson !== actualJson) {
  await storageArea.remove([stagingKey]);
  throw new Error(`Atomic write verification failed: data mismatch for ${stagingKey}`);
}

const commitPayload = { [finalKey]: data };

if (typeof indexUpdater === 'function') {
  const currentIndexData = await storageArea.get([GROUP_INDEX_KEY]);
  const currentIndex = Array.isArray(currentIndexData[GROUP_INDEX_KEY])
    ? currentIndexData[GROUP_INDEX_KEY]
    : [];
  const updatedIndex = indexUpdater(currentIndex);
  commitPayload[GROUP_INDEX_KEY] = updatedIndex;
}

await storageArea.set(commitPayload);
await storageArea.remove([stagingKey]);
return data;

This snippet is evidence to inspect, not proof that this specific code is the root cause.

## Mandatory rules

- Repair the existing project. Do not rebuild it.
- Do not guess at the root cause.
- Do not delete existing backups or user data.
- Do not clear browser storage again.
- Do not silently swallow errors.
- Preserve the current architecture and Git history.
- Do not start Milestone 2.
- Make the smallest safe fix supported by evidence.
- Add a regression test for the confirmed defect.
- Keep the audit report cumulative and preserve historical entries.

## Phase 1 — Trace the complete restoration flow

Inspect these files and any directly related modules:

- `extension/src/storage.js`
- `extension/src/wipe-detection.js`
- `extension/src/backup.js`
- `extension/background.js`
- `extension/tab-vault.js`
- `extension/tab-vault.html`
- `tests/storage.test.js`
- `tests/backup.test.js`
- The existing wipe-detection and recovery tests

Trace this exact path:

1. User clicks **Select Backup File to Restore**.
2. The file input opens.
3. The selected JSON file is read.
4. JSON parsing and schema validation run.
5. Backup data is normalized into the expected internal representation.
6. Groups are written to storage.
7. `group_index` is updated.
8. The UI reloads or refreshes its group list.
9. The empty-state message disappears and restored groups become visible.

Identify the first step that fails.

## Phase 2 — Inspect the atomic write implementation

Review the complete `writeNewVerifySwap` implementation, including its callers and error handling.

Specifically verify:

- Whether `stagedData` is read from the correct staging key.
- Whether `data` and `stagedData` have equivalent serialization and ordering.
- Whether `finalKey` uses the expected `grp_<id>` naming convention.
- Whether the optional `indexUpdater` returns the correct index.
- Whether the group is committed before the staging key is removed.
- Whether callers pass the correct group ID and payload.
- Whether concurrent writes can overwrite the index.
- Whether storage errors are surfaced to the UI.
- Whether restoration incorrectly treats a successful write as a failed operation, or vice versa.

Do not change the atomic write function unless evidence shows that it causes the restoration failure.

## Phase 3 — Inspect backup schema compatibility

Compare the actual exported backup format with the importer's expected schema.

Check the fields:

- `schemaVersion`
- `tabCount`
- `groups`
- `exportedAt`

Verify the shape of each group and tab, including IDs, timestamps, URLs, titles, and any optional fields.

Determine whether the importer expects a different structure than the exporter actually generates. Preserve backward compatibility where possible.

Do not invent required fields that are absent from the established project format.

## Phase 4 — Inspect wipe detection separately

Determine why the dashboard shows the ordinary empty state instead of a disaster-recovery warning.

Check:

- Which storage keys are removed by `chrome.storage.local.clear()`.
- Whether `chrome.storage.sync` still contains the expected recovery flag.
- Whether wipe detection runs before the empty-state UI is rendered.
- Whether the detection result is returned, ignored, or overwritten.
- Whether the app can actually inspect the Downloads directory automatically.
- Whether a missing backup reference is incorrectly treated as proof that no backup exists.

Do not assume that a backup file on disk can be discovered automatically. Confirm the actual permissions and implementation.

## Phase 5 — Add regression tests

Use isolated mock storage and test backup data. Never use the user's normal Chrome profile.

Add tests covering, as applicable:

1. Importing a valid backup creates the expected `grp_<id>` keys.
2. `group_index` contains the restored group IDs.
3. Reloading groups after import returns the restored groups.
4. Invalid JSON produces a visible, understandable error.
5. Unsupported or malformed schemas do not silently clear existing data.
6. A write failure does not report success.
7. Successful restoration updates the UI state rather than leaving a stale empty-state display.
8. Wipe detection correctly distinguishes a genuinely recoverable wipe from a fresh installation, using the project's intended signals.

Use the repository's existing test conventions. Do not make tests pass by weakening assertions or skipping them.

## Phase 6 — Implement the smallest verified fix

Once the first failing step is identified:

- Fix the root cause only.
- Preserve valid existing groups and backups.
- Show meaningful error feedback if import or restoration fails.
- Ensure successful imports refresh the UI.
- Do not display a success message until storage writes and index updates have completed successfully.

If the available evidence cannot establish the root cause, stop before modifying implementation code and report exactly what additional evidence is needed.

## Phase 7 — Verify and document

Run:

timeout 120 node --test tests/*.test.js

Also run the project's existing parity and contrast checks if applicable.

Inspect the final diff and Git status. Preserve unrelated user changes and existing commits.

Append a new dated audit entry to `AUDIT_REPORT.md` and create a detailed corresponding audit file. Record actual commands, observed results, files changed, remaining risks, and any manual browser tests still required.

Keep `replica/features.csv` honest. Do not mark backup recovery as verified until the actual restoration flow has been demonstrated.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/07-backup-restoration-fix.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/07-backup-restoration-fix.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-parity.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-contrast.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md)

### Commit & Git Diff:
Commit: `d3e7e72`
```text
 AUDIT_REPORT.md                            |  37 +++-
 extension/src/backup.js                    |   1 +
 extension/src/storage.js                   |  33 +++-
 extension/src/wipe-detection.js            |  16 ++
 extension/tab-vault.js                     |  53 +++++-
 replica/audit/07-backup-restoration-fix.md | 269 +++++++++++++++++++++++++++++
 replica/audit/logs/07-contrast.txt         |  22 +++
 replica/audit/logs/07-parity.txt           |  64 +++++++
 replica/audit/logs/07-tests.txt            |  35 ++++
 tests/storage.test.js                      | 172 ++++++++++++++++++
 tests/wipe-detection.test.js               |  31 ++++
 11 files changed, 719 insertions(+), 14 deletions(-)
```

## 4. Commands run
1. `timeout 120 node --test tests/*.test.js > replica/audit/logs/07-tests.txt 2>&1`  
   Log output: [`replica/audit/logs/07-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-tests.txt)
2. `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/07-parity.txt 2>&1`  
   Log output: [`replica/audit/logs/07-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-parity.txt)
3. `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/07-contrast.txt 2>&1`  
   Log output: [`replica/audit/logs/07-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/07-contrast.txt)

## 5. Tests
- **Automated Tests**:
  Command: `timeout 120 node --test tests/*.test.js`
  ```text
  ✔ Backup Module: slot calculation and filename rotation (4.652212ms)
  ✔ Backup Module: sanitizeGroupsForBackup excludes incognito tabs (0.659335ms)
  ✔ Backup Module: Empty Guard aborts when tabs count is 0 (1.262504ms)
  ✔ Backup Module: Shrink Guard blocks backup if tabs drop > 50% (5.024559ms)
  ✔ Backup Module: In-app removals lower baseline, undo raises baseline, and restore a 100-tab group allows backup to succeed (11.956921ms)
  ✔ Backup Module: Encoded URL length check triggers offscreen Blob URL creation (319.991185ms)
  ✔ Backup Module: backup_state updated ONLY after download complete; on failure state kept and lastError recorded (1.23311ms)
  ✔ Backup Module: regression - encoded URL length measurement accounts for URI encoding expansion (35.589231ms)
  ✔ Collapse Filter: skips pinned tabs and non-http(s) pages (1.074452ms)
  ✔ Storage Layer: formatGroupKey (3.454259ms)
  ✔ Storage Layer: writeNewVerifySwap atomic workflow (1.54858ms)
  ✔ Storage Layer: writeNewVerifySwap aborts on corruption during staging (0.576369ms)
  ✔ Storage Layer: parallel saveGroup calls serialized without race conditions (13.148774ms)
  ✔ Storage Layer: rebuildIndexFromKeys reconstructs group_index from grp_* keys (0.654125ms)
  ✔ Storage Layer: 30-day trash purge cleans expired items on startup (0.413003ms)
  ✔ Storage Layer: soft-delete, undo, and restore from trash bin (3.292606ms)
  ✔ Storage Layer: regression - concurrent restore and save operations do not deadlock (3.749611ms)
  ✔ Storage Layer: areObjectsEquivalent deep structural equality checks (0.353592ms)
  ✔ Storage Layer: regression - writeNewVerifySwap succeeds when storage area reorders object keys (0.720229ms)
  ✔ Storage Layer: backup restoration workflow restores groups and updates group_index (1.73035ms)
  ✔ Storage Layer: malformed backup data throws error and preserves existing data (1.06236ms)
  ✔ Wipe Detection: findRecommendedBackup selection logic (4.905692ms)
  ✔ Real Flow: stash -> restore all -> empty (no alarm) (6.865337ms)
  ✔ Real Flow: stash -> delete all -> empty (no alarm) (1.396966ms)
  ✔ Real Flow: stash -> local.clear() with backup file (alarm) (1.346251ms)
  ✔ Real Flow: stash -> local.clear() without backup file (alarm) (1.856066ms)
  ✔ Real Flow: Scenario 4 - signed-out Chrome / uninitialized sync with backup in Downloads triggers recovery alarm (2.547591ms)
  ℹ tests 27
  ℹ suites 0
  ℹ pass 27
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 515.311852
  ```
- **Feature Parity**: 20.5 / 100 (`07-parity.txt`).
- **WCAG Contrast**: 20 pairs checked, 0 failing AA (`07-contrast.txt`).
- **Verdict**: **PASS WITH WARNINGS** (All 27 automated tests passed; warning: manual Chrome verification of the fix required).

## 6. Not done
- Milestone 2 features were not started.
- Live Chrome verification of the fix has not yet been executed by the user.

## 7. Assumptions and guesses
- Assumed `schemaVersion: 1` alongside `version: 1` satisfies both backup naming conventions.
- Assumed that if `syncState.hasSavedTabs === false` (deliberate user purge), it should remain a quiet empty state per request 6, while an uninitialized sync with backup in Downloads represents Scenario 4.

## 8. Deviations
None.

## 9. Next step and how to continue
Reload the unpacked extension in Chrome, repeat the manual verification steps (stashing tabs, exporting backup, clearing local storage, and restoring the backup file), verify the groups return, and then proceed to Milestone 2.
