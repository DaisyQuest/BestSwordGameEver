const normalizePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number`);
  }
  return value;
};

const normalizeDeadzone = (value) => {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("deadzone must be between 0 (inclusive) and 1 (exclusive)");
  }
  return value;
};

const normalizeIntent = (intent) => {
  if (!intent || typeof intent !== "object") {
    throw new TypeError("intent must be an object");
  }
  if (!intent.move || typeof intent.move !== "object") {
    throw new TypeError("intent.move must be an object");
  }
  const { x, y } = intent.move;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError("intent.move must have finite x/y");
  }
  return { x, y };
};

export const createMovementController = ({
  maxAcceleration = 20,
  deadzone = 0.05,
  sprintMultiplier = 1.5
} = {}) => {
  const resolvedMax = normalizePositive(maxAcceleration, "maxAcceleration");
  const resolvedDeadzone = normalizeDeadzone(deadzone);
  const resolvedSprint = normalizePositive(sprintMultiplier, "sprintMultiplier");

  const computeForce = (intent, { sprint = false } = {}) => {
    if (typeof sprint !== "boolean") {
      throw new TypeError("sprint must be boolean");
    }

    const move = normalizeIntent(intent);
    const magnitude = Math.hypot(move.x, move.y);
    if (magnitude <= resolvedDeadzone) {
      return {
        applied: false,
        force: { x: 0, y: 0 }
      };
    }

    const normalized = magnitude > 1 ? { x: move.x / magnitude, y: move.y / magnitude } : move;
    const accel = resolvedMax * (sprint ? resolvedSprint : 1);

    return {
      applied: true,
      force: {
        x: normalized.x * accel,
        y: normalized.y * accel
      }
    };
  };

  const applyMovement = (world, bodyId, intent, options) => {
    if (!world || typeof world.applyForce !== "function") {
      throw new TypeError("world must expose applyForce");
    }
    if (typeof bodyId !== "string" || bodyId.length === 0) {
      throw new TypeError("bodyId must be a non-empty string");
    }

    const result = computeForce(intent, options);
    if (result.applied) {
      world.applyForce(bodyId, result.force);
    }
    return result;
  };

  return {
    computeForce,
    applyMovement
  };
};
