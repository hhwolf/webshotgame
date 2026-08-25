import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_PROFILES, characterProfile, silhouetteSignature } from "../src/character-design.js";

test("every combat role has a distinct silhouette signature", () => {
  const signatures = Object.values(CHARACTER_PROFILES).map(silhouetteSignature);
  assert.equal(new Set(signatures).size, signatures.length);
});

test("role proportions communicate expected visual weight", () => {
  const heavy = characterProfile("heavy");
  const rusher = characterProfile("rusher");
  const scout = characterProfile("scout");
  assert.ok(heavy.chestRadius * heavy.chestWidth > rusher.chestRadius * rusher.chestWidth);
  assert.ok(rusher.legLength > heavy.legLength);
  assert.ok(scout.weaponLength > rusher.weaponLength);
});

test("unknown roles use the balanced profile", () => {
  assert.equal(characterProfile("unknown"), CHARACTER_PROFILES.rifleman);
});
