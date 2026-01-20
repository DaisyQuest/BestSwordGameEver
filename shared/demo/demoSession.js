import { createSimulation } from "../simulation/simulationSystem.js";
import { createPlayerSystem } from "../simulation/playerSystem.js";

const normalizeObject = (value, label) => {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
};

const normalizePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number`);
  }
  return value;
};

const normalizeId = (value, label) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
};

const normalizeStepOptions = (options = {}) => {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object");
  }
  if (options.sprint !== undefined && typeof options.sprint !== "boolean") {
    throw new TypeError("options.sprint must be a boolean");
  }
  return {
    sprint: options.sprint ?? false
  };
};

const computeStaminaMultiplier = (stamina) => {
  if (!stamina || typeof stamina !== "object") {
    throw new TypeError("stamina must be an object");
  }
  const ratio = stamina.max > 0 ? stamina.current / stamina.max : 0;
  if (stamina.exhausted) {
    return 0.6;
  }
  if (ratio <= 0.35) {
    return 0.85;
  }
  return 1;
};

const buildSpawnPositions = (arenaRadius, spawnOffset) => {
  if (spawnOffset >= arenaRadius) {
    throw new RangeError("spawnOffset must be less than arenaRadius");
  }
  return {
    player: { x: -spawnOffset, y: 0 },
    rival: { x: spawnOffset, y: 0 }
  };
};

const snapshotBody = (body) => ({
  id: body.id,
  position: { ...body.position },
  velocity: { ...body.velocity }
});

const clampInsideArena = (body, arenaRadius) => {
  const distance = Math.hypot(body.position.x, body.position.y);
  if (distance <= arenaRadius) {
    return false;
  }
  const scale = arenaRadius / distance;
  body.position.x *= scale;
  body.position.y *= scale;
  body.velocity.x *= -0.4;
  body.velocity.y *= -0.4;
  return true;
};

const buildRivalIntent = (elapsedMs) => {
  const t = elapsedMs / 1000;
  return {
    move: {
      x: Math.cos(t) * 0.6,
      y: Math.sin(t) * 0.6
    }
  };
};

export const createDemoSession = ({
  arenaRadius = 14,
  spawnOffset = 5,
  playerId = "hero",
  rivalId = "sparring",
  physics,
  movement,
  stamina,
  balance
} = {}) => {
  const resolvedArena = normalizePositive(arenaRadius, "arenaRadius");
  const resolvedSpawn = normalizePositive(spawnOffset, "spawnOffset");
  const resolvedPlayerId = normalizeId(playerId, "playerId");
  const resolvedRivalId = normalizeId(rivalId, "rivalId");
  if (resolvedPlayerId === resolvedRivalId) {
    throw new RangeError("playerId and rivalId must be different");
  }

  const resolvedPhysics = {
    gravity: { x: 0, y: 0 },
    maxSpeed: 14,
    ...normalizeObject(physics, "physics")
  };
  const resolvedMovement = {
    maxAcceleration: 28,
    sprintMultiplier: 1.6,
    deadzone: 0.05,
    ...normalizeObject(movement, "movement")
  };
  const resolvedStamina = normalizeObject(stamina, "stamina");
  const resolvedBalance = normalizeObject(balance, "balance");

  const simulation = createSimulation({ physics: resolvedPhysics, movement: resolvedMovement });
  const playerSystem = createPlayerSystem({
    balance: resolvedBalance,
    modelDefaults: { stamina: resolvedStamina, balance: resolvedBalance }
  });

  const spawn = buildSpawnPositions(resolvedArena, resolvedSpawn);
  let elapsedMs = 0;

  const setupActors = () => {
    simulation.addActor({
      id: resolvedPlayerId,
      body: { position: { ...spawn.player }, damping: 0.9, mass: 1 }
    });
    simulation.addActor({
      id: resolvedRivalId,
      body: { position: { ...spawn.rival }, damping: 0.9, mass: 1 }
    });
    playerSystem.addPlayer({ id: resolvedPlayerId });
    playerSystem.addPlayer({ id: resolvedRivalId, model: { dominantHand: "left" } });
  };

  const teardownActors = () => {
    simulation.removeActor(resolvedPlayerId);
    simulation.removeActor(resolvedRivalId);
    playerSystem.removePlayer(resolvedPlayerId);
    playerSystem.removePlayer(resolvedRivalId);
  };

  const getSnapshot = () => {
    const playerBody = simulation.world.getBody(resolvedPlayerId);
    const rivalBody = simulation.world.getBody(resolvedRivalId);
    return {
      timeMs: elapsedMs,
      arenaRadius: resolvedArena,
      player: {
        body: snapshotBody(playerBody),
        model: playerSystem.snapshotPlayer(resolvedPlayerId).model
      },
      rival: {
        body: snapshotBody(rivalBody),
        model: playerSystem.snapshotPlayer(resolvedRivalId).model
      }
    };
  };

  const step = (deltaMs, inputs, options) => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new RangeError("deltaMs must be a positive number");
    }
    const resolvedOptions = normalizeStepOptions(options);
    elapsedMs += deltaMs;

    const rivalIntent = buildRivalIntent(elapsedMs);
    simulation.mover.applyMovement(simulation.world, resolvedRivalId, rivalIntent);

    const playerRecord = playerSystem.getPlayer(resolvedPlayerId);
    const wantsSprint = resolvedOptions.sprint;
    const canSprint = wantsSprint && !playerRecord.model.stamina.exhausted;
    const staminaReport = playerSystem.updateStamina(resolvedPlayerId, {
      deltaMs,
      sprinting: canSprint
    });

    const forceMultiplier = computeStaminaMultiplier(playerRecord.model.stamina);
    const playerStep = simulation.step(deltaMs, resolvedPlayerId, inputs, {
      sprint: canSprint,
      forceMultiplier
    });

    const balanceOptions = (playerId) => {
      const record = playerSystem.getPlayer(playerId);
      return record.lastVelocity ? { deltaMs } : { deltaMs, useStoredVelocity: false };
    };

    const balanceReport = playerSystem.updateBalance(
      simulation.world,
      resolvedPlayerId,
      resolvedPlayerId,
      balanceOptions(resolvedPlayerId)
    );
    playerSystem.updateBalance(
      simulation.world,
      resolvedRivalId,
      resolvedRivalId,
      balanceOptions(resolvedRivalId)
    );

    const playerBody = simulation.world.getBody(resolvedPlayerId);
    const rivalBody = simulation.world.getBody(resolvedRivalId);
    const playerClamped = clampInsideArena(playerBody, resolvedArena);
    const rivalClamped = clampInsideArena(rivalBody, resolvedArena);

    return {
      ...getSnapshot(),
      intent: playerStep.intent,
      stamina: staminaReport,
      balance: balanceReport,
      sprinting: canSprint,
      clamped: {
        player: playerClamped,
        rival: rivalClamped
      }
    };
  };

  const reset = () => {
    teardownActors();
    elapsedMs = 0;
    setupActors();
    return getSnapshot();
  };

  setupActors();

  return {
    step,
    reset,
    getSnapshot
  };
};

export const __testables = {
  computeStaminaMultiplier,
  normalizeStepOptions,
  buildSpawnPositions,
  clampInsideArena,
  buildRivalIntent
};
