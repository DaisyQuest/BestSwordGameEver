import { describe, expect, it } from "vitest";
import { createPhysicsWorld } from "../shared/physics/physicsSystem.js";

describe("physicsSystem", () => {
  it("validates world and body configuration", () => {
    expect(() => createPhysicsWorld({ gravity: null })).toThrow(TypeError);
    expect(() => createPhysicsWorld({ gravity: { x: 0, y: "down" } })).toThrow(RangeError);
    expect(() => createPhysicsWorld({ maxSpeed: 0 })).toThrow(RangeError);

    const world = createPhysicsWorld();
    expect(() => world.createBody({ id: "" })).toThrow(TypeError);
    expect(() => world.createBody({ id: "hero", mass: 0 })).toThrow(RangeError);
    expect(() => world.createBody({ id: "hero", damping: 2 })).toThrow(RangeError);
    expect(() => world.createBody({ id: "hero", position: { x: "0", y: 0 } })).toThrow(RangeError);
    world.createBody({ id: "hero" });
    expect(() => world.createBody({ id: "hero" })).toThrow(RangeError);
  });

  it("applies forces, gravity, and damping", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: -10 }, maxSpeed: 100 });
    world.createBody({ id: "actor", mass: 2, damping: 0.5 });

    world.applyForce("actor", { x: 4, y: 0 });
    world.step(1000);

    const body = world.getBody("actor");
    expect(body.velocity.x).toBeCloseTo(1);
    expect(body.velocity.y).toBeCloseTo(-5);
    expect(body.position.x).toBeCloseTo(1);
    expect(body.position.y).toBeCloseTo(-5);
  });

  it("clamps speed and clears forces", () => {
    const world = createPhysicsWorld({ gravity: { x: 0, y: 0 }, maxSpeed: 1 });
    world.createBody({ id: "runner", mass: 1, damping: 1 });

    world.applyForce("runner", { x: 10, y: 0 });
    world.step(1000);

    const body = world.getBody("runner");
    expect(Math.hypot(body.velocity.x, body.velocity.y)).toBeCloseTo(1);

    world.step(1000);
    expect(body.velocity.x).toBeCloseTo(1);
  });

  it("validates step and force inputs", () => {
    const world = createPhysicsWorld();
    world.createBody({ id: "actor" });

    expect(() => world.step(0)).toThrow(RangeError);
    expect(() => world.applyForce("actor", { x: 0, y: NaN })).toThrow(RangeError);
    expect(() => world.applyForce("missing", { x: 1, y: 1 })).toThrow(RangeError);
  });

  it("removes bodies and snapshots state", () => {
    const world = createPhysicsWorld();
    world.createBody({ id: "alpha", position: { x: 1, y: 2 } });
    world.createBody({ id: "beta", position: { x: 3, y: 4 } });

    const snapshot = world.snapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]).toMatchObject({ id: "alpha" });
    expect(world.getBody("missing")).toBeNull();

    expect(world.removeBody("alpha")).toBe(true);
    expect(world.getBody("alpha")).toBeNull();
    expect(world.removeBody("missing")).toBe(false);
  });

  it("allows stepping with no bodies", () => {
    const world = createPhysicsWorld();
    world.step(16);
    expect(world.snapshot()).toEqual([]);
  });
});
