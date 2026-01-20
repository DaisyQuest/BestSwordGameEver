import { describe, expect, it } from "vitest";
import { applyDamage, createCombatant } from "../shared/combat/damageSystem.js";
import { createArmorProfile } from "../shared/combat/armorSystem.js";

const createTogglesStub = (flags) => ({
  isEnabled: (key) => Boolean(flags[key])
});

describe("damageSystem", () => {
  it("creates combatants with valid ids, toggles, and armor", () => {
    const combatant = createCombatant({
      id: "hero",
      armor: {
        id: "starter",
        layers: [
          {
            key: "outer",
            coverage: ["torso"],
            bluntMitigation: 0.2,
            sharpMitigation: 0.1,
            durability: 10
          }
        ]
      }
    });
    expect(combatant.id).toBe("hero");
    expect(combatant.parts.head.status).toBe("healthy");
    expect(combatant.organs.heart.status).toBe("healthy");
    expect(combatant.armor.id).toBe("starter");
    expect(combatant.armor.layers).toHaveLength(1);

    const cloth = createCombatant({ id: "scout", armor: { id: "cloth" } });
    expect(cloth.armor.layers).toHaveLength(0);

    expect(() => createCombatant({ id: "" })).toThrow(TypeError);
    expect(() => createCombatant({ toggles: { limbLoss: "yes" } })).toThrow(
      TypeError
    );
  });

  it("validates damage input", () => {
    const combatant = createCombatant();
    expect(() => applyDamage()).toThrow(TypeError);
    expect(() => applyDamage(combatant, null)).toThrow(TypeError);
    expect(() => applyDamage(combatant, { part: 1, type: "blunt", amount: 1 })).toThrow(
      TypeError
    );
    expect(() => applyDamage(combatant, { part: "head", type: "pierce", amount: 1 })).toThrow(
      RangeError
    );
    expect(() => applyDamage(combatant, { part: "head", type: "blunt", amount: 0 })).toThrow(
      RangeError
    );
    expect(() => applyDamage(combatant, { part: "head", type: "blunt", amount: 1, weakPoint: 1 })).toThrow(
      TypeError
    );
    expect(() => applyDamage(combatant, { part: "head", type: "blunt", amount: 1, organ: 2 })).toThrow(
      TypeError
    );
    expect(() => applyDamage(combatant, { part: "tail", type: "blunt", amount: 1 })).toThrow(
      RangeError
    );
  });

  it("applies weak point multipliers and impairment", () => {
    const combatant = createCombatant();
    const report = applyDamage(combatant, {
      part: "leftArm",
      type: "blunt",
      amount: 50,
      weakPoint: true
    });

    expect(report.applied).toBe(75);
    expect(report.newStatus).toBe("impaired");
    expect(report.effects).toContain("impaired");
    expect(combatant.parts.leftArm.current).toBe(25);
  });

  it("severs limbs when limb loss is enabled", () => {
    const combatant = createCombatant({ toggles: createTogglesStub({ limbLoss: true }) });

    const report = applyDamage(combatant, {
      part: "rightArm",
      type: "sharp",
      amount: 200
    });

    expect(report.severed).toBe(true);
    expect(report.newStatus).toBe("severed");
    expect(report.effects).toContain("severed");

    const followUp = applyDamage(combatant, {
      part: "rightArm",
      type: "sharp",
      amount: 10
    });

    expect(followUp.effects).toContain("alreadySevered");
    expect(followUp.newStatus).toBe("severed");
  });

  it("does not sever limbs when limb loss is disabled", () => {
    const combatant = createCombatant({ toggles: createTogglesStub({ limbLoss: false }) });

    const report = applyDamage(combatant, {
      part: "leftLeg",
      type: "sharp",
      amount: 200
    });

    expect(report.severed).toBe(false);
    expect(report.newStatus).toBe("impaired");
    expect(report.effects).toContain("impaired");
  });

  it("applies organ damage and updates vitals", () => {
    const combatant = createCombatant({
      toggles: createTogglesStub({ organDamage: true })
    });

    const scratch = applyDamage(combatant, {
      part: "torso",
      type: "blunt",
      amount: 10,
      organ: "brain"
    });

    expect(scratch.organStatus).toBe("healthy");
    expect(combatant.vitals.consciousness).toBe("awake");

    const injured = applyDamage(combatant, {
      part: "torso",
      type: "blunt",
      amount: 30,
      organ: "brain"
    });

    expect(injured.organStatus).toBe("injured");
    expect(combatant.vitals.consciousness).toBe("dazed");

    const critical = applyDamage(combatant, {
      part: "torso",
      type: "sharp",
      amount: 20,
      organ: "brain"
    });

    expect(critical.organStatus).toBe("critical");
    expect(combatant.vitals.consciousness).toBe("unconscious");

    const fatal = applyDamage(combatant, {
      part: "torso",
      type: "sharp",
      amount: 200,
      organ: "heart"
    });

    expect(fatal.fatal).toBe(true);
    expect(fatal.effects).toContain("fatal");
    expect(combatant.vitals.isAlive).toBe(false);
  });

  it("ignores organ hits when organ damage is disabled", () => {
    const combatant = createCombatant({ toggles: createTogglesStub({ organDamage: false }) });

    const report = applyDamage(combatant, {
      part: "torso",
      type: "blunt",
      amount: 30,
      organ: "lungs"
    });

    expect(report.effects).toContain("organIgnored");
    expect(report.organStatus).toBeNull();
    expect(combatant.organs.lungs.status).toBe("healthy");
  });

  it("rejects unknown organs when organ damage is enabled", () => {
    const combatant = createCombatant({ toggles: createTogglesStub({ organDamage: true }) });

    expect(() =>
      applyDamage(combatant, {
        part: "torso",
        type: "blunt",
        amount: 20,
        organ: "spleen"
      })
    ).toThrow(RangeError);
  });

  it("applies armor mitigation from combatant or hit overrides", () => {
    const armorProfile = createArmorProfile({
      layers: [
        {
          key: "outer",
          coverage: ["leftArm"],
          bluntMitigation: 0.5,
          sharpMitigation: 0.1,
          durability: 10
        }
      ]
    });
    const combatant = createCombatant({ armor: armorProfile });

    const first = applyDamage(combatant, {
      part: "leftArm",
      type: "blunt",
      amount: 10
    });

    expect(first.armor.totalMitigation).toBeCloseTo(0.5);
    expect(first.applied).toBeCloseTo(5);

    const override = applyDamage(combatant, {
      part: "leftArm",
      type: "sharp",
      amount: 10,
      armor: {
        layers: [
          {
            key: "reinforced",
            coverage: ["leftArm"],
            bluntMitigation: 0.1,
            sharpMitigation: 0.6,
            durability: 10
          }
        ]
      }
    });

    expect(override.armor.totalMitigation).toBeCloseTo(0.6);
    expect(override.applied).toBeCloseTo(4);
  });
});
