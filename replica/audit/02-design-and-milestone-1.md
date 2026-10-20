# Audit 02: Design System & Milestone 1 Implementation

## 1. Task
Copied from user prompt:
```text
Use replica-design: a simple, dense list UI, light and dark themes,
no cloud or social elements. Then use replica-build in milestones.

Milestone 1 only, with automated tests:
- Storage layer: per-group keys, index, atomic write.
- Backup module: empty and shrink guard (in-app deletes lower the
  baseline), 3-file rotation, data URL export with a size check
  and an offscreen-document fallback. Test with 20,000 tabs.
- Empty-state logic with tests for: fresh install, second
  device (sync flag set, onInstalled reason=install), deliberate
  clear, wipe with sync flag, wipe signed out.
- Exclude incognito tabs from backups.
Stop after milestone 1 and show test output, plus steps for me
to load it unpacked and simulate a wipe by running
chrome.storage.local.clear() in the service worker console.
```

## 2. Status
done

## 3. Files
### Created:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/tokens.json`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/tokens.json)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/tokens.css`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/tokens.css)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/components.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/design/components.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/package.json`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/package.json)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/manifest.json`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/manifest.json)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tokens.css`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tokens.css)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/background.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.html`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.html)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/offscreen.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.html)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.css`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.css)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/tab-vault.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/storage.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/backup.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/src/wipe-detection.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon16.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon16.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon48.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon48.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon128.png`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/extension/icons/icon128.png)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/test-helpers.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/test-helpers.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/storage.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/backup.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/backup.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/tests/wipe-detection.test.js)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/build-log.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/build-log.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/02-design-and-milestone-1.md`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/02-design-and-milestone-1.md)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-contrast.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-tests.txt)
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-parity.txt)

### Modified:
- [`/home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/features.csv`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/features.csv)

*(Note: Workspace is not a git repository; no git commit or diff generated).*

## 4. Commands run
- `python3 /home/sid/.gemini/config/skills/replica-design/contrast.py replica/design/tokens.json > replica/audit/logs/02-contrast.txt 2>&1`  
  Log output: [`replica/audit/logs/02-contrast.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-contrast.txt)
- `node --test tests/*.test.js > replica/audit/logs/02-tests.txt 2>&1`  
  Log output: [`replica/audit/logs/02-tests.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-tests.txt)
- `python3 /home/sid/.gemini/config/skills/replica-diff/parity.py replica/features.csv > replica/audit/logs/02-parity.txt 2>&1`  
  Log output: [`replica/audit/logs/02-parity.txt`](file:///home/sid/.gemini/antigravity/scratch/onetab-mv3/replica/audit/logs/02-parity.txt)

## 5. Tests
- Command: `node --test tests/*.test.js`
- Test Output:
  ```text
  ✔ Backup Module: slot calculation and filename rotation (15.487852ms)
  ✔ Backup Module: sanitizeGroupsForBackup excludes incognito tabs (0.814762ms)
  ✔ Backup Module: Empty Guard aborts when tabs count is 0 (2.391539ms)
  ✔ Backup Module: Shrink Guard blocks backup if tabs drop > 50% (3.554676ms)
  ✔ Backup Module: In-app deletes lower baseline and prevent shrink guard false alarm (8.214773ms)
  ✔ Backup Module: 3-file rotation sequence (1 -> 2 -> 3 -> 1) (4.494015ms)
  ✔ Backup Module: 20,000 tabs stress test triggers offscreen fallback (1114.548954ms)
  ✔ Storage Layer: formatGroupKey (5.621202ms)
  ✔ Storage Layer: writeNewVerifySwap atomic workflow (3.178019ms)
  ✔ Storage Layer: writeNewVerifySwap aborts on corruption during staging (4.121991ms)
  ✔ Storage Layer: per-group keys and index lifecycle (16.554479ms)
  ✔ Wipe Detection: findRecommendedBackup selection logic (5.359222ms)
  ✔ Wipe Detection: Scenario 1 - Fresh Install (1.479013ms)
  ✔ Wipe Detection: Scenario 2 - Second Device (sync flag set, onInstalled reason=install) (1.547321ms)
  ✔ Wipe Detection: Scenario 3 - Deliberate Clear (1.131753ms)
  ✔ Wipe Detection: Scenario 4 - Wipe with Sync Flag (High confidence disaster banner) (1.3218ms)
  ✔ Wipe Detection: Scenario 5 - Wipe Signed Out (Contextual recovery prompt) (1.178061ms)
  ✔ Wipe Detection: Active tabs returns isEmpty = false (1.453767ms)
  ℹ tests 18
  ℹ suites 0
  ℹ pass 18
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 1550.42812
  ```
- Contrast Check: `python3 contrast.py replica/design/tokens.json`: 20 pairs checked, 0 failing AA.

## 6. Not done
- Milestone 2+ features (such as search filtering, OneTab text import/export, and right-click context menus) were skipped intentionally in accordance with prompt instructions to "Stop after milestone 1".

## 7. Assumptions and guesses
- Set `DATA_URL_MAX_BYTES` to 2MB (2,097,152 bytes) as the safe threshold for Data URLs in `chrome.downloads.download` before offscreen fallback is triggered.
- Assumed standard Chrome download folder layout when querying `chrome.downloads.search`.

## 8. Deviations
None.

## 9. Next step and how to continue
- Load extension unpacked in Chrome from `/home/sid/.gemini/antigravity/scratch/onetab-mv3/extension` and verify interactive stash and wipe simulation.
- Proceed to Milestone 2 (Search filter, text import/export, and context menu actions).
