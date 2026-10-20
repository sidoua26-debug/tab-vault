# Changelog — Tab Vault

All notable changes to the Tab Vault project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-20

### Added
- **Clean-Room Manifest V3 Architecture**: Modern service worker background runner, zero background page polling, event-driven lifecycle.
- **One-Click Stash & Restore**: Fast tab collapse into dated session groups with pinned/incognito protection and non-http(s) scheme filtering.
- **Defense-in-Depth Disaster Recovery**:
  - Three-tier wipe detection (local storage wipe vs. empty vault vs. normal restore).
  - Automated 3-slot rolling JSON rotation backups saved to Downloads.
  - Emergency 1-click restore banner when storage wipe is detected.
  - Atomic write-verify-swap mechanism with deep structural key equality verification.
- **Authoritative Baseline Architecture**: Centralized baseline tab counter (`baseline.js`) strictly derived from active group contents and sync points, preventing false positive wipe alarms.
- **Storage Self-Healing & Reconciliation**: Automatic detection and purging of unindexed orphan `grp_*` keys on startup and via options modal "Repair Storage" action.
- **5-State Rolling Snapshots**: In-memory and storage ring buffer allowing instantaneous 1-click rollback of vault states before major destructive operations.
- **Full OneTab Compatibility**: Plain-text import and export (`url | title` and bare URLs) with double-newline separation and duplicate URL stripping.
- **Omnibox Integration**: Real-time address bar keyword search (`tv <query>`) with suggested matches.
- **In-Vault Instant Search**: Substring and multi-token search across titles and URLs with keyboard shortcut (`/` or `Ctrl+F`).
- **Drag-and-Drop Organization**: Tab reordering within groups, cross-group dragging, and new-group creation dropzones.
- **Multi-Select Batch Actions**: Checkboxes for selective tab restore, batch delete, and batch move to new collections.
- **Quick List / Starred Links**: Individual tab starring (`★`) with dedicated top-level quick link pill aggregation.
- **30-Day Trash Bin & Instant Undo**: Accidental tab and group deletions are protected with an instant 15-second undo toast and 30-day soft-delete retention.
- **Group Locking & Renaming**: Inline editable group titles, Star & Pin priority groups, and Lock groups (🔒) to preserve sessions across batch restores.
- **Custom User Preferences**:
  - Configurable restore window target (current vs. new window).
  - Configurable restore retention policy (remove vs. keep in vault).
  - Startup launch preference.
  - Duplicate URL stripping toggle.
  - Lazy tab restore to prevent browser freezing during massive batch restores.
- **Accessible Dual Theme**: Native Light and Dark themes with 100% WCAG AA contrast compliance (20/20 verified pairs).
- **Automated CI & Real-Browser E2E Harness**: Comprehensive test suite with 56 unit tests, Puppeteer headless Chromium E2E verification, and sub-100ms 500-tab benchmark.
- **Professional Chrome Web Store Brand & Marketing Suite**: Complete visual redesign including master vector logo and micro-optimized toolbar icons (16/32/48/128/256/512), 6 benefit-driven 1280x800 marketing screenshots with authentic UI mockups, 440x280 small promo tile, and 1400x560 marquee promo banner.
