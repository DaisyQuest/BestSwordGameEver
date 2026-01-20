import { describe, expect, it } from "vitest";
import { __testables, createDemoSession } from "../shared/demo/demoSession.js";

const {
  buildRivalIntent,
  buildSpawnPositions,
  clampInsideArena,
  computeStaminaMultiplier,
  normalizeStepOptions,
  buildWeaponLoadout,
  computeWeaponPose,
  buildWeaponState
} = __testables;

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
    expect(() => createDemoSession({ locomotion: "nope" })).toThrow(TypeError);
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
    expect(step.locomotion.player.forceMultiplier).toBeCloseTo(1);
    expect(step.locomotion.player.limping).toBe(false);
    expect(step.weapons.player.weapon.type).toBe("sword");
    expect(step.weapons.rival.weapon.type).toBe("spear");
    expect(step.weapons.player.weapon.geometry.points.length).toBeGreaterThan(3);
    expect(step.weapons.rival.weapon.geometry.points.length).toBeGreaterThan(3);

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

  it("restores spawn positions after reset", () => {
    const session = createDemoSession({
      arenaRadius: 6,
      spawnOffset: 4,
      stamina: { max: 20, current: 20 }
    });

    const moved = session.step(1000, [{ code: "KeyD", active: true }]);
    expect(moved.player.body.position.x).not.toBeCloseTo(-4);

    const reset = session.reset();
    expect(reset.player.body.position.x).toBeCloseTo(-4);
    expect(reset.rival.body.position.x).toBeCloseTo(4);
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

  it("builds weapons and weapon poses", () => {
    const loadout = buildWeaponLoadout(
      {
        player: { type: "dagger", sharpness: 0.9, mass: 1, length: 0.5, balance: 0.8 },
        rival: { type: "mace", sharpness: 0.1, mass: 4, length: 1.1, balance: 0.4 }
      },
      { player: "hero", rival: "rival" }
    );
    expect(loadout.player.type).toBe("dagger");
    expect(loadout.rival.type).toBe("mace");

    expect(() => buildWeaponLoadout("bad", { player: "hero", rival: "rival" })).toThrow(TypeError);
    expect(() => buildWeaponLoadout({ player: "bad" }, { player: "hero", rival: "rival" })).toThrow(TypeError);

    const pose = computeWeaponPose(1000, {
      weapon: loadout.player,
      dominantHand: "left",
      phaseOffset: 0.5,
      swingSpeed: 1,
      swingArc: 0.5,
      guardAngle: 0.2
    });
    expect(pose.dominantHand).toBe("left");
    expect(pose.reach).toBeGreaterThan(0);
    expect(pose.swinging).toBe(false);

    const swingPose = computeWeaponPose(250, {
      weapon: loadout.player,
      dominantHand: "right",
      phaseOffset: 0,
      swingSpeed: 1,
      swingArc: 0.5,
      guardAngle: 0.2
    });
    expect(swingPose.swinging).toBe(true);

    expect(() => computeWeaponPose(-1, { weapon: loadout.player })).toThrow(RangeError);
    expect(() => computeWeaponPose(0, { weapon: null })).toThrow(TypeError);
    expect(() => computeWeaponPose(0, { weapon: loadout.player, dominantHand: "both" })).toThrow(RangeError);
    expect(() => computeWeaponPose(0, { weapon: loadout.player, swingSpeed: 10 })).toThrow(RangeError);
    expect(() => computeWeaponPose(0, { weapon: loadout.player, swingArc: -1 })).toThrow(RangeError);
    expect(() => computeWeaponPose(0, { weapon: loadout.player, guardAngle: 2 })).toThrow(RangeError);
    expect(() => computeWeaponPose(0, { weapon: loadout.player, phaseOffset: 3 })).toThrow(RangeError);

    const state = buildWeaponState({
      weapon: loadout.rival,
      model: { dominantHand: "right", stamina: { exhausted: true }, posture: "fallen" },
      elapsedMs: 500
    });
    expect(state.pose.swinging).toBeTypeOf("boolean");
    expect(state.pose.dominantHand).toBe("right");

    const restedState = buildWeaponState({
      weapon: loadout.player,
      model: { dominantHand: "left", stamina: { exhausted: false }, posture: "steady" },
      elapsedMs: 0
    });
    expect(restedState.pose.swinging).toBe(false);

    expect(() => buildWeaponState({ weapon: null })).toThrow(TypeError);
    expect(() => buildWeaponState({ weapon: loadout.player, model: null })).toThrow(TypeError);
  });

  it("validates deltaMs", () => {
    const session = createDemoSession();
    expect(() => session.step(0, [])).toThrow(RangeError);
  });
});
