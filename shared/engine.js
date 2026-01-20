import { createFixedStep } from "./determinism/fixedStep.js";
import { createInputQueue } from "./determinism/inputQueue.js";
import { createRng } from "./determinism/rng.js";
import { createFeatureToggles } from "./featureToggles.js";

export const createEngine = ({
  stepMs = 16.6667,
  rngSeed = 0,
  featureToggles = {}
} = {}) => {
  const fixedStep = createFixedStep({ stepMs });
  const rng = createRng(rngSeed);
  const toggles = createFeatureToggles(featureToggles);
  const inputQueue = createInputQueue();

  let tickCount = 0;

  const enqueueInputs = (inputs) => {
    if (inputs === undefined || inputs === null) {
      return;
    }
    if (!Array.isArray(inputs)) {
      throw new TypeError("inputs must be an array");
    }
    for (const input of inputs) {
      inputQueue.enqueue(input);
    }
  };

  const tick = (deltaMs, inputs, onStep) => {
    if (typeof onStep !== "function") {
      throw new TypeError("onStep must be a function");
    }

    enqueueInputs(inputs);

    return fixedStep.advance(deltaMs, () => {
      tickCount += 1;
      const drained = inputQueue.drain();
      onStep({
        tick: tickCount,
        inputs: drained,
        rng,
        toggles
      });
    });
  };

  const reset = () => {
    tickCount = 0;
    inputQueue.clear();
    fixedStep.reset();
  };

  const getState = () => ({
    tick: tickCount,
    inputQueueSize: inputQueue.size(),
    remainderMs: fixedStep.getRemainder()
  });

  return {
    tick,
    reset,
    getState,
    toggles,
    rng
  };
};
