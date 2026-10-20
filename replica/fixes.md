# Fix plan: OneTab

Based on 85 real reviews from the Chrome Web Store (October 2026 scrape) analyzed via `reviews.py`.

## 1. What they hate

1. **Catastrophic data loss**: Represents **~10 of 85 reviews (~12%)** in manual review (explicit wipes after reboots, crashes, and v2 update migrations). Note: `reviews.py` reported **13 reviews (15% share)**, which is a blended "Sync and lost data" keyword theme from a single source (`chrome-web-store`) grouping both explicit data wipes and sync/backup requests together:
   - "The whole point is to save your tabs and it got rid of all my saved tabs without notice" (2026-10-18)
   - "Twice now all my tabs have randomly been removed when rebooting my PC. Unless there is some way to recover them I see no reason to recommend something so unreliable." (2026-08-15)
   - "Poped up a update reminder to v2, I clicked yes. Then lost last 5 months tabs. Serious?" (2026-07-06)
   - "What the hell is going on in the July 1st, 2026 update? All my saved tabs have vanished and cannot be recovered. I spent the whole day trying to save them, but there's no viable solution. Everything is like a blank slate." (2026-07-01)
   - "Lost all of 3 month saved data from OneTab. Had backed up that entire data once it got wiped but it happened again today." (2026-06-02)
   - "After actualisation of browser Google, all my tabs are deleted...." (2026-05-30)
   - "It just updated, and ALL the bookmarks inside the extension suddenly disappeared." (2026-03-26)
   - "keeps resseting and deleting everything"

2. **Accidental collapse and destructive restore** (6 reviews):
   - "The default action when the button is pressed... archives all tabs when the button is pressed without asking. I'm using it for less than a week and pressed it by mistake like 3 times and had to restore 250 tabs manually" (2026-04-12)
   - "After the third time of accidentally clicking on this removing all my tabs and not bringing them all back once restored, Im done with being patient with this extension." (2026-08-02)
   - "BE CAREFUL. This just ruined my day... If you have an existing arrangement of windows and tabs, AVOID THIS. I just installed it, it 'takes away' your tabs not remembering where they belong if you restore them. It opened up multiple new windows of the same tabs, making a total mess and causing Chrome to consume so much memory the it froze and was killed by the OS" (2026-05-18)

3. **v2 rewrite complexity and feature bloat** (4 reviews):
   - "This extension used to be awesome and I recommend it to many people for years. Last update is catastrophic, not to say worst. Total BS, so many useless features and garbage keeps feeding itself even tho I never delete anything !!!" (2026-06-23)
   - "I'm not a fan of the latest update. I liked it better when it was a simple program. The newer features distract from it's original purpose." (2026-04-13)
   - "wholesale 'upgrade' has added so much with such complexity that I'm now unable to use OneTab at all for the purpose I rely on it to provide." (2026-04-05)

4. **Cannot open dashboard without forcing a tab collapse** (1 review + widespread friction):
   - "The Extension pinned button should have a 'go to OneTab page' or something. Often I onetab a bunch of browser tabs and then later im trying to open one of those stored tabs, but i cannot access the Onetab page unless i literally open a placeholder tab and then force One-tab collapse a useless page just so that the onetab central page opens up..." (2026-07-23)

## 2. What is missing

1. **Automated file backup**: Users dread manual copy-pasting to text files every day. Relying solely on browser internal storage (`chrome.storage.local` / LevelDB) leaves data vulnerable to profile corruption, sudden power loss, or browser upgrades.
2. **Export/import fidelity**: Keeping group names and folder structure ("When exporting and importing, the names of the tab groups are not included." - 2026-06-17).
3. **Safe-by-default collapse**: Avoiding catastrophic accidental collapse of entire multi-window workspaces.
4. **Wipe detection & fast disaster recovery**: Noticing when the local store has been initialized blank after an update/crash and offering immediate recovery from external backups.

## 3. What is unsolved

- **Real disaster recovery without cloud surveillance**: Users want to be shielded from browser profile corruption and accidental mass deletes without having to hand their browsing history to a third-party proprietary sync cloud.

## 4. The Fix Plan

| # | Problem | What we build | Size | Skill | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Wiped tabs on browser update/reboot/crash | Scheduled auto-export of JSON backups to Downloads (`chrome.alarms` + `chrome.downloads`) + startup empty-store wipe detection with 1-click restore | M | `replica-backend` | 13 reviews in `Sync and lost data` (score 7.8) |
| 2 | Accidental in-extension deletes | Rolling in-extension snapshots and undo toast (protects against accidental misclicks within the app) | S | `replica-build` | Reviews from Josh S, Anthony Tuttle |
| 3 | Accidental mass-collapse of open windows | Safe-by-default collapse (clear confirmation option + instant undo toast on collapse) | S | `replica-build` | Reviews from Kulagin, Charles Malo, Itamar Rogel |
| 4 | Export/import loses group names & folders | High-fidelity JSON export preserving group titles, notes, and folders + seamless OneTab plain-text importer | S | `replica-build` | Reviews from Wenqing Yang, Emre Coskun |
| 5 | Memory freeze when restoring large groups | Lazy / discarded tab restore option (`chrome.tabs.create({ discarded: true })`) | S | `replica-build` | Reviews from Itamar Rogel, Bart |

## 5. The Angle & Revised Differentiator

### The Angle
**For tab hoarders, developers, and researchers who love instant one-click memory savings but got burned by OneTab losing their tabs during browser reboots, profile wipes, or accidental clicks: our extension provides defense-in-depth disaster recovery with scheduled external JSON auto-backups, startup wipe detection, and safe-by-default collapse—simple, unbloated, and 100% offline.**

### The Three-Part Differentiator Architecture:
1. **External Disk Protection**: Scheduled auto-export of a JSON backup file directly to the user's `Downloads` directory via `chrome.alarms` and `chrome.downloads`. Because this lives outside the browser's volatile profile/LevelDB directory, it survives browser profile resets, re-installations, and update corruptions.
2. **Startup Wipe Detection & One-Click Disaster Recovery**: On extension startup, if the tab list is detected to be empty or missing previous state while local backup files exist, display a prominent recovery prompt to restore the latest JSON snapshot in one click.
3. **In-App Safety Net**: Rolling in-extension snapshots and instant Undo toasts strictly for recovering from accidental in-app tab or group deletions.
