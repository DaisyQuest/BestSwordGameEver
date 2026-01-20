import { describe, expect, it } from "vitest";
import { createSimulation } from "../shared/simulation/simulationSystem.js";

describe("simulationSystem", () => {
  it("adds and removes actors", () => {
    const sim = createSimulation();
    const actor = sim.addActor({ id: "hero" });
    expect(actor.id).toBe("hero");
    expect(sim.getActor("hero")).not.toBeNull();
    expect(() => sim.addActor({ id: "hero" })).toThrow(RangeError);

    expect(sim.removeActor("hero")).toBe(true);
    expect(sim.getActor("hero")).toBeNull();
    expect(sim.removeActor("hero")).toBe(false);
  });

  it("steps actors with inputs and movement", () => {
    const sim = createSimulation({ physics: { gravity: { x: 0, y: 0 }, maxSpeed: 50 } });
    sim.addActor({ id: "hero", body: { mass: 1, damping: 1 } });

    const result = sim.step(1000, "hero", [{ code: "KeyW", active: true }]);
    expect(result.intent.move.y).toBeGreaterThan(0);
    expect(result.movement.applied).toBe(true);
    expect(result.body.position.y).toBeGreaterThan(0);
  });

  it("supports per-actor bindings", () => {
    const sim = createSimulation();
    sim.addActor({
      id: "archer",
      bindings: {
        moveUp: "ArrowUp",
        moveDown: "ArrowDown",
        moveLeft: "ArrowLeft",
        moveRight: "ArrowRight",
        kickPrimary: "KeyJ",
        kickSecondary: "KeyK",
        grabLeft: "KeyU",
        grabRight: "KeyI"
      }
    });

    const result = sim.step(16, "archer", [{ code: "ArrowLeft", active: true }]);
    expect(result.intent.move.x).toBeLessThan(0);
  });

  it("validates actor ids and inputs", () => {
    const sim = createSimulation();
    expect(() => sim.addActor()).toThrow(TypeError);
    expect(() => sim.getActor("")).toThrow(TypeError);
    expect(() => sim.removeActor(123)).toThrow(TypeError);
    expect(() => sim.step(16, "missing", [])).toThrow(RangeError);
    sim.addActor({ id: "hero" });
    expect(() => sim.step(16, "hero", "inputs")).toThrow(TypeError);
  });

  it("accepts undefined inputs and sprint options", () => {
    const sim = createSimulation({ movement: { maxAcceleration: 10, sprintMultiplier: 2 } });
    sim.addActor({ id: "runner", body: { mass: 1, damping: 1 } });

    const normal = sim.step(100, "runner", undefined);
    expect(normal.intent.move).toEqual({ x: 0, y: 0 });

    const sprint = sim.step(100, "runner", [{ code: "KeyD", active: true }], { sprint: true });
    expect(sprint.movement.force.x).toBeGreaterThan(10);
  });
});
