const normalizeTick = (tick) => {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError("tick must be a non-negative integer");
  }
  return tick;
};

const normalizeInputs = (inputs) => {
  if (!Array.isArray(inputs)) {
    throw new TypeError("inputs must be an array");
  }
  return inputs;
};

const cloneInputs = (inputs) => inputs.map((input) => ({ ...input }));

export const createReplayRecorder = ({ seed = null, stepMs = null } = {}) => {
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new TypeError("seed must be a non-negative integer or null");
  }
  if (stepMs !== null && (!Number.isFinite(stepMs) || stepMs <= 0)) {
    throw new RangeError("stepMs must be a positive number or null");
  }

  const frames = [];
  const ticks = new Set();

  const recordFrame = ({ tick, inputs } = {}) => {
    const resolvedTick = normalizeTick(tick);
    const resolvedInputs = normalizeInputs(inputs);
    if (ticks.has(resolvedTick)) {
      throw new RangeError(`tick ${resolvedTick} already recorded`);
    }
    ticks.add(resolvedTick);
    frames.push({
      tick: resolvedTick,
      inputs: cloneInputs(resolvedInputs)
    });
  };

  const exportReplay = () => ({
    seed,
    stepMs,
    frames: frames.map((frame) => ({
      tick: frame.tick,
      inputs: cloneInputs(frame.inputs)
    }))
  });

  const reset = () => {
    frames.length = 0;
    ticks.clear();
  };

  return {
    recordFrame,
    exportReplay,
    reset
  };
};

export const createReplayPlayer = (replay = {}) => {
  if (!replay || typeof replay !== "object") {
    throw new TypeError("replay must be an object");
  }
  const { seed = null, stepMs = null, frames } = replay;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new TypeError("seed must be a non-negative integer or null");
  }
  if (stepMs !== null && (!Number.isFinite(stepMs) || stepMs <= 0)) {
    throw new RangeError("stepMs must be a positive number or null");
  }
  if (!Array.isArray(frames)) {
    throw new TypeError("replay.frames must be an array");
  }

  const frameMap = new Map();
  for (const frame of frames) {
    if (!frame || typeof frame !== "object") {
      throw new TypeError("replay frames must be objects");
    }
    const resolvedTick = normalizeTick(frame.tick);
    const resolvedInputs = normalizeInputs(frame.inputs);
    if (frameMap.has(resolvedTick)) {
      throw new RangeError(`duplicate replay tick ${resolvedTick}`);
    }
    frameMap.set(resolvedTick, {
      tick: resolvedTick,
      inputs: cloneInputs(resolvedInputs)
    });
  }

  const getFrame = (tick) => {
    const resolvedTick = normalizeTick(tick);
    const frame = frameMap.get(resolvedTick);
    if (!frame) {
      return null;
    }
    return {
      tick: frame.tick,
      inputs: cloneInputs(frame.inputs)
    };
  };

  const getInputs = (tick) => {
    const frame = getFrame(tick);
    return frame ? frame.inputs : [];
  };

  return {
    seed,
    stepMs,
    getFrame,
    getInputs
  };
};
