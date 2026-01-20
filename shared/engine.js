import { createFixedStep } from "./determinism/fixedStep.js";
import { createCommandQueue } from "./determinism/commandQueue.js";
import { createInputQueue } from "./determinism/inputQueue.js";
import { createRng } from "./determinism/rng.js";
import { createFeatureToggles } from "./featureToggles.js";

export const createEngine = ({
  stepMs = 16.6667,
  rngSeed = 0,
  featureToggles = {},
  maxCommandQueueSize = 4096,
  commandQueue,
  replayRecorder
} = {}) => {
  const fixedStep = createFixedStep({ stepMs });
  const rng = createRng(rngSeed);
  const toggles = createFeatureToggles(featureToggles);
  const inputQueue = createInputQueue();
  const commands = commandQueue ?? createCommandQueue({ maxSize: maxCommandQueueSize });
  const recorder = replayRecorder ?? null;
  if (recorder !== null && typeof recorder.recordFrame !== "function") {
    throw new TypeError("replayRecorder must expose recordFrame");
  }

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
      const drainedCommands = commands.drain(tickCount);
      if (recorder) {
        recorder.recordFrame({ tick: tickCount, inputs: drained });
      }
      onStep({
        tick: tickCount,
        inputs: drained,
        commands: drainedCommands,
        rng,
        toggles
      });
    });
  };

  const reset = () => {
    tickCount = 0;
    inputQueue.clear();
    commands.clear();
    fixedStep.reset();
    if (recorder?.reset) {
      recorder.reset();
    }
  };

  const getState = () => ({
    tick: tickCount,
    inputQueueSize: inputQueue.size(),
    commandQueueSize: commands.size(),
    remainderMs: fixedStep.getRemainder()
  });

  const enqueueCommands = (events) => {
    if (events === undefined || events === null) {
      return;
    }
    if (!Array.isArray(events)) {
      throw new TypeError("commands must be an array");
    }
    for (const event of events) {
      commands.enqueue(event);
    }
  };

  return {
    tick,
    reset,
    getState,
    enqueueCommands,
    toggles,
    rng,
    commands
  };
};
