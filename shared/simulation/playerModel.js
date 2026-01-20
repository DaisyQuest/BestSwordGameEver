const LIMB_KEYS = ["leftArm", "rightArm", "leftLeg", "rightLeg"];
const LIMB_STATUS_VALUES = ["healthy", "impaired", "severed"];

const DEFAULT_LIMBS = Object.fromEntries(
  LIMB_KEYS.map((key) => [
    key,
    {
      status: "healthy",
      integrity: 1
    }
  ])
);

const clamp01 = (value, label) => {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  if (value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1`);
  }
  return value;
};

const normalizeLimbKey = (limbKey) => {
  if (typeof limbKey !== "string" || limbKey.length === 0) {
    throw new TypeError("limbKey must be a non-empty string");
  }
  if (!LIMB_KEYS.includes(limbKey)) {
    throw new RangeError(`Unknown limb '${limbKey}'`);
  }
  return limbKey;
};

const normalizeLimbStatus = (status) => {
  if (typeof status !== "string") {
    throw new TypeError("status must be a string");
  }
  if (!LIMB_STATUS_VALUES.includes(status)) {
    throw new RangeError("status must be healthy, impaired, or severed");
  }
  return status;
};

const normalizeBalanceConfig = (balance = {}) => {
  const baseStability = clamp01(balance.baseStability ?? 1, "baseStability");
  const current = clamp01(balance.current ?? baseStability, "current");
  const stumbleThreshold = clamp01(balance.stumbleThreshold ?? 0.55, "stumbleThreshold");
  const fallThreshold = clamp01(balance.fallThreshold ?? 0.3, "fallThreshold");
  if (fallThreshold > stumbleThreshold) {
    throw new RangeError("fallThreshold must be less than or equal to stumbleThreshold");
  }
  return {
    baseStability,
    current,
    stumbleThreshold,
    fallThreshold
  };
};

const normalizeLimbState = (limbKey, limb) => {
  if (!limb || typeof limb !== "object") {
    throw new TypeError(`limb '${limbKey}' must be an object`);
  }
  const status = normalizeLimbStatus(limb.status ?? "healthy");
  const integrity = clamp01(limb.integrity ?? 1, "limb integrity");
  return {
    status,
    integrity
  };
};

const buildLimbSet = (limbs = {}) =>
  Object.fromEntries(
    LIMB_KEYS.map((key) => [key, normalizeLimbState(key, limbs[key] ?? DEFAULT_LIMBS[key])])
  );

const getPostureFromBalance = (balance) => {
  if (balance.current <= balance.fallThreshold) {
    return "fallen";
  }
  if (balance.current <= balance.stumbleThreshold) {
    return "stumbling";
  }
  return "steady";
};

export const createPlayerModel = ({ id = "player", limbs, balance, dominantHand = "right" } = {}) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("id must be a non-empty string");
  }
  if (dominantHand !== "left" && dominantHand !== "right") {
    throw new RangeError("dominantHand must be 'left' or 'right'");
  }

  const resolvedBalance = normalizeBalanceConfig(balance);
  const resolvedLimbs = buildLimbSet(limbs);

  return {
    id,
    dominantHand,
    limbs: resolvedLimbs,
    balance: resolvedBalance,
    posture: getPostureFromBalance(resolvedBalance)
  };
};

export const updateLimbStatus = (model, limbKey, status) => {
  if (!model || typeof model !== "object" || !model.limbs) {
    throw new TypeError("model must be a player model");
  }
  const resolvedKey = normalizeLimbKey(limbKey);
  const resolvedStatus = normalizeLimbStatus(status);
  model.limbs[resolvedKey].status = resolvedStatus;
  if (resolvedStatus === "severed") {
    model.limbs[resolvedKey].integrity = 0;
  }
  return model.limbs[resolvedKey];
};

export const applyLimbStress = (model, limbKey, stress, { impairedThreshold = 0.5 } = {}) => {
  if (!model || typeof model !== "object" || !model.limbs) {
    throw new TypeError("model must be a player model");
  }
  const resolvedKey = normalizeLimbKey(limbKey);
  if (!Number.isFinite(stress) || stress < 0) {
    throw new RangeError("stress must be a non-negative number");
  }
  const resolvedThreshold = clamp01(impairedThreshold, "impairedThreshold");
  const limb = model.limbs[resolvedKey];
  if (limb.status === "severed") {
    return { ...limb, updated: false };
  }

  limb.integrity = Math.max(0, limb.integrity - stress);
  if (limb.integrity <= resolvedThreshold) {
    limb.status = "impaired";
  }
  return { ...limb, updated: true };
};

export const applyCombatReport = (model, report) => {
  if (!model || typeof model !== "object" || !model.limbs) {
    throw new TypeError("model must be a player model");
  }
  if (!report || typeof report !== "object") {
    throw new TypeError("report must be an object");
  }
  if (typeof report.part !== "string") {
    throw new TypeError("report.part must be a string");
  }
  if (!LIMB_KEYS.includes(report.part)) {
    return null;
  }

  if (report.severed) {
    model.limbs[report.part].status = "severed";
    model.limbs[report.part].integrity = 0;
    return { ...model.limbs[report.part] };
  }

  if (report.newStatus) {
    const resolvedStatus = normalizeLimbStatus(report.newStatus);
    model.limbs[report.part].status = resolvedStatus;
  }

  return { ...model.limbs[report.part] };
};

export const snapshotPlayerModel = (model) => {
  if (!model || typeof model !== "object" || !model.limbs || !model.balance) {
    throw new TypeError("model must be a player model");
  }
  return {
    id: model.id,
    dominantHand: model.dominantHand,
    posture: model.posture,
    balance: { ...model.balance },
    limbs: Object.fromEntries(
      LIMB_KEYS.map((key) => [key, { ...model.limbs[key] }])
    )
  };
};

export const getLimbKeys = () => [...LIMB_KEYS];
