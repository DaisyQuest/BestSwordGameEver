import { describe, expect, it } from "vitest";
import { createReplayPlayer, createReplayRecorder } from "../shared/determinism/replaySystem.js";

describe("replaySystem", () => {
  it("records and replays frames deterministically", () => {
    const recorder = createReplayRecorder({ seed: 5, stepMs: 16 });
    recorder.recordFrame({ tick: 1, inputs: [{ code: "KeyW", active: true }] });
    recorder.recordFrame({ tick: 2, inputs: [] });

    const replay = recorder.exportReplay();
    const player = createReplayPlayer(replay);

    expect(player.seed).toBe(5);
    expect(player.stepMs).toBe(16);
    expect(player.getInputs(1)).toEqual([{ code: "KeyW", active: true }]);
    expect(player.getInputs(99)).toEqual([]);

    const frame = player.getFrame(1);
    frame.inputs[0].code = "KeyS";
    expect(player.getInputs(1)).toEqual([{ code: "KeyW", active: true }]);
  });

  it("validates recorder and player inputs", () => {
    expect(() => createReplayRecorder({ seed: -1 })).toThrow(TypeError);
    expect(() => createReplayRecorder({ stepMs: 0 })).toThrow(RangeError);

    const recorder = createReplayRecorder();
    expect(() => recorder.recordFrame()).toThrow(RangeError);
    expect(() => recorder.recordFrame({ tick: 0, inputs: "bad" })).toThrow(TypeError);
    recorder.recordFrame({ tick: 0, inputs: [] });
    expect(() => recorder.recordFrame({ tick: 0, inputs: [] })).toThrow(RangeError);
    recorder.reset();
    recorder.recordFrame({ tick: 0, inputs: [] });

    expect(() => createReplayPlayer()).toThrow(TypeError);
    expect(() => createReplayPlayer({ seed: -1, stepMs: 16, frames: [] })).toThrow(TypeError);
    expect(() => createReplayPlayer({ seed: 0, stepMs: 16, frames: {} })).toThrow(TypeError);
    expect(() =>
      createReplayPlayer({ seed: 0, stepMs: 16, frames: [{ tick: 0, inputs: "bad" }] })
    ).toThrow(TypeError);
    expect(() =>
      createReplayPlayer({
        seed: 0,
        stepMs: 16,
        frames: [
          { tick: 0, inputs: [] },
          { tick: 0, inputs: [] }
        ]
      })
    ).toThrow(RangeError);
  });
});
