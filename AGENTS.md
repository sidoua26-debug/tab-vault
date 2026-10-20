# Project Instructions: Tab Vault

## Mandatory Audit & Reporting Standard
Every task, bug fix, feature implementation, refactoring, and milestone performed in this workspace MUST produce a persistent audit trail before completion.

1. **Task Audit File**: Create `replica/audit/NN-<task-name>.md` with the full 9-point audit report.
2. **Cumulative Audit Report**: Append a dated entry to `AUDIT_REPORT.md` at the project root.
3. **Raw Execution Logs**: Redirect exact test and verification outputs into `replica/audit/logs/NN-<name>.txt`. Always run test commands with an explicit timeout: `timeout 120 node --test tests/*.test.js`.
4. **Truth & Verification Standard**:
   - Explicitly distinguish automated mock/unit test results from manual browser verification.
   - Do not claim extension or UI functionality works in Chrome solely because unit tests passed.
   - Report the final verdict as `PASS`, `PASS WITH WARNINGS`, `FAIL`, or `BLOCKED`.
5. **Preservation**: Never overwrite or delete prior audit reports or logs.

See detailed rules in [audit-reporting.md](file:///.agents/rules/audit-reporting.md).
