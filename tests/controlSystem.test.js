import { describe, expect, it } from "vitest";
import { createControlMapper } from "../shared/controls/controlSystem.js";

describe("controlSystem", () => {
  it("validates bindings and remapping", () => {
    expect(() => createControlMapper({ bindings: null })).toThrow(TypeError);
    expect(() => createControlMapper({ bindings: [] })).toThrow(TypeError);
    expect(() => createControlMapper({ bindings: { "": "KeyW" } })).toThrow(TypeError);
    expect(() => createControlMapper({ bindings: { moveUp: "" } })).toThrow(TypeError);

    const mapper = createControlMapper();
    expect(() => mapper.remap("", "KeyZ")).toThrow(TypeError);
    expect(() => mapper.remap("moveUp", "")).toThrow(TypeError);
    mapper.remap("moveUp", " KeyZ ");
    expect(mapper.getBinding("moveUp")).toBe("KeyZ");
    expect(mapper.getBinding("unknown")).toBeNull();
    expect(mapper.snapshot()).toHaveProperty("moveUp", "KeyZ");
    expect(() => mapper.getBinding("")).toThrow(TypeError);
  });

  it("maps inputs into intents", () => {
    const mapper = createControlMapper();
    const intent = mapper.mapInputs([
      { code: "KeyW", active: true },
      { code: "KeyA", active: true },
      { code: "Space", active: true },
      { code: "KeyQ", active: true },
      { code: "KeyE", active: false }
    ]);

    expect(intent.move.y).toBeGreaterThan(0);
    expect(intent.move.x).toBeLessThan(0);
    expect(intent.kicks.primary).toBe(true);
    expect(intent.grabs.left).toBe(true);
  });

  it("normalizes diagonal movement", () => {
    const mapper = createControlMapper();
    const intent = mapper.mapInputs([
      { code: "KeyW", active: true },
      { code: "KeyD", active: true }
    ]);

    const magnitude = Math.hypot(intent.move.x, intent.move.y);
    expect(magnitude).toBeCloseTo(1);
  });

  it("supports custom bindings and empty inputs", () => {
    const mapper = createControlMapper({
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

    expect(mapper.mapInputs()).toEqual({
      move: { x: 0, y: 0 },
      kicks: { primary: false, secondary: false },
      grabs: { left: false, right: false }
    });

    const intent = mapper.mapInputs([
      { code: "ArrowDown", active: true },
      { code: "ArrowRight", active: true },
      { code: "KeyK", active: true },
      { code: "KeyI", active: true }
    ]);

    expect(intent.move.y).toBeLessThan(0);
    expect(intent.move.x).toBeGreaterThan(0);
    expect(intent.kicks.secondary).toBe(true);
    expect(intent.grabs.right).toBe(true);
  });

  it("validates input payloads", () => {
    const mapper = createControlMapper();
    expect(() => mapper.mapInputs("KeyW")).toThrow(TypeError);
    expect(() => mapper.mapInputs([null])).toThrow(TypeError);
    expect(() => mapper.mapInputs([{ code: "", active: true }])).toThrow(TypeError);
    expect(() => mapper.mapInputs([{ code: "KeyW", active: "yes" }])).toThrow(TypeError);
  });
});
