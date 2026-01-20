const LEG_KEYS = ["leftLeg", "rightLeg"];
const LIMB_STATUSES = ["healthy", "impaired", "severed"];
const STATUS_SEVERITY = {
  healthy: 0,
  impaired: 1,
  severed: 2
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const normalizeMultiplier = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1`);
  }
  return value;
};

const normalizeStepIndex = (value) => {
  if (value === undefined) {
    return 0;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("stepIndex must be a non-negative integer");
  }
  return value;
};

const resolveLimbStatus = (limb, limbKey) => {
  if (!limb) {
    return "healthy";
  }
  const status = limb.status ?? "healthy";
  if (typeof status !== "string") {
    throw new TypeError(`${limbKey} status must be a string`);
  }
  if (!LIMB_STATUSES.includes(status)) {
    throw new RangeError(`${limbKey} status must be healthy, impaired, or severed`);
  }
  return status;
};

const computeLegMultiplier = (status, impairedMultiplier, severedMultiplier) => {
  if (status === "severed") {
    return severedMultiplier;
  }
  if (status === "impaired") {
    return impairedMultiplier;
  }
  return 1;
};

const resolveLimpSide = (leftStatus, rightStatus) => {
  const leftSeverity = STATUS_SEVERITY[leftStatus] ?? 0;
  const rightSeverity = STATUS_SEVERITY[rightStatus] ?? 0;
  if (leftSeverity === rightSeverity || (leftSeverity === 0 && rightSeverity === 0)) {
    return null;
  }
  return leftSeverity > rightSeverity ? "leftLeg" : "rightLeg";
};

const shouldApplyLimpPenalty = (limpSide, stepIndex) => {
  if (!limpSide) {
    return false;
  }
  const isLeftStep = stepIndex % 2 === 0;
  return (limpSide === "leftLeg" && isLeftStep) || (limpSide === "rightLeg" && !isLeftStep);
};

export const createLocomotionSystem = ({
  impairedMultiplier = 0.7,
  severedMultiplier = 0.4,
  limpPenalty = 0.2,
  limpShock = 0.1
} = {}) => {
  const resolvedImpaired = normalizeMultiplier(impairedMultiplier, "impairedMultiplier");
  const resolvedSevered = normalizeMultiplier(severedMultiplier, "severedMultiplier");
  const resolvedLimpPenalty = normalizeMultiplier(limpPenalty, "limpPenalty");
  const resolvedLimpShock = normalizeMultiplier(limpShock, "limpShock");

  const computeModifiers = (model, { stepIndex } = {}) => {
    if (!model || typeof model !== "object" || !model.limbs) {
      throw new TypeError("model must include limbs");
    }
    const resolvedStep = normalizeStepIndex(stepIndex);

    const leftStatus = resolveLimbStatus(model.limbs.leftLeg, "leftLeg");
    const rightStatus = resolveLimbStatus(model.limbs.rightLeg, "rightLeg");

    const leftMultiplier = computeLegMultiplier(leftStatus, resolvedImpaired, resolvedSevered);
    const rightMultiplier = computeLegMultiplier(rightStatus, resolvedImpaired, resolvedSevered);

    const baseMultiplier = clamp01(leftMultiplier * rightMultiplier);
    const limpSide = resolveLimpSide(leftStatus, rightStatus);
    const limping = Boolean(limpSide);
    const appliesPenalty = shouldApplyLimpPenalty(limpSide, resolvedStep);
    const appliedPenalty = appliesPenalty ? resolvedLimpPenalty : 0;
    const forceMultiplier = clamp01(baseMultiplier * (1 - appliedPenalty));

    return {
      forceMultiplier,
      baseMultiplier,
      limpSide,
      limping,
      appliedPenalty,
      balanceShock: appliesPenalty ? resolvedLimpShock : 0,
      limbStatuses: {
        leftLeg: leftStatus,
        rightLeg: rightStatus
      }
    };
  };

  const getLegKeys = () => [...LEG_KEYS];

  return {
    computeModifiers,
    getLegKeys
  };
};
