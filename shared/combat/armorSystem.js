const normalizeCoverage = (coverage) => {
  if (!Array.isArray(coverage) || coverage.length === 0) {
    throw new TypeError("layer coverage must be a non-empty array");
  }
  for (const part of coverage) {
    if (typeof part !== "string" || part.length === 0) {
      throw new TypeError("coverage parts must be non-empty strings");
    }
  }
  return coverage;
};

const normalizeMitigation = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a number between 0 and 1`);
  }
  return value;
};

const normalizeDurability = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("durability must be a positive number");
  }
  return value;
};

export const createArmorProfile = ({ id = "armor", layers = [], weakPoints = [] } = {}) => {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("armor id must be a non-empty string");
  }
  if (!Array.isArray(layers)) {
    throw new TypeError("layers must be an array");
  }
  if (!Array.isArray(weakPoints)) {
    throw new TypeError("weakPoints must be an array");
  }

  const normalizedLayers = layers.map((layer, index) => {
    if (!layer || typeof layer !== "object") {
      throw new TypeError("layer must be an object");
    }
    if (typeof layer.key !== "string" || layer.key.length === 0) {
      throw new TypeError("layer key must be a non-empty string");
    }

    return {
      key: layer.key,
      coverage: normalizeCoverage(layer.coverage),
      bluntMitigation: normalizeMitigation(layer.bluntMitigation, "bluntMitigation"),
      sharpMitigation: normalizeMitigation(layer.sharpMitigation, "sharpMitigation"),
      maxDurability: normalizeDurability(layer.durability),
      currentDurability: normalizeDurability(layer.durability),
      index
    };
  });

  const normalizedWeakPoints = new Set();
  for (const part of weakPoints) {
    if (typeof part !== "string" || part.length === 0) {
      throw new TypeError("weakPoints must contain non-empty strings");
    }
    normalizedWeakPoints.add(part);
  }

  return {
    id,
    layers: normalizedLayers,
    weakPoints: normalizedWeakPoints
  };
};

const getLayerMitigation = (layer, type) => {
  const mitigation = type === "sharp" ? layer.sharpMitigation : layer.bluntMitigation;
  const durabilityRatio = layer.currentDurability / layer.maxDurability;
  return mitigation * durabilityRatio;
};

const clampMitigation = (value) => Math.min(Math.max(value, 0), 0.9);

export const applyArmorMitigation = (armor, hit) => {
  if (!armor || typeof armor !== "object" || !Array.isArray(armor.layers)) {
    throw new TypeError("armor must be an object with layers");
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

  const weakPoint = Boolean(hit.weakPoint) || armor.weakPoints?.has?.(hit.part);
  const coveringLayers = armor.layers.filter((layer) => layer.coverage.includes(hit.part));

  if (coveringLayers.length === 0) {
    return {
      mitigatedAmount: hit.amount,
      absorbed: 0,
      totalMitigation: 0,
      layersHit: []
    };
  }

  let totalMitigation = coveringLayers.reduce((sum, layer) => sum + getLayerMitigation(layer, hit.type), 0);
  if (weakPoint) {
    totalMitigation *= 0.5;
  }
  totalMitigation = clampMitigation(totalMitigation);

  const mitigatedAmount = hit.amount * (1 - totalMitigation);
  const absorbed = hit.amount - mitigatedAmount;
  const durabilityDamage = hit.amount * (hit.type === "sharp" ? 0.75 : 0.5);

  const layersHit = coveringLayers.map((layer) => {
    const nextDurability = Math.max(0, layer.currentDurability - durabilityDamage);
    const appliedDamage = layer.currentDurability - nextDurability;
    layer.currentDurability = nextDurability;

    return {
      key: layer.key,
      durabilityDamage: appliedDamage,
      remainingDurability: layer.currentDurability
    };
  });

  return {
    mitigatedAmount,
    absorbed,
    totalMitigation,
    layersHit
  };
};
