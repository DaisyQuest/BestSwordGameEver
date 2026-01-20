import { describe, expect, it } from "vitest";
import { applyArmorMitigation, createArmorProfile } from "../shared/combat/armorSystem.js";

describe("armorSystem", () => {
  it("validates armor profile inputs", () => {
    expect(() => createArmorProfile({ id: "" })).toThrow(TypeError);
    expect(() => createArmorProfile({ layers: "plate" })).toThrow(TypeError);
    expect(() => createArmorProfile({ weakPoints: "head" })).toThrow(TypeError);
    expect(() => createArmorProfile({ layers: [null] })).toThrow(TypeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "outer", coverage: ["head"], bluntMitigation: 1.2, sharpMitigation: 0.1, durability: 10 }
        ]
      })
    ).toThrow(RangeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "outer", coverage: [""], bluntMitigation: 0.2, sharpMitigation: 0.1, durability: 10 }
        ]
      })
    ).toThrow(TypeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "outer", coverage: [], bluntMitigation: 0.2, sharpMitigation: 0.1, durability: 10 }
        ]
      })
    ).toThrow(TypeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "outer", coverage: "head", bluntMitigation: 0.2, sharpMitigation: 0.1, durability: 10 }
        ]
      })
    ).toThrow(TypeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "outer", coverage: ["head"], bluntMitigation: 0.2, sharpMitigation: 0.1, durability: 0 }
        ]
      })
    ).toThrow(RangeError);
    expect(() =>
      createArmorProfile({
        layers: [
          { key: "", coverage: ["head"], bluntMitigation: 0.2, sharpMitigation: 0.1, durability: 10 }
        ]
      })
    ).toThrow(TypeError);
    expect(() => createArmorProfile({ weakPoints: [""] })).toThrow(TypeError);
  });

  it("applies mitigation and durability loss for covered parts", () => {
    const armor = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["head"],
          bluntMitigation: 0.3,
          sharpMitigation: 0.5,
          durability: 10
        },
        {
          key: "padding",
          coverage: ["head"],
          bluntMitigation: 0.4,
          sharpMitigation: 0.1,
          durability: 10
        }
      ]
    });

    const result = applyArmorMitigation(armor, {
      part: "head",
      type: "blunt",
      amount: 10
    });

    expect(result.totalMitigation).toBeCloseTo(0.7);
    expect(result.mitigatedAmount).toBeCloseTo(3);
    expect(result.absorbed).toBeCloseTo(7);
    expect(result.layersHit).toHaveLength(2);
    expect(result.layersHit[0].durabilityDamage).toBeCloseTo(5);
  });

  it("reduces mitigation on weak points and handles uncovered parts", () => {
    const armor = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["torso"],
          bluntMitigation: 0.8,
          sharpMitigation: 0.8,
          durability: 10
        }
      ],
      weakPoints: ["torso"]
    });

    const weakPointResult = applyArmorMitigation(armor, {
      part: "torso",
      type: "sharp",
      amount: 10
    });

    expect(weakPointResult.totalMitigation).toBeCloseTo(0.4);
    expect(weakPointResult.mitigatedAmount).toBeCloseTo(6);

    const freshArmor = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["torso"],
          bluntMitigation: 0.8,
          sharpMitigation: 0.8,
          durability: 10
        }
      ]
    });

    const explicitWeakPoint = applyArmorMitigation(freshArmor, {
      part: "torso",
      type: "sharp",
      amount: 10,
      weakPoint: true
    });

    expect(explicitWeakPoint.totalMitigation).toBeCloseTo(0.4);

    const uncovered = applyArmorMitigation(armor, {
      part: "leftArm",
      type: "blunt",
      amount: 10
    });

    expect(uncovered.totalMitigation).toBe(0);
    expect(uncovered.layersHit).toEqual([]);
  });

  it("validates mitigation inputs", () => {
    const armor = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["head"],
          bluntMitigation: 0.2,
          sharpMitigation: 0.2,
          durability: 10
        }
      ]
    });

    expect(() => applyArmorMitigation(null, { part: "head", type: "blunt", amount: 1 })).toThrow(
      TypeError
    );
    expect(() => applyArmorMitigation(armor, null)).toThrow(TypeError);
    expect(() => applyArmorMitigation(armor, { part: 1, type: "blunt", amount: 1 })).toThrow(
      TypeError
    );
    expect(() => applyArmorMitigation(armor, { part: "head", type: "pierce", amount: 1 })).toThrow(
      RangeError
    );
    expect(() => applyArmorMitigation(armor, { part: "head", type: "blunt", amount: 0 })).toThrow(
      RangeError
    );
  });

  it("clamps mitigation and tracks durability exhaustion", () => {
    const armor = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["head"],
          bluntMitigation: 0.9,
          sharpMitigation: 0.9,
          durability: 5
        },
        {
          key: "padding",
          coverage: ["head"],
          bluntMitigation: 0.9,
          sharpMitigation: 0.9,
          durability: 5
        }
      ]
    });

    const first = applyArmorMitigation(armor, {
      part: "head",
      type: "sharp",
      amount: 10
    });

    expect(first.totalMitigation).toBe(0.9);

    const second = applyArmorMitigation(armor, {
      part: "head",
      type: "sharp",
      amount: 10
    });

    expect(second.layersHit[0].remainingDurability).toBe(0);
    expect(second.layersHit[1].remainingDurability).toBe(0);
  });
});
