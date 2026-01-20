import { describe, expect, it, vi } from "vitest";
import { createEngine } from "../shared/engine.js";

describe("engine", () => {
  it("ticks deterministic steps with inputs and commands", () => {
    const engine = createEngine({ stepMs: 10, rngSeed: 1 });
    const onStep = vi.fn();

    engine.enqueueCommands([
      { tick: 1, actorId: "alpha", payload: { action: "jump" } },
      { tick: 2, actorId: "beta", payload: { action: "kick" } }
    ]);

    const result = engine.tick(25, [{ action: "move" }], onStep);

    expect(result).toEqual({ steps: 2, dropped: false });
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep.mock.calls[0][0]).toMatchObject({
      tick: 1,
      inputs: [{ action: "move" }],
      commands: [{ tick: 1, actorId: "alpha", payload: { action: "jump" } }]
    });
    expect(onStep.mock.calls[1][0]).toMatchObject({
      inputs: [],
      commands: [{ tick: 2, actorId: "beta", payload: { action: "kick" } }]
    });
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
      commandQueueSize: 0,
      remainderMs: 0
    });
  });

  it("validates inputs and callbacks", () => {
    const engine = createEngine({ stepMs: 10 });
    expect(() => engine.tick(10, "input", () => {})).toThrow(TypeError);
    expect(() => engine.tick(10, [], null)).toThrow(TypeError);
    expect(() => engine.enqueueCommands({})).toThrow(TypeError);
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

  it("records replays and clears command queue on reset", () => {
    const recorder = {
      recordFrame: vi.fn(),
      reset: vi.fn()
    };
    const engine = createEngine({ stepMs: 5, replayRecorder: recorder });
    const onStep = vi.fn();

    engine.enqueueCommands([{ tick: 1, actorId: "hero", payload: { action: "move" } }]);
    engine.tick(5, [{ action: "block" }], onStep);

    expect(recorder.recordFrame).toHaveBeenCalledWith({
      tick: 1,
      inputs: [{ action: "block" }]
    });
    expect(engine.getState().commandQueueSize).toBe(0);

    engine.reset();
    expect(recorder.reset).toHaveBeenCalled();
  });

  it("validates replay recorder contracts", () => {
    expect(() => createEngine({ replayRecorder: {} })).toThrow(TypeError);
  });
});
