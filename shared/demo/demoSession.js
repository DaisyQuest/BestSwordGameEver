import { createWeapon } from "../combat/weaponSystem.js";
import { createSimulation } from "../simulation/simulationSystem.js";
import { createLocomotionSystem } from "../simulation/locomotionSystem.js";
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

const normalizeWeaponConfig = (value, label) => {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
};

const DEFAULT_WEAPON_SPECS = {
  player: {
    type: "sword",
    sharpness: 0.8,
    mass: 3.2,
    length: 1.25,
    balance: 0.6
  },
  rival: {
    type: "spear",
    sharpness: 0.65,
    mass: 3.8,
    length: 1.8,
    balance: 0.45
  }
};

const buildWeaponLoadout = (weapons, ids) => {
  const resolved = normalizeWeaponConfig(weapons, "weapons");
  const playerSpec = normalizeWeaponConfig(resolved.player, "weapons.player");
  const rivalSpec = normalizeWeaponConfig(resolved.rival, "weapons.rival");

  return {
    player: createWeapon({
      id: playerSpec.id ?? `${ids.player}-weapon`,
      ...DEFAULT_WEAPON_SPECS.player,
      ...playerSpec
    }),
    rival: createWeapon({
      id: rivalSpec.id ?? `${ids.rival}-weapon`,
      ...DEFAULT_WEAPON_SPECS.rival,
      ...rivalSpec
    })
  };
};

const normalizeWeaponPoseNumber = (value, label, { min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}`);
  }
  return value;
};

const computeWeaponPose = (
  elapsedMs,
  {
    weapon,
    dominantHand = "right",
    phaseOffset = 0,
    swingSpeed = 1.1,
    swingArc = 0.9,
    guardAngle = 0.35
  } = {}
) => {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("elapsedMs must be a non-negative number");
  }
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  if (dominantHand !== "left" && dominantHand !== "right") {
    throw new RangeError("dominantHand must be 'left' or 'right'");
  }
  const resolvedSpeed = normalizeWeaponPoseNumber(swingSpeed, "swingSpeed", { min: 0.1, max: 5 });
  const resolvedArc = normalizeWeaponPoseNumber(swingArc, "swingArc", { min: 0, max: Math.PI });
  const resolvedGuard = normalizeWeaponPoseNumber(guardAngle, "guardAngle", { min: 0, max: Math.PI / 2 });
  const resolvedOffset = normalizeWeaponPoseNumber(phaseOffset, "phaseOffset", { min: 0, max: 2 });

  const t = elapsedMs / 1000;
  const phase = (t * resolvedSpeed + resolvedOffset) * Math.PI * 2;
  const oscillation = Math.sin(phase);
  const swingPhase = (oscillation + 1) / 2;
  const baseAngle = dominantHand === "left" ? Math.PI - resolvedGuard : resolvedGuard;
  const angle = baseAngle + oscillation * resolvedArc;
  const reach = weapon.length * (0.85 + 0.15 * swingPhase);

  return {
    angle,
    reach,
    swingPhase,
    swinging: swingPhase > 0.55,
    dominantHand
  };
};

const buildWeaponState = ({ weapon, model, elapsedMs, phaseOffset = 0 } = {}) => {
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  if (!model || typeof model !== "object" || !model.stamina) {
    throw new TypeError("model must include stamina");
  }
  const stamina = model.stamina;
  const fatigueScale = stamina.exhausted ? 0.75 : 1;
  const postureArc = model.posture === "fallen" ? 0.5 : 0.9;

  return {
    weapon: { ...weapon },
    pose: computeWeaponPose(elapsedMs, {
      weapon,
      dominantHand: model.dominantHand,
      phaseOffset,
      swingSpeed: 1.1 * fatigueScale,
      swingArc: postureArc
    })
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
  balance,
  locomotion,
  weapons
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
  const resolvedLocomotion = normalizeObject(locomotion, "locomotion");
  const weaponLoadout = buildWeaponLoadout(weapons, {
    player: resolvedPlayerId,
    rival: resolvedRivalId
  });

  const simulation = createSimulation({ physics: resolvedPhysics, movement: resolvedMovement });
  const locomotionSystem = createLocomotionSystem(resolvedLocomotion);
  const playerSystem = createPlayerSystem({
    balance: resolvedBalance,
    modelDefaults: { stamina: resolvedStamina, balance: resolvedBalance }
  });

  const spawn = buildSpawnPositions(resolvedArena, resolvedSpawn);
  let elapsedMs = 0;
  let stepIndex = 0;

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
    const playerRecord = playerSystem.getPlayer(resolvedPlayerId);
    const rivalRecord = playerSystem.getPlayer(resolvedRivalId);
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
      },
      weapons: {
        player: buildWeaponState({
          weapon: weaponLoadout.player,
          model: playerRecord.model,
          elapsedMs,
          phaseOffset: 0
        }),
        rival: buildWeaponState({
          weapon: weaponLoadout.rival,
          model: rivalRecord.model,
          elapsedMs,
          phaseOffset: 0.3
        })
      }
    };
  };

  const step = (deltaMs, inputs, options) => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new RangeError("deltaMs must be a positive number");
    }
    const resolvedOptions = normalizeStepOptions(options);
    stepIndex += 1;
    elapsedMs += deltaMs;

    const rivalIntent = buildRivalIntent(elapsedMs);
    const rivalRecord = playerSystem.getPlayer(resolvedRivalId);
    const rivalLocomotion = locomotionSystem.computeModifiers(rivalRecord.model, {
      stepIndex
    });
    simulation.mover.applyMovement(simulation.world, resolvedRivalId, rivalIntent, {
      forceMultiplier: rivalLocomotion.forceMultiplier
    });

    const playerRecord = playerSystem.getPlayer(resolvedPlayerId);
    const wantsSprint = resolvedOptions.sprint;
    const canSprint = wantsSprint && !playerRecord.model.stamina.exhausted;
    const staminaReport = playerSystem.updateStamina(resolvedPlayerId, {
      deltaMs,
      sprinting: canSprint
    });

    const locomotionReport = locomotionSystem.computeModifiers(playerRecord.model, {
      stepIndex
    });
    const forceMultiplier =
      computeStaminaMultiplier(playerRecord.model.stamina) * locomotionReport.forceMultiplier;
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
      {
        ...balanceOptions(resolvedPlayerId),
        shock: locomotionReport.balanceShock
      }
    );
    playerSystem.updateBalance(
      simulation.world,
      resolvedRivalId,
      resolvedRivalId,
      {
        ...balanceOptions(resolvedRivalId),
        shock: rivalLocomotion.balanceShock
      }
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
      locomotion: {
        player: locomotionReport,
        rival: rivalLocomotion
      },
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
    stepIndex = 0;
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
  buildRivalIntent,
  buildWeaponLoadout,
  computeWeaponPose,
  buildWeaponState
};
