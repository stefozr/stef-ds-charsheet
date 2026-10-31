# Changelog

All notable changes to this module are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-10-31

First public release. The sheets are the Evolved Hero Sheet and
the Evolved Monster Sheet.

### Features
- Compact hero and monster sheets built on the Draw Steel system's own sheets: every roll, action and drop behaves
  as in the system sheet.
- Header with the portrait and a dark vitals strip, origin pills, level badge, XP progress, full-width
  characteristic badges and a combat strip (Size, Stability, Speed, Disengage, Potency); the hero's class art
  behind it.
- Chip sidebar for immunities, weaknesses, skills and languages; collapsible, searchable item tables with
  click-to-expand rows.
- Edit in place behind a lock switch; confirmations for Respite and spending a Recovery.
- Settings: use as the default sheets, accent colour, portrait shape, class art.

## Before 1.0 (private development as "Draw Steel: Tidy Sheet")

### 0.3.0 (2026-10-31)

- Hero header: the hero's class artwork (`assets/<Class>.webp`, images supplied by Stefan: Beastheart, Censor,
  Conduit, Elementalist, Fury, Null, Shadow, Summoner, Tactician, Talent, Troubadour) fills the header behind the
  portrait and text. The header then uses dark colours in both sheet themes, with a scrim that darkens the art behind
  the text; cards are slightly see-through. The art follows the class item (changing or removing it updates the
  header). Class found by `_dsid`, else by the class name (so a homebrew Beastheart item also matches); no class or no
  matching image → the plain header. Monster sheets are unchanged.
- Client setting **class art in the header** (on by default).
- Edit-mode inputs in the art header use dark input colours in light theme too.
- New pure helper `classArtFile` (tested).

### 0.2.1 (2026-10-31)

- Hero header: the XP bar is shorter, and XP, Victories and Recovery share one column width. "Recovery Value" is now
  "Recovery" (the hover tooltip still explains it).

### 0.2.0 (2026-10-30)

Second-look feedback from Stefan (empty header space, sidebar hard to follow):
- Characteristics stretch to the full width. A combat strip below them shows Size, Stability, Speed (with movement
  types), Disengage and Potency (W / A / S) in the same five columns. The info column spreads to the portrait's
  height, so the strip ends level with the vitals.
- XP has a thin progress bar towards the next level.
- Stamina bar: the winded threshold line is gone (it cut through the centred values); the fill still turns orange
  when winded.
- Vitals cards (Recoveries, heroic resource, Surges, Epic): icon on top, value, label underneath, centred, values on
  one line across the cards. The heroic resource icon depends on the
  class (Essence sparkles, Wrath gavel, Piety praying hands, …; fallback flame).
- Recovery Value is shown next to Victories (play and edit mode). Spending a recovery (Recoveries label) asks for
  confirmation first; with none left the system's error shows without a dialog.
- Sidebar, play mode: Immunities (green), Weaknesses (red), Skills (grouped by skill group) and Languages as chips;
  empty lists show "None". Combat, Movement and Potency left the sidebar (they are in the header strip).
- Edit mode edits things where they are shown:
  - combat strip: Size (number + T/S/M/L letter when size 1), Stability, Speed, Disengage inputs; movement types as
    icon toggles under Speed (Hover appears with Fly or Teleport); the system's specialized combat dialog (saves,
    turns) is a small gear in the Stability tile;
  - hero characteristics are inputs in the badges (base values, like the system dialog; advancement picks shown as
    a small "+N"); the characteristics gear is gone;
  - sidebar: Immunities / Weaknesses editors (set entries with value and ×, plus a type dropdown + value + "+" to
    add), skills and languages tags left-aligned as chips. The system's wide Stats partials are no longer used.
- Expanding a row near the bottom of a tab scrolls the tab so the whole description is visible (never past the row's
  own top, so long descriptions start at their heading).
- World setting **use as default** (on by default): makes these sheets, or when unticked the Draw
  Steel sheets, the default hero / monster sheets by writing core's default-sheet choice (same as Configure Default
  Sheets). At start-up a stored default that no longer exists (e.g. the disabled Draw Steel Plus sheet) is repaired
  from this setting.
- New pure helper `damageTraitEdit` (tested).
- New pure helpers `traitChips` / `groupSkills` (tested); the potency partial is replaced by the strip.

### 0.1.1 (2026-10-30)

First-look feedback from Stefan:
- Portrait and vitals strip moved to the top-left of the header; name, origins, level and characteristics to its
  right. Larger characteristic badges, level badge, name and vitals (strip 16rem wide, labels no longer truncated).
- Stamina: label and temporary Stamina on a heading row, the bar shows only value / max; inputs size to their
  content, so 3-digit values fit.
- Item rows: clicking anywhere on the row expands or collapses the description (expanded rows are tinted); the
  chevron is gone, so the controls column only holds ⋮. Clicking the icon uses the ability (rolls the follower /
  project); hover dims it and shows a dice icon. The row toggle is our own action (`dstToggleRow`, same bookkeeping as
  the system's `toggleDocumentDescription`, which needs the chevron).
- Status condition buttons grow for two-line names.
- Respite asks for confirmation first.
- Default sizes: hero 860×880, monster 820×820.

### 0.1.0 (2026-10-30)

First version: compact hero and monster sheets on top of the system sheets (header with characteristic badges,
dark vitals strip, collapsible sidebar, collapsible and searchable item tables, lock switch), accent colour and
portrait shape settings. Replaces the Draw Steel Plus sheets.
