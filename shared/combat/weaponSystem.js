const WEAPON_TYPES = new Set([
  "sword",
  "dagger",
  "mace",
  "club",
  "spear",
  "halberd",
  "greatsword",
  "shield"
]);

const normalizeRatio = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a number between 0 and 1`);
  }
  return value;
};

const normalizePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number`);
  }
  return value;
};

export const createWeapon = ({
  id = "weapon",
  type,
  sharpness,
  mass,
  length,
  balance
} = {}) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("weapon id must be a non-empty string");
  }
  if (typeof type !== "string" || type.length === 0) {
    throw new TypeError("weapon type must be a non-empty string");
  }
  if (!WEAPON_TYPES.has(type)) {
    throw new RangeError(`weapon type '${type}' is not supported`);
  }

  const normalizedSharpness = normalizeRatio(sharpness, "sharpness");
  const normalizedMass = normalizePositive(mass, "mass");
  const normalizedLength = normalizePositive(length, "length");
  const normalizedBalance = normalizeRatio(balance, "balance");

  return {
    id,
    type,
    sharpness: normalizedSharpness,
    mass: normalizedMass,
    length: normalizedLength,
    balance: normalizedBalance
  };
};

const normalizeAttackType = (attackType) => {
  if (typeof attackType !== "string" || attackType.length === 0) {
    throw new TypeError("attackType must be a non-empty string");
  }
  if (![
    "slash",
    "thrust",
    "blunt"
  ].includes(attackType)) {
    throw new RangeError("attackType must be 'slash', 'thrust', or 'blunt'");
  }
  return attackType;
};

const normalizeVelocity = (velocity) => {
  if (!Number.isFinite(velocity) || velocity <= 0) {
    throw new RangeError("velocity must be a positive number");
  }
  return velocity;
};

export const computeWeaponImpact = ({ weapon, velocity, attackType, weakPoint = false } = {}) => {
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  const normalizedAttack = normalizeAttackType(attackType);
  const normalizedVelocity = normalizeVelocity(velocity);
  if (typeof weakPoint !== "boolean") {
    throw new TypeError("weakPoint must be boolean");
  }

  const baseForce = weapon.mass * normalizedVelocity;
  const balanceMultiplier = 0.8 + weapon.balance * 0.4;

  let damageType = "blunt";
  let amount = baseForce * balanceMultiplier;

  if (normalizedAttack === "slash") {
    damageType = "sharp";
    amount = baseForce * (0.6 + weapon.sharpness * 0.7) * balanceMultiplier;
  } else if (normalizedAttack === "thrust") {
    damageType = "sharp";
    amount = baseForce * (0.5 + weapon.sharpness * 0.9) * balanceMultiplier;
  } else {
    damageType = "blunt";
    amount = baseForce * (0.7 + (1 - weapon.sharpness) * 0.3) * balanceMultiplier;
  }

  const weakPointMultiplier = weakPoint ? 1.5 : 1;
  const finalAmount = amount * weakPointMultiplier;

  return {
    type: damageType,
    amount: finalAmount,
    baseForce,
    balanceMultiplier,
    weakPointApplied: weakPoint
  };
};
