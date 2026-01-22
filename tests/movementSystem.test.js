import { describe, expect, it, vi } from "vitest";
import { createMovementController } from "../shared/physics/movementSystem.js";

describe("movementSystem", () => {
  it("validates controller configuration", () => {
    expect(() => createMovementController({ maxAcceleration: 0 })).toThrow(RangeError);
    expect(() => createMovementController({ deadzone: -0.1 })).toThrow(RangeError);
    expect(() => createMovementController({ deadzone: 1 })).toThrow(RangeError);
    expect(() => createMovementController({ sprintMultiplier: 0 })).toThrow(RangeError);
  });

  it("computes forces with deadzone and normalization", () => {
    const controller = createMovementController({ maxAcceleration: 10, deadzone: 0.1 });

    const idle = controller.computeForce({ move: { x: 0.05, y: 0 } });
    expect(idle.applied).toBe(false);
    expect(idle.force).toEqual({ x: 0, y: 0, z: 0 });

    const normal = controller.computeForce({ move: { x: 0.6, y: 0.8, z: 0.4 } });
    expect(normal.applied).toBe(true);
    expect(Math.hypot(normal.force.x, normal.force.y, normal.force.z)).toBeCloseTo(10);

    const over = controller.computeForce({ move: { x: 2, y: 0, z: 0 } });
    expect(over.force.x).toBeCloseTo(10);
  });

  it("applies sprint multiplier when requested", () => {
    const controller = createMovementController({ maxAcceleration: 10, sprintMultiplier: 2 });
    const sprint = controller.computeForce({ move: { x: 1, y: 0 } }, { sprint: true });
    expect(sprint.force.x).toBeCloseTo(20);
  });

  it("scales force with forceMultiplier", () => {
    const controller = createMovementController({ maxAcceleration: 10 });
    const scaled = controller.computeForce({ move: { x: 1, y: 0 } }, { forceMultiplier: 0.5 });
    expect(scaled.force.x).toBeCloseTo(5);
    expect(scaled.force.z).toBeCloseTo(0);

    const defaultMultiplier = controller.computeForce({ move: { x: 1, y: 0 } }, { forceMultiplier: null });
    expect(defaultMultiplier.force.x).toBeCloseTo(10);
  });

  it("validates intent and sprint options", () => {
    const controller = createMovementController();
    expect(() => controller.computeForce()).toThrow(TypeError);
    expect(() => controller.computeForce({})).toThrow(TypeError);
    expect(() => controller.computeForce({ move: { x: "1", y: 0 } })).toThrow(RangeError);
    expect(() => controller.computeForce({ move: { x: 1, y: 0, z: "no" } })).toThrow(RangeError);
    expect(() => controller.computeForce({ move: { x: 1, y: 0 } }, { sprint: "yes" })).toThrow(TypeError);
    expect(() =>
      controller.computeForce({ move: { x: 1, y: 0 } }, { forceMultiplier: 2 })
    ).toThrow(RangeError);
  });

  it("applies forces through a physics world", () => {
    const controller = createMovementController({ maxAcceleration: 5 });
    const world = { applyForce: vi.fn() };

    const result = controller.applyMovement(world, "runner", { move: { x: 1, y: 0 } });
    expect(result.applied).toBe(true);
    expect(world.applyForce).toHaveBeenCalledWith("runner", { x: 5, y: 0, z: 0 });

    const idle = controller.applyMovement(world, "runner", { move: { x: 0, y: 0, z: 0 } });
    expect(idle.applied).toBe(false);
  });

  it("validates applyMovement arguments", () => {
    const controller = createMovementController();
    expect(() => controller.applyMovement(null, "runner", { move: { x: 1, y: 0 } })).toThrow(TypeError);
    expect(() => controller.applyMovement({ applyForce: () => {} }, "", { move: { x: 1, y: 0 } })).toThrow(
      TypeError
    );
  });
});
