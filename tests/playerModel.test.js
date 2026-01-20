import { describe, expect, it } from "vitest";
import {
  applyCombatReport,
  applyLimbStress,
  createPlayerModel,
  getLimbKeys,
  snapshotPlayerModel,
  updateLimbStatus
} from "../shared/simulation/playerModel.js";

describe("playerModel", () => {
  it("validates model configuration", () => {
    expect(() => createPlayerModel({ id: "" })).toThrow(TypeError);
    expect(() => createPlayerModel({ dominantHand: "center" })).toThrow(RangeError);
    expect(() => createPlayerModel({ balance: { baseStability: Number.NaN } })).toThrow(TypeError);
    expect(() => createPlayerModel({ balance: { baseStability: -0.1 } })).toThrow(RangeError);
    expect(() => createPlayerModel({ balance: { fallThreshold: 0.9, stumbleThreshold: 0.2 } })).toThrow(
      RangeError
    );
    expect(() =>
      createPlayerModel({
        limbs: { leftArm: { status: "healthy", integrity: 2 } }
      })
    ).toThrow(RangeError);
    expect(() =>
      createPlayerModel({
        limbs: { leftArm: 42 }
      })
    ).toThrow(TypeError);
  });

  it("creates default limbs and posture", () => {
    const model = createPlayerModel({ id: "hero" });
    expect(model.limbs.leftLeg.status).toBe("healthy");
    expect(model.limbs.leftLeg.integrity).toBe(1);
    expect(model.balance.baseStability).toBe(1);
    expect(model.posture).toBe("steady");

    const partial = createPlayerModel({ limbs: { leftArm: { integrity: 0.7 } } });
    expect(partial.limbs.leftArm.status).toBe("healthy");
    expect(partial.limbs.leftArm.integrity).toBeCloseTo(0.7);

    const statusOnly = createPlayerModel({ limbs: { rightArm: { status: "impaired" } } });
    expect(statusOnly.limbs.rightArm.status).toBe("impaired");
    expect(statusOnly.limbs.rightArm.integrity).toBe(1);
  });

  it("updates limb status with validation", () => {
    const model = createPlayerModel();
    expect(() => updateLimbStatus(null, "leftArm", "healthy")).toThrow(TypeError);
    expect(() => updateLimbStatus(model, "", "healthy")).toThrow(TypeError);
    expect(() => updateLimbStatus(model, 12, "healthy")).toThrow(TypeError);
    expect(() => updateLimbStatus(model, "tail", "healthy")).toThrow(RangeError);
    expect(() => updateLimbStatus(model, "leftArm", 2)).toThrow(TypeError);

    const limb = updateLimbStatus(model, "leftArm", "impaired");
    expect(limb.status).toBe("impaired");
  });

  it("applies limb stress and respects severed limbs", () => {
    const model = createPlayerModel();
    expect(() => applyLimbStress(null, "leftLeg", 0.1)).toThrow(TypeError);
    expect(() => applyLimbStress(model, "leftLeg", -1)).toThrow(RangeError);
    expect(() => applyLimbStress(model, "leftLeg", 0.2, { impairedThreshold: 2 })).toThrow(RangeError);

    const stressed = applyLimbStress(model, "leftLeg", 0.6, { impairedThreshold: 0.5 });
    expect(stressed.integrity).toBeCloseTo(0.4);
    expect(stressed.status).toBe("impaired");

    updateLimbStatus(model, "rightLeg", "severed");
    const ignored = applyLimbStress(model, "rightLeg", 0.2);
    expect(ignored.updated).toBe(false);
    expect(ignored.status).toBe("severed");
  });

  it("applies combat reports to limbs", () => {
    const model = createPlayerModel();
    expect(() => applyCombatReport(null, {})).toThrow(TypeError);
    expect(() => applyCombatReport(model, "oops")).toThrow(TypeError);
    expect(() => applyCombatReport(model, { part: 10 })).toThrow(TypeError);
    expect(applyCombatReport(model, { part: "head" })).toBeNull();
    expect(() => applyCombatReport(model, { part: "leftArm", newStatus: "gone" })).toThrow(RangeError);

    const severed = applyCombatReport(model, { part: "leftArm", severed: true });
    expect(severed.status).toBe("severed");
    expect(model.limbs.leftArm.integrity).toBe(0);

    const updated = applyCombatReport(model, { part: "rightArm", newStatus: "impaired" });
    expect(updated.status).toBe("impaired");
  });

  it("snapshots models and limb keys", () => {
    const model = createPlayerModel({ id: "hero", dominantHand: "left" });
    expect(() => snapshotPlayerModel(null)).toThrow(TypeError);
    const snapshot = snapshotPlayerModel(model);
    expect(snapshot).toEqual({
      id: "hero",
      dominantHand: "left",
      posture: "steady",
      balance: model.balance,
      limbs: model.limbs
    });
    snapshot.limbs.leftArm.status = "severed";
    expect(model.limbs.leftArm.status).toBe("healthy");

    expect(getLimbKeys()).toEqual(["leftArm", "rightArm", "leftLeg", "rightLeg"]);
  });
});
