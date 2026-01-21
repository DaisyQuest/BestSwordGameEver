import { createWeapon, createWeaponGeometry } from "../combat/weaponSystem.js";
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
  if (options.weapon !== undefined && (!options.weapon || typeof options.weapon !== "object" || Array.isArray(options.weapon))) {
    throw new TypeError("options.weapon must be an object");
  }
  if (options.weapon?.attack !== undefined && typeof options.weapon.attack !== "boolean") {
    throw new TypeError("options.weapon.attack must be a boolean");
  }
  if (options.weapon?.guard !== undefined && typeof options.weapon.guard !== "boolean") {
    throw new TypeError("options.weapon.guard must be a boolean");
  }
  if (options.weapon?.aim !== undefined && options.weapon.aim !== null) {
    if (!options.weapon.aim || typeof options.weapon.aim !== "object" || Array.isArray(options.weapon.aim)) {
      throw new TypeError("options.weapon.aim must be an object");
    }
    if (!Number.isFinite(options.weapon.aim.x) || !Number.isFinite(options.weapon.aim.y)) {
      throw new RangeError("options.weapon.aim must include finite x and y");
    }
  }
  return {
    sprint: options.sprint ?? false,
    weapon: {
      aim: options.weapon?.aim ?? null,
      attack: options.weapon?.attack ?? null,
      guard: options.weapon?.guard ?? null
    }
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

const normalizeBodyConfig = (value, label) => {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (value.damping !== undefined && (!Number.isFinite(value.damping) || value.damping < 0 || value.damping > 1)) {
    throw new RangeError(`${label}.damping must be between 0 and 1`);
  }
  if (value.mass !== undefined && (!Number.isFinite(value.mass) || value.mass <= 0)) {
    throw new RangeError(`${label}.mass must be a positive number`);
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

  const withGeometry = (weapon) => ({
    ...weapon,
    geometry: createWeaponGeometry({ weapon })
  });

  return {
    player: withGeometry(
      createWeapon({
        id: playerSpec.id ?? `${ids.player}-weapon`,
        ...DEFAULT_WEAPON_SPECS.player,
        ...playerSpec
      })
    ),
    rival: withGeometry(
      createWeapon({
        id: rivalSpec.id ?? `${ids.rival}-weapon`,
        ...DEFAULT_WEAPON_SPECS.rival,
        ...rivalSpec
      })
    )
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

const normalizeAimInput = (aim) => {
  if (aim === null || aim === undefined) {
    return null;
  }
  if (!aim || typeof aim !== "object" || Array.isArray(aim)) {
    throw new TypeError("aim must be an object");
  }
  if (!Number.isFinite(aim.x) || !Number.isFinite(aim.y)) {
    throw new RangeError("aim must include finite x and y");
  }
  return aim;
};

const normalizeWeaponIntent = (value) => {
  if (value === undefined) {
    return { aim: null, attack: null, guard: null };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("weapon intent must be an object");
  }
  if (value.attack !== undefined && value.attack !== null && typeof value.attack !== "boolean") {
    throw new TypeError("weapon intent attack must be a boolean");
  }
  if (value.guard !== undefined && value.guard !== null && typeof value.guard !== "boolean") {
    throw new TypeError("weapon intent guard must be a boolean");
  }
  return {
    aim: normalizeAimInput(value.aim ?? null),
    attack: value.attack ?? null,
    guard: value.guard ?? null
  };
};

const inputHas = (inputs, code) => inputs.some((input) => input.code === code && input.active);

const readAimDirectionFromInputs = (inputs) => {
  let x = 0;
  let y = 0;
  if (inputHas(inputs, "ArrowUp") || inputHas(inputs, "KeyI")) {
    y += 1;
  }
  if (inputHas(inputs, "ArrowDown") || inputHas(inputs, "KeyK")) {
    y -= 1;
  }
  if (inputHas(inputs, "ArrowLeft") || inputHas(inputs, "KeyJ")) {
    x -= 1;
  }
  if (inputHas(inputs, "ArrowRight") || inputHas(inputs, "KeyL")) {
    x += 1;
  }
  if (x === 0 && y === 0) {
    return null;
  }
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
};

const computeAimTarget = ({ aim, inputs, playerBody, rivalBody }) => {
  const normalizedAim = normalizeAimInput(aim);
  if (normalizedAim) {
    return normalizedAim;
  }
  const direction = readAimDirectionFromInputs(inputs);
  if (direction) {
    return {
      x: playerBody.position.x + direction.x,
      y: playerBody.position.y + direction.y
    };
  }
  return { x: rivalBody.position.x, y: rivalBody.position.y };
};

const computeAimAngle = ({ aimTarget, playerBody }) =>
  Math.atan2(aimTarget.y - playerBody.position.y, aimTarget.x - playerBody.position.x);

const computeSwingDuration = ({ weapon, model, guard }) => {
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  if (!model || typeof model !== "object" || !model.stamina) {
    throw new TypeError("model must include stamina");
  }
  const base = 420 + weapon.mass * 110;
  const fatigueScale = model.stamina.exhausted ? 1.35 : 1;
  const guardScale = guard ? 0.9 : 1;
  return base * fatigueScale * guardScale;
};

const advanceWeaponSwing = ({ swingState, deltaMs, attackActive, durationMs }) => {
  if (!swingState || typeof swingState !== "object") {
    throw new TypeError("swingState must be an object");
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    throw new RangeError("deltaMs must be a positive number");
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("durationMs must be a positive number");
  }
  if (attackActive && !swingState.active) {
    swingState.active = true;
    swingState.progress = 0;
    swingState.direction *= -1;
  }
  if (swingState.active) {
    swingState.progress += deltaMs / durationMs;
    if (swingState.progress >= 1) {
      swingState.active = false;
      swingState.progress = 0;
    }
  }
  const swingPhase = swingState.active ? Math.sin(swingState.progress * Math.PI) : 0;
  return {
    swingPhase,
    swinging: swingState.active,
    direction: swingState.direction
  };
};

const computeControlledWeaponPose = ({
  weapon,
  model,
  elapsedMs,
  deltaMs,
  aimAngle,
  attackActive,
  guardActive,
  swingState
}) => {
  const durationMs = computeSwingDuration({ weapon, model, guard: guardActive });
  const swingUpdate = advanceWeaponSwing({
    swingState,
    deltaMs,
    attackActive,
    durationMs
  });
  const postureArc = model.posture === "fallen" ? 0.35 : model.posture === "stumbling" ? 0.65 : 0.9;
  const guardArc = guardActive ? 0.5 : 1;
  const fatigueArc = model.stamina.exhausted ? 0.85 : 1;
  const swingArc = postureArc * guardArc * fatigueArc;
  const sway = Math.sin(elapsedMs / 1000 * 1.6) * (guardActive ? 0.05 : 0.12);
  const angle = aimAngle + sway + swingUpdate.direction * (swingUpdate.swingPhase - 0.5) * swingArc;
  const reachBase = weapon.length * (guardActive ? 0.76 : 0.9) * (model.stamina.exhausted ? 0.95 : 1);
  const reach = reachBase * (1 + swingUpdate.swingPhase * 0.18);

  return {
    angle,
    reach,
    swingPhase: swingUpdate.swingPhase,
    swinging: swingUpdate.swinging,
    dominantHand: model.dominantHand
  };
};

const buildWeaponState = ({
  weapon,
  model,
  elapsedMs,
  phaseOffset = 0,
  control,
  deltaMs,
  swingState
} = {}) => {
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  if (!model || typeof model !== "object" || !model.stamina) {
    throw new TypeError("model must include stamina");
  }
  if (control) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new RangeError("deltaMs must be a positive number");
    }
    if (!swingState || typeof swingState !== "object") {
      throw new TypeError("swingState must be an object");
    }
    return {
      weapon: { ...weapon },
      pose: computeControlledWeaponPose({
        weapon,
        model,
        elapsedMs,
        deltaMs,
        aimAngle: control.aimAngle,
        attackActive: control.attackActive,
        guardActive: control.guardActive,
        swingState
      })
    };
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
  weapons,
  body
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
  let weaponLoadout = buildWeaponLoadout(weapons, {
    player: resolvedPlayerId,
    rival: resolvedRivalId
  });
  const resolvedBody = {
    damping: 0.93,
    mass: 1.2,
    ...normalizeBodyConfig(body, "body")
  };

  const simulation = createSimulation({ physics: resolvedPhysics, movement: resolvedMovement });
  const locomotionSystem = createLocomotionSystem(resolvedLocomotion);
  const playerSystem = createPlayerSystem({
    balance: resolvedBalance,
    modelDefaults: { stamina: resolvedStamina, balance: resolvedBalance }
  });

  const spawn = buildSpawnPositions(resolvedArena, resolvedSpawn);
  let elapsedMs = 0;
  let stepIndex = 0;
  const playerWeaponSwingState = {
    active: false,
    progress: 0,
    direction: 1
  };

  const setupActors = () => {
    simulation.addActor({
      id: resolvedPlayerId,
      body: { position: { ...spawn.player }, damping: resolvedBody.damping, mass: resolvedBody.mass }
    });
    simulation.addActor({
      id: resolvedRivalId,
      body: { position: { ...spawn.rival }, damping: resolvedBody.damping, mass: resolvedBody.mass }
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
      weaponControl: {
        attack: false,
        guard: false,
        aimAngle: computeAimAngle({
          aimTarget: { x: rivalBody.position.x, y: rivalBody.position.y },
          playerBody
        })
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

    const resolvedInputs = Array.isArray(inputs) ? inputs : [];
    const weaponIntent = normalizeWeaponIntent(resolvedOptions.weapon);
    const aimTarget = computeAimTarget({
      aim: weaponIntent.aim,
      inputs: resolvedInputs,
      playerBody,
      rivalBody
    });
    const aimAngle = computeAimAngle({ aimTarget, playerBody });
    const attackActive = weaponIntent.attack ?? (inputHas(resolvedInputs, "Space") || inputHas(resolvedInputs, "KeyF"));
    const guardActive = weaponIntent.guard ?? inputHas(resolvedInputs, "KeyQ");

    const playerWeaponState = buildWeaponState({
      weapon: weaponLoadout.player,
      model: playerRecord.model,
      elapsedMs,
      control: {
        aimAngle,
        attackActive,
        guardActive
      },
      deltaMs,
      swingState: playerWeaponSwingState
    });

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
      weaponControl: {
        attack: attackActive,
        guard: guardActive,
        aimAngle
      },
      clamped: {
        player: playerClamped,
        rival: rivalClamped
      },
      weapons: {
        player: playerWeaponState,
        rival: buildWeaponState({
          weapon: weaponLoadout.rival,
          model: rivalRecord.model,
          elapsedMs,
          phaseOffset: 0.3
        })
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

  const setWeapons = (nextWeapons) => {
    weaponLoadout = buildWeaponLoadout(nextWeapons, {
      player: resolvedPlayerId,
      rival: resolvedRivalId
    });
    return getSnapshot();
  };

  setupActors();

  return {
    step,
    reset,
    getSnapshot,
    setWeapons
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
  buildWeaponState,
  normalizeWeaponIntent,
  readAimDirectionFromInputs,
  computeAimTarget,
  computeAimAngle,
  computeSwingDuration,
  advanceWeaponSwing,
  computeControlledWeaponPose,
  normalizeBodyConfig
};
