import { createFeatureToggles } from "../featureToggles.js";
import { applyArmorMitigation, createArmorProfile } from "./armorSystem.js";

const DEFAULT_PARTS = [
  {
    key: "head",
    maxHealth: 110,
    impairedThreshold: 70,
    canBeSevered: false
  },
  {
    key: "torso",
    maxHealth: 160,
    impairedThreshold: 80,
    canBeSevered: false
  },
  {
    key: "leftArm",
    maxHealth: 100,
    impairedThreshold: 45,
    canBeSevered: true
  },
  {
    key: "rightArm",
    maxHealth: 100,
    impairedThreshold: 45,
    canBeSevered: true
  },
  {
    key: "leftLeg",
    maxHealth: 120,
    impairedThreshold: 55,
    canBeSevered: true
  },
  {
    key: "rightLeg",
    maxHealth: 120,
    impairedThreshold: 55,
    canBeSevered: true
  }
];

const DEFAULT_ORGANS = [
  {
    key: "brain",
    maxHealth: 80,
    injuredRatio: 0.7,
    criticalRatio: 0.3,
    fatal: true
  },
  {
    key: "heart",
    maxHealth: 90,
    injuredRatio: 0.7,
    criticalRatio: 0.3,
    fatal: true
  },
  {
    key: "lungs",
    maxHealth: 100,
    injuredRatio: 0.65,
    criticalRatio: 0.35,
    fatal: false
  },
  {
    key: "liver",
    maxHealth: 95,
    injuredRatio: 0.6,
    criticalRatio: 0.3,
    fatal: false
  },
  {
    key: "kidneys",
    maxHealth: 95,
    injuredRatio: 0.6,
    criticalRatio: 0.3,
    fatal: false
  }
];

const resolveToggles = (toggles) => {
  if (toggles && typeof toggles.isEnabled === "function") {
    return toggles;
  }
  return createFeatureToggles(toggles ?? {});
};

const resolveArmor = (armor) => {
  if (!armor) {
    return null;
  }
  if (armor.layers) {
    const isNormalized = armor.layers.every(
      (layer) =>
        Number.isFinite(layer?.currentDurability) &&
        Number.isFinite(layer?.maxDurability)
    );
    return isNormalized ? armor : createArmorProfile(armor);
  }
  return createArmorProfile(armor);
};

const buildPartState = (part) => ({
  ...part,
  current: part.maxHealth,
  severedThreshold: 0,
  status: "healthy"
});

const buildOrganState = (organ) => ({
  ...organ,
  current: organ.maxHealth,
  status: "healthy"
});

const getOrganStatus = (organ) => {
  if (organ.current <= 0) {
    return "failed";
  }
  const ratio = organ.current / organ.maxHealth;
  if (ratio <= organ.criticalRatio) {
    return "critical";
  }
  if (ratio <= organ.injuredRatio) {
    return "injured";
  }
  return "healthy";
};

const updateVitalsFromBrain = (vitals, brainStatus) => {
  if (brainStatus === "injured") {
    vitals.consciousness = "dazed";
    return;
  }
  if (brainStatus === "critical" || brainStatus === "failed") {
    vitals.consciousness = "unconscious";
    return;
  }
  vitals.consciousness = "awake";
};

export const createCombatant = ({ id = "combatant", toggles, armor } = {}) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("id must be a non-empty string");
  }

  const resolvedToggles = resolveToggles(toggles);

  const parts = Object.fromEntries(
    DEFAULT_PARTS.map((part) => [part.key, buildPartState(part)])
  );
  const organs = Object.fromEntries(
    DEFAULT_ORGANS.map((organ) => [organ.key, buildOrganState(organ)])
  );

  return {
    id,
    parts,
    organs,
    vitals: {
      isAlive: true,
      consciousness: "awake"
    },
    toggles: resolvedToggles,
    armor: resolveArmor(armor)
  };
};

export const applyDamage = (combatant, hit, overrides) => {
  if (!combatant || typeof combatant !== "object" || !combatant.parts) {
    throw new TypeError("combatant must be an object with parts");
  }
  if (!hit || typeof hit !== "object") {
    throw new TypeError("hit must be an object");
  }
  if (typeof hit.part !== "string" || hit.part.length === 0) {
    throw new TypeError("hit.part must be a non-empty string");
  }
  if (hit.type !== "blunt" && hit.type !== "sharp") {
    throw new RangeError("hit.type must be 'blunt' or 'sharp'");
  }
  if (!Number.isFinite(hit.amount) || hit.amount <= 0) {
    throw new RangeError("hit.amount must be a positive number");
  }
  if (hit.weakPoint !== undefined && typeof hit.weakPoint !== "boolean") {
    throw new TypeError("hit.weakPoint must be boolean if provided");
  }
  if (hit.organ !== undefined && typeof hit.organ !== "string") {
    throw new TypeError("hit.organ must be a string if provided");
  }

  const features = resolveToggles(overrides ?? combatant.toggles);
  const part = combatant.parts[hit.part];
  const armor = resolveArmor(hit.armor ?? combatant.armor);

  if (!part) {
    throw new RangeError(`Unknown body part '${hit.part}'`);
  }

  const report = {
    part: hit.part,
    organ: hit.organ ?? null,
    applied: 0,
    newStatus: part.status,
    severed: false,
    organStatus: null,
    armor: null,
    fatal: false,
    effects: []
  };

  if (part.status === "severed") {
    report.effects.push("alreadySevered");
    return report;
  }

  const multiplier = hit.weakPoint ? 1.5 : 1;
  const rawAmount = hit.amount * multiplier;
  const mitigated = armor ? applyArmorMitigation(armor, { ...hit, amount: rawAmount }) : null;
  const appliedAmount = mitigated ? mitigated.mitigatedAmount : rawAmount;
  part.current = Math.max(0, part.current - appliedAmount);
  report.applied = appliedAmount;
  if (mitigated) {
    report.armor = {
      absorbed: mitigated.absorbed,
      totalMitigation: mitigated.totalMitigation,
      layersHit: mitigated.layersHit
    };
  }

  if (part.status === "healthy" && part.current <= part.impairedThreshold) {
    part.status = "impaired";
    report.effects.push("impaired");
  }

  if (
    hit.type === "sharp" &&
    features.isEnabled("limbLoss") &&
    part.canBeSevered &&
    part.current <= part.severedThreshold
  ) {
    part.status = "severed";
    part.current = 0;
    report.severed = true;
    report.effects.push("severed");
  }

  report.newStatus = part.status;

  if (hit.organ) {
    if (!features.isEnabled("organDamage")) {
      report.effects.push("organIgnored");
      return report;
    }

    const organ = combatant.organs[hit.organ];
    if (!organ) {
      throw new RangeError(`Unknown organ '${hit.organ}'`);
    }

    organ.current = Math.max(0, organ.current - appliedAmount);
    const nextStatus = getOrganStatus(organ);
    if (nextStatus !== organ.status) {
      organ.status = nextStatus;
    }
    report.organStatus = organ.status;

    if (hit.organ === "brain") {
      updateVitalsFromBrain(combatant.vitals, organ.status);
    }

    if (organ.fatal && organ.status === "failed") {
      combatant.vitals.isAlive = false;
      report.fatal = true;
      report.effects.push("fatal");
    }
  }

  return report;
};
