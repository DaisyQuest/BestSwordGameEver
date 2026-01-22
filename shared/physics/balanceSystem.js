import { applyLimbStress, getLimbKeys } from "../simulation/playerModel.js";

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const normalizeRate = (value, label) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number`);
  }
  return value;
};

const normalizePenalty = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1`);
  }
  return value;
};

const normalizeDrag = (value, label) => {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 (exclusive) and 1`);
  }
  return value;
};

const validateVelocity = (velocity, label) => {
  if (!velocity || typeof velocity !== "object") {
    throw new TypeError(`${label} must be an object`);
  }
  const z = velocity.z ?? 0;
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) || !Number.isFinite(z)) {
    throw new RangeError(`${label} must have finite x/y/z`);
  }
  return { x: velocity.x, y: velocity.y, z };
};

const computeLimbPenalty = (limbs, impairedPenalty, severedPenalty) => {
  let penalty = 0;
  for (const limbKey of getLimbKeys()) {
    const limb = limbs[limbKey];
    if (!limb) {
      continue;
    }
    if (limb.status === "severed") {
      penalty += severedPenalty;
    } else if (limb.status === "impaired") {
      penalty += impairedPenalty;
    }
  }
  return penalty;
};

const computePosture = (balance) => {
  if (balance.current <= balance.fallThreshold) {
    return "fallen";
  }
  if (balance.current <= balance.stumbleThreshold) {
    return "stumbling";
  }
  return "steady";
};

const applyPostureDrag = (body, posture, stumbleDrag, fallDrag) => {
  if (posture === "stumbling") {
    body.velocity.x *= stumbleDrag;
    body.velocity.y *= stumbleDrag;
    body.velocity.z *= stumbleDrag;
  } else if (posture === "fallen") {
    body.velocity.x *= fallDrag;
    body.velocity.y *= fallDrag;
    body.velocity.z *= fallDrag;
  }
};

const applyImpactStress = (model, accelMagnitude, impactThreshold, impactStress) => {
  if (accelMagnitude < impactThreshold) {
    return [];
  }
  const results = [];
  for (const limbKey of ["leftLeg", "rightLeg"]) {
    results.push(applyLimbStress(model, limbKey, impactStress));
  }
  return results;
};

export const createBalanceSystem = ({
  recoveryRate = 2,
  speedPenalty = 0.02,
  limbImpairedPenalty = 0.1,
  limbSeveredPenalty = 0.25,
  stumbleDrag = 0.85,
  fallDrag = 0.6,
  impactThreshold = 8,
  impactStress = 0.15
} = {}) => {
  const resolvedRecovery = normalizeRate(recoveryRate, "recoveryRate");
  const resolvedSpeedPenalty = normalizeRate(speedPenalty, "speedPenalty");
  const resolvedImpairedPenalty = normalizePenalty(limbImpairedPenalty, "limbImpairedPenalty");
  const resolvedSeveredPenalty = normalizePenalty(limbSeveredPenalty, "limbSeveredPenalty");
  const resolvedStumbleDrag = normalizeDrag(stumbleDrag, "stumbleDrag");
  const resolvedFallDrag = normalizeDrag(fallDrag, "fallDrag");
  const resolvedImpactThreshold = normalizeRate(impactThreshold, "impactThreshold");
  const resolvedImpactStress = normalizePenalty(impactStress, "impactStress");

  const computeForceMultiplier = (model) => {
    if (!model || typeof model !== "object" || !model.limbs) {
      throw new TypeError("model must include limbs");
    }
    let total = 1;
    for (const limbKey of getLimbKeys()) {
      const limb = model.limbs[limbKey];
      if (!limb) {
        continue;
      }
      const status = limb.status;
      if (status === "severed") {
        total *= 0.4;
      } else if (status === "impaired") {
        total *= 0.7;
      }
    }
    return clamp01(total);
  };

  const applyBalance = (world, bodyId, model, { deltaMs, shock = 0, previousVelocity } = {}) => {
    if (!world || typeof world.getBody !== "function") {
      throw new TypeError("world must expose getBody");
    }
    if (typeof bodyId !== "string" || bodyId.length === 0) {
      throw new TypeError("bodyId must be a non-empty string");
    }
    if (!model || typeof model !== "object" || !model.balance || !model.limbs) {
      throw new TypeError("model must include balance and limbs");
    }
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new RangeError("deltaMs must be a positive number");
    }
    if (!Number.isFinite(shock) || shock < 0 || shock > 1) {
      throw new RangeError("shock must be between 0 and 1");
    }

    const body = world.getBody(bodyId);
    if (!body) {
      throw new RangeError(`body '${bodyId}' not found`);
    }

    const dt = deltaMs / 1000;
    const speed = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z);
    const limbPenalty = computeLimbPenalty(model.limbs, resolvedImpairedPenalty, resolvedSeveredPenalty);
    const speedPenalty = speed * resolvedSpeedPenalty;
    const baseTarget = model.balance.baseStability - limbPenalty - speedPenalty;
    const target = clamp01(baseTarget);

    const previous = model.balance.current;
    const shocked = clamp01(previous - shock);
    const recovery = Math.min(1, resolvedRecovery * dt);
    const next = clamp01(shocked + (target - shocked) * recovery);
    model.balance.current = next;

    const previousPosture = model.posture;
    model.posture = computePosture(model.balance);
    applyPostureDrag(body, model.posture, resolvedStumbleDrag, resolvedFallDrag);

    let impactUpdates = [];
    if (previousVelocity !== undefined) {
      const resolvedPrev = validateVelocity(previousVelocity, "previousVelocity");
      const accel = {
        x: (body.velocity.x - resolvedPrev.x) / dt,
        y: (body.velocity.y - resolvedPrev.y) / dt,
        z: (body.velocity.z - resolvedPrev.z) / dt
      };
      const accelMagnitude = Math.hypot(accel.x, accel.y, accel.z);
      impactUpdates = applyImpactStress(model, accelMagnitude, resolvedImpactThreshold, resolvedImpactStress);
    }

    return {
      previous,
      current: model.balance.current,
      target,
      speed,
      limbPenalty,
      speedPenalty,
      posture: model.posture,
      previousPosture,
      impactUpdates
    };
  };

  return {
    applyBalance,
    computeForceMultiplier
  };
};
