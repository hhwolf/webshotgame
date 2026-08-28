import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { movementVelocity } from "../src/movement.js";

test("forward movement reaches full speed on the first update", () => {
  const velocity = movementVelocity(-Math.PI / 2, 1, 0, 3.05);
  assert.ok(Math.abs(velocity.x - 3.05) < 0.0001);
  assert.ok(Math.abs(velocity.z) < 0.0001);
});

test("diagonal movement remains normalized", () => {
  const velocity = movementVelocity(0, 1, 1, 3.05);
  assert.ok(Math.abs(Math.hypot(velocity.x, velocity.z) - 3.05) < 0.0001);
});

test("Three.js owns the only animation scheduler", async () => {
  const source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  assert.match(source, /renderer\.setAnimationLoop\(frame\)/);
  assert.doesNotMatch(source, /requestAnimationFrame\(frame\)/);
});

test("every campaign arena has a dedicated visual profile", async () => {
  const source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  for (const arena of ["Cargo Court", "Sunset Yard", "Canal Works", "Metro Market", "Beacon District", "Apex Foundry"]) {
    assert.match(source, new RegExp(`"${arena}": \\{ floor:`));
  }
});

test("combat feedback avoids persistent tracer geometry", async () => {
  const source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createTracer/);
  assert.match(source, /muzzleQueuedAt/);
  assert.match(source, /ejectShell/);
});

test("visual QA hooks and balanced render scale remain available", async () => {
  const source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  assert.match(source, /setVisualPose/);
  assert.match(source, /viewModelObstructionSamples/);
  assert.match(source, /Math\.min\(devicePixelRatio, 0\.82\)/);
});
