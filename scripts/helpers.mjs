/** Pure helpers (no Foundry globals), tested by tests/helpers.mjs. */

/** Does a row's text match every whitespace-separated term of the search query (case-insensitive)? */
export function matchesSearch(text, query) {
  const terms = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = String(text ?? "").toLowerCase();
  return terms.every(term => haystack.includes(term));
}

/** Integer percentage of value / max, clamped to 0-100 (0 when max is not a positive number). */
export function percent(value, max) {
  const v = Number(value), m = Number(max);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return 0;
  return Math.round(Math.min(Math.max(v / m, 0), 1) * 100);
}

/**
 * Stamina meter data. Temporary stamina is drawn after the current fill (capped at the bar's end); `winded` drives
 * the orange fill.
 */
export function staminaMeter({ value = 0, max = 0, temporary = 0, winded = null }) {
  const pct = percent(value, max);
  const tempPct = Math.min(percent(temporary, max), 100 - pct);
  const windedValue = Number.isFinite(Number(winded)) && winded !== null ? Number(winded) : Math.floor(Number(max) / 2);
  return {
    value, max, pct, tempPct,
    winded: Number(value) > 0 && Number(value) <= windedValue,
    dying: Number(value) <= 0,
  };
}

/** Chips for a damage-type record (immunities / weaknesses): entries above 0, labelled, sorted by label. */
export function traitChips(record, labels = {}) {
  return Object.entries(record ?? {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => ({ key, label: labels[key] ?? key, value: Number(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Skill chips grouped by skill group, in the order of `groups`; skills inside a group sorted by label. Keys missing
 * from `list` (custom skills) go to a trailing group labelled `otherLabel`.
 */
export function groupSkills(keys, list = {}, groups = {}, otherLabel = "Other") {
  const byGroup = new Map(Object.keys(groups).map(group => [group, []]));
  const other = [];
  for (const key of keys ?? []) {
    const skill = list[key];
    if (skill && byGroup.has(skill.group)) byGroup.get(skill.group).push(skill.label ?? key);
    else other.push(skill?.label ?? key);
  }
  const result = [];
  for (const [group, skills] of byGroup) {
    if (skills.length) result.push({ group, label: groups[group]?.label ?? group, skills: skills.sort((a, b) => a.localeCompare(b)) });
  }
  if (other.length) result.push({ group: "other", label: otherLabel, skills: other.sort((a, b) => a.localeCompare(b)) });
  return result;
}

/**
 * Edit-mode data for one damage-trait record (immunities or weaknesses): the set entries (value > 0, sorted by label)
 * and the add options (types at 0, in the order of `labels`).
 */
export function damageTraitEdit(record, labels = {}) {
  const entries = traitChips(record, labels);
  const set = new Set(entries.map(e => e.key));
  const keys = [...new Set([...Object.keys(labels), ...Object.keys(record ?? {})])];
  const options = keys.filter(key => key in (record ?? {}) && !set.has(key)).map(key => ({ key, label: labels[key] ?? key }));
  return { entries, options };
}

/** Header art per class, keyed by the class `_dsid` (files in `assets/`). */
const CLASS_ART = {
  beastheart: "Beastheart.webp",
  censor: "Censor.webp",
  conduit: "Conduit.webp",
  elementalist: "Elementalist.webp",
  fury: "Fury.webp",
  null: "Null.webp",
  shadow: "Shadow.webp",
  summoner: "Summoner.webp",
  tactician: "Tactician.webp",
  talent: "Talent.webp",
  troubadour: "Troubadour.webp",
};

/**
 * File name of a class's header art: by `_dsid`, else by the class name (letters only, lower-cased), so a homebrew
 * class item without a matching `_dsid` still finds its image. Unknown class → null.
 */
export function classArtFile(dsid, name) {
  for (const key of [dsid, String(name ?? "").toLowerCase().replace(/[^a-z]/g, "")]) {
    if (key && Object.hasOwn(CLASS_ART, key)) return CLASS_ART[key];
  }
  return null;
}
