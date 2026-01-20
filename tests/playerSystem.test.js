import { describe, expect, it } from "vitest";
import { createPhysicsWorld } from "../shared/physics/physicsSystem.js";
import { createPlayerSystem } from "../shared/simulation/playerSystem.js";

describe("playerSystem", () => {
  it("manages players and validates identifiers", () => {
    const system = createPlayerSystem();
    expect(() => system.addPlayer()).toThrow(TypeError);
    expect(() => system.addPlayer({ id: "" })).toThrow(TypeError);
    expect(() => system.getPlayer("")).toThrow(TypeError);
    expect(() => system.removePlayer("")).toThrow(TypeError);

    const player = system.addPlayer({ id: "hero", model: { dominantHand: "left" } });
    expect(player.id).toBe("hero");
    expect(player.model.dominantHand).toBe("left");
    expect(system.getPlayer("hero")).toBe(player);
    expect(() => system.addPlayer({ id: "hero" })).toThrow(RangeError);

    expect(system.snapshotPlayer("hero").lastVelocity).toBeNull();
    expect(system.removePlayer("hero")).toBe(true);
    expect(system.getPlayer("hero")).toBeNull();
    expect(system.removePlayer("hero")).toBe(false);
  });

  it("applies damage reports to player models", () => {
    const system = createPlayerSystem();
    system.addPlayer({ id: "hero" });

    expect(() => system.applyDamageReport("missing", { part: "leftArm" })).toThrow(RangeError);
    expect(system.applyDamageReport("hero", { part: "head" })).toBeNull();

    const report = system.applyDamageReport("hero", { part: "leftArm", severed: true });
    expect(report.status).toBe("severed");
    expect(system.getPlayer("hero").model.limbs.leftArm.integrity).toBe(0);
  });

  it("updates balance and tracks velocity", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
    world.createBody({ id: "hero", velocity: { x: 2, y: 0 }, damping: 1 });

    const system = createPlayerSystem({ balance: { impactThreshold: 0 } });
    system.addPlayer({ id: "hero" });

    const report = system.updateBalance(world, "hero", "hero", {
      deltaMs: 1000,
      previousVelocity: { x: 0, y: 0 }
    });
    expect(report.impactUpdates).toHaveLength(2);
    expect(system.getPlayer("hero").lastVelocity).toEqual({ x: 2, y: 0 });

    world.getBody("hero").velocity.x = 3;
    const second = system.updateBalance(world, "hero", "hero", { deltaMs: 1000 });
    expect(second.impactUpdates).toHaveLength(2);
    expect(system.getPlayer("hero").lastVelocity).toEqual({ x: 3, y: 0 });
  });

  it("respects balance options and snapshots players", () => {
    const body = { velocity: { x: 1, y: 0 } };
    let calls = 0;
    const world = {
      getBody: () => {
        calls += 1;
        return calls === 1 ? body : null;
      }
    };

    const system = createPlayerSystem({ balance: { impactThreshold: 0 } });
    const player = system.addPlayer({ id: "hero" });
    player.lastVelocity = { x: 5, y: 0 };

    const report = system.updateBalance(world, "hero", "hero", {
      deltaMs: 1000,
      useStoredVelocity: false
    });
    expect(report.impactUpdates).toEqual([]);
    expect(player.lastVelocity).toEqual({ x: 5, y: 0 });

    const snapshot = system.snapshotPlayer("hero");
    snapshot.model.limbs.leftArm.status = "severed";
    snapshot.lastVelocity.x = 0;
    expect(player.model.limbs.leftArm.status).toBe("healthy");
    expect(player.lastVelocity.x).toBe(5);

    expect(() => system.snapshotPlayer("missing")).toThrow(RangeError);
  });

  it("validates options and missing players in balance updates", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
    world.createBody({ id: "hero" });
    const system = createPlayerSystem();
    system.addPlayer({ id: "hero" });

    expect(() => system.updateBalance(world, "hero", "hero", "nope")).toThrow(TypeError);
    expect(() => system.updateBalance(world, "hero", "missing", { deltaMs: 16 })).toThrow(RangeError);
    system.getPlayer("hero").lastVelocity = { x: 0, y: 0 };
    expect(() => system.updateBalance(world, "hero", "hero")).toThrow(RangeError);

    const report = system.updateBalance(world, "hero", "hero", { deltaMs: 16 });
    expect(report.posture).toBe("steady");
  });
});
