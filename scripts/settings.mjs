export const MODULE_ID = "stef-ds-charsheet";

export const SETTINGS = Object.freeze({
  accentColor: "accentColor",
  portraitShape: "portraitShape",
  classArt: "classArt",
  sidebarOpen: "sidebarOpen",
  defaultSheet: "defaultSheet",
});

/** Our sheet classes per actor type, and the system classes to fall back to. */
const SHEET_TYPES = [
  { type: "hero", sheet: "EvolvedHeroSheet", system: () => ds.applications.sheets.DrawSteelHeroSheet },
  { type: "npc", sheet: "EvolvedNPCSheet", system: () => ds.applications.sheets.DrawSteelNPCSheet },
];

/**
 * Make the Evolved sheets (or the system sheets) the default hero / monster sheets by writing the core "sheetClasses"
 * setting, the same one Configure Default Sheets writes; core then switches every client and closes open sheets.
 * Actors with their own sheet choice keep it. Only the active GM writes.
 */
export async function applyDefaultSheets(useEvolved) {
  if (game.user !== game.users.activeGM) return;
  const setting = foundry.utils.deepClone(game.settings.get("core", "sheetClasses") ?? {});
  setting.Actor ??= {};
  for (const { type, sheet, system } of SHEET_TYPES) {
    const sheets = Object.values(CONFIG.Actor.sheetClasses[type] ?? {});
    const target = useEvolved
      ? sheets.find(s => s.id === `${MODULE_ID}.${sheet}`)
      : sheets.find(s => s.cls === system()) ?? sheets.find(s => !s.id.startsWith(`${MODULE_ID}.`));
    if (target) setting.Actor[type] = target.id;
  }
  await game.settings.set("core", "sheetClasses", setting);
}

/**
 * At ready: if the stored default hero / monster sheet is no longer registered (e.g. a disabled module's sheet), no
 * sheet is the default for that type; apply this module's setting so there is one again.
 */
export async function repairDefaultSheets() {
  const stale = SHEET_TYPES.some(({ type }) => !Object.values(CONFIG.Actor.sheetClasses[type] ?? {}).some(s => s.default));
  if (stale) await applyDefaultSheets(game.settings.get(MODULE_ID, SETTINGS.defaultSheet));
}

export const DEFAULT_ACCENT = "#741b2b";

/** Re-render every open Evolved sheet (after a look setting changes). */
export function rerenderSheets() {
  for (const app of foundry.applications.instances.values()) {
    if (app.element?.classList.contains("ds-cse")) app.render();
  }
}

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.defaultSheet, {
    name: "DSCSE.Settings.DefaultSheet.Name",
    hint: "DSCSE.Settings.DefaultSheet.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => applyDefaultSheets(value),
  });
  game.settings.register(MODULE_ID, SETTINGS.accentColor, {
    name: "DSCSE.Settings.AccentColor.Name",
    hint: "DSCSE.Settings.AccentColor.Hint",
    scope: "client",
    config: true,
    type: new foundry.data.fields.ColorField({ nullable: false, initial: DEFAULT_ACCENT }),
    default: DEFAULT_ACCENT,
    onChange: rerenderSheets,
  });
  game.settings.register(MODULE_ID, SETTINGS.portraitShape, {
    name: "DSCSE.Settings.PortraitShape.Name",
    hint: "DSCSE.Settings.PortraitShape.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      square: "DSCSE.Settings.PortraitShape.Square",
      round: "DSCSE.Settings.PortraitShape.Round",
      transparent: "DSCSE.Settings.PortraitShape.Transparent",
    },
    default: "square",
    onChange: rerenderSheets,
  });
  game.settings.register(MODULE_ID, SETTINGS.classArt, {
    name: "DSCSE.Settings.ClassArt.Name",
    hint: "DSCSE.Settings.ClassArt.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: rerenderSheets,
  });
  game.settings.register(MODULE_ID, SETTINGS.sidebarOpen, {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });
}
