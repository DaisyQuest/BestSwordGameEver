const normalizeTick = (tick) => {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError("tick must be a non-negative integer");
  }
  return tick;
};

const normalizeActorId = (actorId) => {
  if (typeof actorId !== "string" || actorId.length === 0) {
    throw new TypeError("actorId must be a non-empty string");
  }
  return actorId;
};

export const createCommandQueue = ({ maxSize = 4096 } = {}) => {
  if (!Number.isInteger(maxSize) || maxSize <= 0) {
    throw new RangeError("maxSize must be a positive integer");
  }

  const buckets = new Map();
  let size = 0;
  let sequence = 0;

  const enqueue = ({ tick, actorId, payload } = {}) => {
    const resolvedTick = normalizeTick(tick);
    const resolvedActor = normalizeActorId(actorId);
    if (size >= maxSize) {
      throw new RangeError("command queue is full");
    }

    const entry = {
      tick: resolvedTick,
      actorId: resolvedActor,
      payload,
      _sequence: sequence
    };
    sequence += 1;

    const bucket = buckets.get(resolvedTick) ?? [];
    bucket.push(entry);
    buckets.set(resolvedTick, bucket);
    size += 1;
    return entry;
  };

  const drain = (tick) => {
    const resolvedTick = normalizeTick(tick);
    const bucket = buckets.get(resolvedTick);
    if (!bucket || bucket.length === 0) {
      return [];
    }
    buckets.delete(resolvedTick);
    size -= bucket.length;

    bucket.sort((a, b) => {
      if (a.actorId === b.actorId) {
        return a._sequence - b._sequence;
      }
      return a.actorId.localeCompare(b.actorId);
    });

    return bucket.map(({ _sequence, ...rest }) => ({ ...rest }));
  };

  const clear = () => {
    buckets.clear();
    size = 0;
  };

  const getSize = () => size;

  return {
    enqueue,
    drain,
    clear,
    size: getSize
  };
};
