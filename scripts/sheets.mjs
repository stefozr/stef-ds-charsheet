import { classArtFile } from "./helpers.mjs";
import { MODULE_ID, SETTINGS } from "./settings.mjs";
import { SHEET_TABS, EvolvedSheetMixin } from "./evolved-mixin.mjs";

const T = path => `modules/${MODULE_ID}/templates/${path}`;
const SYS = path => `systems/draw-steel/templates/sheets/actor/shared/partials/${path}`;

const BIO_PARTIALS = ["languages", "biography", "director-notes"].map(p => SYS(`biography/${p}.hbs`));

/** Partials used by name in our templates (registered once at init). */
export const NAMED_PARTIALS = {
  cseActionBar: T("shared/action-bar.hbs"),
  cseStaminaMeter: T("shared/stamina-meter.hbs"),
  cseCombatStrip: T("shared/combat-strip.hbs"),
  cseChipList: T("shared/chip-list.hbs"),
  cseLanguages: T("shared/languages.hbs"),
  cseDamageTraitsEdit: T("shared/damage-traits-edit.hbs"),
};

/** Vitals-card icon of the heroic resource, by class `_dsid` (fallback: a flame). */
const HEROIC_ICONS = {
  censor: "fa-gavel", // Wrath
  conduit: "fa-hands-praying", // Piety
  elementalist: "fa-sparkles", // Essence
  summoner: "fa-sparkles", // Essence
  fury: "fa-paw-claws", // Ferocity
  null: "fa-yin-yang", // Discipline
  shadow: "fa-eye", // Insight
  tactician: "fa-crosshairs", // Focus
  talent: "fa-brain", // Clarity
  troubadour: "fa-masks-theater", // Drama
};

/** Built lazily: the system sheet classes must exist (`globalThis.ds`, set by the system before modules load). */
export function defineSheets() {
  const sheets = ds.applications.sheets;

  class EvolvedHeroSheet extends EvolvedSheetMixin(sheets.DrawSteelHeroSheet) {
    static DEFAULT_OPTIONS = {
      classes: ["cse-hero"],
      position: { width: 860, height: 880 },
      actions: { takeRespite: EvolvedHeroSheet.#takeRespite, spendRecovery: EvolvedHeroSheet.#spendRecovery },
    };

    static PARTS = {
      header: { template: T("hero/header.hbs") },
      tabs: { template: T("shared/tabs.hbs") },
      sidebar: { template: T("hero/sidebar.hbs"), templates: [SYS("biography/languages.hbs")], scrollable: [""] },
      abilities: { template: T("shared/abilities.hbs"), scrollable: [""] },
      features: { template: T("shared/features.hbs"), scrollable: [""] },
      equipment: { template: T("hero/equipment.hbs"), scrollable: [""] },
      projects: { template: T("hero/projects.hbs"), scrollable: [""] },
      effects: { template: T("shared/effects.hbs"), scrollable: [""] },
      biography: { template: T("hero/biography.hbs"), templates: BIO_PARTIALS, scrollable: [""] },
    };

    static TABS = SHEET_TABS(["abilities", "features", "equipment", "projects", "effects", "biography"], "abilities");

    async _prepareHeaderContext(context) {
      // Edit mode: base (source) values, edited inline; advancement picks are added on top by the system.
      context.characteristics = this.actor.system._getCharacteristics(this.isEditMode);
      if (this.isEditMode) {
        for (const [key, count] of Object.entries(this.#characteristicAdvancements())) {
          if (context.characteristics[key]) context.characteristics[key].advancements = count;
        }
      }
      context.editableHeroStamina = this.isEditable && this.isPlayMode;
      const cls = this.actor.system.class;
      context.heroicIcon = HEROIC_ICONS[cls?.system?._dsid] ?? "fa-fire";
      // Class art behind the header (assets/<Class>.webp); the class item changing re-renders the sheet.
      const artFile = cls && game.settings.get(MODULE_ID, SETTINGS.classArt) ? classArtFile(cls.system?._dsid, cls.name) : null;
      // Absolute route: a relative url() in a custom property resolves against the stylesheet using var(), not the page.
      context.classArt = artFile ? foundry.utils.getRoute(`modules/${MODULE_ID}/assets/${artFile}`) : null;
    }

    async _prepareSidebarContext(context) {
      await super._prepareSidebarContext(context);
      context.unfilledLanguage = !!this.actor.system._unfilledTraits?.language?.size;
    }

    /** Characteristic increases picked in advancements, counted like the system's CharacteristicInput dialog. */
    #characteristicAdvancements() {
      const counts = {};
      for (const item of this.actor.items) {
        if (!item.supportsAdvancements) continue;
        for (const advancement of item.getEmbeddedCollection("Advancement").documentsByType.characteristic ?? []) {
          for (const chr of item.getFlag("draw-steel", `advancement.${advancement.id}.selected`) ?? []) {
            counts[chr] = (counts[chr] ?? 0) + 1;
          }
        }
      }
      return counts;
    }

    /** Same as the system action (HeroModel#takeRespite), behind a confirmation. */
    static async #takeRespite(event, target) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "DRAW_STEEL.Actor.hero.TakeRespite", icon: "fa-solid fa-bed" },
        content: `<p>${game.i18n.format("DSCSE.RespiteConfirm", {
          name: foundry.utils.escapeHTML(this.actor.name),
          victories: this.actor.system.hero.victories,
        })}</p>`,
      });
      if (confirmed) await this.actor.system.takeRespite();
    }

    /** Same as the system action (HeroModel#spendRecovery), behind a confirmation; none left → the system's error. */
    static async #spendRecovery(event, target) {
      const recoveries = this.actor.system.recoveries;
      if (recoveries.value > 0) {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: "DSCSE.SpendRecoveryTitle", icon: "fa-solid fa-heart-pulse" },
          content: `<p>${game.i18n.format("DSCSE.SpendRecoveryConfirm", {
            name: foundry.utils.escapeHTML(this.actor.name),
            value: recoveries.recoveryValue,
            left: recoveries.value - 1,
            total: recoveries.max,
          })}</p>`,
        });
        if (!confirmed) return;
      }
      await this.actor.system.spendRecovery();
    }
  }

  class EvolvedNPCSheet extends EvolvedSheetMixin(sheets.DrawSteelNPCSheet) {
    static DEFAULT_OPTIONS = {
      classes: ["cse-npc"],
      position: { width: 820, height: 820 },
    };

    static PARTS = {
      header: { template: T("npc/header.hbs") },
      tabs: { template: T("shared/tabs.hbs") },
      sidebar: { template: T("npc/sidebar.hbs"), templates: [SYS("biography/languages.hbs")], scrollable: [""] },
      abilities: { template: T("shared/abilities.hbs"), scrollable: [""] },
      features: { template: T("shared/features.hbs"), scrollable: [""] },
      effects: { template: T("shared/effects.hbs"), scrollable: [""] },
      biography: { template: T("npc/biography.hbs"), templates: BIO_PARTIALS, scrollable: [""] },
    };

    static TABS = SHEET_TABS(["abilities", "features", "effects", "biography"], "abilities");

    async _prepareHeaderContext(context) {
      context.characteristics = this.actor.system._getCharacteristics(this.isEditMode);
      context.isSingleSquadMinion = this.actor.isMinion && (this.actor.system.combatGroups.size === 1);
      if (context.isSingleSquadMinion) context.combatGroup = this.actor.system.combatGroup;
    }

    _prepareVitals(context) {
      return { ...super._prepareVitals(context), editMax: this.isEditMode };
    }
  }

  return { EvolvedHeroSheet, EvolvedNPCSheet };
}
