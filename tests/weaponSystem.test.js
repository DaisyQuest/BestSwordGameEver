import { describe, expect, it } from "vitest";
import { computeWeaponImpact, createWeapon, createWeaponGeometry } from "../shared/combat/weaponSystem.js";

describe("weaponSystem", () => {
  it("validates weapon creation inputs", () => {
    expect(() => createWeapon({ id: "" })).toThrow(TypeError);
    expect(() => createWeapon({ type: "" })).toThrow(TypeError);
    expect(() => createWeapon({ type: "laser" })).toThrow(RangeError);
    expect(() => createWeapon({ type: "sword", sharpness: -0.1, mass: 1, length: 1, balance: 0.5 })).toThrow(
      RangeError
    );
    expect(() => createWeapon({ type: "sword", sharpness: 0.5, mass: 0, length: 1, balance: 0.5 })).toThrow(
      RangeError
    );
    expect(() => createWeapon({ type: "sword", sharpness: 0.5, mass: 1, length: -1, balance: 0.5 })).toThrow(
      RangeError
    );
    expect(() => createWeapon({ type: "sword", sharpness: 0.5, mass: 1, length: 1, balance: 2 })).toThrow(
      RangeError
    );
  });

  it("computes slash, thrust, and blunt impacts", () => {
    const weapon = createWeapon({
      id: "blade",
      type: "sword",
      sharpness: 0.8,
      mass: 2,
      length: 1.2,
      balance: 0.5
    });

    const slash = computeWeaponImpact({ weapon, velocity: 3, attackType: "slash" });
    const thrust = computeWeaponImpact({ weapon, velocity: 3, attackType: "thrust" });
    const blunt = computeWeaponImpact({ weapon, velocity: 3, attackType: "blunt" });

    expect(slash.type).toBe("sharp");
    expect(thrust.type).toBe("sharp");
    expect(blunt.type).toBe("blunt");
    expect(slash.amount).toBeGreaterThan(blunt.amount);
    expect(thrust.amount).toBeGreaterThan(blunt.amount);
  });

  it("applies weak point multiplier and balance effects", () => {
    const weapon = createWeapon({
      id: "dagger",
      type: "dagger",
      sharpness: 1,
      mass: 1,
      length: 0.5,
      balance: 1
    });

    const normal = computeWeaponImpact({ weapon, velocity: 2, attackType: "thrust" });
    const weakPoint = computeWeaponImpact({
      weapon,
      velocity: 2,
      attackType: "thrust",
      weakPoint: true
    });

    expect(normal.balanceMultiplier).toBeCloseTo(1.2);
    expect(weakPoint.amount).toBeCloseTo(normal.amount * 1.5);
    expect(weakPoint.weakPointApplied).toBe(true);
  });

  it("validates impact inputs", () => {
    const weapon = createWeapon({
      id: "club",
      type: "club",
      sharpness: 0,
      mass: 3,
      length: 1,
      balance: 0
    });

    expect(() => computeWeaponImpact()).toThrow(TypeError);
    expect(() => computeWeaponImpact({ weapon: null, velocity: 1, attackType: "slash" })).toThrow(TypeError);
    expect(() => computeWeaponImpact({ weapon, velocity: 0, attackType: "slash" })).toThrow(RangeError);
    expect(() => computeWeaponImpact({ weapon, velocity: 1, attackType: "" })).toThrow(TypeError);
    expect(() => computeWeaponImpact({ weapon, velocity: 1, attackType: "spin" })).toThrow(RangeError);
    expect(() => computeWeaponImpact({ weapon, velocity: 1, attackType: "blunt", weakPoint: "yes" })).toThrow(
      TypeError
    );
  });

  it("builds deterministic weapon geometry", () => {
    const weapon = createWeapon({
      id: "spear-1",
      type: "spear",
      sharpness: 0.4,
      mass: 3,
      length: 2,
      balance: 0.4
    });
    const geometry = createWeaponGeometry({ weapon });
    expect(geometry.type).toBe("spear");
    expect(geometry.length).toBeCloseTo(2);
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.points.length).toBeGreaterThan(4);

    const scaled = createWeaponGeometry({ weapon, scale: 2 });
    expect(scaled.length).toBeCloseTo(4);

    const shield = createWeaponGeometry({
      weapon: createWeapon({
        id: "shield-1",
        type: "shield",
        sharpness: 0,
        mass: 5,
        length: 1,
        balance: 0.2
      })
    });
    expect(shield.points.length).toBe(8);
    expect(shield.width).toBeCloseTo(1);

    expect(() => createWeaponGeometry()).toThrow(TypeError);
    expect(() => createWeaponGeometry({ weapon: { type: "" } })).toThrow(TypeError);
    expect(() => createWeaponGeometry({ weapon: { type: "laser", length: 1 } })).toThrow(RangeError);
    expect(() => createWeaponGeometry({ weapon, scale: 0 })).toThrow(RangeError);
  });
});
