import { describe, expect, it } from "vitest";
import { createBalanceSystem } from "../shared/physics/balanceSystem.js";
import { createPhysicsWorld } from "../shared/physics/physicsSystem.js";
import { createPlayerModel, updateLimbStatus } from "../shared/simulation/playerModel.js";

describe("balanceSystem", () => {
  it("validates configuration", () => {
    expect(() => createBalanceSystem({ recoveryRate: -1 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ speedPenalty: -0.1 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ limbImpairedPenalty: 2 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ limbSeveredPenalty: -1 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ stumbleDrag: 1.2 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ fallDrag: 0 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ impactThreshold: -1 })).toThrow(RangeError);
    expect(() => createBalanceSystem({ impactStress: 2 })).toThrow(RangeError);
  });

  it("applies balance penalties, posture drag, and impact stress", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 }, maxSpeed: 100 });
    world.createBody({ id: "hero", velocity: { x: 10, y: 0 }, damping: 1 });

    const model = createPlayerModel({
      balance: { baseStability: 1, current: 1, stumbleThreshold: 0.6, fallThreshold: 0.3 }
    });
    updateLimbStatus(model, "leftLeg", "impaired");
    updateLimbStatus(model, "rightLeg", "severed");

    const balanceSystem = createBalanceSystem({
      recoveryRate: 1,
      speedPenalty: 0.02,
      limbImpairedPenalty: 0.1,
      limbSeveredPenalty: 0.25,
      stumbleDrag: 0.5,
      fallDrag: 0.2,
      impactThreshold: 5,
      impactStress: 0.2
    });

    const report = balanceSystem.applyBalance(world, "hero", model, {
      deltaMs: 1000,
      previousVelocity: { x: 0, y: 0 }
    });

    expect(report.target).toBeCloseTo(0.45);
    expect(report.current).toBeCloseTo(0.45);
    expect(report.posture).toBe("stumbling");
    expect(report.limbPenalty).toBeCloseTo(0.35);
    expect(report.speedPenalty).toBeCloseTo(0.2);
    expect(report.impactUpdates).toHaveLength(2);
    expect(model.limbs.leftLeg.integrity).toBeCloseTo(0.8);
    expect(model.limbs.rightLeg.integrity).toBeCloseTo(0);

    const body = world.getBody("hero");
    expect(body.velocity.x).toBeCloseTo(5);
  });

  it("handles validation errors and low impact updates", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
    world.createBody({ id: "hero", velocity: { x: 1, y: 0 }, damping: 1 });
    const model = createPlayerModel({
      balance: { baseStability: 1, current: 0.5, stumbleThreshold: 0.6, fallThreshold: 0.3 }
    });

    const balanceSystem = createBalanceSystem({ impactThreshold: 100 });

    expect(() => balanceSystem.applyBalance({}, "hero", model, { deltaMs: 16 })).toThrow(TypeError);
    expect(() => balanceSystem.applyBalance(world, "", model, { deltaMs: 16 })).toThrow(TypeError);
    expect(() => balanceSystem.applyBalance(world, "hero", {}, { deltaMs: 16 })).toThrow(TypeError);
    expect(() => balanceSystem.applyBalance(world, "hero", model, { deltaMs: 0 })).toThrow(RangeError);
    expect(() => balanceSystem.applyBalance(world, "missing", model, { deltaMs: 16 })).toThrow(RangeError);
    expect(() => balanceSystem.applyBalance(world, "hero", model, { deltaMs: 16, shock: 2 })).toThrow(
      RangeError
    );
    expect(() =>
      balanceSystem.applyBalance(world, "hero", model, {
        deltaMs: 16,
        previousVelocity: { x: "0", y: 0 }
      })
    ).toThrow(RangeError);
    expect(() =>
      balanceSystem.applyBalance(world, "hero", model, {
        deltaMs: 16,
        previousVelocity: null
      })
    ).toThrow(TypeError);

    const report = balanceSystem.applyBalance(world, "hero", model, { deltaMs: 16, shock: 0.1 });
    expect(report.posture).toBe("stumbling");
    expect(report.impactUpdates).toEqual([]);
  });

  it("applies fall drag and skips impact stress below threshold", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
    world.createBody({ id: "hero", velocity: { x: 2, y: 0 }, damping: 1 });

    const model = createPlayerModel({
      balance: { baseStability: 0.1, current: 0.1, stumbleThreshold: 0.6, fallThreshold: 0.3 }
    });
    delete model.limbs.leftArm;

    const balanceSystem = createBalanceSystem({ fallDrag: 0.1, impactThreshold: 100 });
    const report = balanceSystem.applyBalance(world, "hero", model, {
      deltaMs: 1000,
      previousVelocity: { x: 1, y: 0 }
    });

    expect(report.posture).toBe("fallen");
    expect(report.previousPosture).toBe("fallen");
    expect(report.impactUpdates).toEqual([]);
    expect(world.getBody("hero").velocity.x).toBeCloseTo(0.2);
  });

  it("keeps steady posture when balance is high", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
    world.createBody({ id: "hero", velocity: { x: 0.1, y: 0 }, damping: 1 });
    const model = createPlayerModel({
      balance: { baseStability: 1, current: 0.9, stumbleThreshold: 0.6, fallThreshold: 0.3 }
    });

    const balanceSystem = createBalanceSystem({ recoveryRate: 0 });
    const report = balanceSystem.applyBalance(world, "hero", model, { deltaMs: 16 });

    expect(report.posture).toBe("steady");
  });

  it("computes limb-based force multipliers", () => {
    const model = createPlayerModel();
    const balanceSystem = createBalanceSystem();

    expect(balanceSystem.computeForceMultiplier(model)).toBeCloseTo(1);
    updateLimbStatus(model, "leftLeg", "impaired");
    updateLimbStatus(model, "rightLeg", "severed");
    expect(balanceSystem.computeForceMultiplier(model)).toBeCloseTo(0.28);
    expect(() => balanceSystem.computeForceMultiplier()).toThrow(TypeError);
  });
});
