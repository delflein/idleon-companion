// src/ui/fmt.test.js — edge cases for the unified formatter (docs/ARCHITECTURE.md M4).
// Run via `npm run test:ui` (node --test, no DOM required).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, plain, fmtStatValue, fmtTermRaw } from "./fmt.js";

test("fmt: null/NaN/Infinity all render the honest em-dash placeholder", () => {
  assert.equal(fmt(null), "—");
  assert.equal(fmt(undefined), "—");
  assert.equal(fmt(NaN), "—");
  assert.equal(fmt(Infinity), "—");
  assert.equal(fmt(-Infinity), "—");
});

test("fmt: small numbers keep up to 2 decimals (trailing zeros dropped), no suffix", () => {
  assert.equal(fmt(0), "0");
  // 1.005 is not exactly representable in binary floating point (~1.00499999...), so
  // toFixed(2) rounds down to "1.00" -> the trailing zeros are then dropped by `+`. This is
  // inherited from all 3 legacy fmt() variants (same `+n.toFixed(2)` idiom) — not a fmt.js bug.
  assert.equal(fmt(1.005), "1");
  assert.equal(fmt(-3.4), "-3.4");
  assert.equal(fmt(9999), "9999");
});

test("fmt: >=1e4 rounds to a comma-grouped integer (all 3 legacy variants agreed here)", () => {
  assert.equal(fmt(10000), "10,000");
  assert.equal(fmt(123456), "123,456");
  assert.equal(fmt(999999), "999,999");
});

test("fmt: >=1e6 gets the M suffix (mining.html behavior; sneaking.html's omission was drift)", () => {
  assert.equal(fmt(1e6), "1.00M");
  assert.equal(fmt(2.5e6), "2.50M");
  assert.equal(fmt(999e6), "999.00M");
});

test("fmt: >=1e9 gets the B suffix", () => {
  assert.equal(fmt(1e9), "1.00B");
  assert.equal(fmt(4.2e9), "4.20B");
});

test("fmt: >=1e15 falls back to exponential notation (sneaking.html's overflow guard)", () => {
  assert.equal(fmt(1e15), "1.00e15");
  assert.equal(fmt(3.14e20), "3.14e20");
});

test("fmt: negative magnitudes use the same thresholds as their absolute value", () => {
  assert.equal(fmt(-1e9), "-1.00B");
  assert.equal(fmt(-25000), "-25,000");
});

test("fmt: digits option changes decimal places on the B/M/exponential branches", () => {
  assert.equal(fmt(1.2345e9, { digits: 0 }), "1B");
  assert.equal(fmt(1.2345e9, { digits: 3 }), "1.234B"); // binary fp: 1.2345e9/1e9 ~= 1.23450000000002
});

test("plain: dashboard-style uncapped comma grouping, no suffix scaling ever", () => {
  assert.equal(plain(12000), "12,000");
  assert.equal(plain(1e9), "1,000,000,000");
  assert.equal(plain(null), "—");
  assert.equal(plain(NaN), "—");
});

test("fmtStatValue: honesty contract lower-bound prefix + format-driven suffix", () => {
  assert.equal(fmtStatValue(1.5, "multiplier", false), "1.5x");
  assert.equal(fmtStatValue(1.5, "multiplier", true), "≥ 1.5x");
  assert.equal(fmtStatValue(42, "points", false), "42 pts");
  assert.equal(fmtStatValue(42, "points", true), "≥ 42 pts");
  assert.equal(fmtStatValue(3.2, "percent", false), "3.2%");
});

test("fmtTermRaw: add/mul/plain kinds match legacy termRow()'s rawVal exactly", () => {
  assert.equal(fmtTermRaw({ kind: "add", value: 12 }, false), "+12%");
  assert.equal(fmtTermRaw({ kind: "add", value: 12 }, true), "+12 pts");
  assert.equal(fmtTermRaw({ kind: "mul", value: 1.25 }, false), "×1.25");
  assert.equal(fmtTermRaw({ kind: "flat", value: 7 }, false), "7");
});
