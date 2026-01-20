export const createFixedStep = ({ stepMs, maxSteps = 120 } = {}) => {
  if (!Number.isFinite(stepMs) || stepMs <= 0) {
    throw new RangeError("stepMs must be a positive number");
  }
  if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
    throw new RangeError("maxSteps must be a positive integer");
  }

  let accumulator = 0;

  const advance = (deltaMs, onStep) => {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError("deltaMs must be a non-negative number");
    }
    if (typeof onStep !== "function") {
      throw new TypeError("onStep must be a function");
    }

    accumulator += deltaMs;
    let steps = 0;

    while (accumulator >= stepMs && steps < maxSteps) {
      accumulator -= stepMs;
      steps += 1;
      onStep(stepMs, steps);
    }

    if (accumulator >= stepMs) {
      accumulator = 0;
      return {
        steps,
        dropped: true
      };
    }

    return {
      steps,
      dropped: false
    };
  };

  const reset = () => {
    accumulator = 0;
  };

  const getRemainder = () => accumulator;

  return {
    advance,
    reset,
    getRemainder
  };
};
