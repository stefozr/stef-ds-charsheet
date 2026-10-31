/**
 * Stef's Character Sheets Evolved for Draw Steel — a compact hero and NPC sheet built on the system's own sheet
 * classes.
 * See README.md for the layout and what each part reuses from the system.
 */

import { MODULE_ID, SETTINGS, registerSettings, repairDefaultSheets } from "./settings.mjs";
import { percent } from "./helpers.mjs";
import { NAMED_PARTIALS, defineSheets } from "./sheets.mjs";
import { registerLegacyMigration } from "./legacy-migration.mjs";

/** The id this module had before 1.0 ("Draw Steel: Tidy Sheet"), and its sheet class names. */
const LEGACY_ID = "ds-tidy-sheet";
const LEGACY_SHEETS = {
  [`${LEGACY_ID}.TidyHeroSheet`]: `${MODULE_ID}.EvolvedHeroSheet`,
  [`${LEGACY_ID}.TidyNPCSheet`]: `${MODULE_ID}.EvolvedNPCSheet`,
};

const legacy = registerLegacyMigration({
  moduleId: MODULE_ID, legacyIds: [LEGACY_ID], version: "1.0.0",
  // Sheet choices name the sheet class by id: the default sheets in core's "sheetClasses" setting, and each actor's
  // own choice in `flags.core.sheetClass` (an unlinked token's own choice lives in its delta).
  extra: async ({ dryRun, report, update, allDocuments }) => {
    const defaults = foundry.utils.deepClone(game.settings.get("core", "sheetClasses") ?? {});
    let changed = false;
    for (const [documentName, types] of Object.entries(defaults)) {
      for (const [type, id] of Object.entries(types ?? {})) {
        if (!LEGACY_SHEETS[id]) continue;
        types[type] = LEGACY_SHEETS[id];
        report.extra.push(`default ${documentName} ${type} sheet: ${id} -> ${types[type]}`);
        changed = true;
      }
    }
    if (changed && !dryRun) await game.settings.set("core", "sheetClasses", defaults);

    for (const actor of allDocuments()) {
      if (actor.documentName !== "Actor") continue;
      const source = actor.isToken ? actor.token?.delta?._source : actor._source;
      const id = source?.flags?.core?.sheetClass;
      if (!LEGACY_SHEETS[id]) continue;
      if (await update(actor, { "flags.core.sheetClass": LEGACY_SHEETS[id] })) {
        report.extra.push(`${actor.uuid} sheet: ${id} -> ${LEGACY_SHEETS[id]}`);
      }
    }
  },
});

Hooks.once("init", () => {
  registerSettings();
  game.modules.get(MODULE_ID).api = { migrateLegacy: legacy.migrate };
  Handlebars.registerHelper("csePercent", (value, max) => percent(value, max));
  foundry.applications.handlebars.loadTemplates(NAMED_PARTIALS);

  if (!globalThis.ds?.applications?.sheets?.DrawSteelHeroSheet) {
    console.error(`${MODULE_ID} | the Draw Steel sheet classes were not found; the Evolved sheets are not registered.`);
    return;
  }
  const { EvolvedHeroSheet, EvolvedNPCSheet } = defineSheets();
  const Actors = foundry.documents.collections.Actors;
  // A stored choice in core's default sheets wins over makeDefault; the setting's onChange writes that choice.
  const makeDefault = game.settings.get(MODULE_ID, SETTINGS.defaultSheet);
  Actors.registerSheet(MODULE_ID, EvolvedHeroSheet, { types: ["hero"], makeDefault, label: "DSCSE.Sheet.Hero" });
  Actors.registerSheet(MODULE_ID, EvolvedNPCSheet, { types: ["npc"], makeDefault, label: "DSCSE.Sheet.Npc" });
  Object.assign(game.modules.get(MODULE_ID).api, { EvolvedHeroSheet, EvolvedNPCSheet });
  console.log(`${MODULE_ID} | Evolved hero and NPC sheets registered`);
});

Hooks.once("ready", () => repairDefaultSheets());
