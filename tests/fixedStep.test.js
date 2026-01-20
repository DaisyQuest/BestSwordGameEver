import { describe, expect, it, vi } from "vitest";
import { createFixedStep } from "../shared/determinism/fixedStep.js";

describe("fixedStep", () => {
  it("validates configuration", () => {
    expect(() => createFixedStep()).toThrow(RangeError);
    expect(() => createFixedStep({ stepMs: 0 })).toThrow(RangeError);
    expect(() => createFixedStep({ stepMs: 16, maxSteps: 0 })).toThrow(RangeError);
  });

  it("advances with fixed steps", () => {
    const stepper = createFixedStep({ stepMs: 10 });
    const spy = vi.fn();

    const result = stepper.advance(25, spy);

    expect(result).toEqual({ steps: 2, dropped: false });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(stepper.getRemainder()).toBeCloseTo(5);
  });

  it("drops excess steps when maxSteps exceeded", () => {
    const stepper = createFixedStep({ stepMs: 10, maxSteps: 1 });
    const spy = vi.fn();

    const result = stepper.advance(35, spy);

    expect(result).toEqual({ steps: 1, dropped: true });
    expect(stepper.getRemainder()).toBe(0);
  });

  it("validates advance inputs", () => {
    const stepper = createFixedStep({ stepMs: 10 });
    expect(() => stepper.advance(-1, () => {})).toThrow(RangeError);
    expect(() => stepper.advance(1, null)).toThrow(TypeError);
  });

  it("resets accumulator", () => {
    const stepper = createFixedStep({ stepMs: 10 });
    const spy = vi.fn();
    stepper.advance(15, spy);
    stepper.reset();
    expect(stepper.getRemainder()).toBe(0);
  });
});
