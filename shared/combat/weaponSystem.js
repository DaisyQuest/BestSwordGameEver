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

const normalizeGeometryScale = (value) => {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("scale must be a positive number");
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

const DEFAULT_WIDTH_RATIO = {
  sword: 0.14,
  dagger: 0.1,
  mace: 0.2,
  club: 0.22,
  spear: 0.08,
  halberd: 0.18,
  greatsword: 0.2,
  shield: 0.9
};

const scaleProfile = (profile, length, width) =>
  profile.map((point) => ({
    x: point.x * length,
    y: point.y * (width / 2)
  }));

const createShieldProfile = (radius) => {
  const points = [];
  const sides = 8;
  for (let i = 0; i < sides; i += 1) {
    const angle = (Math.PI * 2 * i) / sides;
    points.push({
      x: radius + Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  return points;
};

const getWeaponProfile = (type) => {
  switch (type) {
    case "dagger":
      return [
        { x: 0, y: 0.25 },
        { x: 0.35, y: 0.25 },
        { x: 0.4, y: 0.3 },
        { x: 0.45, y: 0.18 },
        { x: 1, y: 0.04 },
        { x: 1, y: -0.04 },
        { x: 0.45, y: -0.18 },
        { x: 0.4, y: -0.3 },
        { x: 0.35, y: -0.25 },
        { x: 0, y: -0.25 }
      ];
    case "spear":
      return [
        { x: 0, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.9, y: 0.08 },
        { x: 1, y: 0 },
        { x: 0.9, y: -0.08 },
        { x: 0.85, y: -0.15 },
        { x: 0, y: -0.15 }
      ];
    case "mace":
      return [
        { x: 0, y: 0.2 },
        { x: 0.7, y: 0.2 },
        { x: 0.8, y: 0.35 },
        { x: 0.95, y: 0.3 },
        { x: 1, y: 0 },
        { x: 0.95, y: -0.3 },
        { x: 0.8, y: -0.35 },
        { x: 0.7, y: -0.2 },
        { x: 0, y: -0.2 }
      ];
    case "club":
      return [
        { x: 0, y: 0.22 },
        { x: 0.65, y: 0.22 },
        { x: 0.85, y: 0.4 },
        { x: 1, y: 0.32 },
        { x: 1, y: -0.32 },
        { x: 0.85, y: -0.4 },
        { x: 0.65, y: -0.22 },
        { x: 0, y: -0.22 }
      ];
    case "halberd":
      return [
        { x: 0, y: 0.18 },
        { x: 0.7, y: 0.18 },
        { x: 0.82, y: 0.32 },
        { x: 1, y: 0.1 },
        { x: 0.95, y: 0 },
        { x: 1, y: -0.1 },
        { x: 0.82, y: -0.32 },
        { x: 0.7, y: -0.18 },
        { x: 0, y: -0.18 }
      ];
    case "greatsword":
      return [
        { x: 0, y: 0.3 },
        { x: 0.3, y: 0.3 },
        { x: 0.35, y: 0.45 },
        { x: 0.45, y: 0.2 },
        { x: 1, y: 0.08 },
        { x: 1, y: -0.08 },
        { x: 0.45, y: -0.2 },
        { x: 0.35, y: -0.45 },
        { x: 0.3, y: -0.3 },
        { x: 0, y: -0.3 }
      ];
    case "sword":
    default:
      return [
        { x: 0, y: 0.25 },
        { x: 0.25, y: 0.25 },
        { x: 0.3, y: 0.4 },
        { x: 0.38, y: 0.18 },
        { x: 1, y: 0.06 },
        { x: 1, y: -0.06 },
        { x: 0.38, y: -0.18 },
        { x: 0.3, y: -0.4 },
        { x: 0.25, y: -0.25 },
        { x: 0, y: -0.25 }
      ];
  }
};

export const createWeaponGeometry = ({ weapon, scale } = {}) => {
  if (!weapon || typeof weapon !== "object") {
    throw new TypeError("weapon must be an object");
  }
  if (typeof weapon.type !== "string" || weapon.type.length === 0) {
    throw new TypeError("weapon.type must be a non-empty string");
  }
  if (!WEAPON_TYPES.has(weapon.type)) {
    throw new RangeError(`weapon type '${weapon.type}' is not supported`);
  }
  const length = normalizePositive(weapon.length, "length");
  const resolvedScale = normalizeGeometryScale(scale);
  const scaledLength = length * resolvedScale;

  if (weapon.type === "shield") {
    const radius = scaledLength / 2;
    return {
      type: weapon.type,
      length: scaledLength,
      width: scaledLength,
      points: createShieldProfile(radius)
    };
  }

  const widthRatio = DEFAULT_WIDTH_RATIO[weapon.type] ?? DEFAULT_WIDTH_RATIO.sword;
  const width = scaledLength * widthRatio;
  const profile = getWeaponProfile(weapon.type);

  return {
    type: weapon.type,
    length: scaledLength,
    width,
    points: scaleProfile(profile, scaledLength, width)
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
