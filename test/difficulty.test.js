import assert from "node:assert/strict";
import test from "node:test";
import {
  challengeForArena,
  estimatedWinRate,
  normalizeArenaRecords,
  recordArenaResult,
  TARGET_WIN_RATE
} from "../src/difficulty.js";

test("new arenas begin at the 20 percent target prior", () => {
  const [record] = normalizeArenaRecords([], 1);
  assert.equal(estimatedWinRate(record), TARGET_WIN_RATE);
  assert.equal(challengeForArena(0, record), 1.2);
});

test("wins increase pressure and losses reduce it", () => {
  let records = normalizeArenaRecords([], 1);
  const baseline = challengeForArena(0, records[0]);
  for (let index = 0; index < 5; index += 1) records = recordArenaResult(records, 0, true);
  assert.ok(challengeForArena(0, records[0]) > baseline);

  records = normalizeArenaRecords([], 1);
  for (let index = 0; index < 5; index += 1) records = recordArenaResult(records, 0, false);
  assert.ok(challengeForArena(0, records[0]) < baseline);
});

test("difficulty history is bounded and isolated per arena", () => {
  let records = normalizeArenaRecords([], 2);
  for (let index = 0; index < 20; index += 1) records = recordArenaResult(records, 1, index % 3 === 0);
  assert.deepEqual(records[0], { attempts: 0, wins: 0, recent: [] });
  assert.equal(records[1].attempts, 20);
  assert.equal(records[1].wins, 7);
  assert.equal(records[1].recent.length, 12);
});

test("stored records are sanitized before use", () => {
  const records = normalizeArenaRecords([{ attempts: -2, wins: 99, recent: [1, 0, "yes"] }], 2);
  assert.deepEqual(records[0], { attempts: 0, wins: 0, recent: [true, false, true] });
  assert.deepEqual(records[1], { attempts: 0, wins: 0, recent: [] });
});
