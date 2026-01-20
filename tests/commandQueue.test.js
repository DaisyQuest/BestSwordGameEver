import { describe, expect, it } from "vitest";
import { createCommandQueue } from "../shared/determinism/commandQueue.js";

describe("commandQueue", () => {
  it("validates configuration and inputs", () => {
    expect(() => createCommandQueue({ maxSize: 0 })).toThrow(RangeError);

    const queue = createCommandQueue({ maxSize: 1 });
    expect(() => queue.enqueue()).toThrow(RangeError);
    expect(() => queue.enqueue({ tick: -1, actorId: "hero" })).toThrow(RangeError);
    expect(() => queue.enqueue({ tick: 0, actorId: "" })).toThrow(TypeError);
  });

  it("orders commands deterministically by actor and sequence", () => {
    const queue = createCommandQueue();
    queue.enqueue({ tick: 2, actorId: "zeta", payload: { a: 1 } });
    queue.enqueue({ tick: 2, actorId: "alpha", payload: { b: 2 } });
    queue.enqueue({ tick: 2, actorId: "alpha", payload: { c: 3 } });

    const drained = queue.drain(2);
    expect(drained.map((entry) => entry.actorId)).toEqual(["alpha", "alpha", "zeta"]);
    expect(drained.map((entry) => entry.payload)).toEqual([{ b: 2 }, { c: 3 }, { a: 1 }]);
    expect(queue.size()).toBe(0);
  });

  it("handles empty drains and capacity limits", () => {
    const queue = createCommandQueue({ maxSize: 1 });
    expect(queue.drain(0)).toEqual([]);
    queue.enqueue({ tick: 0, actorId: "hero", payload: { action: "move" } });
    expect(() =>
      queue.enqueue({ tick: 1, actorId: "hero", payload: { action: "kick" } })
    ).toThrow(RangeError);
    expect(queue.drain(0)).toEqual([{ tick: 0, actorId: "hero", payload: { action: "move" } }]);
    expect(() => queue.drain(-1)).toThrow(RangeError);
    queue.enqueue({ tick: 0, actorId: "hero", payload: { action: "move" } });
    queue.clear();
    expect(queue.size()).toBe(0);
  });
});
