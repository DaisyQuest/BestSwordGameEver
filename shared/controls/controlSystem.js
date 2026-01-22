const DEFAULT_BINDINGS = {
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  moveAscend: "ShiftLeft",
  moveDescend: "ControlLeft",
  kickPrimary: "Space",
  kickSecondary: "Shift+Space",
  grabLeft: "KeyQ",
  grabRight: "KeyE"
};

const validateBindings = (bindings) => {
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    throw new TypeError("bindings must be an object");
  }
  for (const [action, key] of Object.entries(bindings)) {
    if (typeof action !== "string" || action.length === 0) {
      throw new TypeError("binding action must be a non-empty string");
    }
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("binding key must be a non-empty string");
    }
  }
};

const normalizeKey = (key) => key.trim();

export const createControlMapper = ({ bindings = DEFAULT_BINDINGS } = {}) => {
  validateBindings(bindings);
  const mapping = new Map(Object.entries(bindings));

  const remap = (action, key) => {
    if (typeof action !== "string" || action.length === 0) {
      throw new TypeError("action must be a non-empty string");
    }
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }
    mapping.set(action, normalizeKey(key));
  };

  const getBinding = (action) => {
    if (typeof action !== "string" || action.length === 0) {
      throw new TypeError("action must be a non-empty string");
    }
    return mapping.get(action) ?? null;
  };

  const snapshot = () => Object.fromEntries(mapping.entries());

  const mapInputs = (inputs = []) => {
    if (!Array.isArray(inputs)) {
      throw new TypeError("inputs must be an array");
    }
    const active = new Set();

    for (const input of inputs) {
      if (!input || typeof input !== "object") {
        throw new TypeError("input entries must be objects");
      }
      if (typeof input.code !== "string" || input.code.length === 0) {
        throw new TypeError("input.code must be a non-empty string");
      }
      if (typeof input.active !== "boolean") {
        throw new TypeError("input.active must be boolean");
      }
      if (input.active) {
        active.add(normalizeKey(input.code));
      }
    }

    const intent = {
      move: {
        x: 0,
        y: 0,
        z: 0
      },
      kicks: {
        primary: false,
        secondary: false
      },
      grabs: {
        left: false,
        right: false
      }
    };

    const moveUp = mapping.get("moveUp");
    const moveDown = mapping.get("moveDown");
    const moveLeft = mapping.get("moveLeft");
    const moveRight = mapping.get("moveRight");
    const moveAscend = mapping.get("moveAscend");
    const moveDescend = mapping.get("moveDescend");

    if (moveUp && active.has(moveUp)) {
      intent.move.y += 1;
    }
    if (moveDown && active.has(moveDown)) {
      intent.move.y -= 1;
    }
    if (moveLeft && active.has(moveLeft)) {
      intent.move.x -= 1;
    }
    if (moveRight && active.has(moveRight)) {
      intent.move.x += 1;
    }
    if (moveAscend && active.has(moveAscend)) {
      intent.move.z += 1;
    }
    if (moveDescend && active.has(moveDescend)) {
      intent.move.z -= 1;
    }

    const kickPrimary = mapping.get("kickPrimary");
    const kickSecondary = mapping.get("kickSecondary");

    if (kickPrimary && active.has(kickPrimary)) {
      intent.kicks.primary = true;
    }
    if (kickSecondary && active.has(kickSecondary)) {
      intent.kicks.secondary = true;
    }

    const grabLeft = mapping.get("grabLeft");
    const grabRight = mapping.get("grabRight");

    if (grabLeft && active.has(grabLeft)) {
      intent.grabs.left = true;
    }
    if (grabRight && active.has(grabRight)) {
      intent.grabs.right = true;
    }

    const magnitude = Math.hypot(intent.move.x, intent.move.y, intent.move.z);
    if (magnitude > 1) {
      intent.move.x = intent.move.x / magnitude;
      intent.move.y = intent.move.y / magnitude;
      intent.move.z = intent.move.z / magnitude;
    }

    return intent;
  };

  return {
    remap,
    getBinding,
    snapshot,
    mapInputs
  };
};
