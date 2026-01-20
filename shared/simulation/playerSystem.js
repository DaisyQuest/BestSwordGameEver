import { createBalanceSystem } from "../physics/balanceSystem.js";
import { applyCombatReport, createPlayerModel, snapshotPlayerModel } from "./playerModel.js";

const normalizeId = (id) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("playerId must be a non-empty string");
  }
  return id;
};

const normalizeOptions = (options) => {
  if (!options) {
    return {};
  }
  if (typeof options !== "object") {
    throw new TypeError("options must be an object");
  }
  return options;
};

export const createPlayerSystem = ({ balance = {}, modelDefaults = {} } = {}) => {
  const balanceSystem = createBalanceSystem(balance);
  const players = new Map();

  const addPlayer = ({ id, model } = {}) => {
    const resolvedId = normalizeId(id);
    if (players.has(resolvedId)) {
      throw new RangeError(`player '${resolvedId}' already exists`);
    }
    const resolvedModel = model
      ? createPlayerModel({ ...modelDefaults, ...model, id: resolvedId })
      : createPlayerModel({ ...modelDefaults, id: resolvedId });
    const record = {
      id: resolvedId,
      model: resolvedModel,
      lastVelocity: null
    };
    players.set(resolvedId, record);
    return record;
  };

  const getPlayer = (id) => {
    const resolvedId = normalizeId(id);
    return players.get(resolvedId) ?? null;
  };

  const removePlayer = (id) => {
    const resolvedId = normalizeId(id);
    return players.delete(resolvedId);
  };

  const applyDamageReport = (playerId, report) => {
    const player = getPlayer(playerId);
    if (!player) {
      throw new RangeError(`player '${playerId}' not found`);
    }
    return applyCombatReport(player.model, report);
  };

  const updateBalance = (world, bodyId, playerId, options) => {
    const resolvedOptions = normalizeOptions(options);
    const player = getPlayer(playerId);
    if (!player) {
      throw new RangeError(`player '${playerId}' not found`);
    }

    const useStoredVelocity = resolvedOptions.useStoredVelocity !== false;
    const previousVelocity =
      resolvedOptions.previousVelocity ??
      (useStoredVelocity ? player.lastVelocity : undefined);

    const report = balanceSystem.applyBalance(world, bodyId, player.model, {
      deltaMs: resolvedOptions.deltaMs,
      shock: resolvedOptions.shock ?? 0,
      previousVelocity
    });

    const body = world?.getBody?.(bodyId) ?? null;
    if (body) {
      player.lastVelocity = { ...body.velocity };
    }

    return report;
  };

  const snapshotPlayer = (playerId) => {
    const player = getPlayer(playerId);
    if (!player) {
      throw new RangeError(`player '${playerId}' not found`);
    }
    return {
      id: player.id,
      model: snapshotPlayerModel(player.model),
      lastVelocity: player.lastVelocity ? { ...player.lastVelocity } : null
    };
  };

  return {
    addPlayer,
    getPlayer,
    removePlayer,
    applyDamageReport,
    updateBalance,
    snapshotPlayer,
    balanceSystem
  };
};
