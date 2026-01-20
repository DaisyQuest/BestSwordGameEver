const normalizeVec = (value, label) => {
  if (!value || typeof value !== "object") {
    throw new TypeError(`${label} must be an object`);
  }
  const { x, y } = value;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError(`${label} must have finite x/y`);
  }
  return { x, y };
};

export const createPhysicsWorld = ({ gravity = { x: 0, y: -9.8 }, maxSpeed = 20 } = {}) => {
  const resolvedGravity = normalizeVec(gravity, "gravity");
  if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) {
    throw new RangeError("maxSpeed must be a positive number");
  }

  const bodies = new Map();

  const createBody = ({ id, mass = 1, position = { x: 0, y: 0 }, velocity = { x: 0, y: 0 }, damping = 0.98 } = {}) => {
    if (typeof id !== "string" || id.length === 0) {
      throw new TypeError("body id must be a non-empty string");
    }
    if (bodies.has(id)) {
      throw new RangeError(`body '${id}' already exists`);
    }
    if (!Number.isFinite(mass) || mass <= 0) {
      throw new RangeError("mass must be a positive number");
    }
    if (!Number.isFinite(damping) || damping < 0 || damping > 1) {
      throw new RangeError("damping must be between 0 and 1");
    }

    const body = {
      id,
      mass,
      position: normalizeVec(position, "position"),
      velocity: normalizeVec(velocity, "velocity"),
      force: { x: 0, y: 0 },
      damping
    };

    bodies.set(id, body);
    return body;
  };

  const getBody = (id) => bodies.get(id) ?? null;

  const removeBody = (id) => bodies.delete(id);

  const applyForce = (id, force) => {
    const body = getBody(id);
    if (!body) {
      throw new RangeError(`body '${id}' not found`);
    }
    const resolved = normalizeVec(force, "force");
    body.force.x += resolved.x;
    body.force.y += resolved.y;
  };

  const step = (deltaMs) => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      throw new RangeError("deltaMs must be a positive number");
    }
    const dt = deltaMs / 1000;

    for (const body of bodies.values()) {
      const accel = {
        x: resolvedGravity.x + body.force.x / body.mass,
        y: resolvedGravity.y + body.force.y / body.mass
      };

      body.velocity.x += accel.x * dt;
      body.velocity.y += accel.y * dt;

      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        body.velocity.x *= scale;
        body.velocity.y *= scale;
      }

      body.velocity.x *= body.damping;
      body.velocity.y *= body.damping;

      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;

      body.force.x = 0;
      body.force.y = 0;
    }
  };

  const snapshot = () =>
    Array.from(bodies.values()).map((body) => ({
      id: body.id,
      mass: body.mass,
      position: { ...body.position },
      velocity: { ...body.velocity },
      damping: body.damping
    }));

  return {
    createBody,
    getBody,
    removeBody,
    applyForce,
    step,
    snapshot
  };
};
