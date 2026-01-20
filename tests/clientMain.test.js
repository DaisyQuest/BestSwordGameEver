import { describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  reset: vi.fn(),
  step: vi.fn()
}));

vi.mock("../shared/demo/demoSession.js", () => ({
  createDemoSession: () => mockSession
}));

const buildSnapshot = ({ exhausted = false, max = 100 } = {}) => ({
  arenaRadius: 10,
  player: {
    body: {
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 1 }
    },
    model: {
      stamina: { max, current: exhausted ? 10 : 80, exhausted },
      posture: exhausted ? "stumbling" : "steady"
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
  }
});

const stubContext = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  save: vi.fn(),
  restore: vi.fn()
});

describe("client main", () => {
  it("boots the demo UI and updates HUD", async () => {
    let stepCount = 0;
    mockSession.getSnapshot.mockImplementation(() => buildSnapshot());
    mockSession.reset.mockImplementation(() => buildSnapshot({ exhausted: false }));
    mockSession.step.mockImplementation(() => {
      stepCount += 1;
      if (stepCount === 1) {
        return buildSnapshot({ exhausted: false, max: 100 });
      }
      return buildSnapshot({ exhausted: true, max: 0 });
    });

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

    await import("../client/main.js");

    handlers.keydown({ code: "ShiftRight" });
    rafCallbacks.shift()(1000);
    handlers.keyup({ code: "ShiftRight" });
    rafCallbacks.shift()(1100);

    handlers.keydown({ code: "KeyR" });
    handlers.keyup({ code: "ShiftLeft" });
    handlers.click();

    expect(mockSession.step).toHaveBeenCalled();
    expect(mockSession.reset).toHaveBeenCalled();
    expect(elements["#stamina-value"].textContent).toContain("/");
    expect(elements["#posture"].textContent.length).toBeGreaterThan(0);
    expect(canvasContext.arc).toHaveBeenCalled();
  });
});
