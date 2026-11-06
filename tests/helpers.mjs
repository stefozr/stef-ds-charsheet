import assert from "node:assert/strict";
import {
  clampFrame, classArtFile, damageTraitEdit, fitFrame, groupSkills, matchesSearch, percent, portraitFit, portraitFrame,
  staminaMeter, traitChips, zoomFrameAt,
} from "../scripts/helpers.mjs";

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
// Portrait framing
assert.deepEqual(clampFrame({ x: 12.345, y: -999, zoom: 99 }), { x: 12.3, y: -500, zoom: 10 }, "clamped and rounded");
assert.deepEqual(clampFrame({ x: "a", zoom: 0.01 }), { x: 0, y: 0, zoom: 0.1 }, "bad values fall back, zoom floor");
assert.equal(clampFrame({ zoom: 1.23456 }).zoom, 1.235, "zoom rounded to 0.001");
assert.deepEqual(clampFrame(), { x: 0, y: 0, zoom: 1 }, "default");
assert.deepEqual(portraitFrame({ v: 2, src: "a.webp", x: 10, y: 5, zoom: 2 }, "a.webp"), { x: 10, y: 5, zoom: 2, active: true });
assert.equal(portraitFrame({ src: "a.webp", x: 10, y: 5, zoom: 2 }, "a.webp").active, false, "first-build flag ignored");
assert.deepEqual(portraitFrame({ v: 2, src: "old.webp", x: 10, y: 5, zoom: 2 }, "a.webp"), { x: 0, y: 0, zoom: 1, active: false },
  "framing made for another image is ignored");
assert.deepEqual(portraitFrame(undefined, "a.webp"), { x: 0, y: 0, zoom: 1, active: false }, "no flag");

{
  const F = 1 / 0.9; // the portrait frame's aspect
  // Tall image (aspect 0.5), cover/top: full width, top edge on the frame top.
  const tall = fitFrame({ imgAspect: 0.5, frameAspect: F, fit: "cover", anchor: "top" });
  assert.equal(tall.zoom, 1);
  assert.ok(Math.abs(tall.y - ((F / 0.5) / 2 - 0.5) * 100) < 0.1, "top edge on the frame top");
  assert.equal(tall.x, 0);
  // Wide image (aspect 2), cover: the height fills (zoom a/F), no vertical offset.
  const wide = fitFrame({ imgAspect: 2, frameAspect: F, fit: "cover", anchor: "top" });
  assert.equal(wide.zoom, Math.round((2 / F) * 1000) / 1000);
  assert.ok(Math.abs(wide.y) < 0.1, "fills the height exactly");
  // Tall image, contain/bottom: the height fits, no vertical offset.
  const contain = fitFrame({ imgAspect: 0.5, frameAspect: F, fit: "contain", anchor: "bottom" });
  assert.equal(contain.zoom, Math.round((0.5 / F) * 1000) / 1000);
  assert.ok(Math.abs(contain.y) < 0.1);
  // Wide image, contain/bottom: full width, bottom edge on the frame bottom.
  const wideContain = fitFrame({ imgAspect: 2, frameAspect: F, fit: "contain", anchor: "bottom" });
  assert.equal(wideContain.zoom, 1);
  assert.ok(Math.abs(wideContain.y - (0.5 - (F / 2) / 2) * 100) < 0.1, "bottom edge on the frame bottom");
  assert.deepEqual(fitFrame({ imgAspect: 1, frameAspect: 1 }), { x: 0, y: 0, zoom: 1 }, "square in square");
  assert.deepEqual(fitFrame({ imgAspect: 0, frameAspect: 1 }), { x: 0, y: 0, zoom: 1 }, "unknown size");
}
assert.deepEqual(portraitFit("square"), { fit: "cover", anchor: "top" });
assert.deepEqual(portraitFit("transparent"), { fit: "contain", anchor: "bottom" });
assert.deepEqual(portraitFit("round", { objectFit: "contain", objectPosition: "center" }), { fit: "contain", anchor: "center" });
assert.deepEqual(portraitFit("square", { objectPosition: "center bottom" }), { fit: "cover", anchor: "bottom" });

{
  // The image point under the cursor stays put: screen = t + p * z  =>  p = (c - t) / z must be unchanged.
  const before = { x: 10, y: -20, zoom: 1.5 };
  const after = zoomFrameAt(before, 30, 15, 2);
  assert.equal(after.zoom, 3);
  assert.ok(Math.abs((30 - before.x) / before.zoom - (30 - after.x) / after.zoom) < 0.1, "x under cursor fixed");
  assert.ok(Math.abs((15 - before.y) / before.zoom - (15 - after.y) / after.zoom) < 0.1, "y under cursor fixed");
  assert.deepEqual(zoomFrameAt({ x: 0, y: 0, zoom: 1 }, 0, 0, 0.5), { x: 0, y: 0, zoom: 0.5 }, "zoom about the centre");
  assert.equal(zoomFrameAt({ x: 0, y: 0, zoom: 10 }, 20, 20, 2).zoom, 10, "zoom ceiling");
  assert.deepEqual(zoomFrameAt({ x: 5, y: 5, zoom: 10 }, 20, 20, 2), { x: 5, y: 5, zoom: 10 }, "no pan at the ceiling");
}

console.log("CHARACTER SHEETS EVOLVED HELPER TESTS PASSED");
