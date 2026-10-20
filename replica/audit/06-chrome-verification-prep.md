# Audit 06: Environment Inspection, Automated Retest & Chrome Manual Verification Plan

## 1. Task
Copied from user prompt:
```text
# Tab Vault — Prepare and Verify Milestone 1.5 in Chrome

Continue the existing project at:

`/home/sid/.gemini/antigravity/scratch/onetab-mv3`

Read `AUDIT_REPORT.md` and `replica/audit/05-audit-scorecard-verification.md` first.

## Objective

Help me complete the outstanding real-browser verification for Milestone 1.5 before starting Milestone 2.

### Strict rules
- Do not rebuild the project.
- Do not modify working implementation code unless a real defect is demonstrated.
- Do not mark any feature as verified without evidence.
- Do not start Milestone 2.
- Preserve Git history and all user changes.
- Do not clear my normal browser profile or important browser data.

### Step 1 — Check the environment

Check whether Chrome or Chromium is installed and whether browser automation is available. The previous check returned no browser executable, so verify again rather than assuming one exists.

If no suitable browser is available, explain the limitation and prepare instructions for me to run the tests in my own Chrome installation. Do not claim browser tests passed.

### Step 2 — Inspect the extension

Inspect the existing manifest, toolbar action, collapse handler, undo flow, auto-backup implementation, developer panel, and wipe-recovery flow.

Confirm the exact paths and controls that the manual checklist refers to. If any instruction in Audit 05 is outdated or incorrect, update the checklist without changing historical audit entries.

### Step 3 — Prepare a safe test plan

Give me concise, numbered steps to verify:

1. Loading the unpacked extension from the existing `extension/` directory.
2. Collapsing tabs while keeping pinned tabs and non-HTTP(S) tabs open.
3. Using Undo to restore collapsed tabs.
4. Triggering an automatic backup and validating the downloaded JSON file.
5. Confirming the developer panel is hidden normally and visible using the supported development setting.
6. Testing storage-wipe recovery only in a disposable Chrome profile with test data.

For every step, provide:
- Action
- Expected result
- How I can confirm the result
- What evidence I should send back if it fails

Do not ask me to clear data in my regular Chrome profile.

### Step 4 — Verify any available automated checks

Rerun:

`timeout 120 node --test tests/*.test.js`

If appropriate, also rerun the existing parity and contrast checks. Record the actual results, not previously reported results.

Do not change `features.csv` to improve the score artificially.

### Step 5 — Record the outcome

If you perform additional checks or make corrections, append **Audit 06** to `AUDIT_REPORT.md` and create a corresponding detailed audit file. Preserve all earlier audit entries.

Update the scorecard only when the new evidence supports a change.

If the manual Chrome tests cannot be performed in this environment, record them as `MANUAL VERIFICATION REQUIRED`.

### Final response

Tell me:
- Whether a real Chrome test environment was available.
- Whether the automated tests passed.
- The exact manual steps I must perform.
- Any defects discovered and files changed.
- Whether Milestone 2 remains blocked.

Do not start Milestone 2 until the required manual verification is complete.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/06-chrome-verification-prep.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/06-chrome-verification-prep.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-parity.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-contrast.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/AUDIT_REPORT.md)

### Commit & Git Diff:
Commit: `672c061`
```text
 AUDIT_REPORT.md                              |  30 ++++-
 replica/audit/06-chrome-verification-prep.md | 170 +++++++++++++++++++++++++++
 replica/audit/logs/06-contrast.txt           |  22 ++++
 replica/audit/logs/06-parity.txt             |  64 ++++++++++
 replica/audit/logs/06-tests.txt              |  30 +++++
 5 files changed, 315 insertions(+), 1 deletion(-)
```

## 4. Commands run
1. Environment Check:
   - `which google-chrome google-chrome-stable chromium chromium-browser /snap/bin/chromium /usr/bin/chromium /usr/bin/google-chrome 2>&1`
   - `/snap/bin/chromium --version 2>&1`
   - `node -e "try { require('puppeteer'); } catch(e) { console.log('no puppeteer'); }"`
   - `node -e "try { require('playwright'); } catch(e) { console.log('no playwright'); }"`
   Confirmed `/snap/bin/chromium` (Chromium 155 snap) exists, but no browser automation framework is installed to programmatically trigger extension toolbar clicks or interact with browser chrome.
2. Automated Test Suite:
   `timeout 120 node --test tests/*.test.js > replica/audit/logs/06-tests.txt 2>&1`  
   Log output: [`replica/audit/logs/06-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-tests.txt)
3. Parity Check:
   `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/06-parity.txt 2>&1`  
   Log output: [`replica/audit/logs/06-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-parity.txt)
4. WCAG Contrast Check:
   `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/06-contrast.txt 2>&1`  
   Log output: [`replica/audit/logs/06-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/06-contrast.txt)

## 5. Tests
- **Automated Tests**:
  Command: `timeout 120 node --test tests/*.test.js`
  ```text
  ✔ Backup Module: slot calculation and filename rotation (4.601689ms)
  ✔ Backup Module: sanitizeGroupsForBackup excludes incognito tabs (0.799908ms)
  ✔ Backup Module: Empty Guard aborts when tabs count is 0 (1.328327ms)
  ✔ Backup Module: Shrink Guard blocks backup if tabs drop > 50% (4.68977ms)
  ✔ Backup Module: In-app removals lower baseline, undo raises baseline, and restore a 100-tab group allows backup to succeed (6.897156ms)
  ✔ Backup Module: Encoded URL length check triggers offscreen Blob URL creation (332.505484ms)
  ✔ Backup Module: backup_state updated ONLY after download complete; on failure state kept and lastError recorded (0.971911ms)
  ✔ Backup Module: regression - encoded URL length measurement accounts for URI encoding expansion (42.527869ms)
  ✔ Collapse Filter: skips pinned tabs and non-http(s) pages (1.197863ms)
  ✔ Storage Layer: formatGroupKey (2.110913ms)
  ✔ Storage Layer: writeNewVerifySwap atomic workflow (11.621905ms)
  ✔ Storage Layer: writeNewVerifySwap aborts on corruption during staging (0.898814ms)
  ✔ Storage Layer: parallel saveGroup calls serialized without race conditions (17.495432ms)
  ✔ Storage Layer: rebuildIndexFromKeys reconstructs group_index from grp_* keys (0.744324ms)
  ✔ Storage Layer: 30-day trash purge cleans expired items on startup (0.883085ms)
  ✔ Storage Layer: soft-delete, undo, and restore from trash bin (4.995635ms)
  ✔ Storage Layer: regression - concurrent restore and save operations do not deadlock (3.833229ms)
  ✔ Wipe Detection: findRecommendedBackup selection logic (2.533023ms)
  ✔ Real Flow: stash -> restore all -> empty (no alarm) (4.29285ms)
  ✔ Real Flow: stash -> delete all -> empty (no alarm) (0.962994ms)
  ✔ Real Flow: stash -> local.clear() with backup file (alarm) (1.116631ms)
  ✔ Real Flow: stash -> local.clear() without backup file (alarm) (5.823596ms)
  ℹ tests 22
  ℹ suites 0
  ℹ pass 22
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 514.202961
  ```
- **WCAG Contrast Check**: 20 pairs checked, 0 failing AA (`06-contrast.txt`).
- **Feature Parity**: 20.5 / 100 (`06-parity.txt`).
- **Verdict**: **PASS WITH WARNINGS** (Automated checks green; live browser verification in Chrome remains marked `MANUAL VERIFICATION REQUIRED`).

## 6. Not done
- Milestone 2 implementation was not started.
- Live browser test execution was not performed automatically because no browser automation framework is present in the environment; a non-destructive manual plan was formulated for the user.

## 7. Assumptions and guesses
- Assumed manual testing should use `--user-data-dir=/tmp/tab-vault-test-profile` so that the user's default browser profile and cookies are completely untouched.

## 8. Deviations
None.

## 9. Next step and how to continue
Execute the 6-step manual verification plan in Chrome with a disposable test profile, confirm the findings, update `replica/features.csv`, and start Milestone 2.
