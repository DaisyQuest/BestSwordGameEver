import { describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  reset: vi.fn(),
  step: vi.fn(),
  setWeapons: vi.fn()
}));

vi.mock("../shared/demo/demoSession.js", () => ({
  createDemoSession: () => mockSession
}));

const ACTOR_HEIGHTS = {
  fallen: 0.6,
  stumbling: 1.4,
  steady: 1.9
};
const WEAPON_RENDER_SCALE = 1.35;
const CAMERA_PROFILE = {
  focusAheadRatio: 0.7,
  shoulderOffset: 1.1,
  centerBiasX: 0.52,
  centerBiasY: 0.62,
  zoomScale: 1.38
};

const buildSnapshot = ({
  exhausted = false,
  max = 100,
  posture,
  weapons = true,
  geometry = true,
  reach,
  weaponType = "sword",
  timeMs = 1000,
  weaponControl
} = {}) => ({
  timeMs,
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
  weaponControl: weaponControl ?? {
    attack: false,
    guard: false,
    aimAngle: 0.4
  },
  intent: {
    move: { x: 0.5, y: 0.2 }
  },
  weapons: weapons
    ? {
      player: {
        weapon: {
          type: weaponType,
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
  shadowColor: "",
  globalAlpha: 1,
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 1
});

const setupDom = () => {
  const handlers = {};
  const canvasContext = stubContext();
  const elements = {
    "#arena": {
      getContext: () => canvasContext,
      getBoundingClientRect: () => ({ width: 960, height: 640 }),
      addEventListener: (event, handler) => {
        handlers[event] = handler;
      }
    },
    "#stamina-fill": { style: {} },
    "#stamina-value": { textContent: "" },
    "#posture": { textContent: "" },
    "#speed": { textContent: "" },
    "#intent": { textContent: "" },
    "#motion": { textContent: "" },
    "#weapon-status": { textContent: "" },
    "#weapon-angle": { textContent: "" },
    "#weapon-loadout": { textContent: "" },
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
    mockSession.setWeapons.mockImplementation(() => buildSnapshot({ weaponType: "mace" }));
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
    handlers.pointerdown({ clientX: 200, clientY: 200 });
    rafCallbacks.shift()(start + 16);
    handlers.keydown({ code: "KeyV" });
    rafCallbacks.shift()(start + 24);
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
    expect(elements["#weapon-status"].textContent.length).toBeGreaterThan(0);
    expect(elements["#weapon-angle"].textContent).toContain("°");
    expect(elements["#weapon-loadout"].textContent.length).toBeGreaterThan(0);
    expect(canvasContext.arc).toHaveBeenCalled();
    expect(canvasContext.ellipse).toHaveBeenCalled();

    const lastCall = mockSession.step.mock.calls.at(-1);
    expect(lastCall[2].weapon.attack).toBe(true);
    expect(mockSession.setWeapons).toHaveBeenCalled();
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

    const toRival = {
      x: snapshot.rival.body.position.x - snapshot.player.body.position.x,
      y: snapshot.rival.body.position.y - snapshot.player.body.position.y
    };
    const distance = Math.hypot(toRival.x, toRival.y) || 1;
    const direction = { x: toRival.x / distance, y: toRival.y / distance };
    const shoulder = { x: -direction.y, y: direction.x };
    const focusDistance = distance * CAMERA_PROFILE.focusAheadRatio;
    const focus = {
      x:
        snapshot.player.body.position.x +
        direction.x * focusDistance +
        shoulder.x * CAMERA_PROFILE.shoulderOffset,
      y:
        snapshot.player.body.position.y +
        direction.y * focusDistance +
        shoulder.y * CAMERA_PROFILE.shoulderOffset
    };
    const center = { x: 960 * CAMERA_PROFILE.centerBiasX, y: 640 * CAMERA_PROFILE.centerBiasY };
    const scale = (Math.min(960, 640) / (snapshot.arenaRadius * 2)) * CAMERA_PROFILE.zoomScale;
    const postureHeight = snapshot.player.model.posture === "fallen"
      ? ACTOR_HEIGHTS.fallen
      : snapshot.player.model.posture === "stumbling"
        ? ACTOR_HEIGHTS.stumbling
        : ACTOR_HEIGHTS.steady;
    const handHeight = postureHeight * 0.7;
    const anchor = {
      x: snapshot.player.body.position.x,
      y: snapshot.player.body.position.y,
      z: handHeight
    };
    const tip = {
      x: anchor.x + Math.cos(snapshot.weapons.player.pose.angle) * snapshot.weapons.player.pose.reach * WEAPON_RENDER_SCALE,
      y: anchor.y + Math.sin(snapshot.weapons.player.pose.angle) * snapshot.weapons.player.pose.reach * WEAPON_RENDER_SCALE,
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

    const toRival = {
      x: snapshot.rival.body.position.x - snapshot.player.body.position.x,
      y: snapshot.rival.body.position.y - snapshot.player.body.position.y
    };
    const distance = Math.hypot(toRival.x, toRival.y) || 1;
    const direction = { x: toRival.x / distance, y: toRival.y / distance };
    const shoulder = { x: -direction.y, y: direction.x };
    const focusDistance = distance * CAMERA_PROFILE.focusAheadRatio;
    const focus = {
      x:
        snapshot.player.body.position.x +
        direction.x * focusDistance +
        shoulder.x * CAMERA_PROFILE.shoulderOffset,
      y:
        snapshot.player.body.position.y +
        direction.y * focusDistance +
        shoulder.y * CAMERA_PROFILE.shoulderOffset
    };
    const center = { x: 960 * CAMERA_PROFILE.centerBiasX, y: 640 * CAMERA_PROFILE.centerBiasY };
    const scale = (Math.min(960, 640) / (snapshot.arenaRadius * 2)) * CAMERA_PROFILE.zoomScale;
    const postureHeight = snapshot.player.model.posture === "fallen"
      ? ACTOR_HEIGHTS.fallen
      : snapshot.player.model.posture === "stumbling"
        ? ACTOR_HEIGHTS.stumbling
        : ACTOR_HEIGHTS.steady;
    const handHeight = postureHeight * 0.7;
    const geometryScale = (snapshot.weapons.player.pose.reach * WEAPON_RENDER_SCALE)
      / snapshot.weapons.player.weapon.length;
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
