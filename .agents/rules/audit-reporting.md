# Tab Vault Audit & Reporting Standard

This workspace rule governs all tasks, bug fixes, feature implementations, refactorings, and milestones within the Tab Vault project (`/home/sid/.gemini/antigravity/scratch/onetab-mv3`).

## 1. Core Rule: Mandatory Audit Record Per Task
Whenever you finish a task, or stop for any reason (blocked, error, interrupted):
1. **Numbered Task Audit File**: Write or update `replica/audit/NN-<task-name>.md` (where `NN` is the next sequential two-digit number). Never edit or delete earlier audit files.
2. **Cumulative Audit Report**: Append a dated entry to `AUDIT_REPORT.md` at the project root.
3. **Raw Command & Test Logs**: Execute tests and checks with real command execution, redirecting raw output to `replica/audit/logs/NN-<name>.txt`. Never paraphrase or fabricate logs.

## 2. Required Audit Report Contents
Every task audit report and cumulative entry must contain:
- **Task Summary & Final Status**: Exact description copied from user prompt, and status (`done`, `partial`, or `blocked`).
- **Verdict**: Explicit declaration of `PASS`, `PASS WITH WARNINGS`, `FAIL`, or `BLOCKED`.
- **Files Changed**: Exact paths of all files created, modified, or deleted.
- **Tests Executed**: Exact commands run (e.g. `timeout 120 node --test tests/*.test.js`), pass/fail counts, and link to raw output log.
- **Verification Seam Distinction**:
  - Distinguish automated unit/integration test results from manual browser verification.
  - Never claim live browser or extension behavior works solely because isolated unit tests pass.
- **Quality Gates**:
  - Parity score check via `python3 parity.py replica/features.csv`.
  - Contrast check via `python3 contrast.py replica/design/tokens.json`.
  - Manifest and security linting.
- **Remaining Issues, Blockers & Unverified Behaviors**: Transparent documentation of edge cases, pending manual browser steps, or incomplete scope.
- **Next Recommended Actions**: Actionable guidance for the subsequent session or task.

## 3. History Preservation
- Never overwrite, truncate, or delete historical audit files in `replica/audit/`.
- Never claim features are complete or verified without real logs backing the claim.
