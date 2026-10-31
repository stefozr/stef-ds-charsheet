/**
 * Shared behaviour of the Evolved hero and NPC sheets. Applied on top of the system sheet classes, so every system action,
 * context preparation, drag & drop and form submission is inherited unchanged; this layer only swaps templates and adds:
 *  - a "sidebar" part built from the system "stats" context (the stats tab itself is dropped),
 *  - a lock switch in the window header replacing the system's toggle-mode frame button,
 *  - collapsible item tables, a per-tab search box and a collapsible sidebar,
 *  - the accent colour and portrait shape client settings.
 */

import { MODULE_ID, SETTINGS } from "./settings.mjs";
import { damageTraitEdit, groupSkills, matchesSearch, staminaMeter, traitChips } from "./helpers.mjs";

/** Per actor (uuid): collapsed table sections and per-tab search text. Kept for the session. */
const collapsedSections = new Map();
const searchQueries = new Map();

const stateFor = (map, uuid, create) => {
  if (!map.has(uuid)) map.set(uuid, create());
  return map.get(uuid);
};

/** Movement types in the edit-mode toggles of the Speed tile, in display order, with their icons. */
const MOVEMENT_ICONS = {
  walk: "fa-person-walking",
  fly: "fa-feather",
  swim: "fa-person-swimming",
  climb: "fa-mountain",
  burrow: "fa-shovel",
  teleport: "fa-wand-sparkles",
};

/** Inputs that belong to sheet widgets, not the document: their change events must not submit the form. */
const UNBOUND_INPUTS = ".cse-search, .cse-iw-type, .cse-iw-value";

export const SHEET_TABS = (tabs, initial) => ({
  primary: { tabs: tabs.map(id => ({ id })), initial, labelPrefix: "DRAW_STEEL.Actor.Tabs" },
});

export function EvolvedSheetMixin(Base) {
  return class EvolvedSheet extends Base {
    static DEFAULT_OPTIONS = {
      classes: ["ds-cse"],
      actions: {
        cseToggleRow: EvolvedSheet.#onToggleRow,
        cseToggleSection: EvolvedSheet.#onToggleSection,
        cseExpandAll: EvolvedSheet.#onExpandAll,
        cseCollapseAll: EvolvedSheet.#onCollapseAll,
        cseToggleSidebar: EvolvedSheet.#onToggleSidebar,
        cseToggleMovement: EvolvedSheet.#onToggleMovement,
        cseAddDamageTrait: EvolvedSheet.#onAddDamageTrait,
        cseRemoveDamageTrait: EvolvedSheet.#onRemoveDamageTrait,
      },
    };

    /* -------------------------------------------------- */
    /*   Rendering configuration                          */
    /* -------------------------------------------------- */

    /** @inheritdoc */
    _configureRenderOptions(options) {
      // System code may re-render the old "stats" part (e.g. after a recovery); its content now lives here.
      if (Array.isArray(options.parts) && options.parts.includes("stats")) {
        options.parts = [...new Set(options.parts.flatMap(p => (p === "stats" ? ["header", "sidebar"] : [p])))];
      }
      super._configureRenderOptions(options);
    }

    /** @inheritdoc */
    _getFrameButtons(options) {
      return super._getFrameButtons(options).filter(b => b.action !== "toggleMode");
    }

    /** @inheritdoc */
    async _renderFrame(options) {
      const frame = await super._renderFrame(options);
      const header = frame.querySelector(".window-header");
      if (header && this.isEditable) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cse-mode-switch";
        button.dataset.action = "toggleMode";
        button.dataset.tooltip = "DRAW_STEEL.SHEET.ToggleMode";
        button.setAttribute("aria-label", game.i18n.localize("DRAW_STEEL.SHEET.ToggleMode"));
        button.innerHTML = '<span class="cse-switch-thumb"><i class="fa-solid fa-lock" inert></i></span>';
        header.prepend(button);
      }
      return frame;
    }

    /* -------------------------------------------------- */
    /*   Context                                          */
    /* -------------------------------------------------- */

    /** @inheritdoc */
    async _preparePartContext(partId, context, options) {
      if (partId === "sidebar") {
        await super._preparePartContext("stats", context, options);
        context.languages = this._getLanguages();
        await this._prepareSidebarContext(context);
        return context;
      }
      await super._preparePartContext(partId, context, options);
      if (partId === "header") {
        // The combat strip shows what the system builds for its stats part (size / stability tooltip, movement list).
        context.combatTooltip = this._getCombatTooltip();
        context.movement = this.actor.system._getMovement?.();
        if (this.isEditMode) this.#prepareStripEditContext(context);
        await this._prepareHeaderContext(context);
        context.vitals = this._prepareVitals(context);
      }
      return context;
    }

    /** Edit-mode inputs of the combat strip: size letters and the movement-type toggles (source values). */
    #prepareStripEditContext(context) {
      const source = this.actor.system._source;
      context.cseSizeLetters = Object.entries(ds.CONFIG.sizes).map(([key, { label }]) => ({
        key, label: game.i18n.localize(label), selected: source.combat.size.letter === key,
      }));
      const types = new Set(source.movement.types);
      context.cseMovement = Object.entries(MOVEMENT_ICONS)
        .filter(([key]) => ds.CONFIG.speedOptions.includes(key))
        .map(([key, icon]) => ({
          key, icon, active: types.has(key),
          label: game.i18n.localize(CONFIG.Token.movement.actions[key]?.label ?? key),
        }));
      context.cseCanHover = types.has("fly") || types.has("teleport");
      context.cseHover = !!source.movement.hover;
    }

    /** Subclass hook: extra header context (characteristics, minion squad, …). */
    async _prepareHeaderContext(context) {}

    /** Sidebar chips (play mode): immunities, weaknesses, skills grouped by skill group, languages. Subclasses call super. */
    async _prepareSidebarContext(context) {
      const system = this.actor.system;
      const labels = system._getImmunitiesWeaknesses?.().labels ?? {};
      const skills = system.skills?.value;
      context.cseChips = {
        immunities: traitChips(system.damage?.immunities, labels),
        weaknesses: traitChips(system.damage?.weaknesses, labels),
        skills: skills ? groupSkills(skills, ds.CONFIG.skills.list, ds.CONFIG.skills.groups, game.i18n.localize("DSCSE.OtherSkills")) : null,
        languages: Array.from(system.biography?.languages ?? [], l => ds.CONFIG.languages[l]?.label ?? l)
          .sort((a, b) => a.localeCompare(b)),
      };
      if (this.isEditMode) {
        const damage = system._source.damage;
        context.cseDamageEdit = ["immunities", "weaknesses"].map(kind => ({
          kind,
          label: system.schema.getField(["damage", kind]).label,
          ...damageTraitEdit(damage?.[kind], labels),
        }));
      }
    }

    /** Stamina meter data for the vitals strip. */
    _prepareVitals(context) {
      const stamina = this.actor.system.stamina;
      const squad = context.isSingleSquadMinion ? context.combatGroup?.system : null;
      return {
        ...staminaMeter({
          value: squad ? squad.staminaValue : stamina.value,
          max: squad ? squad.staminaMax : stamina.max,
          temporary: stamina.temporary,
          winded: squad ? null : stamina.winded,
        }),
        isSquad: !!squad,
        editMax: false,
      };
    }

    /* -------------------------------------------------- */
    /*   Render                                           */
    /* -------------------------------------------------- */

    /** @inheritdoc */
    async _onFirstRender(context, options) {
      await super._onFirstRender(context, options);
      // Search boxes: filter on input; never let their change event reach the form (no submit for a nameless input).
      this.element.addEventListener("input", event => {
        if (!event.target.matches?.(".cse-search")) return;
        const tab = event.target.dataset.cseTab;
        stateFor(searchQueries, this.document.uuid, () => ({}))[tab] = event.target.value;
        this.#applySearch(tab);
      });
      this.element.addEventListener("change", event => {
        if (event.target.matches?.(UNBOUND_INPUTS)) event.stopPropagation();
      }, { capture: true });
    }

    /** @inheritdoc */
    async _onRender(context, options) {
      await super._onRender(context, options);
      const el = this.element;
      el.classList.toggle("cse-edit", this.isEditMode);
      el.classList.toggle("cse-play", this.isPlayMode);
      el.classList.toggle("cse-sidebar-closed", !game.settings.get(MODULE_ID, SETTINGS.sidebarOpen));
      for (const shape of ["square", "round", "transparent"]) el.classList.remove(`cse-portrait-${shape}`);
      el.classList.add(`cse-portrait-${game.settings.get(MODULE_ID, SETTINGS.portraitShape)}`);
      el.style.setProperty("--cse-accent", String(game.settings.get(MODULE_ID, SETTINGS.accentColor)));

      const modeSwitch = el.querySelector(".window-header .cse-mode-switch");
      if (modeSwitch) {
        modeSwitch.classList.toggle("active", this.isEditMode);
        const icon = modeSwitch.querySelector("i");
        icon?.classList.toggle("fa-lock", this.isPlayMode);
        icon?.classList.toggle("fa-feather", this.isEditMode);
      }

      const collapsed = collapsedSections.get(this.document.uuid);
      for (const section of el.querySelectorAll(".cse-table[data-cse-section]")) {
        section.classList.toggle("collapsed", !!collapsed?.has(section.dataset.cseSection));
      }
      const queries = searchQueries.get(this.document.uuid) ?? {};
      for (const input of el.querySelectorAll(".cse-search")) {
        const tab = input.dataset.cseTab;
        if (queries[tab] && input.value !== queries[tab]) input.value = queries[tab];
        this.#applySearch(tab);
      }
    }

    /** Hide rows of one tab whose name/keywords do not match its search text; hide tables left empty. */
    #applySearch(tab) {
      const query = searchQueries.get(this.document.uuid)?.[tab] ?? "";
      const tabEl = this.element.querySelector(`.tab[data-tab="${tab}"]`);
      if (!tabEl) return;
      for (const row of tabEl.querySelectorAll("li[data-document-uuid]")) {
        row.classList.toggle("cse-filtered", !matchesSearch(row.querySelector(".name")?.textContent, query));
      }
      for (const section of tabEl.querySelectorAll(".cse-table")) {
        const rows = section.querySelectorAll("li[data-document-uuid]");
        const visible = section.querySelectorAll("li[data-document-uuid]:not(.cse-filtered)");
        section.classList.toggle("cse-filtered", !!query && rows.length > 0 && visible.length === 0);
      }
    }

    #setCollapsed(sections, collapse) {
      const set = stateFor(collapsedSections, this.document.uuid, () => new Set());
      for (const section of sections) {
        const key = section.dataset.cseSection;
        if (collapse) set.add(key);
        else set.delete(key);
        section.classList.toggle("collapsed", collapse);
      }
    }

    #activeTabSections() {
      const tab = this.tabGroups?.primary;
      return this.element.querySelectorAll(`.tab[data-tab="${tab}"] .cse-table[data-cse-section]`);
    }

    /* -------------------------------------------------- */
    /*   Actions                                          */
    /* -------------------------------------------------- */

    /**
     * Click anywhere on a row (except its icon and controls, which carry their own actions) to expand or collapse its
     * description. Same bookkeeping as the system's toggleDocumentDescription, which needs the chevron we dropped.
     */
    static async #onToggleRow(event, target) {
      const row = target.closest(".expandable-document");
      const container = row?.querySelector(".document-description");
      if (!container) return;
      const uuid = row.dataset.documentUuid;
      const expanded = this._expandedDocumentDescriptions.has(uuid);
      if (expanded) this._expandedDocumentDescriptions.delete(uuid);
      else {
        if (!container.innerHTML.trim()) {
          const doc = this._getEmbeddedDocument(row);
          const embed = await doc?.system?.toEmbed?.(doc.documentName === "ActiveEffect" ? {} : { includeName: false });
          if (embed) container.innerHTML = embed.outerHTML;
        }
        this._expandedDocumentDescriptions.add(uuid);
      }
      container.classList.toggle("expanded", !expanded);
      if (!expanded) setTimeout(() => EvolvedSheet.#revealRow(row), 180); // after the 0.15s expand transition
    }

    /** Scroll the row's tab so the expanded row is fully visible, never past the row's own top edge. */
    static #revealRow(row) {
      const scroller = row.closest("[data-application-part]");
      if (!scroller?.isConnected) return;
      const view = scroller.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      const overflow = rect.bottom - view.bottom;
      if (overflow <= 0) return;
      scroller.scrollBy({ top: Math.min(overflow + 4, rect.top - view.top), behavior: "smooth" });
    }

    /** Edit mode, Speed tile: toggle one movement type (or hover) on the source data. */
    static async #onToggleMovement(event, target) {
      const key = target.dataset.movement;
      const movement = this.actor.system._source.movement;
      if (key === "hover") return this.actor.update({ "system.movement.hover": !movement.hover });
      const types = new Set(movement.types);
      if (types.has(key)) types.delete(key);
      else types.add(key);
      return this.actor.update({ "system.movement.types": [...types] });
    }

    /** Edit mode, sidebar: set the picked damage type of an immunity / weakness card to the entered value. */
    static async #onAddDamageTrait(event, target) {
      const card = target.closest("[data-cse-damage]");
      const type = card?.querySelector(".cse-iw-type")?.value;
      const value = Math.max(1, Math.trunc(Number(card?.querySelector(".cse-iw-value")?.value) || 1));
      if (!type) return;
      return this.actor.update({ [`system.damage.${card.dataset.cseDamage}.${type}`]: value });
    }

    /** Edit mode, sidebar: clear one immunity / weakness (back to 0). */
    static async #onRemoveDamageTrait(event, target) {
      const card = target.closest("[data-cse-damage]");
      const type = target.dataset.type;
      if (!card || !type) return;
      return this.actor.update({ [`system.damage.${card.dataset.cseDamage}.${type}`]: 0 });
    }

    static #onToggleSection(event, target) {
      const section = target.closest(".cse-table[data-cse-section]");
      if (section) this.#setCollapsed([section], !section.classList.contains("collapsed"));
    }

    static #onExpandAll() {
      this.#setCollapsed(this.#activeTabSections(), false);
    }

    static #onCollapseAll() {
      this.#setCollapsed(this.#activeTabSections(), true);
    }

    static async #onToggleSidebar() {
      const open = !game.settings.get(MODULE_ID, SETTINGS.sidebarOpen);
      this.element.classList.toggle("cse-sidebar-closed", !open);
      await game.settings.set(MODULE_ID, SETTINGS.sidebarOpen, open);
    }
  };
}
