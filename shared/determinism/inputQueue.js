export const createInputQueue = ({ maxSize = 1024 } = {}) => {
  if (!Number.isInteger(maxSize) || maxSize <= 0) {
    throw new RangeError("maxSize must be a positive integer");
  }

  const queue = [];

  const enqueue = (event) => {
    if (event === undefined) {
      throw new TypeError("event is required");
    }
    if (queue.length >= maxSize) {
      throw new RangeError("input queue is full");
    }
    queue.push(event);
  };

  const drain = (count = queue.length) => {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("count must be a non-negative integer");
    }
    if (count === 0 || queue.length === 0) {
      return [];
    }
    const actual = Math.min(count, queue.length);
    return queue.splice(0, actual);
  };

  const size = () => queue.length;

  const clear = () => {
    queue.length = 0;
  };

  return {
    enqueue,
    drain,
    size,
    clear
  };
};
