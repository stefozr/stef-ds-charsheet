/**
 * Shared behaviour of the Evolved hero and NPC sheets. Applied on top of the system sheet classes, so every system action,
 * context preparation, drag & drop and form submission is inherited unchanged; this layer only swaps templates and adds:
 *  - a "sidebar" part built from the system "stats" context (the stats tab itself is dropped),
 *  - a lock switch in the window header replacing the system's toggle-mode frame button,
 *  - collapsible item tables, a per-tab search box and a collapsible sidebar,
 *  - the accent colour and portrait shape client settings,
 *  - portrait framing in edit mode: the whole image is shown (dimmed outside the frame) while hovering; drag to pan,
 *    wheel or toolbar to zoom (flag `portrait` on the actor).
 */

import { MODULE_ID, SETTINGS } from "./settings.mjs";
import {
  clampFrame, damageTraitEdit, fitFrame, groupSkills, matchesSearch, PORTRAIT_FLAG_VERSION, portraitFit, portraitFrame,
  staminaMeter, traitChips, zoomFrameAt,
} from "./helpers.mjs";

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

/** Portrait framing: pointer travel (px) before a press becomes a drag, toolbar zoom step, wheel sensitivity, save delay. */
const DRAG_THRESHOLD = 4;
const ZOOM_STEP = 1.25;
const WHEEL_ZOOM = 0.0015;
const PORTRAIT_SAVE_DELAY = 400;

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
        cseZoomPortrait: EvolvedSheet.#onZoomPortrait,
        cseResetPortrait: EvolvedSheet.#onResetPortrait,
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
        context.csePortrait = portraitFrame(this.actor.getFlag(MODULE_ID, "portrait"), this.actor.img);
        // The automatic fit (shape setting + system avatar properties), reproduced when framing starts in edit mode.
        context.cseFit = portraitFit(game.settings.get(MODULE_ID, SETTINGS.portraitShape), context.avatarProperties ?? {});
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
      this.#bindPortraitFraming();
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
      this.#refreshFraming();
    }

    /** @inheritdoc */
    _onClose(options) {
      this.#hideGhost();
      return super._onClose(options);
    }

    /* -------------------------------------------------- */
    /*   Portrait framing                                 */
    /* -------------------------------------------------- */

    /** Active drag: { pointerId, startX, startY, frame, width, height, moved }. */
    #portraitDrag = null;

    /** The click that ends a drag must not open the file picker. */
    #suppressPortraitClick = false;

    /** Debounced save after wheel zooming. */
    #portraitSaveSoon = foundry.utils.debounce(() => this.#savePortrait(), PORTRAIT_SAVE_DELAY);

    /** Edit mode: the whole image, dimmed outside the frame, while the pointer is over the portrait (lives on body). */
    #ghost = null;

    /** The portrait under the event, when it can be framed now (edit mode, editable, free layout ready). */
    #framingTarget(event) {
      if (!this.isEditMode || !this.isEditable) return null;
      return event.target.closest?.(".cse-portrait.cse-framing.cse-free") ?? null;
    }

    /**
     * The frame's inner box (inside its border) in screen pixels: the reference of the pan percentages. The ratio of
     * the screen rect to the layout size covers a scaled sheet window.
     */
    static #frameBox(portrait) {
      const rect = portrait.getBoundingClientRect();
      const scale = portrait.offsetWidth ? rect.width / portrait.offsetWidth : 1;
      return {
        left: rect.left + portrait.clientLeft * scale,
        top: rect.top + portrait.clientTop * scale,
        width: portrait.clientWidth * scale,
        height: portrait.clientHeight * scale,
      };
    }

    /** The framing currently drawn (CSS custom properties on the portrait). */
    static #readFrame(portrait) {
      const value = (name, fallback) => {
        const n = parseFloat(portrait.style.getPropertyValue(name));
        return Number.isFinite(n) ? n : fallback;
      };
      return clampFrame({ x: value("--cse-pan-x", 0), y: value("--cse-pan-y", 0), zoom: value("--cse-zoom", 1) });
    }

    static #drawFrame(portrait, frame) {
      portrait.style.setProperty("--cse-pan-x", `${frame.x}%`);
      portrait.style.setProperty("--cse-pan-y", `${frame.y}%`);
      portrait.style.setProperty("--cse-zoom", String(frame.zoom));
    }

    /**
     * Edit mode without a stored framing: switch the portrait from the object-fit look to the free layout, starting
     * from the framing that reproduces the automatic fit (so nothing moves). Needs the image's natural size.
     */
    #initFreeLayout() {
      const portrait = this.element.querySelector(".cse-portrait.cse-framing:not(.cse-free)");
      const img = portrait?.querySelector("img");
      if (!img) return;
      const apply = () => {
        if (!img.isConnected || !img.naturalWidth || !img.naturalHeight) return;
        if (!portrait.clientWidth || !portrait.clientHeight) return;
        EvolvedSheet.#drawFrame(portrait, fitFrame({
          imgAspect: img.naturalWidth / img.naturalHeight,
          frameAspect: portrait.clientWidth / portrait.clientHeight,
          fit: portrait.dataset.cseFit,
          anchor: portrait.dataset.cseAnchor,
        }));
        portrait.classList.add("cse-free");
      };
      if (img.complete) apply();
      else img.addEventListener("load", apply, { once: true });
    }

    /** Show (or move) the ghost over the real image: outside the frame only, clipped to the sheet window. */
    #showGhost() {
      const portrait = this.element?.querySelector(".cse-portrait.cse-framing.cse-free");
      const img = portrait?.querySelector("img");
      if (!img || !this.isEditMode) return this.#hideGhost();
      this.#ghost ??= Object.assign(document.createElement("img"), { className: "cse-portrait-ghost", alt: "" });
      const ghost = this.#ghost;
      if (ghost.src !== img.src) ghost.src = img.src;
      const r = img.getBoundingClientRect();
      const win = this.element.getBoundingClientRect();
      const frame = EvolvedSheet.#frameBox(portrait);
      // Ghost-local coordinates: the visible part (inside the window) minus a hole where the frame is (evenodd).
      const left = Math.max(0, win.left - r.left);
      const top = Math.max(0, win.top - r.top);
      const right = Math.min(r.width, win.right - r.left);
      const bottom = Math.min(r.height, win.bottom - r.top);
      const hole = {
        left: Math.min(Math.max(frame.left - r.left, left), right),
        top: Math.min(Math.max(frame.top - r.top, top), bottom),
        right: Math.min(Math.max(frame.left + frame.width - r.left, left), right),
        bottom: Math.min(Math.max(frame.top + frame.height - r.top, top), bottom),
      };
      const pt = (x, y) => `${x}px ${y}px`;
      Object.assign(ghost.style, {
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        zIndex: String((parseInt(getComputedStyle(this.element).zIndex) || 100) + 1),
        clipPath: `polygon(evenodd, ${[
          pt(left, top), pt(right, top), pt(right, bottom), pt(left, bottom), pt(left, top),
          pt(hole.left, hole.top), pt(hole.left, hole.bottom), pt(hole.right, hole.bottom), pt(hole.right, hole.top),
          pt(hole.left, hole.top),
        ].join(", ")})`,
      });
      if (!ghost.isConnected) document.body.append(ghost);
    }

    #hideGhost() {
      this.#ghost?.remove();
    }

    /** After a render: rebuild the free layout and keep the ghost only while the pointer is still over the portrait. */
    #refreshFraming() {
      this.#initFreeLayout();
      if (!this.#ghost?.isConnected) return;
      const portrait = this.element.querySelector(".cse-portrait.cse-framing.cse-free");
      if (portrait?.matches(":hover")) this.#showGhost();
      else this.#hideGhost();
    }

    /** Store the drawn framing on the actor, tagged with the image it was made for. */
    async #savePortrait() {
      const portrait = this.element?.querySelector(".cse-portrait.cse-framing.cse-free");
      if (!portrait || !this.isEditable) return;
      const frame = EvolvedSheet.#readFrame(portrait);
      const stored = portraitFrame(this.actor.getFlag(MODULE_ID, "portrait"), this.actor.img);
      if (stored.active && stored.x === frame.x && stored.y === frame.y && stored.zoom === frame.zoom) return;
      await this.actor.setFlag(MODULE_ID, "portrait", { v: PORTRAIT_FLAG_VERSION, src: this.actor.img, ...frame });
    }

    /** Drag to pan and wheel to zoom on the portrait (edit mode). Bound once on the sheet element, so renders keep them. */
    #bindPortraitFraming() {
      const el = this.element;
      el.addEventListener("pointerdown", event => {
        if (event.button !== 0 || !event.target.matches?.(".cse-portrait img")) return;
        const portrait = this.#framingTarget(event);
        if (!portrait) return;
        const box = EvolvedSheet.#frameBox(portrait);
        this.#portraitDrag = {
          pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
          frame: EvolvedSheet.#readFrame(portrait), width: box.width, height: box.height, moved: false,
        };
        event.target.setPointerCapture?.(event.pointerId);
      });
      el.addEventListener("pointermove", event => {
        const drag = this.#portraitDrag;
        if (!drag || event.pointerId !== drag.pointerId) {
          // Hovering: show the whole image (late layout init if the image was not loaded at render time).
          if (!this.isEditMode || !event.target.closest?.(".cse-portrait.cse-framing")) return;
          this.#initFreeLayout();
          if (this.#framingTarget(event)) this.#showGhost();
          return;
        }
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.moved = true;
        const portrait = el.querySelector(".cse-portrait.cse-framing.cse-free");
        if (!portrait) return;
        portrait.classList.add("cse-dragging");
        EvolvedSheet.#drawFrame(portrait, clampFrame({
          x: drag.frame.x + (dx / drag.width) * 100,
          y: drag.frame.y + (dy / drag.height) * 100,
          zoom: drag.frame.zoom,
        }));
        this.#showGhost();
      });
      el.addEventListener("pointerout", event => {
        if (this.#portraitDrag) return;
        const portrait = event.target.closest?.(".cse-portrait");
        if (portrait && !portrait.contains(event.relatedTarget)) this.#hideGhost();
      });
      const endDrag = event => {
        const drag = this.#portraitDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        this.#portraitDrag = null;
        const portrait = el.querySelector(".cse-portrait.cse-framing");
        portrait?.classList.remove("cse-dragging");
        if (!portrait?.matches(":hover")) this.#hideGhost();
        if (!drag.moved) return;
        if (event.type === "pointerup") {
          this.#suppressPortraitClick = true;
          setTimeout(() => { this.#suppressPortraitClick = false; }, 0);
        }
        this.#savePortrait();
      };
      el.addEventListener("pointerup", endDrag);
      el.addEventListener("pointercancel", endDrag);
      // Capture phase on the sheet element runs before the ApplicationV2 action dispatch (editImage).
      el.addEventListener("click", event => {
        if (!this.#suppressPortraitClick) return;
        this.#suppressPortraitClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
      el.addEventListener("wheel", event => {
        const portrait = this.#framingTarget(event);
        if (!portrait || !event.deltaY) return;
        event.preventDefault();
        const box = EvolvedSheet.#frameBox(portrait);
        const cx = ((event.clientX - box.left) / box.width - 0.5) * 100;
        const cy = ((event.clientY - box.top) / box.height - 0.5) * 100;
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM);
        EvolvedSheet.#drawFrame(portrait, zoomFrameAt(EvolvedSheet.#readFrame(portrait), cx, cy, factor));
        this.#showGhost();
        this.#portraitSaveSoon();
      }, { passive: false });
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

    /** Edit mode, portrait toolbar: zoom one step in or out about the frame centre. */
    static async #onZoomPortrait(event, target) {
      const portrait = target.closest(".cse-portrait.cse-framing.cse-free");
      if (!portrait) return;
      const factor = Number(target.dataset.step) > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      EvolvedSheet.#drawFrame(portrait, zoomFrameAt(EvolvedSheet.#readFrame(portrait), 0, 0, factor));
      this.#showGhost();
      return this.#savePortrait();
    }

    /** Edit mode, portrait toolbar: back to the automatic fit. */
    static async #onResetPortrait() {
      if (this.actor.getFlag(MODULE_ID, "portrait")) return this.actor.unsetFlag(MODULE_ID, "portrait");
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
