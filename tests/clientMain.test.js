import { describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  reset: vi.fn(),
  step: vi.fn()
}));

vi.mock("../shared/demo/demoSession.js", () => ({
  createDemoSession: () => mockSession
}));

const buildSnapshot = ({
  exhausted = false,
  max = 100,
  posture,
  weapons = true,
  geometry = true,
  reach
} = {}) => ({
  arenaRadius: 10,
  player: {
    body: {
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 1 }
    },
    model: {
      stamina: { max, current: exhausted ? 10 : 80, exhausted },
      posture: posture ?? (exhausted ? "stumbling" : "steady")
    }
  },
  rival: {
    body: {
      position: { x: 2, y: 0 },
      velocity: { x: 0, y: 0 }
    },
    model: {
      stamina: { max, current: max, exhausted: false },
      posture: "steady"
    }
  },
  intent: {
    move: { x: 0.5, y: 0.2 }
  },
  weapons: weapons
    ? {
      player: {
        weapon: {
          length: 1.2,
          geometry: geometry ? { points: [{ x: 0, y: 0.1 }, { x: 1, y: 0 }, { x: 0, y: -0.1 }] } : null
        },
        pose: { angle: 0.3, swingPhase: 0.2, swinging: false, reach }
      },
      rival: {
        weapon: {
          length: 1.6,
          geometry: { points: [{ x: 0, y: 0.2 }, { x: 1.2, y: 0 }, { x: 0, y: -0.2 }] }
        },
        pose: { angle: 1.4, swingPhase: 0.7, swinging: true, reach }
      }
    }
    : null
});

const stubContext = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  shadowBlur: 0,
  shadowColor: ""
});

const setupDom = () => {
  const handlers = {};
  const canvasContext = stubContext();
  const elements = {
    "#arena": {
      getContext: () => canvasContext,
      getBoundingClientRect: () => ({ width: 960, height: 640 })
    },
    "#stamina-fill": { style: {} },
    "#stamina-value": { textContent: "" },
    "#posture": { textContent: "" },
    "#speed": { textContent: "" },
    "#intent": { textContent: "" },
    "#motion": { textContent: "" },
    "#reset": {
      addEventListener: (event, handler) => {
        handlers.click = handler;
      }
    }
  };

  globalThis.document = {
    querySelector: (selector) => elements[selector]
  };

  const rafCallbacks = [];
  globalThis.requestAnimationFrame = (callback) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  };

  globalThis.window = {
    devicePixelRatio: 0,
    addEventListener: (event, handler) => {
      handlers[event] = handler;
    }
  };

  return { canvasContext, elements, handlers, rafCallbacks };
};

describe("client main", () => {
  it("boots the demo UI and updates HUD", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    let stepCount = 0;
    mockSession.getSnapshot.mockImplementation(() => buildSnapshot());
    mockSession.reset.mockImplementation(() => buildSnapshot({ exhausted: false }));
    mockSession.step.mockImplementation(() => {
      stepCount += 1;
      if (stepCount === 1) {
        return buildSnapshot({ exhausted: false, max: 100, weapons: true, posture: "stumbling", geometry: false });
      }
      return buildSnapshot({ exhausted: true, max: 0, posture: "fallen" });
    });

    const { canvasContext, elements, handlers, rafCallbacks } = setupDom();

    await import("../client/main.js");

    const start = performance.now();
    rafCallbacks.shift()(start);
    handlers.keydown({ code: "ShiftRight" });
    rafCallbacks.shift()(start + 16);
    handlers.keyup({ code: "ShiftRight" });
    rafCallbacks.shift()(start + 32);

    handlers.keydown({ code: "KeyR" });
    handlers.keyup({ code: "ShiftLeft" });
    handlers.click();

    expect(mockSession.step).toHaveBeenCalled();
    expect(mockSession.reset).toHaveBeenCalled();
    expect(elements["#stamina-value"].textContent).toContain("/");
    expect(elements["#posture"].textContent.length).toBeGreaterThan(0);
    expect(elements["#motion"].textContent).toBe("Full");
    expect(canvasContext.arc).toHaveBeenCalled();
    expect(canvasContext.ellipse).toHaveBeenCalled();
  });

  it("skips invalid frame deltas and schedules another frame", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSession.getSnapshot.mockImplementation(() => buildSnapshot());
    mockSession.reset.mockImplementation(() => buildSnapshot({ exhausted: false }));
    mockSession.step.mockImplementation(() => buildSnapshot());

    globalThis.performance = { now: () => 1000 };
    const { handlers, rafCallbacks } = setupDom();

    await import("../client/main.js");

    rafCallbacks.shift()(Number.NaN);
    rafCallbacks.shift()(1000);
    rafCallbacks.shift()(999);

    expect(mockSession.step).not.toHaveBeenCalled();
    expect(typeof rafCallbacks[0]).toBe("function");
    handlers.keydown({ code: "KeyR" });
    expect(mockSession.reset).toHaveBeenCalled();

    rafCallbacks.shift()(1016);
    expect(mockSession.step).toHaveBeenCalled();
  });

  it("projects weapon reach around the camera focus", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const snapshot = buildSnapshot({ exhausted: false, weapons: true, geometry: false, reach: 0.6 });
    mockSession.getSnapshot.mockImplementation(() => snapshot);
    mockSession.reset.mockImplementation(() => snapshot);
    mockSession.step.mockImplementation(() => snapshot);

    const { canvasContext, rafCallbacks } = setupDom();

    await import("../client/main.js");

    const start = performance.now();
    rafCallbacks.shift()(start);
    rafCallbacks.shift()(start + 16);

    const focus = {
      x: (snapshot.player.body.position.x + snapshot.rival.body.position.x) / 2,
      y: (snapshot.player.body.position.y + snapshot.rival.body.position.y) / 2
    };
    const center = { x: 960 / 2, y: 640 * 0.58 };
    const scale = Math.min(960, 640) / (snapshot.arenaRadius * 2);
    const postureHeight = snapshot.player.model.posture === "fallen"
      ? 0.4
      : snapshot.player.model.posture === "stumbling"
        ? 1.1
        : 1.5;
    const handHeight = postureHeight * 0.7;
    const anchor = {
      x: snapshot.player.body.position.x,
      y: snapshot.player.body.position.y,
      z: handHeight
    };
    const tip = {
      x: anchor.x + Math.cos(snapshot.weapons.player.pose.angle) * snapshot.weapons.player.pose.reach,
      y: anchor.y + Math.sin(snapshot.weapons.player.pose.angle) * snapshot.weapons.player.pose.reach,
      z: handHeight + snapshot.weapons.player.pose.swingPhase * 0.2
    };
    const projectPoint = (point) => {
      const relativeX = point.x - focus.x;
      const relativeY = point.y - focus.y;
      const isoX = (relativeX - relativeY) * 0.7;
      const isoY = (relativeX + relativeY) * 0.35 - point.z * 0.75;
      return {
        x: center.x + isoX * scale,
        y: center.y + isoY * scale
      };
    };
    const expectedTip = projectPoint(tip);

    const matched = canvasContext.lineTo.mock.calls.some(
      ([x, y]) => Math.abs(x - expectedTip.x) < 0.1 && Math.abs(y - expectedTip.y) < 0.1
    );
    expect(matched).toBe(true);
  });

  it("renders safely when weapons are missing", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const snapshot = buildSnapshot({ weapons: false });
    mockSession.getSnapshot.mockImplementation(() => snapshot);
    mockSession.reset.mockImplementation(() => snapshot);
    mockSession.step.mockImplementation(() => snapshot);

    const { rafCallbacks } = setupDom();
    await import("../client/main.js");

    const start = performance.now();
    rafCallbacks.shift()(start);
    rafCallbacks.shift()(start + 16);

    expect(mockSession.step).toHaveBeenCalled();
  });

  it("scales weapon geometry to match reach", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const snapshot = buildSnapshot({ exhausted: false, weapons: true, geometry: true, reach: 2.4 });
    mockSession.getSnapshot.mockImplementation(() => snapshot);
    mockSession.reset.mockImplementation(() => snapshot);
    mockSession.step.mockImplementation(() => snapshot);

    const { canvasContext, rafCallbacks } = setupDom();

    await import("../client/main.js");

    const start = performance.now();
    rafCallbacks.shift()(start);
    rafCallbacks.shift()(start + 16);

    const focus = {
      x: (snapshot.player.body.position.x + snapshot.rival.body.position.x) / 2,
      y: (snapshot.player.body.position.y + snapshot.rival.body.position.y) / 2
    };
    const center = { x: 960 / 2, y: 640 * 0.58 };
    const scale = Math.min(960, 640) / (snapshot.arenaRadius * 2);
    const postureHeight = snapshot.player.model.posture === "fallen"
      ? 0.4
      : snapshot.player.model.posture === "stumbling"
        ? 1.1
        : 1.5;
    const handHeight = postureHeight * 0.7;
    const geometryScale = snapshot.weapons.player.pose.reach / snapshot.weapons.player.weapon.length;
    const point = snapshot.weapons.player.weapon.geometry.points[1];
    const rotated = {
      x: snapshot.player.body.position.x
        + Math.cos(snapshot.weapons.player.pose.angle) * point.x * geometryScale
        - Math.sin(snapshot.weapons.player.pose.angle) * point.y * geometryScale,
      y: snapshot.player.body.position.y
        + Math.sin(snapshot.weapons.player.pose.angle) * point.x * geometryScale
        + Math.cos(snapshot.weapons.player.pose.angle) * point.y * geometryScale,
      z: handHeight + snapshot.weapons.player.pose.swingPhase * 0.2
    };
    const relativeX = rotated.x - focus.x;
    const relativeY = rotated.y - focus.y;
    const isoX = (relativeX - relativeY) * 0.7;
    const isoY = (relativeX + relativeY) * 0.35 - rotated.z * 0.75;
    const expected = {
      x: center.x + isoX * scale,
      y: center.y + isoY * scale
    };

    const matched = canvasContext.lineTo.mock.calls.some(
      ([x, y]) => Math.abs(x - expected.x) < 0.1 && Math.abs(y - expected.y) < 0.1
    );
    expect(matched).toBe(true);
  });

  it("toggles reduced motion rendering", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const snapshot = buildSnapshot({ exhausted: false, weapons: true, geometry: false, reach: 1 });
    mockSession.getSnapshot.mockImplementation(() => snapshot);
    mockSession.reset.mockImplementation(() => snapshot);
    mockSession.step.mockImplementation(() => snapshot);

    const { canvasContext, elements, handlers, rafCallbacks } = setupDom();

    await import("../client/main.js");

    const start = performance.now();
    rafCallbacks.shift()(start);
    rafCallbacks.shift()(start + 16);
    expect(elements["#motion"].textContent).toBe("Full");
    expect(canvasContext.shadowBlur).toBe(12);

    handlers.keydown({ code: "KeyM" });
    rafCallbacks.shift()(start + 32);

    expect(elements["#motion"].textContent).toBe("Reduced");
    expect(canvasContext.shadowBlur).toBe(0);
  });
});
