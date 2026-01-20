const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number`);
  }
  return value;
};

const normalizeNonNegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number`);
  }
  return value;
};

const normalizeRatio = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1`);
  }
  return value;
};

const normalizeStaminaConfig = (stamina = {}) => {
  if (typeof stamina !== "object" || stamina === null) {
    throw new TypeError("stamina must be an object");
  }
  const max = normalizePositive(stamina.max ?? 100, "max");
  const current = normalizeNonNegative(stamina.current ?? max, "current");
  if (current > max) {
    throw new RangeError("current must be less than or equal to max");
  }
  const regenRate = normalizeNonNegative(stamina.regenRate ?? 12, "regenRate");
  const sprintCost = normalizeNonNegative(stamina.sprintCost ?? 20, "sprintCost");
  const exhaustionThreshold = normalizeRatio(stamina.exhaustionThreshold ?? 0.15, "exhaustionThreshold");

  return {
    max,
    current,
    regenRate,
    sprintCost,
    exhaustionThreshold
  };
};

const computeExhausted = (stamina) => stamina.current <= stamina.max * stamina.exhaustionThreshold;

export const createStaminaState = (stamina = {}) => {
  const resolved = normalizeStaminaConfig(stamina);
  return {
    ...resolved,
    exhausted: computeExhausted(resolved)
  };
};

export const updateStamina = (state, { deltaMs, sprinting = false, extraCost = 0 } = {}) => {
  if (!state || typeof state !== "object") {
    throw new TypeError("state must be an object");
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    throw new RangeError("deltaMs must be a positive number");
  }
  if (typeof sprinting !== "boolean") {
    throw new TypeError("sprinting must be a boolean");
  }
  const resolvedExtra = normalizeNonNegative(extraCost, "extraCost");

  const previous = state.current;
  const drain = (sprinting ? state.sprintCost : 0) * (deltaMs / 1000) + resolvedExtra;
  const drained = Math.min(previous, drain);
  let current = clamp(previous - drain, 0, state.max);

  let regenerated = 0;
  if (!sprinting) {
    const regen = state.regenRate * (deltaMs / 1000);
    regenerated = Math.min(state.max - current, regen);
    current = clamp(current + regen, 0, state.max);
  }

  state.current = current;
  state.exhausted = computeExhausted(state);

  return {
    previous,
    current,
    drained,
    regenerated,
    exhausted: state.exhausted,
    sprinting
  };
};

export const snapshotStamina = (state) => {
  if (!state || typeof state !== "object") {
    throw new TypeError("state must be an object");
  }
  return {
    max: state.max,
    current: state.current,
    regenRate: state.regenRate,
    sprintCost: state.sprintCost,
    exhaustionThreshold: state.exhaustionThreshold,
    exhausted: state.exhausted
  };
};
