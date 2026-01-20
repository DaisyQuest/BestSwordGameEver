import { describe, expect, it } from "vitest";
import { __testables, createDemoSession } from "../shared/demo/demoSession.js";

const { buildRivalIntent, buildSpawnPositions, clampInsideArena, computeStaminaMultiplier, normalizeStepOptions } =
  __testables;

describe("demoSession", () => {
  it("validates configuration and ids", () => {
    expect(() => createDemoSession({ arenaRadius: 0 })).toThrow(RangeError);
    expect(() => createDemoSession({ spawnOffset: -1 })).toThrow(RangeError);
    expect(() => createDemoSession({ playerId: "" })).toThrow(TypeError);
    expect(() => createDemoSession({ rivalId: "" })).toThrow(TypeError);
    expect(() => createDemoSession({ playerId: "hero", rivalId: "hero" })).toThrow(RangeError);
    expect(() => createDemoSession({ physics: "nope" })).toThrow(TypeError);
    expect(() => createDemoSession({ movement: [] })).toThrow(TypeError);
    expect(() => createDemoSession({ stamina: 2 })).toThrow(TypeError);
    expect(() => createDemoSession({ balance: "bad" })).toThrow(TypeError);
  });

  it("steps the session and updates stamina + balance", () => {
    const session = createDemoSession({
      stamina: { max: 50, current: 30, regenRate: 10, sprintCost: 20, exhaustionThreshold: 0.3 },
      balance: { impactThreshold: 0 },
      physics: { gravity: { x: 0, y: 0 }, maxSpeed: 50 }
    });

    const snapshot = session.getSnapshot();
    expect(snapshot.player.body.position.x).toBeLessThan(0);
    expect(snapshot.rival.body.position.x).toBeGreaterThan(0);

    const step = session.step(1000, [{ code: "KeyW", active: true }], { sprint: true });
    expect(step.intent.move.y).toBeGreaterThan(0);
    expect(step.stamina.drained).toBeGreaterThan(0);
    expect(step.balance.posture).toBeDefined();

    const rest = session.step(1000, [], { sprint: false });
    expect(rest.stamina.regenerated).toBeGreaterThan(0);
  });

  it("prevents sprint when exhausted and applies clamp", () => {
    const session = createDemoSession({
      arenaRadius: 3,
      spawnOffset: 2,
      stamina: { max: 10, current: 1, exhaustionThreshold: 0.2, regenRate: 0, sprintCost: 5 },
      balance: { impactThreshold: 0 },
      physics: { gravity: { x: 0, y: 0 }, maxSpeed: 100 },
      movement: { maxAcceleration: 50 }
    });

    const step = session.step(1000, [{ code: "KeyD", active: true }], { sprint: true });
    expect(step.sprinting).toBe(false);
    expect(step.clamped.player).toBe(true);
    const distance = Math.hypot(
      step.player.body.position.x,
      step.player.body.position.y
    );
    expect(distance).toBeLessThanOrEqual(step.arenaRadius);
  });

  it("resets the session state", () => {
    const session = createDemoSession({ stamina: { max: 40, current: 10 } });
    session.step(1000, [{ code: "KeyW", active: true }], { sprint: true });
    const reset = session.reset();
    expect(reset.timeMs).toBe(0);
    expect(reset.player.body.position.x).toBeLessThan(0);
    expect(reset.player.model.stamina.current).toBe(10);
  });

  it("covers helper utilities", () => {
    expect(normalizeStepOptions().sprint).toBe(false);
    expect(normalizeStepOptions(undefined).sprint).toBe(false);
    expect(() => normalizeStepOptions("nope")).toThrow(TypeError);
    expect(() => normalizeStepOptions({ sprint: "yes" })).toThrow(TypeError);

    const spawn = buildSpawnPositions(10, 3);
    expect(spawn.player.x).toBeLessThan(0);
    expect(() => buildSpawnPositions(5, 5)).toThrow(RangeError);

    const body = { position: { x: 20, y: 0 }, velocity: { x: 1, y: 1 } };
    const clamped = clampInsideArena(body, 5);
    expect(clamped).toBe(true);
    expect(body.position.x).toBeCloseTo(5);

    const noClamp = clampInsideArena({ position: { x: 1, y: 1 }, velocity: { x: 0, y: 0 } }, 5);
    expect(noClamp).toBe(false);

    expect(() => computeStaminaMultiplier(null)).toThrow(TypeError);
    expect(computeStaminaMultiplier({ max: 10, current: 0, exhausted: true })).toBe(0.6);
    expect(computeStaminaMultiplier({ max: 10, current: 3, exhausted: false })).toBe(0.85);
    expect(computeStaminaMultiplier({ max: 10, current: 9, exhausted: false })).toBe(1);
    expect(computeStaminaMultiplier({ max: 0, current: 0, exhausted: false })).toBe(0.85);

    const rivalIntent = buildRivalIntent(0);
    expect(rivalIntent.move.x).toBeCloseTo(0.6);
  });

  it("validates deltaMs", () => {
    const session = createDemoSession();
    expect(() => session.step(0, [])).toThrow(RangeError);
  });
});
