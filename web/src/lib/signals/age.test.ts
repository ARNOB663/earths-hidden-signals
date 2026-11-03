import assert from "node:assert/strict";
import test from "node:test";
import { ageOf, humanAge, statusAfterAge } from "./age.ts";

const NOW = new Date("2026-11-03T12:00:00Z");

test("a fresh real reading is not stale", () => {
  const age = ageOf("2026-11-03T00:00:00Z", NOW, 48);
  assert.equal(age.stale, false);
  assert.equal(age.notApplicable, false);
  assert.equal(age.label, "12 hours old");
});

test("a reading older than the limit is stale and becomes grey", () => {
  const age = ageOf("2026-10-25T00:00:00Z", NOW, 48);
  assert.equal(age.stale, true);
  assert.equal(statusAfterAge("red", age), "grey");
  assert.equal(statusAfterAge("green", age), "grey");
});

test("sample runs never age", () => {
  const age = ageOf("2025-09-01T00:00:00Z", NOW, 48, true);
  assert.equal(age.stale, false);
  assert.equal(age.notApplicable, true);
  assert.equal(statusAfterAge("yellow", age), "yellow");
});

test("a future timestamp clamps to zero rather than a negative age", () => {
  assert.equal(ageOf("2026-11-04T12:00:00Z", NOW, 48).hours, 0);
});

test("an unparseable timestamp is treated as stale", () => {
  const age = ageOf("not-a-date", NOW, 48);
  assert.equal(age.stale, true);
  assert.equal(age.label, "Measurement time unknown");
});

test("human ages read naturally", () => {
  assert.equal(humanAge(0.5), "30 minutes old");
  assert.equal(humanAge(30), "30 hours old");
  assert.equal(humanAge(72), "3 days old");
});
