# Tab Vault Component Specifications

Dense, distraction-free desktop browser list interface. Zero cloud or social elements.

---

## 1. Button
- **Variants**:
  - `primary`: Solid accent fill (`--color-accent`), text `--color-on-accent`.
  - `secondary`: Surface fill (`--color-surface`), border `--color-border`, text `--color-text`.
  - `ghost`: Transparent background, text `--color-text-muted`, hover surface fill.
  - `danger`: Ghost or solid with `--color-danger`.
- **Sizes**:
  - `sm`: 24px height, 6px horizontal padding, font `xs` (11px).
  - `md`: 28px height, 10px horizontal padding, font `sm` (12px).
- **States**: default, hover, active, focus-visible (2px outline `--color-accent`), disabled.
- **Tokens**: `radius-sm` (3px), `motion-fast` (100ms).
- **A11y**: Native `<button>`, accessible aria-label on icon-only buttons, keyboard tab-stop.

---

## 2. TabRow (Dense 24px Row)
- **Structure**: Favicon (16x16) | Title (truncated with ellipsis) | Close button (ghost).
- **Variants**: standard tab, pinned tab (pin badge/icon).
- **Sizes**: Fixed `--density-row-height` (24px), vertical padding 2px, horizontal padding 6px.
- **States**:
  - `default`: Text `--color-text`.
  - `hover`: Background `--color-surface`, close button appears/highlights.
  - `focus-visible`: 1px dashed or solid focus ring inside row.
  - `drag-over`: 2px top or bottom border indicator (`--color-accent`).
- **A11y**: Role `listitem`, keyboard navigation (arrow keys or tab navigation), Enter/Space to restore tab, Delete/Backspace to soft-delete tab.

---

## 3. TabGroupCard
- **Structure**:
  - Header: Group title / timestamp (13px, bold), tab count badge, actions row:
    - "Restore all" button
    - "Delete all" button
    - "Star" toggle
    - "Lock" toggle
    - "More" menu (Name group, Add note, Export JSON)
  - Body: Vertical stack of `TabRow`s with `--density-item-gap` (4px).
- **States**: default, starred (pinned to top with subtle accent border or star badge), locked (delete button disabled/hidden, restore retains group).
- **Tokens**: Background `--color-bg`, border `--color-border`, margin-bottom `--density-group-gap` (16px).
- **A11y**: Group header marked with appropriate heading level or region label.

---

## 4. DisasterBanner (Recovery Prompt)
- **Structure**:
  - Icon (Shield / Backup icon).
  - Headline: "Disaster Recovery Detected" or "Backup Available".
  - Body: Explains scenario, shows recommended backup filename, date, tab count, and file size.
  - Action row:
    - Primary: "Select Backup File to Restore" (opens native file picker with hint).
    - Secondary: "Dismiss" (ghost).
- **States**:
  - `high-confidence`: Red/Warning accent border for wipes with `sync.hasSavedTabs: true`.
  - `contextual`: Subtle surface alert for signed-out profiles with detected backup.
- **Tokens**: Surface `--color-surface`, border `--color-warning` / `--color-accent`, radius `md`.

---

## 5. Toast (Undo Notification)
- **Structure**: Notification message (e.g., "18 tabs saved. [Undo]") + countdown progress indicator or dismiss icon.
- **Sizes**: Floating bottom-right or bottom-center, height 36px, padding 8px 16px.
- **Tokens**: Background `--color-text`, text `--color-bg`, shadow `--shadow-toast`, radius `md`.
- **A11y**: `role="status"`, `aria-live="polite"`.

---

## 6. SearchInput
- **Structure**: Search icon + dense input field with hotkey badge (`/`) + clear button (`Esc`).
- **Sizes**: Height 28px, font `sm` (12px).
- **Tokens**: Background `--color-surface`, border `--color-border-input`, text `--color-text`.
- **A11y**: Clear accessible label `aria-label="Filter saved tabs"`.
