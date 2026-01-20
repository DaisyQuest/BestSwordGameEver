import { describe, expect, it } from "vitest";
import { createLocomotionSystem } from "../shared/simulation/locomotionSystem.js";
import { createPlayerModel, updateLimbStatus } from "../shared/simulation/playerModel.js";

const buildModel = () => createPlayerModel();

describe("locomotionSystem", () => {
  it("validates configuration", () => {
    expect(() => createLocomotionSystem({ impairedMultiplier: -0.1 })).toThrow(RangeError);
    expect(() => createLocomotionSystem({ severedMultiplier: 2 })).toThrow(RangeError);
    expect(() => createLocomotionSystem({ limpPenalty: -1 })).toThrow(RangeError);
    expect(() => createLocomotionSystem({ limpShock: 1.2 })).toThrow(RangeError);
  });

  it("computes multipliers with healthy limbs", () => {
    const model = buildModel();
    const locomotion = createLocomotionSystem();

    const report = locomotion.computeModifiers(model, { stepIndex: 0 });
    expect(report.forceMultiplier).toBeCloseTo(1);
    expect(report.baseMultiplier).toBeCloseTo(1);
    expect(report.limping).toBe(false);
    expect(report.limpSide).toBeNull();
    expect(report.balanceShock).toBe(0);
  });

  it("applies limp penalty on alternating steps", () => {
    const model = buildModel();
    updateLimbStatus(model, "leftLeg", "impaired");

    const locomotion = createLocomotionSystem({ impairedMultiplier: 0.6, limpPenalty: 0.25, limpShock: 0.2 });

    const evenStep = locomotion.computeModifiers(model, { stepIndex: 2 });
    expect(evenStep.limping).toBe(true);
    expect(evenStep.limpSide).toBe("leftLeg");
    expect(evenStep.appliedPenalty).toBeCloseTo(0.25);
    expect(evenStep.balanceShock).toBeCloseTo(0.2);
    expect(evenStep.forceMultiplier).toBeCloseTo(0.45);

    const oddStep = locomotion.computeModifiers(model, { stepIndex: 3 });
    expect(oddStep.limping).toBe(true);
    expect(oddStep.appliedPenalty).toBe(0);
    expect(oddStep.balanceShock).toBe(0);
    expect(oddStep.forceMultiplier).toBeCloseTo(0.6);
  });

  it("handles severe limb injuries and equal severities", () => {
    const model = buildModel();
    updateLimbStatus(model, "leftLeg", "severed");
    updateLimbStatus(model, "rightLeg", "severed");

    const locomotion = createLocomotionSystem({ severedMultiplier: 0.3, limpPenalty: 0.1 });
    const report = locomotion.computeModifiers(model, { stepIndex: 1 });

    expect(report.baseMultiplier).toBeCloseTo(0.09);
    expect(report.limping).toBe(false);
    expect(report.limpSide).toBeNull();
    expect(report.balanceShock).toBe(0);
  });

  it("validates model inputs and limb statuses", () => {
    const locomotion = createLocomotionSystem();
    expect(() => locomotion.computeModifiers(null)).toThrow(TypeError);
    expect(() => locomotion.computeModifiers({ limbs: {} }, { stepIndex: -1 })).toThrow(RangeError);

    const model = buildModel();
    model.limbs.leftLeg.status = "broken";
    expect(() => locomotion.computeModifiers(model)).toThrow(RangeError);

    model.limbs.leftLeg.status = 42;
    expect(() => locomotion.computeModifiers(model)).toThrow(TypeError);
  });

  it("exposes leg keys and accepts missing limb records", () => {
    const locomotion = createLocomotionSystem();
    expect(locomotion.getLegKeys()).toEqual(["leftLeg", "rightLeg"]);

    const model = buildModel();
    delete model.limbs.rightLeg;
    const report = locomotion.computeModifiers(model, { stepIndex: 0 });
    expect(report.limbStatuses.rightLeg).toBe("healthy");
  });
});
