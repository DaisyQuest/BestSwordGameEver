import { describe, expect, it } from "vitest";
import { createRng } from "../shared/determinism/rng.js";

describe("rng", () => {
  it("rejects invalid seeds", () => {
    expect(() => createRng(-1)).toThrow(TypeError);
    expect(() => createRng(1.5)).toThrow(TypeError);
    expect(() => createRng("seed")).toThrow(TypeError);
  });

  it("produces deterministic sequences", () => {
    const rngA = createRng(42);
    const rngB = createRng(42);

    const sequenceA = Array.from({ length: 5 }, () => rngA.nextUint32());
    const sequenceB = Array.from({ length: 5 }, () => rngB.nextUint32());

    expect(sequenceA).toEqual(sequenceB);
  });

  it("generates floats and ints within range", () => {
    const rng = createRng(7);
    const floatValue = rng.nextFloat();
    expect(floatValue).toBeGreaterThanOrEqual(0);
    expect(floatValue).toBeLessThan(1);

    const intValue = rng.nextInt(3, 3);
    expect(intValue).toBe(3);
    const ranged = rng.nextInt(0, 10);
    expect(ranged).toBeGreaterThanOrEqual(0);
    expect(ranged).toBeLessThanOrEqual(10);
  });

  it("validates nextInt inputs", () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0.2, 1)).toThrow(TypeError);
    expect(() => rng.nextInt(2, 1)).toThrow(RangeError);
  });
});
