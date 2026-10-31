import assert from "node:assert/strict";
import { classArtFile, damageTraitEdit, groupSkills, matchesSearch, percent, staminaMeter, traitChips } from "../scripts/helpers.mjs";

assert.equal(matchesSearch("Black Ash Teleport Magic, Ranged", ""), true, "empty query matches");
assert.equal(matchesSearch("Black Ash Teleport", "ash"), true, "case-insensitive substring");
assert.equal(matchesSearch("Black Ash Teleport Magic", "tele magic"), true, "every term, any order");
assert.equal(matchesSearch("Black Ash Teleport", "tele strike"), false, "all terms required");
assert.equal(matchesSearch(undefined, "x"), false, "missing text");

assert.equal(percent(5, 10), 50);
assert.equal(percent(15, 10), 100, "clamped high");
assert.equal(percent(-3, 10), 0, "clamped low");
assert.equal(percent(3, 0), 0, "no max");
assert.equal(percent("2", "8"), 25, "numeric strings");

assert.deepEqual(staminaMeter({ value: 30, max: 40, temporary: 0, winded: 20 }),
  { value: 30, max: 40, pct: 75, tempPct: 0, winded: false, dying: false });
const winded = staminaMeter({ value: 12, max: 40, temporary: 5, winded: 20 });
assert.equal(winded.winded, true, "at or below the threshold is winded");
assert.equal(winded.tempPct, 13, "temporary stamina shown after the fill");
assert.equal(staminaMeter({ value: 38, max: 40, temporary: 10, winded: 20 }).tempPct, 5, "temp capped at the bar's end");
const dying = staminaMeter({ value: -4, max: 40, winded: 20 });
assert.equal(dying.dying, true);
assert.equal(dying.winded, false, "dying is not shown as winded");
assert.equal(dying.pct, 0);
assert.equal(staminaMeter({ value: 15, max: 30 }).winded, true, "winded defaults to half of max");

assert.deepEqual(traitChips({ all: 0, fire: 5, acid: 2 }, { fire: "Fire", acid: "Acid" }),
  [{ key: "acid", label: "Acid", value: 2 }, { key: "fire", label: "Fire", value: 5 }], "positive only, sorted by label");
assert.deepEqual(traitChips({ holy: 1 }), [{ key: "holy", label: "holy", value: 1 }], "label falls back to the key");
assert.deepEqual(traitChips(undefined), []);

const groups = { crafting: { label: "Crafting" }, exploration: { label: "Exploration" }, lore: { label: "Lore" } };
const list = {
  cooking: { label: "Cooking", group: "crafting" }, alchemy: { label: "Alchemy", group: "crafting" },
  ride: { label: "Ride", group: "exploration" }, magic: { label: "Magic", group: "lore" },
};
assert.deepEqual(groupSkills(new Set(["magic", "cooking", "alchemy", "basketWeaving"]), list, groups, "Other"), [
  { group: "crafting", label: "Crafting", skills: ["Alchemy", "Cooking"] },
  { group: "lore", label: "Lore", skills: ["Magic"] },
  { group: "other", label: "Other", skills: ["basketWeaving"] },
], "group order kept, empty groups dropped, custom skills last");
assert.deepEqual(groupSkills([], list, groups), []);

const iwLabels = { all: "Damage", acid: "Acid", cold: "Cold", fire: "Fire" };
assert.deepEqual(damageTraitEdit({ all: 3, acid: 2, cold: 0, fire: 0 }, iwLabels), {
  entries: [{ key: "acid", label: "Acid", value: 2 }, { key: "all", label: "Damage", value: 3 }],
  options: [{ key: "cold", label: "Cold" }, { key: "fire", label: "Fire" }],
}, "set entries by label, options in label order");
assert.deepEqual(damageTraitEdit({ all: 0, holy: 0 }, { all: "Damage" }).options,
  [{ key: "all", label: "Damage" }, { key: "holy", label: "holy" }], "unlabelled record keys still offered");
assert.deepEqual(damageTraitEdit(undefined, iwLabels), { entries: [], options: [] });

assert.equal(classArtFile("censor"), "Censor.webp", "by _dsid");
assert.equal(classArtFile(undefined, "Beastheart"), "Beastheart.webp", "by name when there is no _dsid");
assert.equal(classArtFile("homebrew-fury", "Fury"), "Fury.webp", "unknown _dsid falls back to the name");
assert.equal(classArtFile("unknown", "Homebrew"), null, "unknown class");
assert.equal(classArtFile(undefined, undefined), null, "no class");
assert.equal(classArtFile("constructor"), null, "no prototype keys");
console.log("CHARACTER SHEETS EVOLVED HELPER TESTS PASSED");
