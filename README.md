# Stef's Character Sheets Evolved for Draw Steel

A compact hero and monster (NPC) sheet for the [Draw Steel](https://foundryvtt.com/packages/draw-steel) system in
Foundry VTT. Everything important sits in the header (portrait, vitals, characteristics and a combat strip), the
hero's class art fills the background, and the item tables collapse and filter, so a whole hero fits on one screen.
The sheets are built on the system's own sheet classes, so every roll, action, drag and drop behaves exactly as in
the system sheet. Retainers, objects and parties keep the system sheets.

## Features

- **Header.** Portrait and vitals strip top-left; to their right the name, origin pills (ancestry · culture ·
  career · class · subclasses; monsters: keywords, organization, role), the level badge (with a level-up button when
  an advancement is ready), XP with a progress bar to the next level, Victories and Recovery (monsters: EV, Free
  Strike, and Malice for the Director), and five full-width characteristic badges (click to roll).
- **Class art.** The hero's class artwork fills the header behind the portrait and text, with dark header colours
  and a scrim behind the text. It follows the class item; heroes without a class, or with a class that has no
  artwork, keep the plain header. Art is included for Beastheart, Censor, Conduit, Elementalist, Fury, Null,
  Shadow, Summoner, Tactician, Talent and Troubadour.
- **Combat strip** under the characteristics: Size, Stability, Speed (movement types underneath), Disengage and
  Potency (W / A / S).
- **Portrait + vitals strip** (always dark): Stamina with temporary Stamina and a bar that turns orange when winded
  ("Stamina" spends 2 hero tokens to regain Stamina), Recoveries (click to spend one, asks first), the heroic
  resource with an icon per class, Surges (click to gain surges with a hero token), and the Epic resource from level
  10. Minions in a single squad show the squad's Stamina, like the system sheet. The portrait can be square, round
  or unframed.
- **Chip sidebar** (toggle left of the tabs, remembered per client): Immunities (green), Weaknesses (red), Skills
  grouped by skill group and Languages as chips; monsters also get the *With Captain* toggle.
- **Collapsible rows.** Tabs: Abilities (first), Features, Equipment, Projects, Effects, Biography. Click anywhere on
  an item row to expand its description; click its icon to use the ability (or roll the follower / project); ⋮
  opens the menu. Item tables have headers with a count, collapse on click, a search box per tab (name and keywords,
  every word must match) and expand / collapse all. Collapsed sections and search text are kept per actor for the
  session.
- **Edit in place.** A lock switch in the window header replaces the system's mode toggle. In edit mode the
  characteristic badges become inputs (base values; advancement picks shown as "+N"), the combat strip holds the
  Size, Stability, Speed and Disengage inputs and movement-type toggles (the specialized combat dialog sits behind a
  small gear in the Stability tile), and the sidebar edits Immunities, Weaknesses, Skills and Languages.
- **Respite** and spending a Recovery ask for confirmation first.
- **Accent colour** for table headers, the active tab and the level badge (default crimson `#741b2b`). Light and dark
  follow Foundry's sheet theme.

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL and press Install:

```
https://github.com/stefozr/stef-ds-charsheet/releases/latest/download/module.json
```

Then enable **Stef's Character Sheets Evolved for Draw Steel** in your world's module settings.

## Requirements and compatible modules

| Module | Required? | What it adds or why |
| --- | --- | --- |
| Foundry VTT 14 | Required | Verified on 14.369. |
| Draw Steel system 1.1.2 | Required | The sheets extend the system's own hero and NPC sheets. |

No other module is needed. Modules that hook into the system sheets' item rows keep working, because the rows keep
the system's markup (see *For module authors* below).

## Using the sheets as the default

With the world setting **Evolved sheets: use as default** ticked (the default), the Evolved Hero Sheet and Evolved
Monster Sheet are the default sheets for heroes and monsters. Unticking it makes the Draw Steel sheets the default
again. The setting writes the same choice as *Configure Default Sheets*; actors with their own sheet choice (the
sheet selector in a sheet's title bar) keep it. If a stored default sheet no longer exists, for example after
another sheet module was disabled, the sheets repair the default from this setting at start-up.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Evolved sheets: use as default | world | Makes the Evolved sheets (or, unticked, the Draw Steel sheets) the default hero and monster sheets. On by default. |
| Evolved sheets: accent colour | client | Colour of the table headers, the active tab underline and the level badge. Default `#741b2b`. |
| Evolved sheets: portrait shape | client | Square, round or no frame. |
| Evolved sheets: class art in the header | client | Shows the hero's class artwork behind the hero header. On by default. |

The sidebar's open or closed state is remembered per client (hidden setting).

## API

`game.modules.get("stef-ds-charsheet").api` provides:
- `EvolvedHeroSheet`, `EvolvedNPCSheet`: the sheet classes (registered as `stef-ds-charsheet.EvolvedHeroSheet` and
  `stef-ds-charsheet.EvolvedNPCSheet`).

## Known limitations

- Only heroes and monsters get the new sheets; retainers, objects and parties keep the system sheets.
- The templates follow the Draw Steel 1.1.2 sheet templates. A system update that adds fields or actions to its own
  sheets needs a matching module update before they appear here (the sidebar includes the system's stats and
  biography partials directly, so changes there arrive on their own).
- Class art is matched by the class's Draw Steel id, else by its name; homebrew classes with other names keep the
  plain header.

## Uninstalling

Disable the module. Heroes and monsters fall back to the Draw Steel sheets; untick *use as default* first if you
want the default-sheet choice cleared as well. Client settings stay in each browser's local storage and do nothing.

## For module authors

`scripts/sheets.mjs` subclasses the system's `DrawSteelHeroSheet` / `DrawSteelNPCSheet` through `EvolvedSheetMixin`
(`scripts/evolved-mixin.mjs`). Every action, context preparation, drop handler and form submission is the system's
own; only templates and CSS change, plus:

- the system "stats" tab is dropped; its context feeds the new `sidebar` part (`_preparePartContext("sidebar")` calls
  the system with `"stats"`), and a render request for `stats` is mapped to `header` + `sidebar`;
- languages moved from the biography tab to the sidebar, and director notes are shown only to the Director;
- rows keep the markup other modules rely on: `li.item.draggable.expandable-document[data-document-uuid]`,
  `.name > .label + .keywords`, `.document-description` (the chevron is replaced by the row-wide `cseToggleRow`
  action), `.effect-list-container .effect-create`, `[data-setting="malice"]` in the NPC `header` part.

The sheets' root element has the class `ds-cse`; the module's own classes and CSS variables use the `cse-` prefix.

Tests: `node tests/helpers.mjs` (search matching, percentages, stamina meter, trait chips, skill groups, class art
lookup).

## Stef's modules

| Module | What it does |
|---|---|
| [Stef's Automation Suite for Draw Steel](https://github.com/stefozr/stef-ds-automation) | Applies ability results per target (damage, conditions, forced movement, saves, triggered actions, summons, areas) with undo, plus the automation library and editor. |
| [Stef's Quality of Life Improvements for Draw Steel](https://github.com/stefozr/stef-ds-qol) | Small fixes and table conveniences for the Draw Steel system and the Combat Tools family. |
| [Stef's Auto FX for Draw Steel](https://github.com/stefozr/stef-ds-fx) | Sequencer animations for abilities, scaled by tier, per target with the Automation Suite. |
| [Stef's Character Sheets Evolved for Draw Steel](https://github.com/stefozr/stef-ds-charsheet) | A compact hero and monster sheet with class art, collapsible rows and a combat strip. |
| [Stef's Health Overlay](https://github.com/stefozr/stef-health-overlay) | Injury overlays on tokens by remaining Stamina / HP (Draw Steel and D&D 5e). |

## License

MIT (see [LICENSE](LICENSE)). The class art in `assets/` is © 2026 Stefan, included under the module's MIT license.
The templates follow the Draw Steel system's MIT-licensed templates (© 2025 MetaMorphic Digital), and the bundled
fonts (Roboto Condensed, Signika Negative) are under the SIL Open Font License 1.1: see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Stef's Character Sheets Evolved for Draw Steel is an independent product and is not affiliated with, endorsed or
sponsored by MCDM Productions, LLC. Draw Steel is a trademark of MCDM Productions, LLC.
