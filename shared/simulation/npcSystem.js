import { createCombatant, applyDamage } from "../combat/damageSystem.js";
import { createRng } from "../determinism/rng.js";

const DEFAULT_PARTS = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];
const TORSO_ORGANS = ["heart", "lungs", "liver", "kidneys"];

const normalizeId = (id) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("npc id must be a non-empty string");
  }
  return id;
};

const normalizeRng = (rng, seed) => {
  if (!rng) {
    return createRng(seed ?? 0);
  }
  if (typeof rng.nextInt !== "function" || typeof rng.nextFloat !== "function") {
    throw new TypeError("rng must expose nextInt and nextFloat");
  }
  return rng;
};

const normalizeAiConfig = (ai = {}) => {
  if (typeof ai !== "object" || Array.isArray(ai)) {
    throw new TypeError("ai config must be an object");
  }
  const {
    baseDamage = 18,
    variance = 4,
    sharpChance = 0.45,
    weakPointChance = 0.15,
    organChance = 0.35,
    brain
  } = ai;

  if (!Number.isFinite(baseDamage) || baseDamage <= 0) {
    throw new RangeError("ai.baseDamage must be a positive number");
  }
  if (!Number.isInteger(variance) || variance < 0) {
    throw new RangeError("ai.variance must be a non-negative integer");
  }
  for (const [key, value] of [
    ["sharpChance", sharpChance],
    ["weakPointChance", weakPointChance],
    ["organChance", organChance]
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`ai.${key} must be between 0 and 1`);
    }
  }
  if (brain !== undefined && typeof brain !== "function") {
    throw new TypeError("ai.brain must be a function if provided");
  }

  return {
    baseDamage,
    variance,
    sharpChance,
    weakPointChance,
    organChance,
    brain: brain ?? null
  };
};

const selectTargetPart = (defender) => {
  const available = Object.keys(defender.parts ?? {}).filter(
    (part) => defender.parts[part]?.status !== "severed"
  );
  return available.length > 0 ? available : DEFAULT_PARTS;
};

const buildDefaultHit = ({ attacker, defender, rng, ai }) => {
  const parts = selectTargetPart(defender);
  const part = parts[rng.nextInt(0, parts.length - 1)];
  const isSharp = rng.nextFloat() < ai.sharpChance;
  const offset = ai.variance > 0 ? rng.nextInt(-ai.variance, ai.variance) : 0;
  const amount = Math.max(1, Math.round(ai.baseDamage + offset));
  const weakPoint = rng.nextFloat() < ai.weakPointChance;
  let organ;

  if (weakPoint && rng.nextFloat() < ai.organChance) {
    if (part === "head") {
      organ = "brain";
    } else if (part === "torso") {
      organ = TORSO_ORGANS[rng.nextInt(0, TORSO_ORGANS.length - 1)];
    }
  }

  return {
    part,
    type: isSharp ? "sharp" : "blunt",
    amount,
    weakPoint,
    organ
  };
};

const normalizeHit = (hit) => {
  if (!hit || typeof hit !== "object") {
    throw new TypeError("brain must return a hit object");
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
  if (hit.organ !== undefined && hit.organ !== null && typeof hit.organ !== "string") {
    throw new TypeError("hit.organ must be a string if provided");
  }
  return {
    part: hit.part,
    type: hit.type,
    amount: hit.amount,
    weakPoint: hit.weakPoint ?? false,
    organ: hit.organ ?? undefined
  };
};

export const createNpcSystem = ({ rng, rngSeed, ai, combatantDefaults = {} } = {}) => {
  const rngInstance = normalizeRng(rng, rngSeed);
  const aiConfig = normalizeAiConfig(ai);
  const npcs = new Map();

  const addNpc = ({ id, combatant } = {}) => {
    const resolvedId = normalizeId(id);
    if (npcs.has(resolvedId)) {
      throw new RangeError(`npc '${resolvedId}' already exists`);
    }
    const record = {
      id: resolvedId,
      combatant: combatant
        ? createCombatant({ ...combatantDefaults, ...combatant, id: resolvedId })
        : createCombatant({ ...combatantDefaults, id: resolvedId })
    };
    npcs.set(resolvedId, record);
    return record;
  };

  const getNpc = (id) => {
    const resolvedId = normalizeId(id);
    return npcs.get(resolvedId) ?? null;
  };

  const removeNpc = (id) => {
    const resolvedId = normalizeId(id);
    return npcs.delete(resolvedId);
  };

  const listNpcs = () => Array.from(npcs.values());

  const resolveNpc = (id) => {
    const npc = getNpc(id);
    if (!npc) {
      throw new RangeError(`npc '${id}' not found`);
    }
    return npc;
  };

  const resolveBrain = () => aiConfig.brain ?? buildDefaultHit;

  const stepBattle = ({ attackerId, defenderId, context } = {}) => {
    const attacker = resolveNpc(attackerId);
    const defender = resolveNpc(defenderId);
    const brain = resolveBrain();

    const hit = normalizeHit(
      brain({
        attacker,
        defender,
        rng: rngInstance,
        ai: aiConfig,
        context: context ?? {}
      })
    );

    const damageReport = applyDamage(defender.combatant, hit);

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      hit,
      report: damageReport,
      defenderVitals: { ...defender.combatant.vitals }
    };
  };

  return {
    addNpc,
    getNpc,
    removeNpc,
    listNpcs,
    stepBattle,
    rng: rngInstance,
    ai: aiConfig
  };
};
