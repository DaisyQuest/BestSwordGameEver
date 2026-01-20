import { describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  reset: vi.fn(),
  step: vi.fn()
}));

vi.mock("../shared/demo/demoSession.js", () => ({
  createDemoSession: () => mockSession
}));

const buildSnapshot = ({ exhausted = false, max = 100, posture, weapons = true, geometry = true } = {}) => ({
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
        pose: { angle: 0.3, swingPhase: 0.2, swinging: false }
      },
      rival: {
        weapon: {
          length: 1.6,
          geometry: { points: [{ x: 0, y: 0.2 }, { x: 1.2, y: 0 }, { x: 0, y: -0.2 }] }
        },
        pose: { angle: 1.4, swingPhase: 0.7, swinging: true }
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
  restore: vi.fn()
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
});
