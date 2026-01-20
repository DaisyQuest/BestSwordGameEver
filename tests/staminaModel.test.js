import { describe, expect, it } from "vitest";
import { createStaminaState, snapshotStamina, updateStamina } from "../shared/simulation/staminaModel.js";

describe("staminaModel", () => {
  it("validates stamina configuration", () => {
    expect(() => createStaminaState(null)).toThrow(TypeError);
    expect(() => createStaminaState({ max: 0 })).toThrow(RangeError);
    expect(() => createStaminaState({ max: 10, current: -1 })).toThrow(RangeError);
    expect(() => createStaminaState({ max: 10, current: 11 })).toThrow(RangeError);
    expect(() => createStaminaState({ regenRate: -2 })).toThrow(RangeError);
    expect(() => createStaminaState({ sprintCost: -1 })).toThrow(RangeError);
    expect(() => createStaminaState({ exhaustionThreshold: 2 })).toThrow(RangeError);
  });

  it("creates stamina defaults and exhaustion state", () => {
    const state = createStaminaState();
    expect(state.max).toBe(100);
    expect(state.current).toBe(100);
    expect(state.exhausted).toBe(false);

    const exhausted = createStaminaState({ max: 50, current: 5, exhaustionThreshold: 0.2 });
    expect(exhausted.exhausted).toBe(true);
  });

  it("updates stamina with drain and regen", () => {
    const state = createStaminaState({ max: 100, current: 40, regenRate: 10, sprintCost: 30 });

    const sprint = updateStamina(state, { deltaMs: 1000, sprinting: true });
    expect(sprint.previous).toBe(40);
    expect(sprint.drained).toBe(30);
    expect(sprint.regenerated).toBe(0);
    expect(sprint.current).toBe(10);
    expect(state.exhausted).toBe(true);

    const rest = updateStamina(state, { deltaMs: 2000 });
    expect(rest.sprinting).toBe(false);
    expect(rest.regenerated).toBeCloseTo(20);
    expect(rest.current).toBeCloseTo(30);
    expect(state.exhausted).toBe(false);

    const overDrain = updateStamina(state, { deltaMs: 1000, sprinting: true, extraCost: 50 });
    expect(overDrain.drained).toBe(30);
    expect(overDrain.current).toBe(0);
  });

  it("validates update inputs and snapshots", () => {
    const state = createStaminaState();
    expect(() => updateStamina(null, { deltaMs: 16 })).toThrow(TypeError);
    expect(() => updateStamina(state, { deltaMs: 0 })).toThrow(RangeError);
    expect(() => updateStamina(state, { deltaMs: 16, sprinting: "no" })).toThrow(TypeError);
    expect(() => updateStamina(state, { deltaMs: 16, extraCost: -1 })).toThrow(RangeError);

    const snapshot = snapshotStamina(state);
    snapshot.current = 0;
    expect(state.current).toBe(100);
    expect(() => snapshotStamina(null)).toThrow(TypeError);
  });
});
