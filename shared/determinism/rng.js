const UINT32_MAX = 0xffffffff;
const MODULO = 0x100000000;

export const createRng = (seed) => {
  if (!Number.isInteger(seed) || seed < 0) {
    throw new TypeError("seed must be a non-negative integer");
  }

  let state = seed >>> 0;

  const nextUint32 = () => {
    state = (1664525 * state + 1013904223) % MODULO;
    return state;
  };

  const nextFloat = () => nextUint32() / (UINT32_MAX + 1);

  const nextInt = (min, max) => {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new TypeError("min and max must be integers");
    }
    if (max < min) {
      throw new RangeError("max must be >= min");
    }
    const range = max - min + 1;
    if (range === 1) {
      return min;
    }
    return min + (nextUint32() % range);
  };

  return {
    nextUint32,
    nextFloat,
    nextInt
  };
};
