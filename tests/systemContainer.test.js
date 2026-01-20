import { describe, expect, it } from "vitest";
import { createFeatureToggles } from "../shared/featureToggles.js";
import { createSystemContainer } from "../shared/simulation/systemContainer.js";

describe("system container", () => {
  it("registers systems and runs lifecycle hooks in dependency order", () => {
    const calls = [];
    const container = createSystemContainer({ context: { seed: 7 } });

    container.registerSystem({
      name: "physics",
      factory: ({ context }) => ({
        init: () => calls.push(`init-physics-${context.seed}`),
        update: () => calls.push("update-physics"),
        shutdown: () => calls.push("shutdown-physics"),
        tag: "physics"
      })
    });

    container.registerSystem({
      name: "combat",
      dependencies: ["physics"],
      factory: ({ dependencies }) => ({
        init: () => calls.push(`init-combat-${dependencies.physics.tag}`),
        update: () => calls.push("update-combat"),
        shutdown: () => calls.push("shutdown-combat")
      })
    });

    container.initAll();
    container.updateAll();
    container.shutdownAll();

    expect(calls).toEqual([
      "init-physics-7",
      "init-combat-physics",
      "update-physics",
      "update-combat",
      "shutdown-combat",
      "shutdown-physics"
    ]);
  });

  it("skips disabled systems and supports optional dependencies", () => {
    const toggles = createFeatureToggles({ "feature.ai": false });
    const container = createSystemContainer({ featureToggles: toggles });

    container.registerSystem({
      name: "ai",
      toggleKey: "feature.ai",
      factory: () => ({
        init: () => {},
        update: () => {},
        shutdown: () => {}
      })
    });

    container.registerSystem({
      name: "ui",
      dependencies: [{ name: "ai", optional: true }],
      factory: ({ dependencies }) => ({
        init: () => {
          expect(dependencies.ai).toBeNull();
        },
        update: () => {},
        shutdown: () => {}
      })
    });

    container.initAll();
    expect(container.getSystem("ai")).toBeNull();
  });

  it("throws when required dependencies are disabled", () => {
    const toggles = createFeatureToggles({ "feature.ai": false });
    const container = createSystemContainer({ featureToggles: toggles });

    container.registerSystem({
      name: "ai",
      toggleKey: "feature.ai",
      factory: () => ({
        init: () => {},
        update: () => {},
        shutdown: () => {}
      })
    });

    container.registerSystem({
      name: "ui",
      dependencies: ["ai"],
      factory: () => ({
        init: () => {},
        update: () => {},
        shutdown: () => {}
      })
    });

    expect(() => container.resolveAll()).toThrow(
      "system 'ui' requires disabled dependency 'ai'"
    );
  });

  it("validates inputs and lifecycle contracts", () => {
    const container = createSystemContainer();

    expect(() => container.registerSystem()).toThrow(
      "system name must be a non-empty string"
    );

    expect(() =>
      container.registerSystem({
        name: "bad",
        factory: "nope"
      })
    ).toThrow("factory must be a function");

    expect(() =>
      container.registerSystem({
        name: "deps",
        factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} }),
        dependencies: {}
      })
    ).toThrow("dependencies must be an array");

    expect(() =>
      container.registerSystem({
        name: "depsEntry",
        factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} }),
        dependencies: [123]
      })
    ).toThrow("dependency entries must be strings or objects");

    expect(() =>
      container.registerSystem({
        name: "toggle",
        factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} }),
        toggleKey: 123
      })
    ).toThrow("toggle key must be a non-empty string");

    container.registerSystem({
      name: "badLifecycle",
      factory: () => ({ init: "nope" })
    });

    expect(() => container.resolveSystem("badLifecycle")).toThrow(
      "system 'badLifecycle' init must be a function"
    );

    container.registerSystem({
      name: "nullLifecycle",
      factory: () => null
    });

    expect(() => container.resolveSystem("nullLifecycle")).toThrow(
      "system 'nullLifecycle' must be an object"
    );

    container.registerSystem({
      name: "badUpdate",
      factory: () => ({ init: () => {}, update: "nope" })
    });

    expect(() => container.resolveSystem("badUpdate")).toThrow(
      "system 'badUpdate' update must be a function"
    );

    container.registerSystem({
      name: "badShutdown",
      factory: () => ({ init: () => {}, update: () => {}, shutdown: "nope" })
    });

    expect(() => container.resolveSystem("badShutdown")).toThrow(
      "system 'badShutdown' shutdown must be a function"
    );
  });

  it("detects missing systems and circular dependencies", () => {
    const container = createSystemContainer();

    expect(() => container.resolveSystem("missing")).toThrow(
      "system 'missing' not registered"
    );

    container.registerSystem({
      name: "dup",
      factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} })
    });

    expect(() =>
      container.registerSystem({
        name: "dup",
        factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} })
      })
    ).toThrow("system 'dup' already registered");

    container.registerSystem({
      name: "alpha",
      dependencies: ["beta"],
      factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} })
    });

    container.registerSystem({
      name: "beta",
      dependencies: ["alpha"],
      factory: () => ({ init: () => {}, update: () => {}, shutdown: () => {} })
    });

    expect(() => container.resolveAll()).toThrow(
      "system 'alpha' has circular dependencies"
    );
  });

  it("requires valid container configuration", () => {
    expect(() => createSystemContainer({ context: [] })).toThrow(
      "context must be an object"
    );

    expect(() => createSystemContainer({ featureToggles: {} })).toThrow(
      "featureToggles must expose isEnabled"
    );
  });
});
