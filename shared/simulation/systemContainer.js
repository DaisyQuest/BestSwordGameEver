import { createFeatureToggles } from "../featureToggles.js";

const noop = () => {};

const normalizeName = (name) => {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("system name must be a non-empty string");
  }
  return name;
};

const normalizeDependencies = (dependencies = []) => {
  if (!Array.isArray(dependencies)) {
    throw new TypeError("dependencies must be an array");
  }
  return dependencies.map((dependency) => {
    if (typeof dependency === "string") {
      return { name: normalizeName(dependency), optional: false };
    }
    if (dependency && typeof dependency === "object") {
      return {
        name: normalizeName(dependency.name),
        optional: Boolean(dependency.optional)
      };
    }
    throw new TypeError("dependency entries must be strings or objects");
  });
};

const normalizeFactory = (factory) => {
  if (typeof factory !== "function") {
    throw new TypeError("factory must be a function");
  }
  return factory;
};

const normalizeToggleKey = (toggleKey) => {
  if (toggleKey === undefined || toggleKey === null) {
    return null;
  }
  if (typeof toggleKey !== "string" || toggleKey.length === 0) {
    throw new TypeError("toggle key must be a non-empty string");
  }
  return toggleKey;
};

const normalizeLifecycle = (system, name) => {
  if (system === null || typeof system !== "object") {
    throw new TypeError(`system '${name}' must be an object`);
  }

  const { init = noop, update = noop, shutdown = noop, ...rest } = system;

  if (typeof init !== "function") {
    throw new TypeError(`system '${name}' init must be a function`);
  }
  if (typeof update !== "function") {
    throw new TypeError(`system '${name}' update must be a function`);
  }
  if (typeof shutdown !== "function") {
    throw new TypeError(`system '${name}' shutdown must be a function`);
  }

  return {
    init,
    update,
    shutdown,
    ...rest
  };
};

const normalizeFeatureToggles = (featureToggles) => {
  if (!featureToggles) {
    return createFeatureToggles();
  }
  if (typeof featureToggles.isEnabled !== "function") {
    throw new TypeError("featureToggles must expose isEnabled");
  }
  return featureToggles;
};

export const createSystemContainer = ({ featureToggles, context = {} } = {}) => {
  if (context === null || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("context must be an object");
  }

  const toggles = normalizeFeatureToggles(featureToggles);
  const registry = new Map();
  const instances = new Map();
  const order = [];

  const registerSystem = ({ name, factory, dependencies, toggleKey } = {}) => {
    const resolvedName = normalizeName(name);
    if (registry.has(resolvedName)) {
      throw new RangeError(`system '${resolvedName}' already registered`);
    }
    const record = {
      name: resolvedName,
      factory: normalizeFactory(factory),
      dependencies: normalizeDependencies(dependencies),
      toggleKey: normalizeToggleKey(toggleKey)
    };
    registry.set(resolvedName, record);
    return record;
  };

  const isSystemEnabled = (record) => {
    if (!record.toggleKey) {
      return true;
    }
    return toggles.isEnabled(record.toggleKey);
  };

  const resolveSystem = (name, stack = new Set()) => {
    const resolvedName = normalizeName(name);
    if (instances.has(resolvedName)) {
      return instances.get(resolvedName);
    }
    const record = registry.get(resolvedName);
    if (!record) {
      throw new RangeError(`system '${resolvedName}' not registered`);
    }
    if (stack.has(resolvedName)) {
      throw new RangeError(`system '${resolvedName}' has circular dependencies`);
    }
    if (!isSystemEnabled(record)) {
      instances.set(resolvedName, null);
      return null;
    }
    stack.add(resolvedName);

    const resolvedDependencies = {};
    for (const dependency of record.dependencies) {
      const dependencyInstance = resolveSystem(dependency.name, stack);
      if (dependencyInstance === null) {
        if (dependency.optional) {
          resolvedDependencies[dependency.name] = null;
        } else {
          throw new RangeError(
            `system '${resolvedName}' requires disabled dependency '${dependency.name}'`
          );
        }
      } else {
        resolvedDependencies[dependency.name] = dependencyInstance;
      }
    }

    stack.delete(resolvedName);
    const instance = normalizeLifecycle(
      record.factory({
        name: resolvedName,
        dependencies: resolvedDependencies,
        context,
        featureToggles: toggles
      }),
      resolvedName
    );

    instances.set(resolvedName, instance);
    order.push(resolvedName);
    return instance;
  };

  const resolveAll = () => {
    for (const name of registry.keys()) {
      resolveSystem(name);
    }
  };

  const getSystem = (name) => {
    const resolvedName = normalizeName(name);
    return instances.get(resolvedName) ?? null;
  };

  const initAll = (payload) => {
    resolveAll();
    for (const name of order) {
      const system = instances.get(name);
      if (system) {
        system.init(payload);
      }
    }
  };

  const updateAll = (payload) => {
    resolveAll();
    for (const name of order) {
      const system = instances.get(name);
      if (system) {
        system.update(payload);
      }
    }
  };

  const shutdownAll = (payload) => {
    resolveAll();
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const name = order[index];
      const system = instances.get(name);
      if (system) {
        system.shutdown(payload);
      }
    }
  };

  return {
    registerSystem,
    resolveSystem,
    resolveAll,
    getSystem,
    initAll,
    updateAll,
    shutdownAll,
    featureToggles: toggles
  };
};
