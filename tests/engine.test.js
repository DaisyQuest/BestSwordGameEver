import { describe, expect, it, vi } from "vitest";
import { createEngine } from "../shared/engine.js";

describe("engine", () => {
  it("ticks deterministic steps with inputs", () => {
    const engine = createEngine({ stepMs: 10, rngSeed: 1 });
    const onStep = vi.fn();

    const result = engine.tick(25, [{ action: "move" }], onStep);

    expect(result).toEqual({ steps: 2, dropped: false });
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep.mock.calls[0][0]).toMatchObject({
      tick: 1,
      inputs: [{ action: "move" }]
    });
    expect(onStep.mock.calls[1][0].inputs).toEqual([]);
  });

  it("handles empty inputs and state reset", () => {
    const engine = createEngine({ stepMs: 10 });
    const onStep = vi.fn();
    engine.tick(10, null, onStep);

    expect(engine.getState().tick).toBe(1);
    engine.reset();
    expect(engine.getState()).toEqual({
      tick: 0,
      inputQueueSize: 0,
      remainderMs: 0
    });
  });

  it("validates inputs and callbacks", () => {
    const engine = createEngine({ stepMs: 10 });
    expect(() => engine.tick(10, "input", () => {})).toThrow(TypeError);
    expect(() => engine.tick(10, [], null)).toThrow(TypeError);
  });

  it("exposes feature toggles and rng", () => {
    const engine = createEngine({
      stepMs: 10,
      rngSeed: 5,
      featureToggles: { organs: true }
    });

    expect(engine.toggles.isEnabled("organs")).toBe(true);
    expect(engine.rng.nextInt(1, 1)).toBe(1);
  });
});
