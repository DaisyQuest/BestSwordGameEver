import { describe, expect, it } from "vitest";
import { createInputQueue } from "../shared/determinism/inputQueue.js";

describe("inputQueue", () => {
  it("validates config", () => {
    expect(() => createInputQueue({ maxSize: 0 })).toThrow(RangeError);
  });

  it("enqueues and drains inputs", () => {
    const queue = createInputQueue({ maxSize: 2 });
    queue.enqueue({ action: "move" });
    queue.enqueue({ action: "kick" });

    expect(queue.size()).toBe(2);
    expect(queue.drain(1)).toEqual([{ action: "move" }]);
    expect(queue.size()).toBe(1);
    expect(queue.drain()).toEqual([{ action: "kick" }]);
    expect(queue.size()).toBe(0);
  });

  it("handles empty drains and clears", () => {
    const queue = createInputQueue();
    expect(queue.drain(0)).toEqual([]);
    expect(queue.drain()).toEqual([]);
    queue.enqueue({ action: "grab" });
    queue.clear();
    expect(queue.size()).toBe(0);
  });

  it("validates enqueue and drain", () => {
    const queue = createInputQueue({ maxSize: 1 });
    expect(() => queue.enqueue()).toThrow(TypeError);
    queue.enqueue({ action: "move" });
    expect(() => queue.enqueue({ action: "kick" })).toThrow(RangeError);
    expect(() => queue.drain(-1)).toThrow(RangeError);
  });
});
