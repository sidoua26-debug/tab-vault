# Recon map: OneTab (Chrome Extension - Manifest V3)

Scope: Core tab suspension/consolidation, group management, local persistence, search, export/import, and user options
For: Local-first, privacy-focused Manifest V3 Chrome extension
Date: 2026-10-20

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Chrome Web Store listing | https://chromewebstore.google.com/detail/onetab/chphlpgkkbolifaimnlloiipkdnihall?hl=en | Overview, user feedback, store metadata, permissions |
| 2 | Official Help Center | https://www.one-tab.com/help | Core features, drag & drop, selection, shortcuts, menus |
| 3 | Official Marketing Site | https://www.one-tab.com/ | Positioning, 95% memory savings premise, privacy model |
| 4 | Chrome Extension MV3 API Docs | https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3 | Service worker lifecycle, chrome.tabs, chrome.storage |

## Core loop

One click consolidates all open browser tabs into an organized, low-memory list that users can search, organize, and restore on demand.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Main Tab Dashboard | Internal tab `chrome-extension://<id>/dashboard.html` opened on toolbar click or command | Browse, manage, search, and restore saved tab groups | SearchBar, GroupList, TabCard, GroupHeaderControls, QuickList | empty, populated, filtered-search, reordering |
| S02 | Options & Settings | `chrome-extension://<id>/options.html` or linked from S01 header | Configure capture rules, restore targets, duplicate filtering, theme | OptionSections, RadioGroups, CheckboxSwitches, ExcludeList | default, saved, modified |
| S03 | Import / Export View | Modal overlay or dedicated sub-page on S01 | Backup and restore tab links in plain text format | TextArea, CopyButton, ImportButton, FormatInstructions | empty, filled, validation-error |

## Flows

```
F01 One-click window tab consolidation
    Browser active window -> Click extension action icon
    S01 Dashboard focuses with newly prepended group containing all window tabs
    happy path clicks: 1
    edge: only 1 tab open (dashboard already open), pinned tabs present, incognito window

F02 Restore tabs from dashboard
    S01 Dashboard -> Click single tab link OR click "Restore all"
    Tabs open in browser window (current or new according to settings); items removed or retained based on options
    happy path clicks: 1
    edge: locked group (items must not be deleted on restore), window was closed

F03 Selective capture via context menu
    Right-click inside any web page -> Extension context menu -> "Send only this tab" / "Send tabs to right"
    Target tabs close, appended/prepended to S01 dashboard
    happy path clicks: 2
    edge: protected chrome:// or chrome-extension:// URLs, domain in exclusion list

F04 Group organization & protection
    S01 Dashboard -> Click "More..." on group -> Rename, Lock, or Star group
    Group updates title, gets locked against accidental deletion, or pins to top
    happy path clicks: 2
    edge: dragged tabs between groups, delete requested on locked group (prevented)

F05 Fast search & navigation
    S01 Dashboard -> Type '/' or click search bar -> Enter keywords
    Instant client-side filter hides non-matching groups and tab items
    happy path clicks: 1 (or 0 with '/' key)
    edge: no matches state, special characters, URL matching vs title matching

F06 Data backup & migration
    S01 Dashboard -> "Export / Import URLs" -> Copy text list or paste new list -> Click "Import"
    Validates URLs, generates new timestamped TabGroup in S01
    happy path clicks: 3
    edge: malformed URLs, empty text, mixed URL/title formatting
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| SearchBar | full-width, compact | empty, focused, filled | S01 |
| TabGroupContainer | standard, locked, starred | collapsed, expanded, dragging | S01 |
| TabItemRow | default, starred, selected | default, hover, dragging, selected | S01 |
| FaviconIcon | domain icon, fallback globe | loading, rendered, fallback error | S01 |
| ActionButton | primary, secondary, ghost, danger | default, hover, active, disabled | S01, S02, S03 |
| ContextDropdownMenu | group menu, selection menu | closed, open | S01 |
| SettingsToggle | switch, checkbox, radio | on, off, disabled | S02 |
| PlainTextEditor | import textarea, export textarea | readonly, editable, focused | S03 |

## Inferred data model

```
TabGroup:
  id: string (uuid / timestamp)
  createdAt: number (epoch ms)
  title: string (optional custom name, defaults to date-time string)
  isLocked: boolean (default false)
  isStarred: boolean (default false)
  tabs: TabItem[]

TabItem:
  id: string (uuid)
  url: string
  title: string
  favIconUrl: string (optional)
  pinned: boolean
  isStarred: boolean (optional)
  createdAt: number

Settings:
  restoreWindow: "current" | "new"
  restoreRetention: "remove" | "keep"
  pinnedTabs: "ignore" | "capture"
  dropDuplicates: boolean
  openDashboardOnStartup: boolean
  theme: "system" | "light" | "dark"
  excludedDomains: string[]
```

Evidence: S01 UI elements, OneTab help pages, options specifications.
Confidence: high

Relationships:
- 1 TabGroup has N TabItems (1-to-many, ordered).
- Settings is a single global configuration object.

## Feature matrix

See `features.csv`.
- Must-have (MVP parity): 12
- Must-have (Differentiator / Value-add): 2
- Should-have: 20 (including 1 differentiator: lazy restore)
- Could-have: 2
- Skip: 2 (cloud sharing web service & cloud sync backend)

## Out of scope (cannot or should not be cloned)

- Proprietary cloud web hosting for shared tab lists (`one-tab.com/page/...`) — keep local-first.
- Proprietary multi-device cloud sync server — substitute with direct JSON / text backup & export.
- Original names, logos, branding, and proprietary assets.

## Size

Screens: 3 (Dashboard, Options, Import/Export).
Flows: 6.
Entities: 3 core (TabGroup, TabItem, Settings).
Hard parts: MV3 service worker lifecycle constraints, tab drag-and-drop state synchronization, drag to empty space to split groups, chrome.storage quota handling.
Size: M
