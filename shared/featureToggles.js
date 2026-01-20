export const createFeatureToggles = (initial = {}) => {
  if (initial === null || typeof initial !== "object" || Array.isArray(initial)) {
    throw new TypeError("initial toggles must be an object");
  }

  const toggles = new Map();

  for (const [key, value] of Object.entries(initial)) {
    if (typeof value !== "boolean") {
      throw new TypeError(`toggle '${key}' must be boolean`);
    }
    toggles.set(key, value);
  }

  const isEnabled = (key) => {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("toggle key must be a non-empty string");
    }
    return toggles.get(key) ?? false;
  };

  const set = (key, enabled) => {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("toggle key must be a non-empty string");
    }
    if (typeof enabled !== "boolean") {
      throw new TypeError("toggle value must be boolean");
    }
    toggles.set(key, enabled);
  };

  const snapshot = () => Object.fromEntries(toggles.entries());

  return {
    isEnabled,
    set,
    snapshot
  };
};
